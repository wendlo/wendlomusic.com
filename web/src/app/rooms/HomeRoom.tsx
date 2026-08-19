/**
 * HomeRoom — the landing slide: full-bleed Ken-Burns hero.
 *
 * Ported VERBATIM from prototype/index.html, where the home room is simply:
 *     <section class="room" data-page="home"><div class="hero"></div></section>
 *
 * The Ken-Burns pan is pure CSS on the parent `.room[data-page=home] .hero`
 * (keyframes `kb`, 24s) — nothing to do here. The <Hero> helper applies the
 * background image + `--focal`/`--focal-m` focal custom properties.
 *
 * The floating chrome that appears over the home slide — the handwritten logo
 * (top-left), the rotated "join our email list!" email CTA, and the
 * /click-here-white.gif arrow — all live in the Shell (they float over the
 * whole stage and are hidden off-home via CSS: `.stage:not(.at-home) …`), NOT
 * inside this room. See prototype markup lines 353-355 (siblings of `.track`,
 * not children of the home `.room`).
 *
 * The email-CTA click behaviour (navigate to contact + open the email modal)
 * is exposed as a reusable hook in ./_client/HomeIsland for the Shell/Phase-4
 * wiring — see `useEmailCtaAction`.
 */

import type { HomePage } from '@/lib/content/types';
import { Hero } from './_client/Hero';

export interface HomeRoomProps {
  home: HomePage;
}

export function HomeRoom({ home }: HomeRoomProps) {
  return (
    <section className="room" data-page="home">
      <Hero hero={home.hero} />
    </section>
  );
}
