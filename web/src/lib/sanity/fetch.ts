/**
 * sanityFetch — the single read path for site content (Phase 5).
 *
 * Two modes, decided per request:
 *  - PREVIEW: when Next draft mode is enabled AND `SANITY_API_READ_TOKEN` is
 *    set, reads go through a token'd client with `perspective: 'previewDrafts'`
 *    and no caching, so editors see unpublished drafts live (Presentation
 *    tool / Visual Editing).
 *  - PUBLISHED: otherwise the shared CDN client is used with Next cache tags
 *    (`next: { tags, revalidate: false }`) — cached indefinitely until
 *    `/api/revalidate` calls `revalidateTag(_type)` from the Sanity webhook.
 *
 * Guards (INVARIANT 1): returns `null` when Sanity is unconfigured so callers
 * fall back to baked content; `draftMode()` is wrapped so calling outside a
 * request scope (scripts, build-time edge cases) degrades to published reads.
 */

import type { QueryParams } from 'next-sanity';
import { draftMode } from 'next/headers';
import { serverEnv } from '@/lib/env';
import { getClient } from './client';

export interface SanityFetchOptions {
  /** Next cache tags to associate with this query (doc `_type` names). */
  tags?: string[];
}

/**
 * Run a GROQ query. Returns the typed result, or `null` when no Sanity project
 * is configured. Throws on a genuine fetch/GROQ error (the caller in
 * lib/content wraps this in try/catch and falls back).
 */
export async function sanityFetch<T>(
  query: string,
  params: QueryParams = {},
  { tags = [] }: SanityFetchOptions = {},
): Promise<T | null> {
  const client = getClient();
  if (!client) return null;

  let isDraft = false;
  try {
    isDraft = (await draftMode()).isEnabled;
  } catch {
    // No request scope (script / non-request context) → published reads.
    isDraft = false;
  }

  const token = serverEnv().sanityReadToken;
  if (isDraft && token) {
    return client
      .withConfig({ useCdn: false, token, perspective: 'previewDrafts' })
      .fetch<T>(query, params, { cache: 'no-store' });
  }

  return client.fetch<T>(query, params, {
    next: { tags, revalidate: false },
  });
}
