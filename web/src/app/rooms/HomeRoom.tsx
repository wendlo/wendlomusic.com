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
 * (top-left) and the band-placed doodles (homePage.doodles: today the "join
 * our email list!" link + the /click-here-white.gif arrow) — lives in the
 * Shell (it floats over the whole stage and is hidden off-home via CSS:
 * `.stage:not(.at-home) …`), NOT inside this room. Doodle clicks are handled
 * there too (Shell followLink → slide + OPEN_SHEET_EVENT).
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
