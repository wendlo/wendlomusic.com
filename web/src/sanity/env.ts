/**
 * Sanity-specific env constants, shared by sanity.config.ts, sanity.cli.ts and
 * the Studio route.
 *
 * INVARIANT: importing this (and therefore sanity.config.ts) must NEVER throw
 * when no Sanity project is configured — the site build has to stay green with
 * no NEXT_PUBLIC_SANITY_PROJECT_ID. So `projectId` falls back to a harmless
 * placeholder that satisfies Sanity's "non-empty projectId" requirement at
 * config-construction time. The real gate lives in the read layer + the Studio
 * route, both of which check `isSanityConfigured` before doing anything live.
 */

/**
 * Strip wrapping quotes/whitespace (dashboard paste mistakes) and accept only
 * Sanity's legal id charset; anything else counts as "not configured" so the
 * Studio config can never throw at import over a mangled env value.
 */
function cleanId(raw: string | undefined): string | undefined {
  const v = raw?.trim().replace(/^['"]+|['"]+$/g, '').trim().toLowerCase();
  return v && /^[a-z0-9-]+$/.test(v) ? v : undefined;
}

/** The project id from env, or undefined when unset/empty/invalid. */
export const projectId = cleanId(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID);

/** True only when a real Sanity project id is present. */
export const isSanityConfigured = Boolean(projectId);

/**
 * A safe, always-non-empty project id for constructing the config. When no real
 * project is set we use a placeholder so `defineConfig` / the Studio never blow
 * up at import time; nothing live is ever fetched with it because the read
 * layer and Studio route both guard on `isSanityConfigured` first.
 */
export const safeProjectId = projectId ?? 'placeholder';

export const dataset =
  cleanId(process.env.NEXT_PUBLIC_SANITY_DATASET) ?? 'production';

export const apiVersion =
  process.env.NEXT_PUBLIC_SANITY_API_VERSION?.trim() || '2024-10-01';
