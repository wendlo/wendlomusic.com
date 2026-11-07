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
 *   d. Google Sheets append (src/lib/sheets.ts) — contacts go to the
 *      "Messages" tab, signups to "Email signups" (tabs + headers created on
 *      first use). RECORD OF TRUTH: configured + fails → 502.
 *   e. Kit signup (src/lib/kit.ts, email kind only): single opt-in — upsert
 *      the subscriber as ACTIVE (on the list at once, no email) and add them
 *      to the "Website signups" form. Skipped when Kit env is unset. Then the
 *      signup row's "Mailing list" cell is filled in (best-effort).
 *   f. Notify email via Resend — best-effort, never fails the request.
 *
 * DEGRADE RULE: when NO storage backend applies to this submission (no Sheets,
 * no Kit [email kind], no per-kind webhook from Sanity connections) →
 * 503 { ok:false, reason:'unconfigured' } so the client shows the
 * booking-email fallback. Nothing here may throw out of POST, and the whole
 * request works with ZERO env configured (it degrades to the 503).
 */

import { createHash } from 'node:crypto';
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
import { claimOnce, rateLimit, releaseClaim } from '@/lib/ratelimit';
import { kitConfig, kitSubscribe, type KitOutcome } from '@/lib/kit';
import {
  appendSubmission,
  MAILING_LIST_STATUS,
  setMailingListStatus,
  sheetsConfig,
  type SheetRowRef,
} from '@/lib/sheets';

export const runtime = 'nodejs';

/** Total request budget (§6.1: 15s). */
const TOTAL_BUDGET_MS = 15_000;
/** Per-upstream-call cap inside the budget. */
const CALL_CAP_MS = 8_000;
/**
 * Budget held back from the Kit step so the best-effort "Mailing list" cell
 * update (and notify email) still get a chance before the 15s deadline.
 */
const AFTER_KIT_RESERVE_MS = 2_500;

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
    const res = await fetch(url, { ...init, cache: 'no-store', signal: controller.signal });
    // Read the body while the abort timer is still armed: a server that sends
    // headers and then stalls the body must not outlive the budget.
    const buf = await res.arrayBuffer();
    const nullBody = [101, 204, 205, 304].includes(res.status);
    return new Response(nullBody ? null : buf, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
  } finally {
    clearTimeout(timer);
  }
}

const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

/** The page the form was submitted from, if the browser sent a sane Referer. */
function referrerOf(req: NextRequest): string | undefined {
  const ref = req.headers.get('referer');
  if (!ref || ref.length > 500) return undefined;
  try {
    const u = new URL(ref);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

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
  mailingList?: string,
): Promise<void> {
  if (!env.emailProviderApiKey || !env.notifyEmailTo || !env.notifyEmailFrom) return;
  try {
    const lines = SHEET_COLUMNS.filter((k) => values[k]).map(
      (k) => `${k}: ${values[k]}`,
    );
    if (mailingList) lines.push(`mailing list: ${mailingList}`);
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
  const ctx: { idemKey?: string } = {};
  const res = await handle(req, ctx);
  // The idempotency claim marks a submission as DONE. If it wasn't (Turnstile
  // 400, storage 502, …) release it so the fan's retry with the same values is
  // actually processed instead of being swallowed as a no-op 200.
  if (ctx.idemKey && res.status !== 200) await releaseClaim(ctx.idemKey);
  return res;
}

async function handle(req: NextRequest, ctx: { idemKey?: string }): Promise<NextResponse> {
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
    ctx.idemKey = `idem:${idemKey}`;

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
    const kit = kind === 'email' ? kitConfig(env) : null;
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
    if (!sheets && !kit && !webhookUrl) {
      return json({ ok: false, reason: 'unconfigured' }, 503);
    }

    /* ---- (d) Google Sheets — record of truth: configured + failed → 502 ---- */
    const call = (url: string, init: RequestInit) => timedFetch(url, init, deadline);
    let recorded = false;
    let sheetRow: SheetRowRef | null = null;
    if (sheets) {
      try {
        sheetRow = await appendSubmission(sheets, kind, values, call);
        recorded = true;
      } catch (err) {
        console.error(`[submit] sheets append failed: ${err instanceof Error ? err.message : err}`);
        return json({ ok: false, reason: 'storage' }, 502);
      }
    }

    /* ---- webhook fallback (per-kind, from Sanity connections) ---- */
    if (webhookUrl) {
      const ok = await postWebhook(webhookUrl, kind, values, deadline);
      recorded = recorded || ok;
      // Webhook as the ONLY backend must not silently drop the submission.
      if (!ok && !sheets && !kit) {
        return json({ ok: false, reason: 'storage' }, 502);
      }
    }

    /* ---- (e) Kit signup — email kind only ---- */
    let mailingList: string | undefined;
    if (kind === 'email') {
      let outcome: KitOutcome | 'not_connected' = 'not_connected';
      if (kit) {
        const kitCall = (url: string, init: RequestInit) =>
          timedFetch(url, init, deadline - AFTER_KIT_RESERVE_MS);
        const result = await kitSubscribe(
          kit,
          {
            email: values.email,
            name: values.name,
            location: values.location,
            meal: values.meal,
            referrer: referrerOf(req),
          },
          kitCall,
        );
        // Kit as the ONLY backend that recorded nothing → loud failure.
        if (!result.ok && !recorded) {
          return json({ ok: false, reason: 'storage' }, 502);
        }
        outcome = result.outcome;
      }
      const status = MAILING_LIST_STATUS[outcome];
      mailingList = status;
      // Best-effort: fill the signup row's "Mailing list" cell.
      if (sheets && sheetRow) await setMailingListStatus(sheets, sheetRow, status, call);
    }

    /* ---- (f) notify email — best-effort, never fails the request ---- */
    await sendNotifyEmail(env, kind, values, deadline, mailingList);

    return json({ ok: true, successText }, 200);
  } catch {
    // ABSOLUTE: no throw escapes the handler.
    return json({ ok: false, reason: 'error' }, 500);
  }
}
