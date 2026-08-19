/**
 * <Hero> — the full-bleed background image behind a room, with Ken-Burns
 * (home only, via the `.room[data-page=home] .hero` CSS rule) and focal-point
 * object-position driven by `--focal` / `--focal-m` custom properties.
 *
 * Server component (no interactivity). The prototype set the hero via
 * `background-image` + `--focal`/`--focal-m` on the room; we do the same here.
 * Pass the resolved HeroImage; focal is applied through heroFocalStyle.
 */

import type { HeroImage } from '@/lib/content/types';
import { heroFocalStyle } from '@/lib/image';

export interface HeroProps {
  /** Resolved hero image; `url` is always concrete (baked default inlined). */
  hero: HeroImage;
  /** Extra classes on the .hero element (e.g. none — scrims live on .room). */
  className?: string;
}

/**
 * Renders `<div class="hero" style="background-image:…; --focal:…; --focal-m:…">`.
 * The `::after` scrim and Ken-Burns come from CSS keyed on the room/page.
 */
export function Hero({ hero, className }: HeroProps) {
  return (
    <div
      className={className ? `hero ${className}` : 'hero'}
      style={{
        backgroundImage: `url("${hero.url}")`,
        ...heroFocalStyle(hero),
      }}
    />
  );
}
