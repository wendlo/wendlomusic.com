/**
 * Embedded Sanity Studio at /studio (catch-all route).
 *
 * GUARD (build/runtime safety): when NEXT_PUBLIC_SANITY_PROJECT_ID is unset we
 * render a plain message instead of the Studio, so the site build stays green
 * and the route never crashes with no Sanity project configured.
 *
 * The actual <NextStudio> (and the `sanity` bundle it pulls in) lives in the
 * client component `./Studio` — importing it there keeps the Studio out of the
 * RSC module graph, where `sanity`'s transitive `swr` default import would
 * otherwise break the Turbopack build.
 *
 * Phase-1 scope only — no draft mode / presentation / live preview.
 */
import type { Metadata, Viewport } from 'next';

import { isSanityConfigured } from '@/sanity/env';
import Studio from './Studio';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Wendlo Studio',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function StudioPage() {
  if (!isSanityConfigured) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          color: '#1a1a1a',
          background: '#fff',
        }}
      >
        <p style={{ maxWidth: '32rem', lineHeight: 1.5 }}>
          Sanity not configured — set{' '}
          <code
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              background: '#f2f2f2',
              padding: '0.1em 0.35em',
              borderRadius: '4px',
            }}
          >
            NEXT_PUBLIC_SANITY_PROJECT_ID
          </code>{' '}
          in <code>.env.local</code>.
        </p>
      </div>
    );
  }

  return <Studio />;
}
