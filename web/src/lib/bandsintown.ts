/**
 * Bandsintown server helper (phase-4).
 *
 * Fetches an artist's upcoming events from the CORS-open public REST API and
 * normalizes them into typed `Show` rows for the Tour room (a server
 * component). Mirrors the prototype's loadShows() (index.html ~L714-736):
 * the `/events?date=upcoming` endpoint, the date/venue/city + Tickets/RSVP
 * offer mapping, and the empty-state fallback.
 *
 * GRACEFUL FAILURE IS MANDATORY: `next build` prerenders `/` and calls this at
 * build time. Any network error / non-200 / bad payload returns `[]` so the
 * room renders its empty state and the build still succeeds offline.
 *
 * Public defaults (safe to ship) are used when env is unset; override later via
 * NEXT_PUBLIC_BANDSINTOWN_* or Sanity connectionSettings.
 */

const DEFAULT_ARTIST = 'id_14800723';
const DEFAULT_APP_ID = 'e013532ece4ef52f851d48a4d3730c70';

const MON = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
] as const;

/** One normalized upcoming show, ready to render as a `.show` row. */
export interface Show {
  /** Zero-padded day of month, e.g. "07". */
  day: string;
  /** Uppercased 3-letter month, e.g. "JUL". */
  mon: string;
  /** Venue name. */
  venue: string;
  /** "City, Region" (falls back to country), best-effort. */
  loc: string;
  /** Direct ticket-purchase URL, when an available Tickets offer exists. */
  ticketUrl?: string;
  /** Bandsintown event page (RSVP / details). */
  rsvpUrl: string;
}

/** Shape of the bits of a Bandsintown event we read (rest is ignored). */
interface BitEvent {
  datetime?: string;
  url?: string;
  venue?: { name?: string; city?: string; region?: string; country?: string };
  offers?: { type?: string; status?: string; url?: string }[];
}

/**
 * GET upcoming events for the configured artist and normalize them.
 * Never throws — returns `[]` on any error / non-200 / non-array payload.
 */
export async function getUpcomingShows(): Promise<Show[]> {
  const artist =
    process.env.NEXT_PUBLIC_BANDSINTOWN_ARTIST_ID?.trim() || DEFAULT_ARTIST;
  const appId =
    process.env.NEXT_PUBLIC_BANDSINTOWN_APP_ID?.trim() || DEFAULT_APP_ID;

  const url =
    `https://rest.bandsintown.com/artists/${encodeURIComponent(artist)}/events` +
    `?app_id=${encodeURIComponent(appId)}&date=upcoming`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
        next: { revalidate: 900, tags: ['bandsintown-shows'] },
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return [];

    const events: unknown = await res.json();
    if (!Array.isArray(events)) return [];

    return (events as BitEvent[])
      .map(normalize)
      .filter((s): s is Show => s !== null);
  } catch {
    // Network error / timeout / bad JSON — fall back to the empty state.
    return [];
  }
}

/** Normalize one raw event; returns null if it lacks the essentials. */
function normalize(e: BitEvent): Show | null {
  if (!e || typeof e.datetime !== 'string') return null;
  const d = new Date(e.datetime);
  if (Number.isNaN(d.getTime())) return null;

  const v = e.venue ?? {};
  const loc = [v.city, v.region || v.country].filter(Boolean).join(', ');
  const tix = (e.offers ?? []).find(
    (o) => o?.type === 'Tickets' && o?.status === 'available',
  );

  return {
    day: String(d.getDate()).padStart(2, '0'),
    mon: MON[d.getMonth()],
    venue: v.name ?? '',
    loc,
    ticketUrl: tix?.url,
    rsvpUrl: e.url ?? '',
  };
}
