/**
 * Google Sheets record of truth — service-account JWT signed with node:crypto
 * + plain fetch (no googleapis dependency).
 *
 * Server-only. Never import from client components (it handles the key).
 *
 * The band only makes a blank spreadsheet and shares it (Editor) with the
 * service account. On first use per server instance the code provisions two
 * tabs so contacts and signups are never mixed up:
 *
 *   "Messages"       Received | Name | Email | Subject | Message
 *   "Email signups"  Signed up | Name | Email | Where they live | Best meal |
 *                    Anything else | Mailing list
 *
 * Provisioning rules: an EMPTY default first tab ("Sheet1") is renamed to
 * "Messages" instead of being left behind; any other missing tab is added
 * ("already exists" from a concurrent instance counts as success). A tab with
 * an empty row 1 gets the header row; a row 1 with anything else in it is
 * never overwritten. New headers are made bold + frozen (best-effort).
 *
 * Every write uses valueInputOption=RAW, so a fan typing "=IMPORTXML(…)" is
 * stored as literal text and never evaluated (formula-injection safety).
 */

import { createSign } from 'node:crypto';
import type { ServerEnv } from '@/lib/env';
import type { SubmissionKind } from '@/lib/forms';

/** A deadline-bound fetch supplied by the caller (route owns the budget). */
export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

export interface SheetsConfig {
  sheetsId: string;
  email: string;
  /** PEM, already \n-un-escaped. */
  privateKey: string;
}

export function sheetsConfig(env: ServerEnv): SheetsConfig | null {
  if (
    !env.googleSheetsId ||
    !env.googleServiceAccountEmail ||
    !env.googleServiceAccountPrivateKey
  ) {
    return null;
  }
  return {
    sheetsId: env.googleSheetsId,
    email: env.googleServiceAccountEmail,
    // §6.1 footgun: the env value is \n-escaped PEM — un-escape at point of use.
    privateKey: env.googleServiceAccountPrivateKey.replace(/\\n/g, '\n'),
  };
}

/* ------------------------------------------------------------------ *
 * Tab layout
 * ------------------------------------------------------------------ */

interface TabSpec {
  title: string;
  header: readonly string[];
  /** Row cells, in header order, from the validated form values. */
  row: (stamp: string, v: Record<string, string>) => string[];
}

export const TABS: Record<SubmissionKind, TabSpec> = {
  contact: {
    title: 'Messages',
    header: ['Received', 'Name', 'Email', 'Subject', 'Message'],
    row: (t, v) => [t, v.name ?? '', v.email ?? '', v.subject ?? '', v.message ?? ''],
  },
  email: {
    title: 'Email signups',
    header: [
      'Signed up',
      'Name',
      'Email',
      'Where they live',
      'Best meal',
      'Anything else',
      'Mailing list',
    ],
    // "Mailing list" starts blank; setMailingListStatus fills it after Kit.
    row: (t, v) => [
      t,
      v.name ?? '',
      v.email ?? '',
      v.location ?? '',
      v.meal ?? '',
      v.message ?? '',
      '',
    ],
  },
};

/** "Mailing list" is this many columns right of the row's first cell (6 → "G"). */
const MAILING_LIST_OFFSET = TABS.email.header.length - 1;

/** The four values the "Mailing list" cell can hold. */
export const MAILING_LIST_STATUS = {
  confirmation_sent: 'Confirmation email sent',
  already_subscribed: 'Already subscribed',
  not_added: 'Not added — add by hand in Kit',
  not_connected: 'Kit not connected yet',
} as const;
export type MailingListStatus = (typeof MAILING_LIST_STATUS)[keyof typeof MAILING_LIST_STATUS];

const TIME_ZONE = 'America/New_York';
const stampFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/** "Nov 7, 2026, 2:58 PM ET" — the band's home time zone (EST/EDT both "ET"). */
export function formatStamp(date: Date = new Date()): string {
  // Newer ICU puts a narrow no-break space before AM/PM; normalise it.
  return `${stampFormat.format(date).replace(/[  ]/g, ' ')} ET`;
}

/* ------------------------------------------------------------------ *
 * Auth — service-account JWT → access token (cached per instance)
 * ------------------------------------------------------------------ */

const b64url = (input: Buffer | string): string =>
  (typeof input === 'string' ? Buffer.from(input) : input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function accessToken(cfg: SheetsConfig, call: Fetcher): Promise<string> {
  const cached = tokenCache.get(cfg.email);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const iat = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: cfg.email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      iat,
      exp: iat + 3600,
    }),
  );
  const unsigned = `${header}.${claims}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(cfg.privateKey);
  const jwt = `${unsigned}.${b64url(signature)}`;

  const res = await call('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`google token exchange ${res.status}`);
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error('google token exchange: no access_token');
  tokenCache.set(cfg.email, {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  });
  return data.access_token;
}

/* ------------------------------------------------------------------ *
 * Low-level Sheets REST helpers
 * ------------------------------------------------------------------ */

const API = 'https://sheets.googleapis.com/v4/spreadsheets';

/** A1 range on a named tab: 'Email signups'!A1 (single quotes doubled). */
const a1 = (title: string, range: string): string =>
  `'${title.replace(/'/g, "''")}'!${range}`;

class SheetsError extends Error {
  constructor(
    readonly step: string,
    readonly status: number,
    readonly detail: string,
  ) {
    super(`sheets ${step} ${status}${detail ? `: ${detail}` : ''}`);
  }
}

async function api<T>(
  cfg: SheetsConfig,
  call: Fetcher,
  step: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = await accessToken(cfg, call);
  const res = await call(`${API}/${encodeURIComponent(cfg.sheetsId)}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = ((await res.json()) as { error?: { message?: string } }).error?.message ?? '';
    } catch {
      // non-JSON error body
    }
    throw new SheetsError(step, res.status, detail);
  }
  return (await res.json()) as T;
}

interface SheetProps {
  sheetId: number;
  title: string;
  index: number;
}

async function listTabs(cfg: SheetsConfig, call: Fetcher): Promise<SheetProps[]> {
  const data = await api<{ sheets?: { properties?: SheetProps }[] }>(
    cfg,
    call,
    'read tabs',
    '?fields=sheets.properties(sheetId,title,index)',
  );
  return (data.sheets ?? [])
    .map((s) => s.properties)
    .filter((p): p is SheetProps => !!p && typeof p.title === 'string')
    .sort((a, b) => a.index - b.index);
}

const hasValues = (rows: unknown): boolean =>
  Array.isArray(rows) &&
  rows.some((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== ''));

/* ------------------------------------------------------------------ *
 * Provisioning — lazy, cached per instance (success only), concurrency-safe
 * ------------------------------------------------------------------ */

const provisionCache = new Map<string, Promise<void>>();

/**
 * Two instances adding the same tab at the same moment don't get "already
 * exists": Google keeps both and renames the loser "Email signups_conflict123…"
 * (observed against the real API). Nothing ever writes to such a tab (all
 * writes go by exact title), so delete any EMPTY one. Best-effort.
 */
async function removeConflictTabs(
  cfg: SheetsConfig,
  call: Fetcher,
  tabs: SheetProps[],
): Promise<void> {
  const ours = [TABS.contact.title, TABS.email.title];
  const conflicts = tabs.filter((t) =>
    ours.some((title) => t.title.startsWith(`${title}_conflict`) && /_conflict\d+$/.test(t.title)),
  );
  for (const t of conflicts) {
    try {
      const v = await api<{ values?: unknown }>(
        cfg,
        call,
        'read conflict tab',
        `/values/${encodeURIComponent(a1(t.title, 'A1:Z100'))}`,
      );
      if (hasValues(v.values)) continue;
      await api(cfg, call, 'delete conflict tab', ':batchUpdate', {
        method: 'POST',
        body: { requests: [{ deleteSheet: { sheetId: t.sheetId } }] },
      });
    } catch {
      // the other instance deleted it first, or it's just left behind (harmless)
    }
  }
}

async function provision(cfg: SheetsConfig, call: Fetcher): Promise<void> {
  const wanted = [TABS.contact, TABS.email];
  let tabs = await listTabs(cfg, call);
  const has = (title: string) => tabs.some((t) => t.title === title);

  /* 1. make sure both tabs exist */
  if (!wanted.every((w) => has(w.title))) {
    const requests: unknown[] = [];
    const first = tabs[0];
    let renamed = false;
    if (first && !has(TABS.contact.title) && /^sheet\s?1$/i.test(first.title)) {
      let empty = false;
      try {
        const v = await api<{ values?: unknown }>(
          cfg,
          call,
          'read default tab',
          `/values/${encodeURIComponent(a1(first.title, 'A1:Z100'))}`,
        );
        empty = !hasValues(v.values);
      } catch (err) {
        // 400 = a concurrent instance already renamed it → just add tabs below.
        if (!(err instanceof SheetsError) || err.status !== 400) throw err;
      }
      if (empty) {
        requests.push({
          updateSheetProperties: {
            properties: { sheetId: first.sheetId, title: TABS.contact.title },
            fields: 'title',
          },
        });
        renamed = true;
      }
    }
    for (const w of wanted) {
      if (has(w.title) || (renamed && w === TABS.contact)) continue;
      requests.push({ addSheet: { properties: { title: w.title } } });
    }
    try {
      await api(cfg, call, 'create tabs', ':batchUpdate', { method: 'POST', body: { requests } });
    } catch (err) {
      // A concurrent instance may have created/renamed them first ("already
      // exists" fails the whole atomic batch) — re-read and accept if present.
      if (!(err instanceof SheetsError) || err.status !== 400) throw err;
    }
    tabs = await listTabs(cfg, call);
    await removeConflictTabs(cfg, call, tabs);
    const missing = wanted.filter((w) => !has(w.title));
    if (missing.length) {
      throw new Error(`sheets: tabs still missing: ${missing.map((m) => m.title).join(', ')}`);
    }
  }

  /* 2. header rows — only into an EMPTY row 1, never over other content */
  const query = wanted
    .map((w) => `ranges=${encodeURIComponent(a1(w.title, '1:1'))}`)
    .join('&');
  const got = await api<{ valueRanges?: { values?: unknown }[] }>(
    cfg,
    call,
    'read headers',
    `/values:batchGet?${query}`,
  );
  const needHeader = wanted.filter((_, i) => !hasValues(got.valueRanges?.[i]?.values));
  if (!needHeader.length) return;

  await api(cfg, call, 'write headers', '/values:batchUpdate', {
    method: 'POST',
    body: {
      valueInputOption: 'RAW',
      data: needHeader.map((w) => ({
        range: a1(w.title, `A1:${String.fromCharCode(64 + w.header.length)}1`),
        values: [w.header],
      })),
    },
  });

  /* 3. bold + frozen header — cosmetic, never fails provisioning */
  try {
    const requests = needHeader.flatMap((w) => {
      const sheetId = tabs.find((t) => t.title === w.title)?.sheetId;
      if (sheetId === undefined) return [];
      return [
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true } } },
            fields: 'userEnteredFormat.textFormat.bold',
          },
        },
        {
          updateSheetProperties: {
            properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
            fields: 'gridProperties.frozenRowCount',
          },
        },
      ];
    });
    if (requests.length) {
      await api(cfg, call, 'style headers', ':batchUpdate', { method: 'POST', body: { requests } });
    }
  } catch (err) {
    console.warn(`[sheets] header styling skipped: ${err instanceof Error ? err.message : err}`);
  }
}

/** Run provisioning once per instance; concurrent callers share one run. */
function ensureTabs(cfg: SheetsConfig, call: Fetcher): Promise<void> {
  let pending = provisionCache.get(cfg.sheetsId);
  if (!pending) {
    pending = provision(cfg, call);
    provisionCache.set(cfg.sheetsId, pending);
    pending.catch(() => {
      if (provisionCache.get(cfg.sheetsId) === pending) provisionCache.delete(cfg.sheetsId);
    });
  }
  return pending;
}

/** Test hook: forget cached tokens + provisioning. */
export function resetSheetsCache(): void {
  provisionCache.clear();
  tokenCache.clear();
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

/** Where an appended row landed, for a later best-effort cell update. */
export interface SheetRowRef {
  title: string;
  row: number;
  /** 1-based column the appended row starts in (normally 1 = "A"). */
  startColumn: number;
}

async function appendOnce(
  cfg: SheetsConfig,
  call: Fetcher,
  tab: TabSpec,
  cells: string[],
): Promise<SheetRowRef | null> {
  const data = await api<{ updates?: { updatedRange?: string } }>(
    cfg,
    call,
    'append',
    `/values/${encodeURIComponent(a1(tab.title, 'A1'))}:append` +
      '?valueInputOption=RAW&insertDataOption=INSERT_ROWS',
    { method: 'POST', body: { values: [cells] } },
  );
  // e.g. "'Email signups'!A5:G5" → row 5, starting column A. Google appends
  // at the detected table's first column, which isn't always A (e.g. the band
  // inserted a column on the left), so keep the start column too.
  const m = data.updates?.updatedRange?.match(/!([A-Z]+)(\d+)/);
  return m ? { title: tab.title, row: Number(m[2]), startColumn: colIndex(m[1]!) } : null;
}

/** "A" → 1, "Z" → 26, "AA" → 27. */
function colIndex(letters: string): number {
  return [...letters].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0);
}

/** 1 → "A", 27 → "AA". */
function colLetters(index: number): string {
  let s = '';
  for (let n = index; n > 0; n = Math.floor((n - 1) / 26)) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  }
  return s;
}

/**
 * Append one row to the tab for `kind`. THROWS on failure — the caller turns
 * that into a 502 (record of truth). Returns where the row landed (or null if
 * Google didn't say).
 */
export async function appendSubmission(
  cfg: SheetsConfig,
  kind: SubmissionKind,
  values: Record<string, string>,
  call: Fetcher,
  now: Date = new Date(),
): Promise<SheetRowRef | null> {
  const tab = TABS[kind];
  const cells = tab.row(formatStamp(now), values);
  const wasCached = provisionCache.has(cfg.sheetsId);
  await ensureTabs(cfg, call);
  try {
    return await appendOnce(cfg, call, tab, cells);
  } catch (err) {
    // A tab renamed/deleted after this instance provisioned → re-provision
    // once and retry (400 = "Unable to parse range").
    provisionCache.delete(cfg.sheetsId);
    if (!wasCached || !(err instanceof SheetsError) || err.status !== 400) throw err;
    await ensureTabs(cfg, call);
    return appendOnce(cfg, call, tab, cells);
  }
}

/** Fill the signup row's "Mailing list" cell. Best-effort: never throws. */
export async function setMailingListStatus(
  cfg: SheetsConfig,
  ref: SheetRowRef,
  status: MailingListStatus,
  call: Fetcher,
): Promise<void> {
  try {
    // "Mailing list" is the last cell of the row we appended.
    const column = colLetters(ref.startColumn + MAILING_LIST_OFFSET);
    const range = a1(ref.title, `${column}${ref.row}`);
    await api(
      cfg,
      call,
      'mailing-list cell',
      `/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
      { method: 'PUT', body: { range, values: [[status]] } },
    );
  } catch (err) {
    console.warn(`[sheets] mailing-list cell not updated: ${err instanceof Error ? err.message : err}`);
  }
}
