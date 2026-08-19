/**
 * Smart-link page parser — CLIENT-safe (browser DOMParser), faithfully ported
 * from prototype/admin/core.js `parseSmartLink`.
 *
 * Given the raw HTML of a DistroKid HyperFollow / TuneCore / Linkfire-style
 * smart-link page, extracts:
 * - title (og:title / twitter:title / <title>, with vendor suffixes trimmed)
 * - artUrl (og:image / og:image:url / twitter:image)
 * - per-service listen links for the 8 fixed services
 *
 * The HTML itself is fetched by the caller (through /api/proxy) — this module
 * never performs network I/O, so the server never fetches the extracted
 * third-party URLs (§6.2).
 */

export const SMARTLINK_SERVICES = [
  'spotify',
  'apple',
  'amazon',
  'deezer',
  'itunes',
  'napster',
  'tidal',
  'youtube',
] as const;

export type SmartLinkService = (typeof SMARTLINK_SERVICES)[number];

export interface SmartLinkResult {
  title?: string;
  artUrl?: string;
  links: { service: SmartLinkService; url: string }[];
}

/** Per-service href patterns (ported verbatim from the prototype). */
const PATTERNS: Record<SmartLinkService, RegExp> = {
  spotify: /https?:\/\/open\.spotify\.com\/(?:track|album)\/[\w]+[^"'\s\\<>]*/i,
  apple: /https?:\/\/music\.apple\.com\/[^"'\s\\<>]+/i,
  amazon:
    /https?:\/\/(?:music\.amazon\.[a-z.]+|www\.amazon\.[a-z.]+\/music)[^"'\s\\<>]*/i,
  deezer:
    /https?:\/\/(?:www\.)?deezer\.com\/[^"'\s\\<>]+|https?:\/\/deezer\.page\.link\/[^"'\s\\<>]+/i,
  itunes: /https?:\/\/(?:itunes|geo\.itunes)\.apple\.com\/(?!lookup)[^"'\s\\<>]+/i,
  napster: /https?:\/\/[a-z.]*napster\.com\/[^"'\s\\<>]+/i,
  tidal: /https?:\/\/(?:listen\.)?tidal\.com\/[^"'\s\\<>]+/i,
  youtube:
    /https?:\/\/(?:music\.youtube\.com|www\.youtube\.com\/watch|youtu\.be\/)[^"'\s\\<>]*/i,
};

/**
 * Smart-link pages (HyperFollow etc.) HTML-entity-encode their URLs
 * (`&#47;`, `&#x2F;`, `&`, `&amp;`…) — decode before matching.
 */
function decodeEntities(raw: string): string {
  return raw
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n: string) =>
      String.fromCharCode(parseInt(n, 16)),
    )
    .replace(/\\u0026/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

/**
 * Parse a smart-link page's raw HTML. Browser-only for the meta extraction
 * (uses DOMParser — robust against attribute order, entities and og:image:url
 * variants); when DOMParser is unavailable the service-link matching still
 * runs, only title/artUrl come back undefined.
 */
export function parseSmartLink(raw: string): SmartLinkResult {
  let title = '';
  let artUrl = '';

  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    const meta = (p: string): string => {
      const el = doc.querySelector(
        `meta[property="${p}"],meta[name="${p}"]`,
      );
      return el ? el.getAttribute('content') || '' : '';
    };
    title = meta('og:title') || meta('twitter:title') || doc.title || '';
    title = title
      .split(
        /\s*[|–—]\s*(?:DistroKid|HyperFollow|TuneCore|Linkfire|Listen now).*/i,
      )[0]
      .replace(/\s*(?:by|—|-)\s*Wendlo\s*$/i, '')
      .trim();
    artUrl =
      meta('og:image') || meta('og:image:url') || meta('twitter:image') || '';
  }

  const txt = decodeEntities(raw);
  const links: SmartLinkResult['links'] = [];
  for (const service of SMARTLINK_SERVICES) {
    const m = txt.match(PATTERNS[service]);
    if (m) links.push({ service, url: m[0] });
  }

  return {
    title: title || undefined,
    artUrl: artUrl || undefined,
    links,
  };
}
