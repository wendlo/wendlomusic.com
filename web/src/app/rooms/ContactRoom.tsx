/**
 * ContactRoom — stripes bg + full-bleed polaroids image + glass contact card.
 *
 * Ports prototype/index.html's `.room[data-page=contact]` markup verbatim:
 *   .bg, img.contact-polaroids, .contact-block > .contact-card.
 * The card contents (message/email/gform buttons, socials, licensing copy) and
 * the message/email/Google-Form modal sheet are interactive, so they live in
 * the co-located ContactIsland client island. The room stays a server
 * component that just lays out the static shell and hands the content slice
 * to the island.
 */

import type { ContactPage } from '@/lib/content/types';
import { ContactIsland } from './_client/ContactIsland';

export interface ContactRoomProps {
  contact: ContactPage;
}

export function ContactRoom({ contact }: ContactRoomProps) {
  return (
    <section className="room" data-page="contact">
      <div className="bg" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="contact-polaroids"
        src={contact.polaroids.url}
        alt="Wendlo polaroids"
      />
      <ContactIsland contact={contact} />
    </section>
  );
}
