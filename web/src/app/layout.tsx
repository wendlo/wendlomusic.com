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
import { getSiteContent } from '@/lib/content';
import PreviewVisualEditing from '@/components/PreviewVisualEditing';
import '@/styles/tokens.css';
import '@/styles/globals.css';
import '@/styles/rooms.css';
import '@/styles/doodles.css';

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
  return {
    // Apex is the canonical host (www 307-redirects to it), so relative
    // og:image / icon URLs must resolve against the apex with no redirect hop.
    // Hardcoded on purpose: a missing or malformed env value can't break the
    // build or point crawlers at www.
    metadataBase: new URL('https://wendlomusic.com'),
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
  // Sanity live preview: only mount the Visual Editing overlay (which also
  // re-renders the page on Studio edits) inside an active draft-mode session
  // (started via /api/draft-mode/enable). With zero env this is always false
  // and nothing extra renders.
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
        {isPreview ? <PreviewVisualEditing /> : null}
      </body>
    </html>
  );
}
