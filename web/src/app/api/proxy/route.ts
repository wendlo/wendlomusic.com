/**
 * §6.2 /api/proxy — hardened smart-link fetcher for the Studio music importer.
 *
 * GET /api/proxy?url=https://distrokid.com/hyperfollow/…
 *
 * Security posture:
 * - Same-origin gate: requires the `x-wendlo-import: 1` header, and when a
 *   Referer/Origin header is present it must be our own host. Browsers always
 *   send Origin/Referer on same-origin fetches from the Studio, and a foreign
 *   site cannot attach the custom header cross-origin without a CORS preflight
 *   (which we never answer), so this route is unusable as an open proxy.
 * - https-only, default port only, no credentials in the URL.
 * - STRICT host allowlist, sourced from PROXY_ALLOWED_HOSTS (comma list) with a
 *   code default. Match: host === entry OR host.endsWith('.' + entry).
 * - SSRF/DNS-rebinding guard: every hop's hostname is resolved via
 *   node:dns/promises and ALL resolved addresses must be public (loopback,
 *   RFC1918, link-local/metadata, ULA, etc. are rejected). The first validated
 *   address is then PINNED for the actual connection via a custom undici Agent
 *   lookup, so the fetched socket cannot re-resolve to a different IP.
 * - redirect:'manual' loop, max 5 hops, re-validating every Location target
 *   (scheme + allowlist + DNS) before following. Rejected hops are logged with
 *   console.warn so the allowlist can be widened without guesswork.
 * - 3MB response cap enforced with a reader loop; 12s total AbortController.
 * - Responds text/plain, Cache-Control: no-store. The upstream Content-Type is
 *   echoed in `x-upstream-content-type` (the importer also pulls og:image
 *   bytes through this proxy).
 *
 * INVARIANT: never crashes without env — PROXY_ALLOWED_HOSTS is optional and
 * everything is evaluated per-request.
 */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { NextRequest, NextResponse } from 'next/server';
import { Agent, fetch as undiciFetch } from 'undici';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_ALLOWED_HOSTS =
  'distrokid.com,hyperfollow.com,tunecore.com,ffm.to,lnk.to';

const MAX_HOPS = 5;
const MAX_BYTES = 3 * 1024 * 1024; // 3MB
const TIMEOUT_MS = 12_000;

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** Parse the allowlist (env is the single source of truth; code default). */
function allowedHosts(): string[] {
  const raw = process.env.PROXY_ALLOWED_HOSTS?.trim() || DEFAULT_ALLOWED_HOSTS;
  return raw
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

function hostAllowed(host: string): boolean {
  const h = host.toLowerCase();
  return allowedHosts().some((entry) => h === entry || h.endsWith('.' + entry));
}

/** True when an IPv4 address (as octets) is private/loopback/link-local. */
function isPrivateV4(octets: number[]): boolean {
  const [a, b] = octets;
  if (a === 0) return true; // 0.0.0.0/8 ("this" network)
  if (a === 10) return true; // 10/8
  if (a === 127) return true; // 127/8 loopback
  if (a === 169 && b === 254) return true; // 169.254/16 link-local + metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
  return false;
}

/** Reject loopback / private / link-local / ULA / metadata addresses. */
function isForbiddenIp(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const octets = address.split('.').map(Number);
    if (octets.length !== 4 || octets.some((n) => !Number.isFinite(n))) {
      return true;
    }
    return isPrivateV4(octets);
  }
  if (family === 6) {
    const lower = address.toLowerCase();
    if (lower === '::' || lower === '::1') return true; // unspecified/loopback
    // IPv4-mapped (::ffff:a.b.c.d) — validate the embedded IPv4.
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isForbiddenIp(mapped[1]);
    const firstWord = parseInt(lower.split(':')[0] || '0', 16);
    if ((firstWord & 0xfe00) === 0xfc00) return true; // fc00::/7 ULA
    if ((firstWord & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    return false;
  }
  return true; // not an IP at all
}

interface ResolvedTarget {
  url: URL;
  /** Validated, pinned IP for url.hostname. */
  address: string;
  family: number;
}

/**
 * Validate one hop: https, default port, no creds, allowlisted host, public
 * DNS. Throws with a human-readable reason (also console.warn'd by callers).
 */
async function validateHop(target: URL): Promise<ResolvedTarget> {
  if (target.protocol !== 'https:') {
    throw new Error(`non-https URL (${target.protocol}//)`);
  }
  if (target.username || target.password) {
    throw new Error('credentials embedded in URL');
  }
  if (target.port && target.port !== '443') {
    throw new Error(`non-default port :${target.port}`);
  }
  const host = target.hostname;
  if (isIP(host)) {
    throw new Error(`IP-literal host ${host} is not allowed`);
  }
  if (!hostAllowed(host)) {
    throw new Error(`host "${host}" is not in the allowlist`);
  }
  let addresses;
  try {
    addresses = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new Error(`DNS lookup failed for "${host}"`);
  }
  if (!addresses.length) {
    throw new Error(`DNS returned no addresses for "${host}"`);
  }
  // ALL addresses must be public — a single private record means rebinding.
  for (const { address } of addresses) {
    if (isForbiddenIp(address)) {
      throw new Error(
        `host "${host}" resolves to forbidden address ${address}`,
      );
    }
  }
  return { url: target, address: addresses[0].address, family: addresses[0].family };
}

/** Fetch one hop with the validated IP pinned at the socket level. */
async function fetchPinned(target: ResolvedTarget, signal: AbortSignal) {
  const dispatcher = new Agent({
    connect: {
      timeout: TIMEOUT_MS,
      // Pin the connection to the address we validated — the socket can never
      // follow a re-resolved (rebound) DNS answer. TLS SNI/cert checks still
      // run against the original hostname.
      lookup: (_hostname, _options, callback) => {
        callback(null, [{ address: target.address, family: target.family }]);
      },
    },
  });
  try {
    return await undiciFetch(target.url, {
      method: 'GET',
      redirect: 'manual',
      signal,
      dispatcher,
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml,image/*,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.8',
      },
    });
  } finally {
    // Close lazily; keeping the connection pool around is pointless per-hop.
    setTimeout(() => void dispatcher.close().catch(() => {}), TIMEOUT_MS);
  }
}

function textResponse(status: number, message: string): NextResponse {
  return new NextResponse(message, {
    status,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // --- Same-origin gate -----------------------------------------------------
  if (request.headers.get('x-wendlo-import') !== '1') {
    return textResponse(403, 'proxy: forbidden');
  }
  const selfHost = new URL(request.url).host;
  for (const header of ['origin', 'referer'] as const) {
    const value = request.headers.get(header);
    if (!value) continue;
    try {
      if (new URL(value).host !== selfHost) {
        return textResponse(403, 'proxy: cross-origin use is not allowed');
      }
    } catch {
      return textResponse(403, 'proxy: cross-origin use is not allowed');
    }
  }

  // --- Input ------------------------------------------------------------
  const rawUrl = request.nextUrl.searchParams.get('url');
  if (!rawUrl) return textResponse(400, 'proxy: missing ?url=');
  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return textResponse(400, 'proxy: invalid URL');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // --- Redirect loop, re-validating every hop -------------------------
    let response: Awaited<ReturnType<typeof fetchPinned>> | null = null;
    for (let hop = 0; hop <= MAX_HOPS; hop++) {
      let resolved: ResolvedTarget;
      try {
        resolved = await validateHop(target);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.warn(
          `[api/proxy] rejected hop ${hop} → ${target.href}: ${reason} ` +
            `(widen PROXY_ALLOWED_HOSTS if this host is legitimate)`,
        );
        return textResponse(400, `proxy: ${reason}`);
      }

      response = await fetchPinned(resolved, controller.signal);

      const status = response.status;
      if (status >= 300 && status < 400) {
        const location = response.headers.get('location');
        // Drain/cancel the redirect body before moving on.
        try {
          await response.body?.cancel();
        } catch {
          /* already consumed/closed */
        }
        if (!location) {
          return textResponse(502, `proxy: redirect (${status}) without Location`);
        }
        if (hop === MAX_HOPS) {
          console.warn(`[api/proxy] too many redirects fetching ${rawUrl}`);
          return textResponse(502, 'proxy: too many redirects');
        }
        try {
          target = new URL(location, resolved.url);
        } catch {
          return textResponse(502, 'proxy: invalid redirect Location');
        }
        continue;
      }

      if (!response.ok) {
        return textResponse(502, `proxy: upstream responded ${status}`);
      }
      break; // 2xx — read the body below
    }

    if (!response || !response.body) {
      return textResponse(502, 'proxy: empty upstream response');
    }

    // --- Body read with a hard 3MB cap -----------------------------------
    const chunks: Uint8Array[] = [];
    let total = 0;
    for await (const chunk of response.body) {
      const bytes =
        chunk instanceof Uint8Array
          ? chunk
          : new Uint8Array(chunk as ArrayBufferLike);
      total += bytes.byteLength;
      if (total > MAX_BYTES) {
        controller.abort();
        return textResponse(502, 'proxy: response exceeds 3MB cap');
      }
      chunks.push(bytes);
    }
    const body = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      body.set(c, offset);
      offset += c.byteLength;
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
        'x-upstream-content-type':
          response.headers.get('content-type') ?? 'application/octet-stream',
      },
    });
  } catch (err) {
    if (controller.signal.aborted) {
      return textResponse(504, 'proxy: upstream timed out (12s)');
    }
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[api/proxy] fetch failed for ${rawUrl}: ${reason}`);
    return textResponse(502, 'proxy: fetch failed');
  } finally {
    clearTimeout(timer);
  }
}
