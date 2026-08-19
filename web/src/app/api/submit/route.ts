/**
 * POST /api/submit — the contact + email form pipeline (MIGRATION-PLAN §6.1).
 *
 * Pipeline IN ORDER (record-of-truth must not be lost):
 *   a. Rate-limit (per-IP + per-email sliding window) + idempotency + Turnstile
 *      token single-use — all via Vercel KV / Upstash REST; SKIPPED (allow)
 *      when KV env is unset.
 *   b. Cloudflare Turnstile siteverify — SKIPPED when TURNSTILE_SECRET_KEY is
 *      unset; fail → 400, nothing else runs.
 *   c. Field validation (name + email required, email regex) + honeypot reject.
 *   d. Google Sheets append (service-account JWT signed with node:crypto — no
 *      googleapis dep). RECORD OF TRUTH: configured + fails → 502.
 *   e. Mailchimp upsert status 'pending' (email kind only) — skipped when
 *      Mailchimp env is unset.
 *   f. Notify email via Resend — best-effort, never fails the request.
 *
 * DEGRADE RULE: when NO storage backend applies to this submission (no Sheets,
 * no Mailchimp [email kind], no per-kind webhook from Sanity connections) →
 * 503 { ok:false, reason:'unconfigured' } so the client shows the
 * booking-email fallback. Nothing here may throw out of POST, and the whole
 * request works with ZERO env configured (it degrades to the 503).
 */

import { createHash, createSign } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { serverEnv, type ServerEnv } from '@/lib/env';
import { getSiteContent } from '@/lib/content';
import {
  HONEYPOT_FIELD,
  SHEET_COLUMNS,
  validateSubmission,
  type SubmissionKind,
  type SubmitResponseBody,
} from '@/lib/forms';
import { claimOnce, rateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';

/** Total request budget (§6.1: 15s). */
const TOTAL_BUDGET_MS = 15_000;
/** Per-upstream-call cap inside the budget. */
const CALL_CAP_MS = 8_000;

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

function json(body: SubmitResponseBody, status: number): NextResponse {
  return NextResponse.json(body, { status });
}

/** fetch with a deadline-aware timeout; throws on abort like fetch does. */
async function timedFetch(
  url: string,
  init: RequestInit,
  deadline: number,
): Promise<Response> {
  const remaining = Math.min(CALL_CAP_MS, deadline - Date.now());
  if (remaining <= 0) throw new Error('budget exhausted');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), remaining);
  try {
    return await fetch(url, { ...init, cache: 'no-store', signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');
const md5 = (s: string): string => createHash('md5').update(s).digest('hex');

const b64url = (input: Buffer | string): string =>
  (typeof input === 'string' ? Buffer.from(input) : input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/* ------------------------------------------------------------------ *
 * (b) Turnstile
 * ------------------------------------------------------------------ */

async function verifyTurnstile(
  secret: string,
  token: string,
  ip: string,
  deadline: number,
): Promise<boolean> {
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== 'unknown') body.set('remoteip', ip);
    const res = await timedFetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      { method: 'POST', body },
      deadline,
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * (d) Google Sheets append — service-account JWT via node:crypto
 * ------------------------------------------------------------------ */

interface SheetsConfig {
  sheetsId: string;
  email: string;
  /** PEM, already \n-un-escaped. */
  privateKey: string;
}

function sheetsConfig(env: ServerEnv): SheetsConfig | null {
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

/** Sign a service-account JWT and exchange it for an OAuth access token. */
async function googleAccessToken(cfg: SheetsConfig, deadline: number): Promise<string> {
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

  const res = await timedFetch(
    'https://oauth2.googleapis.com/token',
    {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    },
    deadline,
  );
  if (!res.ok) throw new Error(`google token exchange ${res.status}`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error('google token exchange: no access_token');
  return data.access_token;
}

/** Append one timestamped row of ALL fields. Throws on any failure (→ 502). */
async function appendToSheet(
  cfg: SheetsConfig,
  kind: SubmissionKind,
  values: Record<string, string>,
  deadline: number,
): Promise<void> {
  const token = await googleAccessToken(cfg, deadline);
  const row: string[] = [
    new Date().toISOString(),
    kind,
    ...SHEET_COLUMNS.map((k) => values[k] ?? ''),
  ];
  const res = await timedFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      cfg.sheetsId,
    )}/values/${encodeURIComponent('A1')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [row] }),
    },
    deadline,
  );
  if (!res.ok) throw new Error(`sheets append ${res.status}`);
}

/* ------------------------------------------------------------------ *
 * (e) Mailchimp upsert (email kind only)
 * ------------------------------------------------------------------ */

interface MailchimpConfig {
  apiKey: string;
  serverPrefix: string;
  audienceId: string;
}

function mailchimpConfig(env: ServerEnv): MailchimpConfig | null {
  if (!env.mailchimpApiKey || !env.mailchimpServerPrefix || !env.mailchimpAudienceId) {
    return null;
  }
  return {
    apiKey: env.mailchimpApiKey,
    serverPrefix: env.mailchimpServerPrefix,
    audienceId: env.mailchimpAudienceId,
  };
}

/** Upsert the member as 'pending' (double opt-in). Returns success. */
async function mailchimpUpsert(
  cfg: MailchimpConfig,
  values: Record<string, string>,
  deadline: number,
): Promise<boolean> {
  try {
    const email = values.email ?? '';
    const hash = md5(email.toLowerCase());
    const mergeFields: Record<string, string> = {};
    if (values.name) mergeFields.FNAME = values.name;
    if (values.location) mergeFields.LOCATION = values.location;
    if (values.meal) mergeFields.MEAL = values.meal;

    const res = await timedFetch(
      `https://${cfg.serverPrefix}.api.mailchimp.com/3.0/lists/${cfg.audienceId}/members/${hash}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Basic ${Buffer.from(`anystring:${cfg.apiKey}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email_address: email,
          status_if_new: 'pending',
          merge_fields: mergeFields,
        }),
      },
      deadline,
    );
    return res.ok;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * Webhook storage fallback (Sanity connections.emailWebhookUrl/contactWebhookUrl)
 * ------------------------------------------------------------------ */

async function postWebhook(
  url: string,
  kind: SubmissionKind,
  values: Record<string, string>,
  deadline: number,
): Promise<boolean> {
  try {
    const res = await timedFetch(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, values, submittedAt: new Date().toISOString() }),
      },
      deadline,
    );
    return res.ok;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * (f) Notify email via Resend — best-effort
 * ------------------------------------------------------------------ */

async function sendNotifyEmail(
  env: ServerEnv,
  kind: SubmissionKind,
  values: Record<string, string>,
  deadline: number,
): Promise<void> {
  if (!env.emailProviderApiKey || !env.notifyEmailTo || !env.notifyEmailFrom) return;
  try {
    const lines = SHEET_COLUMNS.filter((k) => values[k]).map(
      (k) => `${k}: ${values[k]}`,
    );
    await timedFetch(
      'https://api.resend.com/emails',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.emailProviderApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: env.notifyEmailFrom,
          to: [env.notifyEmailTo],
          reply_to: values.email,
          subject: `Wendlo ${kind === 'email' ? 'email list signup' : 'message'} — ${values.name ?? ''}`,
          text: `New ${kind} submission from wendlomusic.com\n\n${lines.join('\n')}\n`,
        }),
      },
      deadline,
    );
  } catch {
    // best-effort: never fails the request
  }
}

/* ------------------------------------------------------------------ *
 * POST handler
 * ------------------------------------------------------------------ */

export async function POST(req: NextRequest): Promise<NextResponse> {
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  try {
    /* ---- parse ---- */
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ ok: false, reason: 'invalid' }, 400);
    }
    const kind: SubmissionKind = body.kind === 'email' ? 'email' : 'contact';
    const rawValues =
      body.values && typeof body.values === 'object'
        ? (body.values as Record<string, unknown>)
        : {};
    const successText =
      typeof body.successText === 'string' ? body.successText.slice(0, 500) : undefined;
    const turnstileToken =
      typeof body.turnstileToken === 'string' ? body.turnstileToken : '';
    const honeypot = typeof body[HONEYPOT_FIELD] === 'string' ? body[HONEYPOT_FIELD] : '';
    const emailValue = typeof rawValues.email === 'string' ? rawValues.email.trim() : '';
    const ip = clientIp(req);
    const env = serverEnv();

    /* ---- (a) rate-limit + idempotency (no-op allow when KV unset) ---- */
    const ipAllowed = await rateLimit(`ip:${ip}`, 8, 600); // 8 / 10 min / IP
    if (!ipAllowed) return json({ ok: false, reason: 'rate_limited' }, 429);
    if (emailValue) {
      const emailAllowed = await rateLimit(
        `email:${sha256(emailValue.toLowerCase())}`,
        4,
        3600, // 4 / hour / email
      );
      if (!emailAllowed) return json({ ok: false, reason: 'rate_limited' }, 429);
    }
    // Idempotency: an identical retried/replayed submission is a no-op success.
    const idemKey = sha256(`${kind}:${JSON.stringify(rawValues)}`);
    const firstTime = await claimOnce(`idem:${idemKey}`, 600);
    if (!firstTime) return json({ ok: true, successText }, 200);

    /* ---- (b) Turnstile (skip when secret unset) ---- */
    if (env.turnstileSecretKey) {
      if (!turnstileToken) return json({ ok: false, reason: 'turnstile' }, 400);
      // Enforce token single-use server-side (skip silently when KV unset).
      const fresh = await claimOnce(`turnstile:${sha256(turnstileToken)}`, 300);
      if (!fresh) return json({ ok: false, reason: 'turnstile' }, 400);
      const passed = await verifyTurnstile(
        env.turnstileSecretKey,
        turnstileToken,
        ip,
        deadline,
      );
      if (!passed) return json({ ok: false, reason: 'turnstile' }, 400);
    }

    /* ---- (c) validate + honeypot ---- */
    if (honeypot) return json({ ok: false, reason: 'invalid' }, 400);
    const validated = validateSubmission(kind, rawValues);
    if (!validated.ok) {
      return json({ ok: false, reason: 'invalid', fields: validated.fields }, 400);
    }
    const values = validated.values;

    /* ---- resolve which storage backends apply to THIS submission ---- */
    const sheets = sheetsConfig(env);
    const mailchimp = kind === 'email' ? mailchimpConfig(env) : null;
    let webhookUrl = '';
    try {
      const content = await getSiteContent();
      const conn = content.settings.connections;
      webhookUrl =
        (kind === 'email' ? conn.emailWebhookUrl : conn.contactWebhookUrl)?.trim() ?? '';
    } catch {
      webhookUrl = ''; // content resolution must never take the pipeline down
    }

    // DEGRADE RULE: no storage backend at all → 503 'unconfigured' so the
    // client shows the booking-email fallback instead of a fake success.
    if (!sheets && !mailchimp && !webhookUrl) {
      return json({ ok: false, reason: 'unconfigured' }, 503);
    }

    /* ---- (d) Google Sheets — record of truth: configured + failed → 502 ---- */
    let recorded = false;
    if (sheets) {
      try {
        await appendToSheet(sheets, kind, values, deadline);
        recorded = true;
      } catch {
        return json({ ok: false, reason: 'storage' }, 502);
      }
    }

    /* ---- webhook fallback (per-kind, from Sanity connections) ---- */
    if (webhookUrl) {
      const ok = await postWebhook(webhookUrl, kind, values, deadline);
      recorded = recorded || ok;
      // Webhook as the ONLY backend must not silently drop the submission.
      if (!ok && !sheets && !mailchimp) {
        return json({ ok: false, reason: 'storage' }, 502);
      }
    }

    /* ---- (e) Mailchimp upsert — email kind only ---- */
    if (mailchimp) {
      const ok = await mailchimpUpsert(mailchimp, values, deadline);
      // Mailchimp as the ONLY backend that recorded nothing → loud failure.
      if (!ok && !recorded) {
        return json({ ok: false, reason: 'storage' }, 502);
      }
      recorded = recorded || ok;
    }

    /* ---- (f) notify email — best-effort, never fails the request ---- */
    await sendNotifyEmail(env, kind, values, deadline);

    return json({ ok: true, successText }, 200);
  } catch {
    // ABSOLUTE: no throw escapes the handler.
    return json({ ok: false, reason: 'error' }, 500);
  }
}
