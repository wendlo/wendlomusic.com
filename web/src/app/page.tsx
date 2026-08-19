/**
 * Home route ("/") — the single-page Wendlo site.
 *
 * SERVER component: resolves all content, then renders the client <Shell>
 * wrapping the room components. Rooms appear in the slider in `settings.pages`
 * order, and ONLY enabled pages are rendered — so the Shell's enabled-based
 * slide index lines up 1:1 with the DOM order (disabled pages are simply
 * absent, never phantom slots to slide through). Each room gets its typed slice.
 */

import { Fragment, type ReactNode } from 'react';
import type { PageId } from '@/lib/content/types';
import { getSiteContent } from '@/lib/content';
import { Shell } from './rooms/_client/Shell';
import { HomeRoom } from './rooms/HomeRoom';
import { AboutRoom } from './rooms/AboutRoom';
import { TourRoom } from './rooms/TourRoom';
import { ContactRoom } from './rooms/ContactRoom';
import { MusicRoom } from './rooms/MusicRoom';
import { StoreRoom } from './rooms/StoreRoom';
import { BlogRoom } from './rooms/BlogRoom';

export default async function Home() {
  const content = await getSiteContent();
  const { settings, home, about, tour, music, contact, blog } = content;

  const roomsById: Record<PageId, ReactNode> = {
    home: <HomeRoom home={home} />,
    about: <AboutRoom about={about} />,
    tour: <TourRoom tour={tour} />,
    contact: <ContactRoom contact={contact} />,
    music: <MusicRoom music={music} />,
    store: <StoreRoom shopify={settings.connections.shopify} />,
    blog: <BlogRoom blog={blog} />,
  };

  return (
    <Shell pages={settings.pages} design={settings.design}>
      {settings.pages
        .filter((p) => p.enabled)
        .map((p) => (
          <Fragment key={p.pageId}>{roomsById[p.pageId]}</Fragment>
        ))}
    </Shell>
  );
}
