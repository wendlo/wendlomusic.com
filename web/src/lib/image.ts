/**
 * Image helpers.
 *
 * - `heroFocalStyle` computes the inline CSS custom properties (`--focal` /
 *   `--focal-m`) that the hero CSS consumes for desktop/mobile object-position.
 * - `resolveImageUrl` maps an (optionally empty) image to a concrete URL,
 *   falling back to a baked default asset.
 */

import type { CSSProperties } from 'react';
import type { HeroImage, ResolvedImage } from '@/lib/content/types';

/** Center default when no focal is specified. */
export const DEFAULT_FOCAL = '50% 50%';

/**
 * A minimal source-image shape accepted by `resolveImageUrl` — either an
 * already-resolved image, or a possibly-empty url (mirrors the prototype's
 * '' = use default).
 */
export interface MaybeImage {
  url?: string | null;
}

/**
 * Inline style carrying the hero focal custom properties.
 * `--focal`  → desktop object-position (defaults to "50% 50%").
 * `--focal-m` → mobile object-position (falls back to focalDesktop, then center).
 *
 * Returned as a plain object typed to allow the CSS custom properties, so it
 * can be spread straight onto a `style={...}` prop.
 */
export type FocalStyle = CSSProperties & {
  '--focal': string;
  '--focal-m': string;
};

/**
 * Compute `--focal` / `--focal-m` custom properties from a HeroImage.
 *   --focal   = focalDesktop ?? "50% 50%"
 *   --focal-m = focalMobile ?? focalDesktop ?? "50% 50%"
 */
export function heroFocalStyle(hero: Pick<HeroImage, 'focalDesktop' | 'focalMobile'>): FocalStyle {
  const focal = hero.focalDesktop || DEFAULT_FOCAL;
  const focalMobile = hero.focalMobile || hero.focalDesktop || DEFAULT_FOCAL;
  return {
    '--focal': focal,
    '--focal-m': focalMobile,
  };
}

/**
 * Resolve an image URL, falling back to a baked default when the source image
 * is empty/absent (mirrors the prototype's '' → default-asset rule).
 *
 * @param image      the (possibly empty) source image
 * @param defaultUrl the baked default asset to use when empty
 */
export function resolveImageUrl(
  image: MaybeImage | null | undefined,
  defaultUrl: string,
): string {
  const url = image?.url?.trim();
  return url ? url : defaultUrl;
}

/** Narrow a MaybeImage to a ResolvedImage using a baked default. */
export function resolveImage(
  image: MaybeImage | null | undefined,
  defaultUrl: string,
): ResolvedImage {
  return { url: resolveImageUrl(image, defaultUrl) };
}
