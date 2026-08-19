/**
 * Sanity read client (next-sanity).
 *
 * The whole file is env-driven and NEVER throws at import: when
 * `NEXT_PUBLIC_SANITY_PROJECT_ID` is unset the exported `client` is `null` and
 * every read path falls back to baked content. This keeps the build green with
 * no Sanity project configured (CRITICAL INVARIANT 2).
 */

import { createClient, type SanityClient } from 'next-sanity';
import { env, serverEnv } from '@/lib/env';

/** Pinned API version for all reads. Bump deliberately. */
export const SANITY_API_VERSION = env.sanity.apiVersion ?? '2024-10-01';

/** Dataset, defaulting to `production` when unset. */
export const SANITY_DATASET = env.sanity.dataset ?? 'production';

/** Project id (may be undefined → Sanity disabled). */
export const SANITY_PROJECT_ID = env.sanity.projectId;

/**
 * The shared read client, or `null` when no project id is configured. Callers
 * MUST null-check (see `getClient`) so the fallback content path stays intact.
 */
export const client: SanityClient | null = SANITY_PROJECT_ID
  ? createClient({
      projectId: SANITY_PROJECT_ID,
      dataset: SANITY_DATASET,
      apiVersion: SANITY_API_VERSION,
      // Public, cacheable reads. Phase 5 adds draft-mode/live preview.
      useCdn: true,
      // Optional read token (private datasets); harmless when undefined.
      token: serverEnv().sanityReadToken,
      perspective: 'published',
    })
  : null;

/**
 * Guarded accessor: returns the configured client, or `null` when Sanity is not
 * configured. Prefer this over importing `client` directly so the guard reads
 * clearly at the call site.
 */
export function getClient(): SanityClient | null {
  return client;
}

/** True when a Sanity project is configured. */
export function isSanityConfigured(): boolean {
  return client !== null;
}
