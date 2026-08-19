/**
 * Content resolver — the single seam between the site and its content source.
 *
 * For now this ALWAYS returns the baked fallback content (see ./fallback), so
 * the whole site renders with no Sanity project. When a real Sanity project is
 * wired (a later phase), the branch below is where the GROQ fetch lands; the
 * return type (SiteContent) stays identical so no downstream code changes.
 */

import { env } from '@/lib/env';
import { sanityFetch } from '@/lib/sanity/fetch';
import { siteContentQuery, type RawSiteContent } from '@/lib/sanity/queries';
import { fallbackContent } from './fallback';
import { mapSiteContent } from './map';
import type { SiteContent } from './types';

export type { SiteContent } from './types';

/**
 * Every document `_type` the batched query reads. Threaded through as Next
 * cache tags so the Sanity webhook (`/api/revalidate`) can invalidate exactly
 * the published-content cache by `_type`.
 */
const CONTENT_TAGS = [
  'siteSettings',
  'homePage',
  'aboutPage',
  'tourPage',
  'musicPage',
  'contactPage',
  'blogPage',
  'blogPost',
];

/**
 * Resolve all site content. Returns the same fully-typed SiteContent shape
 * regardless of source.
 *
 * When `NEXT_PUBLIC_SANITY_PROJECT_ID` is set, a single batched GROQ query
 * fetches all singletons + published blogPosts and maps the result 1:1 onto
 * `SiteContent` (empty Sanity images resolve to the baked default assets via
 * lib/sanity/image; any absent field falls back to the baked value). On ANY
 * error — or when the project id is unset — the baked `fallbackContent` is
 * returned, so the fallback is always the guaranteed rendering path.
 */
export async function getSiteContent(): Promise<SiteContent> {
  if (!env.sanity.projectId) return fallbackContent;
  try {
    const raw = await sanityFetch<RawSiteContent>(
      siteContentQuery,
      {},
      { tags: CONTENT_TAGS },
    );
    if (!raw) return fallbackContent;
    return mapSiteContent(raw);
  } catch {
    return fallbackContent;
  }
}
