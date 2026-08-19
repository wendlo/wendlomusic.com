/**
 * AboutRoom — server component.
 *
 * Faithful port of the prototype's About room (index.html §<section data-page="about">):
 *   <section class="room scrim-l" data-page="about">
 *     <div class="hero" …/>            ← via <Hero>
 *     <div class="about-copy"><h2/><p/></div>
 *   </section>
 *
 * `.scrim-l` (left scrim) lives on the .room per the CSS contract, NOT on <Hero>.
 * Heading is plain text. Body is PLAIN multiline text rendered with
 * `white-space:pre-line` (see .about-copy p in rooms.css) — NOT rich text.
 *
 * No local interactivity and no integration-dependent handlers: the About room
 * is purely static content, so this stays a server component.
 */

import type { AboutPage } from '@/lib/content/types';
import { Hero } from './_client/Hero';

export interface AboutRoomProps {
  about: AboutPage;
}

export function AboutRoom({ about }: AboutRoomProps) {
  return (
    <section className="room scrim-l" data-page="about">
      <Hero hero={about.hero} />
      <div className="about-copy">
        <h2 id="aboutHeading">{about.heading}</h2>
        <p id="aboutBody">{about.body}</p>
      </div>
    </section>
  );
}
