/**
 * GET /api/draft-mode/enable — Sanity Presentation preview entry point.
 *
 * Uses next-sanity's `defineEnableDraftMode`: the Presentation tool calls this
 * URL with a signed preview-URL secret; the handler verifies it with a token'd
 * client, enables Next draft mode (cookie), and redirects into the site, where
 * `sanityFetch` switches to draft-perspective reads.
 *
 * GUARD (INVARIANT 1): with no Sanity project or no `SANITY_API_READ_TOKEN`
 * this responds 503 text instead of constructing the handler — the build and
 * the route stay green with zero env configured.
 */

import { defineEnableDraftMode } from 'next-sanity/draft-mode';
import { serverEnv } from '@/lib/env';
import { getClient } from '@/lib/sanity/client';

export const dynamic = 'force-dynamic';

function buildHandler(): { GET: (request: Request) => Promise<Response> } | null {
  const client = getClient();
  const token = serverEnv().sanityReadToken;
  if (!client || !token) return null;
  return defineEnableDraftMode({ client: client.withConfig({ token }) });
}

const handler = buildHandler();

export async function GET(request: Request): Promise<Response> {
  if (!handler) {
    return new Response(
      'Preview is not configured — set NEXT_PUBLIC_SANITY_PROJECT_ID and SANITY_API_READ_TOKEN.',
      { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } },
    );
  }
  return handler.GET(request);
}
