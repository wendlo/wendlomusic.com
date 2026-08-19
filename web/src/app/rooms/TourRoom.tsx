/**
 * TourRoom — hero + right-half shows panel (server component).
 *
 * The hero renders via the shared <Hero> helper. Upcoming shows are fetched at
 * the server (RSC) via getUpcomingShows() — cached with `next: { revalidate,
 * tags }`, graceful-failing to `[]` so `next build` prerenders offline. The
 * `.show` rows / empty state render here; the <ShowsPanel> client island wraps
 * them only to port the scroll-hint hide-at-bottom behavior (needs the DOM).
 */

import type { TourPage } from '@/lib/content/types';
import { getUpcomingShows } from '@/lib/bandsintown';
import { Hero } from './_client/Hero';
import { ShowsPanel } from './_client/TourIsland';

export interface TourRoomProps {
  tour: TourPage;
}

export async function TourRoom({ tour }: TourRoomProps) {
  const shows = await getUpcomingShows();
  const hasShows = shows.length > 0;

  return (
    <section className="room" data-page="tour">
      <Hero hero={tour.hero} />
      <ShowsPanel hasShows={hasShows}>
        {hasShows
          ? shows.map((s, i) => (
              <div className="show" key={i}>
                <div className="date">
                  <b>{s.day}</b>
                  <span>{s.mon}</span>
                </div>
                <div className="meta">
                  <b>{s.venue}</b>
                  <span>{s.loc}</span>
                </div>
                <div className="acts">
                  {s.ticketUrl ? (
                    <a
                      className="rsvp"
                      href={s.ticketUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Tickets
                    </a>
                  ) : null}
                  <a
                    className="rsvp ghost"
                    href={s.rsvpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    RSVP
                  </a>
                </div>
              </div>
            ))
          : (
              <div className="shows-empty">
                {tour.emptyText}
                {tour.emptyLinkText && tour.emptyLinkUrl ? (
                  <>
                    <br />
                    <a
                      href={tour.emptyLinkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {tour.emptyLinkText}
                    </a>
                  </>
                ) : null}
              </div>
            )}
      </ShowsPanel>
    </section>
  );
}
