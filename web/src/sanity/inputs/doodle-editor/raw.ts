/**
 * Builders for the stored (Sanity) shape of doodles: new items, duplicates,
 * and model → raw (used by the sandbox to seed LEGACY_DOODLES).
 */

import {
  NEW_PLACEMENTS,
  doodlesFrom,
  type Doodle,
  type DoodlePlacement,
  type RawDoodle,
  type RawDoodleImage,
  type RawDoodleText,
  type SanityProject,
} from '@/lib/doodles';
import { placementValue } from './geometry';
import type { ImageUrlResolver } from './types';

const KEY_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Random 12-char array key. */
export function newKey(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => KEY_CHARS[b % KEY_CHARS.length]).join('');
}

export function linkValue(link: { kind: string; page?: string; url?: string }) {
  return {
    _type: 'doodleLink',
    kind: link.kind,
    ...(link.kind === 'page' && link.page ? { page: link.page } : {}),
    ...(link.kind === 'url' && link.url !== undefined ? { url: link.url } : {}),
  };
}

export function newImageItem(ref: string): RawDoodleImage {
  return {
    _type: 'doodleImage',
    _key: newKey(),
    image: { _type: 'image', asset: { _type: 'reference', _ref: ref } },
    alt: '',
    shadow: true,
    link: linkValue({ kind: 'none' }),
    desktop: placementValue(NEW_PLACEMENTS.image.desktop),
    phone: placementValue(NEW_PLACEMENTS.image.phone),
  } as RawDoodleImage;
}

export function newTextItem(): RawDoodleText {
  return {
    _type: 'doodleText',
    _key: newKey(),
    text: 'new link',
    color: 'white',
    shadow: true,
    link: linkValue({ kind: 'none' }),
    desktop: placementValue(NEW_PLACEMENTS.text.desktop),
    phone: placementValue(NEW_PLACEMENTS.text.phone),
  } as RawDoodleText;
}

/** Deep copy with a fresh key and a new placement on one device. */
export function duplicateItem(
  item: RawDoodle,
  device: 'desktop' | 'phone',
  placement: DoodlePlacement,
): RawDoodle {
  const copy = JSON.parse(JSON.stringify(item)) as RawDoodle;
  copy._key = newKey();
  copy[device] = placementValue(placement);
  return copy;
}

/** Model → stored shape. `ref` = the image asset ref for image doodles. */
export function rawFromDoodle(d: Doodle, ref?: string): RawDoodle {
  const base = {
    _key: d._key,
    shadow: d.shadow,
    link: linkValue(d.link),
    desktop: placementValue(d.desktop),
    phone: placementValue(d.phone),
  };
  if (d.kind === 'image') {
    return {
      ...base,
      _type: 'doodleImage',
      image: { _type: 'image', asset: { _type: 'reference', _ref: ref ?? '' } },
      alt: d.alt,
    } as RawDoodleImage;
  }
  return { ...base, _type: 'doodleText', text: d.text, color: d.color } as RawDoodleText;
}

/** Image asset ref of a raw item ('' for text / missing). */
export function refOf(item: RawDoodle | undefined): string {
  return item?._type === 'doodleImage' ? (item.image?.asset?._ref ?? '') : '';
}

/** doodlesFrom() plus an optional URL override for image assets (sandbox). */
export function resolveDoodles(
  raw: RawDoodle[],
  project: SanityProject,
  resolveImageUrl?: ImageUrlResolver,
): Doodle[] {
  const items = doodlesFrom(raw, project);
  if (!resolveImageUrl) return items;
  const refs = new Map(raw.map((r) => [r._key, refOf(r)]));
  return items.map((d) => {
    if (d.kind !== 'image') return d;
    const src = resolveImageUrl(refs.get(d._key) ?? '');
    return src ? { ...d, src } : d;
  });
}
