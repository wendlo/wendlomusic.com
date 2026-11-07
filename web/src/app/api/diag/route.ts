/**
 * GET /api/diag — TEMPORARY launch diagnostics for the form pipeline.
 *
 * Answers "why does the form fail?" without anyone opening Vercel logs.
 * Requires header `x-wendlo-diag: <SANITY_REVALIDATE_SECRET>`; anything else
 * gets a bare 404. The response holds NO secret values and NO personal data:
 * only whether each setting is present, the private key's SHAPE, and the
 * status codes / error codes the real services return.
 */

import { createPrivateKey, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { serverEnv, turnstileSiteKey, DEFAULT_TURNSTILE_SITE_KEY } from '@/lib/env';
import { sheetsConfig } from '@/lib/sheets';
import { kitConfig, resolveFormId } from '@/lib/kit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const notFound = () => new NextResponse('Not Found', { status: 404 });

function authorised(req: NextRequest): boolean {
  const want = serverEnv().sanityRevalidateSecret;
  const got = req.headers.get('x-wendlo-diag');
  if (!want || !got) return false;
  const a = Buffer.from(want);
  const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function timed(url: string, init: RequestInit = {}, ms = 8000): Promise<Response> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: c.signal, cache: 'no-store' });
  } finally {
    clearTimeout(t);
  }
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 200);

export async function GET(req: NextRequest) {
  if (!authorised(req)) return notFound();
  const env = serverEnv();
  const out: Record<string, unknown> = { at: new Date().toISOString() };

  /* ---- settings present? (booleans / shapes only) ---- */
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? '';
  const OTHER_VARS = ['NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY', 'GOOGLE_SHEETS_ID', 'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'KIT_API_KEY'];
  const cfg = sheetsConfig(env);
  const pem = cfg?.privateKey ?? '';
  const footer = '-----END PRIVATE KEY-----';
  let parses: string = 'n/a';
  if (pem) {
    try {
      createPrivateKey(pem);
      parses = 'ok';
    } catch (e) {
      parses = `error: ${errText(e)}`;
    }
  }
  out.settings = {
    GOOGLE_SHEETS_ID: env.googleSheetsId ? `set (${env.googleSheetsId.length} chars, ends …${env.googleSheetsId.slice(-4)})` : 'MISSING',
    GOOGLE_SERVICE_ACCOUNT_EMAIL: env.googleServiceAccountEmail ?? 'MISSING',
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: raw
      ? {
          rawLength: raw.length,
          rawWrappedInQuotes: /^\s*["']/.test(raw) && /["']\s*$/.test(raw),
          rawHasLiteralBackslashN: raw.includes('\\n'),
          rawHasRealLineBreaks: /\r?\n/.test(raw),
          rawContainsOtherSettingNames: OTHER_VARS.filter((n) => raw.includes(n)),
          startsWithBeginLine: pem.trimStart().startsWith('-----BEGIN PRIVATE KEY-----'),
          hasEndLine: pem.includes(footer),
          charsAfterEndLine: pem.includes(footer) ? pem.slice(pem.indexOf(footer) + footer.length).trim().length : null,
          parsesAsPrivateKey: parses,
        }
      : 'MISSING',
    TURNSTILE_SECRET_KEY: env.turnstileSecretKey ? `set (${env.turnstileSecretKey.length} chars)` : 'MISSING',
    turnstileSiteKeyUsed: (() => {
      const k = turnstileSiteKey();
      if (!k) return 'none';
      return k === DEFAULT_TURNSTILE_SITE_KEY && !process.env['NEXT_PUBLIC_TURNSTILE_SITE_KEY'.toString()]
        ? 'built-in default'
        : 'from NEXT_PUBLIC_TURNSTILE_SITE_KEY';
    })(),
    KIT_API_KEY: env.kitApiKey ? `set (${env.kitApiKey.length} chars)` : 'MISSING',
    KIT_FORM_ID: env.kitFormId ? 'set' : 'not set (looked up by name)',
    KV: (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) && (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN) ? 'set' : 'MISSING',
    RESEND: env.emailProviderApiKey ? 'set' : 'not set (optional)',
  };

  /* ---- Google: token + sheet access (the form's record of truth) ---- */
  if (cfg && parses === 'ok') {
    const g: Record<string, unknown> = {};
    try {
      const { createSign } = await import('node:crypto');
      const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64url');
      const iat = Math.floor(Date.now() / 1000);
      const unsigned = `${b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64(JSON.stringify({ iss: cfg.email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 600 }))}`;
      const jwt = `${unsigned}.${b64(createSign('RSA-SHA256').update(unsigned).sign(cfg.privateKey))}`;
      const tr = await timed('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }) });
      const tj = (await tr.json().catch(() => ({}))) as { access_token?: string; error?: string; error_description?: string };
      g.tokenExchange = tr.ok && tj.access_token ? 'ok' : `${tr.status} ${tj.error ?? ''} ${tj.error_description ?? ''}`.trim();
      if (tj.access_token) {
        const sr = await timed(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(cfg.sheetsId)}?fields=sheets.properties.title`, { headers: { authorization: `Bearer ${tj.access_token}` } });
        const sj = (await sr.json().catch(() => ({}))) as { sheets?: { properties: { title: string } }[]; error?: { message?: string; status?: string } };
        g.sheetRead = sr.ok ? `ok (${sj.sheets?.length ?? 0} tabs)` : `${sr.status} ${sj.error?.status ?? ''}: ${(sj.error?.message ?? '').slice(0, 160)}`;
      }
    } catch (e) {
      g.error = errText(e);
    }
    out.google = g;
  } else {
    out.google = cfg ? 'skipped: private key does not parse' : 'skipped: Sheets settings incomplete';
  }

  /* ---- Turnstile: is the SECRET valid? (dummy token) ---- */
  if (env.turnstileSecretKey) {
    try {
      const r = await timed('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: new URLSearchParams({ secret: env.turnstileSecretKey, response: 'wendlo-diag-dummy' }) });
      const j = (await r.json().catch(() => ({}))) as { 'error-codes'?: string[] };
      const codes = j['error-codes'] ?? [];
      out.turnstile = { errorCodes: codes, verdict: codes.includes('invalid-input-secret') ? 'SECRET IS WRONG' : codes.includes('invalid-input-response') ? 'secret ok (dummy token rejected as expected)' : 'unclear' };
    } catch (e) {
      out.turnstile = { error: errText(e) };
    }
  }

  /* ---- Kit ---- */
  const kit = kitConfig(env);
  if (kit) {
    try {
      const r = await timed('https://api.kit.com/v4/account', { headers: { 'X-Kit-Api-Key': kit.apiKey, Accept: 'application/json' } });
      const formId = await resolveFormId(kit, (u, i) => timed(u, i));
      out.kit = { account: r.status === 200 ? 'ok' : `HTTP ${r.status}`, websiteSignupsForm: formId ? 'found' : 'NOT FOUND' };
    } catch (e) {
      out.kit = { error: errText(e) };
    }
  }

  /* ---- KV (rate limiting) ---- */
  const kvUrl = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').trim().replace(/^['"]+|['"]+$/g, '');
  const kvTok = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '').trim().replace(/^['"]+|['"]+$/g, '');
  if (kvUrl && kvTok) {
    try {
      const r = await timed(`${kvUrl}/ping`, { headers: { authorization: `Bearer ${kvTok}` } }, 4000);
      out.kv = r.ok ? 'ok' : `HTTP ${r.status}`;
    } catch (e) {
      out.kv = { error: errText(e) };
    }
  }

  return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } });
}
