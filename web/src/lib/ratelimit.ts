/**
 * Upstash-REST rate limiting + idempotency (§6.1 step 1) — plain fetch, no deps.
 *
 * Talks to Vercel KV / Upstash Redis over its REST pipeline endpoint using
 * KV_REST_API_URL + KV_REST_API_TOKEN. DEGRADE RULE: when the KV env is unset
 * — or Upstash itself errors / times out — every check FAILS OPEN (allows the
 * request). Rate limiting is defense-in-depth here; it must never take the
 * contact form down with it.
 *
 * Server-only. Never import from client components.
 */

type RedisCommand = (string | number)[];

interface UpstashResult {
  result?: unknown;
  error?: string;
}

const KV_TIMEOUT_MS = 3000;

function kvEnv(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL?.trim();
  const token = process.env.KV_REST_API_TOKEN?.trim();
  return url && token ? { url, token } : null;
}

/** True when a KV backend is configured (used only for logging/decisions). */
export function kvConfigured(): boolean {
  return kvEnv() !== null;
}

/**
 * Run a Redis command pipeline against the Upstash REST API.
 * Returns null when KV is unconfigured or the call fails (callers fail open).
 */
async function pipeline(commands: RedisCommand[]): Promise<UpstashResult[] | null> {
  const kv = kvEnv();
  if (!kv) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), KV_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${kv.url}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${kv.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(commands),
        cache: 'no-store',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return null;
    const json = (await res.json()) as unknown;
    return Array.isArray(json) ? (json as UpstashResult[]) : null;
  } catch {
    return null;
  }
}

/**
 * Sliding-window rate limit: `limit` events per `windowSec` for `key`.
 * Returns true when the request is ALLOWED. Fails open (true) when KV is
 * unconfigured or unreachable.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<boolean> {
  const now = Date.now();
  const windowStart = now - windowSec * 1000;
  const member = `${now}-${Math.random().toString(36).slice(2)}`;
  const redisKey = `rl:${key}`;

  const results = await pipeline([
    ['ZREMRANGEBYSCORE', redisKey, 0, windowStart],
    ['ZADD', redisKey, now, member],
    ['ZCARD', redisKey],
    ['PEXPIRE', redisKey, windowSec * 1000],
  ]);
  if (!results) return true; // degrade: no KV → allow

  const card = results[2]?.result;
  const count = typeof card === 'number' ? card : Number(card);
  if (!Number.isFinite(count)) return true;
  return count <= limit;
}

/**
 * One-shot claim (idempotency / Turnstile single-use): SET key NX EX ttl.
 * Returns true the FIRST time a key is seen, false on replay. Fails open
 * (true) when KV is unconfigured or unreachable.
 */
export async function claimOnce(key: string, ttlSec: number): Promise<boolean> {
  const results = await pipeline([['SET', `once:${key}`, '1', 'NX', 'EX', ttlSec]]);
  if (!results) return true; // degrade: no KV → treat as first
  const r = results[0];
  if (!r || r.error) return true;
  return r.result === 'OK'; // null result → key existed → replay
}
