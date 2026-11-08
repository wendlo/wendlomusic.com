/**
 * Home-page doodles: hand-drawn images/GIFs and text links the band places
 * freely over the home hero, separately for desktop and phone.
 *
 * Shared by the SITE (Shell → DoodleLayer) and the STUDIO editor
 * (DoodleCanvasInput), so the editor canvas is pixel-for-pixel the site.
 *
 * Geometry model (one rule for everything, so gaps never drift):
 *   - The layer is the stage, capped at DOODLE_LAYER_MAX_WIDTH and centred.
 *   - x / y  = the item's CENTRE, as % of the layer's width / height.
 *   - w      = image width, or text font-size, as % of the layer's width
 *              (CSS `cqw`) — so every item and every gap scales together.
 *   - rot    = degrees, about the centre.
 *   Desktop and phone each have their own placement; `hidden` hides the item
 *   on that device. Array order = paint order (later items on top).
 *
 * No React, no Sanity imports — safe for server, client and Studio code.
 */

import type { PageId } from '@/lib/content/types';

/* ------------------------------------------------------------------ *
 * Model
 * ------------------------------------------------------------------ */

export interface DoodlePlacement {
  /** centre, % of layer width */
  x: number;
  /** centre, % of layer height */
  y: number;
  /** image width or text font-size, % of layer width (cqw) */
  w: number;
  /** rotation, degrees */
  rot: number;
  /** hidden on this device */
  hidden?: boolean;
}

export type DoodleLinkKind = 'none' | 'page' | 'email-signup' | 'message' | 'url';

export interface DoodleLink {
  kind: DoodleLinkKind;
  /** for kind 'page' */
  page?: PageId;
  /** for kind 'url' (http/https) */
  url?: string;
}

export const DOODLE_COLORS = {
  white: '#ffffff',
  butter: 'var(--butter)',
  accent: 'var(--persimmon)',
  ink: 'var(--ink)',
} as const;
export type DoodleColor = keyof typeof DOODLE_COLORS;

interface DoodleBase {
  _key: string;
  link: DoodleLink;
  /** soft shadow so the item reads over a busy photo (default true) */
  shadow: boolean;
  desktop: DoodlePlacement;
  phone: DoodlePlacement;
}

export interface DoodleImage extends DoodleBase {
  kind: 'image';
  /** untransformed URL (keeps GIF animation) */
  src: string;
  /** intrinsic pixel size (aspect ratio) */
  width: number;
  height: number;
  /** required when linked; '' = decorative */
  alt: string;
}

export interface DoodleText extends DoodleBase {
  kind: 'text';
  text: string;
  color: DoodleColor;
}

export type Doodle = DoodleImage | DoodleText;

/** Reference frames the editor canvas uses (and the site matches). */
export const REF_DESKTOP = { w: 1440, h: 900 } as const;
export const REF_PHONE = { w: 390, h: 844 } as const;
/** The layer stops growing beyond this width (ultra-wide screens). */
export const DOODLE_LAYER_MAX_WIDTH = 1920;
/** Same queries as the phone layout in rooms.css. */
export const PHONE_MEDIA = '(max-width: 640px), (max-width: 899px) and (orientation: portrait)';

/* ------------------------------------------------------------------ *
 * Today's look, as doodles (fallback content + migration seed).
 * Measured on the live site at commit 3f95725:
 *   desktop 1440x900 — CTA text box centre (1142.2, 578.7), 22px font, -4°;
 *     click-here GIF 110px wide, centre (965.4, 578.3), -3°.
 *   phone 390x844 — CTA centre (289, 136.1), 15.5px font, -4°; GIF hidden.
 * ------------------------------------------------------------------ */

export const CLICK_HERE_SRC = '/click-here-white.gif';
export const CLICK_HERE_SIZE = { width: 866, height: 575 } as const;

const pctW = (px: number, ref: { w: number }) => +((px / ref.w) * 100).toFixed(4);
const pctH = (px: number, ref: { h: number }) => +((px / ref.h) * 100).toFixed(4);

export const LEGACY_DOODLES: Doodle[] = [
  {
    _key: 'clickhere',
    kind: 'image',
    src: CLICK_HERE_SRC,
    ...CLICK_HERE_SIZE,
    alt: '',
    shadow: true,
    link: { kind: 'email-signup' },
    desktop: { x: pctW(965.4, REF_DESKTOP), y: pctH(578.3, REF_DESKTOP), w: pctW(110, REF_DESKTOP), rot: -3 },
    phone: { x: 30, y: 16.13, w: 22, rot: -3, hidden: true },
  },
  {
    _key: 'emailcta',
    kind: 'text',
    text: 'join our email list!',
    color: 'white',
    shadow: true,
    link: { kind: 'email-signup' },
    desktop: { x: pctW(1142.2, REF_DESKTOP), y: pctH(578.7, REF_DESKTOP), w: pctW(22, REF_DESKTOP), rot: -4 },
    phone: { x: pctW(289, REF_PHONE), y: pctH(136.1, REF_PHONE), w: pctW(15.5, REF_PHONE), rot: -4 },
  },
];

/* ------------------------------------------------------------------ *
 * Sanity shapes (schema: doodleImage / doodleText / doodleLink /
 * doodlePlacement) → model. Used by map.ts AND the Studio editor, which only
 * has the form value (asset reference, no URL) — so URLs and sizes are
 * derived from the asset id: image-<hash>-<W>x<H>-<ext>.
 * ------------------------------------------------------------------ */

export interface RawDoodlePlacement {
  x?: number;
  y?: number;
  w?: number;
  rot?: number;
  hidden?: boolean;
}
export interface RawDoodleLink {
  kind?: string;
  page?: string;
  url?: string;
}
interface RawDoodleBase {
  _key?: string;
  _type?: string;
  link?: RawDoodleLink;
  shadow?: boolean;
  desktop?: RawDoodlePlacement;
  phone?: RawDoodlePlacement;
}
export interface RawDoodleImage extends RawDoodleBase {
  _type: 'doodleImage';
  image?: { asset?: { _ref?: string } } | null;
  alt?: string;
}
export interface RawDoodleText extends RawDoodleBase {
  _type: 'doodleText';
  text?: string;
  color?: string;
}
export type RawDoodle = RawDoodleImage | RawDoodleText;

export interface SanityProject {
  projectId: string;
  dataset: string;
}

const REF_RE = /^image-([a-f0-9]+)-(\d+)x(\d+)-([a-z0-9]+)$/i;

/** image-<hash>-<W>x<H>-<ext> → CDN URL (no transforms) + intrinsic size. */
export function assetFromRef(
  ref: string | undefined,
  project: SanityProject,
): { src: string; width: number; height: number } | null {
  const m = ref ? REF_RE.exec(ref) : null;
  if (!m) return null;
  const [, hash, w, h, ext] = m;
  return {
    src: `https://cdn.sanity.io/images/${project.projectId}/${project.dataset}/${hash}-${w}x${h}.${ext}`,
    width: Number(w),
    height: Number(h),
  };
}

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const PAGE_IDS_SET = new Set(['home', 'about', 'tour', 'contact', 'music', 'store', 'blog']);
const LINK_KINDS = new Set<DoodleLinkKind>(['none', 'page', 'email-signup', 'message', 'url']);

export function placementFrom(raw: RawDoodlePlacement | undefined, d: DoodlePlacement): DoodlePlacement {
  return {
    x: num(raw?.x, d.x),
    y: num(raw?.y, d.y),
    w: Math.max(0.2, num(raw?.w, d.w)),
    rot: num(raw?.rot, d.rot),
    hidden: raw?.hidden ?? d.hidden ?? false,
  };
}

export function linkFrom(raw: RawDoodleLink | undefined): DoodleLink {
  const kind = (LINK_KINDS.has(raw?.kind as DoodleLinkKind) ? raw?.kind : 'none') as DoodleLinkKind;
  if (kind === 'page') {
    return PAGE_IDS_SET.has(raw?.page ?? '') ? { kind, page: raw!.page as PageId } : { kind: 'none' };
  }
  if (kind === 'url') {
    const url = (raw?.url ?? '').trim();
    return /^https?:\/\//i.test(url) ? { kind, url } : { kind: 'none' };
  }
  return { kind };
}

/** A full http(s) address like https://example.com — the rule the Studio checks links against. */
export function isWebAddress(url: string | null | undefined): boolean {
  return /^https?:\/\/[^\s/.]+\.[^\s]+$/i.test((url ?? '').trim());
}

/**
 * Whether a link can do anything with the pages switched on right now: a page
 * link needs its page, and the two form links need Contact (the form sheets
 * live there). The site turns an unavailable doodle link into plain
 * decoration and leaves an unavailable custom nav item out of the menu; the
 * Studio previews apply the same rule.
 */
export function linkAvailable(link: DoodleLink, enabledPages: readonly string[]): boolean {
  switch (link.kind) {
    case 'page':
      return !!link.page && enabledPages.includes(link.page);
    case 'email-signup':
    case 'message':
      return enabledPages.includes('contact');
    default:
      return true;
  }
}

const DEFAULT_DESKTOP: DoodlePlacement = { x: 50, y: 50, w: 8, rot: 0 };
const DEFAULT_PHONE: DoodlePlacement = { x: 50, y: 50, w: 24, rot: 0 };
const DEFAULT_TEXT_DESKTOP: DoodlePlacement = { x: 50, y: 50, w: 1.5, rot: 0 };
const DEFAULT_TEXT_PHONE: DoodlePlacement = { x: 50, y: 50, w: 4, rot: 0 };

/** Sanity array → renderable doodles. Items with no usable image/text are dropped. */
export function doodlesFrom(raw: RawDoodle[] | null | undefined, project: SanityProject): Doodle[] {
  const out: Doodle[] = [];
  for (const [i, r] of (raw ?? []).entries()) {
    const _key = r._key || `d${i}`;
    const link = linkFrom(r.link);
    const shadow = r.shadow ?? true;
    if (r._type === 'doodleImage') {
      const a = assetFromRef(r.image?.asset?._ref, project);
      if (!a) continue;
      out.push({
        _key, kind: 'image', ...a, alt: (r.alt ?? '').trim(), link, shadow,
        desktop: placementFrom(r.desktop, DEFAULT_DESKTOP),
        phone: placementFrom(r.phone, DEFAULT_PHONE),
      });
    } else if (r._type === 'doodleText') {
      const text = (r.text ?? '').trim();
      if (!text) continue;
      const color = (r.color && r.color in DOODLE_COLORS ? r.color : 'white') as DoodleColor;
      out.push({
        _key, kind: 'text', text, color, link, shadow,
        desktop: placementFrom(r.desktop, DEFAULT_TEXT_DESKTOP),
        phone: placementFrom(r.phone, DEFAULT_TEXT_PHONE),
      });
    }
  }
  return out;
}

/** Defaults for a newly added item (editor). */
export const NEW_PLACEMENTS = {
  image: { desktop: DEFAULT_DESKTOP, phone: DEFAULT_PHONE },
  text: { desktop: DEFAULT_TEXT_DESKTOP, phone: DEFAULT_TEXT_PHONE },
} as const;

/* ------------------------------------------------------------------ *
 * Rendering helpers
 * ------------------------------------------------------------------ */

const r4 = (n: number) => +n.toFixed(4);

/** CSS custom properties consumed by .doodle in doodles.css. */
export function doodleVars(d: Doodle): Record<string, string> {
  const v: Record<string, string> = {
    '--dx': String(r4(d.desktop.x)),
    '--dy': String(r4(d.desktop.y)),
    '--dw': String(r4(d.desktop.w)),
    '--dr': String(r4(d.desktop.rot)),
    '--mx': String(r4(d.phone.x)),
    '--my': String(r4(d.phone.y)),
    '--mw': String(r4(d.phone.w)),
    '--mr': String(r4(d.phone.rot)),
  };
  if (d.kind === 'image') v['--ar'] = `${d.width} / ${d.height}`;
  if (d.kind === 'text') v['--c'] = DOODLE_COLORS[d.color];
  return v;
}

/** href for a doodle link ('' = not a link). */
export function doodleHref(link: DoodleLink): string {
  switch (link.kind) {
    case 'page':
      return `#${link.page}`;
    case 'email-signup':
    case 'message':
      return '#contact';
    case 'url':
      return link.url ?? '';
    default:
      return '';
  }
}

/** Window event the contact room listens for to open a form sheet. */
export const OPEN_SHEET_EVENT = 'wendlo:open-sheet';
export type OpenSheetDetail = 'email' | 'message';
