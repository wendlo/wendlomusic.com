/**
 * Reachable contact address — SERVER ONLY (uses node:dns). Never import from a
 * client component; pass the resolved string down as a prop instead.
 *
 * resolveReachableEmail(address) checks whether the address's domain can
 * receive mail (has MX records). When DNS says definitively that it cannot —
 * ENODATA / ENOTFOUND / an empty or RFC 7505 "null MX" answer — it returns
 * BAND_INBOX_FALLBACK so visitors are never pointed at a bouncing mailbox. On a
 * timeout or any other DNS error it assumes the address is fine and returns it
 * unchanged. It never throws.
 *
 * Self-healing: once the domain gets (forwarding) MX records, the next ISR
 * render resolves them and switches back to the original address — no deploy.
 */

import { Resolver } from 'node:dns/promises';

/**
 * The band's Gmail, used ONLY while the domain mailbox (contact.bookingEmail,
 * e.g. hello@wendlomusic.com) doesn't receive mail. Remove once MX is live.
 */
export const BAND_INBOX_FALLBACK = 'wendlomusic@gmail.com';

const LOOKUP_TIMEOUT_MS = 2500;
/** Definitive answers are memoized per server instance for this long. */
const CACHE_TTL_MS = 10 * 60 * 1000;

/** DNS error codes that mean "this domain has no mail exchanger". */
const NO_MX_CODES = new Set(['ENODATA', 'ENOTFOUND']);

const cache = new Map<string, { value: string; expires: number }>();

type MxVerdict = 'has-mx' | 'no-mx' | 'unknown';

async function lookupMx(domain: string): Promise<MxVerdict> {
  let resolver: Resolver | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    resolver = new Resolver({ timeout: LOOKUP_TIMEOUT_MS, tries: 1 });
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), LOOKUP_TIMEOUT_MS);
    });
    const result = await Promise.race([resolver.resolveMx(domain), timeout]);
    if (result === 'timeout') {
      try {
        resolver.cancel();
      } catch {
        // nothing in flight to cancel
      }
      return 'unknown';
    }
    // RFC 7505 null MX ("MX 0 .") means the domain explicitly accepts no mail.
    const usable = result.filter(
      (r) => r.exchange && r.exchange !== '.' && r.exchange.trim() !== '',
    );
    return usable.length > 0 ? 'has-mx' : 'no-mx';
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code?: unknown }).code)
        : '';
    return NO_MX_CODES.has(code) ? 'no-mx' : 'unknown';
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Returns an address visitors can actually reach. Never throws.
 *  - domain has MX            → `address`
 *  - domain definitively no MX → BAND_INBOX_FALLBACK
 *  - timeout / other error    → `address` (assume fine)
 *  - empty / malformed input  → BAND_INBOX_FALLBACK (nothing to deliver to)
 */
export async function resolveReachableEmail(address: string): Promise<string> {
  try {
    const trimmed = (address ?? '').trim();
    const at = trimmed.lastIndexOf('@');
    const domain = at > 0 ? trimmed.slice(at + 1).toLowerCase() : '';
    if (!domain || !domain.includes('.')) return BAND_INBOX_FALLBACK;

    const hit = cache.get(domain);
    if (hit && hit.expires > Date.now()) {
      return hit.value === 'no-mx' ? BAND_INBOX_FALLBACK : trimmed;
    }

    const verdict = await lookupMx(domain);
    if (verdict !== 'unknown') {
      // only cache definitive answers; transient failures retry next render
      cache.set(domain, { value: verdict, expires: Date.now() + CACHE_TTL_MS });
    }
    return verdict === 'no-mx' ? BAND_INBOX_FALLBACK : trimmed;
  } catch {
    return (address ?? '').trim() || BAND_INBOX_FALLBACK;
  }
}
