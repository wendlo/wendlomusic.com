/**
 * Root layout.
 *
 * Fonts: the prototype loads ONLY Montserrat (nav/body) + Caveat (hand). We
 * self-host both (SIL OFL) as variable woff2 files in src/fonts/ and load them
 * via next/font/local so builds are hermetic (no Google Fonts fetch at build
 * time), exposing the same CSS custom properties tokens.css aliases
 * (--font-montserrat / --font-caveat). NO serif is introduced (the prototype
 * has none).
 *
 * Tabler icons: the prototype uses the Tabler icon webfont for social/cart/blog
 * glyphs (`<i class="ti ti-…">`). It is a plain stylesheet (not a Google font),
 * so it is loaded via a <link> in <head>.
 *
 * Metadata is built from getSiteContent().settings; the site-wide announcement
 * bar renders here (over the stage) when enabled.
 */

import type { Metadata } from 'next';
import { draftMode } from 'next/headers';
import localFont from 'next/font/local';
import { VisualEditing } from 'next-sanity/visual-editing';
import { getSiteContent } from '@/lib/content';
import '@/styles/tokens.css';
import '@/styles/globals.css';
import '@/styles/rooms.css';

const montserrat = localFont({
  variable: '--font-montserrat',
  src: [
    {
      path: '../fonts/montserrat-latin-wght-normal.woff2',
      weight: '100 900',
      style: 'normal',
    },
    {
      path: '../fonts/montserrat-latin-wght-italic.woff2',
      weight: '100 900',
      style: 'italic',
    },
  ],
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
});

const caveat = localFont({
  variable: '--font-caveat',
  src: [
    {
      path: '../fonts/caveat-latin-wght-normal.woff2',
      weight: '400 700',
      style: 'normal',
    },
  ],
  display: 'swap',
  fallback: ['cursive'],
});

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getSiteContent();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || 'https://www.wendlomusic.com';
  return {
    metadataBase: new URL(siteUrl),
    title: settings.title || 'Wendlo',
    description: settings.description || '',
    icons: { icon: '/w-tile.png' },
    openGraph: {
      title: settings.title || 'Wendlo',
      description: settings.description || '',
      images: [{ url: '/w-tile.png' }],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { settings } = await getSiteContent();
  const ann = settings.announcement;
  const annOn = !!ann.enabled && !!ann.text;
  // Sanity live preview: only mount the Visual Editing overlay inside an
  // active draft-mode session (started via /api/draft-mode/enable). With zero
  // env this is always false and nothing extra renders.
  const { isEnabled: isPreview } = await draftMode();

  return (
    <html lang="en" className={`${montserrat.variable} ${caveat.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.7.0/dist/tabler-icons.min.css"
        />
      </head>
      <body>
        {/* Site-wide announcement bar (rendered over the stage when enabled). */}
        {annOn ? (
          <a className="annbar on" href={`#${ann.page}`}>
            {ann.text}
          </a>
        ) : null}
        {children}
        {isPreview ? <VisualEditing /> : null}
      </body>
    </html>
  );
}
