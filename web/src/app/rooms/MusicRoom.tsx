/**
 * MusicRoom — scrolling stripes page of song cards + inline YouTube embeds.
 *
 * Faithful port of the prototype's `renderMusic()` (index.html §637–671):
 *  - Iterate `music.entries` in order.
 *  - Song entries render a `.song` card. Alternation (`.song.img-first`) is driven
 *    by a song-only counter (YouTube entries do NOT advance it), matching the
 *    prototype's `songIdx++`. Even song index → art-first.
 *  - Listen links iterate `music.services` order; only enabled links with a url
 *    render, as circular anchors to the real url (§660–663).
 *  - YouTube entries render a full-width `.ytentry` iframe via youtube-nocookie
 *    (§656–658). A missing/unparseable url yields no output (matching `if(!id) return ''`).
 *
 * Pure server component — every element is static markup with real hrefs; no
 * state, effects, or handlers, so no client island is required.
 */

import type {
  MusicPage,
  ServiceId,
  SongEntry,
  YoutubeEntry,
  ListenLink,
} from '@/lib/content/types';
import type { ReactNode } from 'react';

export interface MusicRoomProps {
  music: MusicPage;
}

/** Per-service label + icon, verbatim from prototype SERVICE_META (§638–647). */
const SERVICE_META: Record<ServiceId, { label: string; icon: ReactNode }> = {
  spotify: { label: 'Spotify', icon: <i className="ti ti-brand-spotify" /> },
  apple: { label: 'Apple Music', icon: <i className="ti ti-brand-apple" /> },
  amazon: { label: 'Amazon Music', icon: <i className="ti ti-brand-amazon" /> },
  deezer: { label: 'Deezer', icon: <i className="ti ti-brand-deezer" /> },
  itunes: { label: 'iTunes', icon: <b>iT</b> },
  napster: { label: 'Napster', icon: <b>N</b> },
  tidal: { label: 'Tidal', icon: <i className="ti ti-brand-tidal" /> },
  youtube: { label: 'YouTube', icon: <i className="ti ti-brand-youtube" /> },
};

/** Extract a YouTube video id, verbatim regex from prototype ytId() (§648–651). */
function ytId(url: string): string {
  const m = String(url || '').match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/,
  );
  return m ? m[1] : '';
}

function ListenLinks({
  song,
  services,
}: {
  song: SongEntry;
  services: ServiceId[];
}) {
  // §660: filter to services (in fixed order) that this song enables with a url.
  const active: ListenLink[] = services
    .map((s) => song.links.find((l) => l.service === s))
    .filter(
      (l): l is ListenLink => !!l && l.enabled && !!l.url,
    );

  if (active.length === 0) {
    // §667: no <span>listen on</span>, no links — but keep the .listen row.
    return <div className="listen" />;
  }

  return (
    <div className="listen">
      <span>listen on</span>
      {active.map((l) => {
        const m = SERVICE_META[l.service] ?? {
          label: l.service,
          icon: <i className="ti ti-music" />,
        };
        return (
          <a
            key={l.service}
            href={l.url}
            target="_blank"
            rel="noopener"
            aria-label={`Listen on ${m.label}`}
            title={m.label}
          >
            {m.icon}
          </a>
        );
      })}
    </div>
  );
}

function SongCard({
  song,
  services,
  imgFirst,
}: {
  song: SongEntry;
  services: ServiceId[];
  imgFirst: boolean;
}) {
  return (
    <div className={imgFirst ? 'song img-first' : 'song'}>
      <div className="card card-text">
        <h3>{song.title}</h3>
        <div className="tag">{song.tag || ''}</div>
        <p>{song.blurb || ''}</p>
        <ListenLinks song={song} services={services} />
      </div>
      <div
        className="card card-art"
        style={{ backgroundImage: `url('${song.art.url || ''}')` }}
      />
    </div>
  );
}

function YtEntry({ entry }: { entry: YoutubeEntry }) {
  const id = ytId(entry.url);
  if (!id) return null; // §657: unparseable url → nothing.
  return (
    <div className="ytentry" title={entry.title || ''}>
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}`}
        title={entry.title || 'YouTube video'}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}

export function MusicRoom({ music }: MusicRoomProps) {
  let songIdx = 0; // song-only counter (YouTube entries do not advance it, §654/664).

  return (
    <section className="room" data-page="music">
      <div className="bg" />
      <div className="content">
        <div className="music-head" />
        <div className="songs" id="songs">
          {music.entries.map((en) => {
            if (en.type === 'youtube') {
              return <YtEntry key={en.id} entry={en} />;
            }
            const imgFirst = songIdx++ % 2 === 0;
            return (
              <SongCard
                key={en.id}
                song={en}
                services={music.services}
                imgFirst={imgFirst}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
