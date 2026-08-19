/**
 * Sanity image resolution → the site's resolved image shapes.
 *
 * Two helpers map raw Sanity image sources into the exact `SiteContent` shapes:
 *   - `resolveImage`   → `ResolvedImage | undefined`  ({ url })
 *   - `resolveHero`    → `HeroImage | undefined`       ({ url, focal… })
 *
 * BOTH return `undefined` when the source image is empty/missing, so the caller
 * (lib/content) can leave the field off and let the room's baked default asset
 * apply. Nothing here throws when Sanity is unconfigured.
 */

import imageUrlBuilder from '@sanity/image-url';
import type { SanityImageSource } from '@sanity/image-url';
import type { HeroImage, ResolvedImage } from '@/lib/content/types';
import { SANITY_DATASET, SANITY_PROJECT_ID } from './client';

/**
 * A raw Sanity image value with an asset reference. `undefined`/empty when the
 * editor left the image blank.
 */
export interface SanityImageValue {
  asset?: { _ref?: string; _id?: string } | null;
  hotspot?: { x?: number; y?: number } | null;
  crop?: unknown;
}

/** A heroImage object value as projected from GROQ. */
export interface SanityHeroValue {
  image?: SanityImageValue | null;
  focalDesktop?: string | null;
  focalMobile?: string | null;
}

/** Shared url-builder, or null when Sanity is unconfigured. */
const builder =
  SANITY_PROJECT_ID
    ? imageUrlBuilder({ projectId: SANITY_PROJECT_ID, dataset: SANITY_DATASET })
    : null;

/** True when an image value actually references an uploaded asset. */
function hasAsset(image: SanityImageValue | null | undefined): boolean {
  return Boolean(image?.asset?._ref || image?.asset?._id);
}

/**
 * Build a renderable URL for a Sanity image, or `undefined` when there is no
 * asset (or Sanity is unconfigured). Accepts an optional max width for sizing.
 */
export function imageUrl(
  image: SanityImageValue | null | undefined,
  width?: number,
): string | undefined {
  if (!builder || !hasAsset(image)) return undefined;
  let b = builder.image(image as SanityImageSource).auto('format').fit('max');
  if (width) b = b.width(width);
  return b.url();
}

/**
 * Resolve a plain Sanity image into `ResolvedImage`, or `undefined` when empty
 * (so the baked default is used).
 */
export function resolveImage(
  image: SanityImageValue | null | undefined,
  width?: number,
): ResolvedImage | undefined {
  const url = imageUrl(image, width);
  return url ? { url } : undefined;
}

/**
 * Resolve a heroImage object into `HeroImage`, or `undefined` when the image is
 * empty (so the room's baked default hero applies). Focal strings pass through
 * only when the image is present.
 */
export function resolveHero(
  hero: SanityHeroValue | null | undefined,
  width?: number,
): HeroImage | undefined {
  const url = imageUrl(hero?.image, width);
  if (!url) return undefined;
  const resolved: HeroImage = { url };
  if (hero?.focalDesktop) resolved.focalDesktop = hero.focalDesktop;
  if (hero?.focalMobile) resolved.focalMobile = hero.focalMobile;
  return resolved;
}
