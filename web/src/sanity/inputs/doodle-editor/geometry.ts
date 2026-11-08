/**
 * Canvas maths in REFERENCE pixels (the canvas is exactly REF_DESKTOP or
 * REF_PHONE, so these numbers are what the site shows at that size).
 */

import { REF_DESKTOP, REF_PHONE, type DoodlePlacement } from '@/lib/doodles';
import type { Device } from './types';

export const REF: Record<Device, { w: number; h: number }> = { desktop: REF_DESKTOP, phone: REF_PHONE };

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const MIN_SIZE = 0.3;
export const MAX_SIZE = 60;

/** Unrotated box of an item, centre + size, in reference px. */
export interface Box {
  key: string;
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export function boxOf(key: string, p: DoodlePlacement, size: { w: number; h: number }, device: Device): Box {
  const ref = REF[device];
  return { key, cx: (p.x / 100) * ref.w, cy: (p.y / 100) * ref.h, w: size.w, h: size.h };
}

export interface Gap {
  to: Box;
  /** edge-to-edge horizontal gap; negative = the boxes overlap across */
  dx: number;
  /** edge-to-edge vertical gap; negative = the boxes overlap down */
  dy: number;
  /** centre-to-centre offsets (absolute) */
  ddx: number;
  ddy: number;
}

export function gapBetween(a: Box, b: Box): Gap {
  const dx = Math.max(b.cx - b.w / 2 - (a.cx + a.w / 2), a.cx - a.w / 2 - (b.cx + b.w / 2));
  const dy = Math.max(b.cy - b.h / 2 - (a.cy + a.h / 2), a.cy - a.h / 2 - (b.cy + b.h / 2));
  return { to: b, dx, dy, ddx: Math.abs(a.cx - b.cx), ddy: Math.abs(a.cy - b.cy) };
}

/** The other box closest to `a` (edge-to-edge distance). */
export function nearestGap(a: Box, others: Box[]): Gap | null {
  let best: Gap | null = null;
  let bestD = Infinity;
  for (const b of others) {
    if (b.key === a.key) continue;
    const g = gapBetween(a, b);
    const d = Math.hypot(Math.max(0, g.dx), Math.max(0, g.dy));
    // tie-break overlapping boxes by centre distance
    const score = d === 0 ? -1 / (1 + Math.hypot(g.ddx, g.ddy)) : d;
    if (score < bestD) {
      bestD = score;
      best = g;
    }
  }
  return best;
}

/**
 * Plain words for one axis of a gap: "46 px gap"; when the boxes overlap on
 * this axis but are apart on the other, they sit side by side, so say how
 * level they are (centre to centre).
 */
export function describeAxis(edge: number, centre: number, otherEdge: number): string {
  if (edge >= 0) return `${Math.round(edge)} px gap`;
  if (otherEdge >= 0) return `side by side (centres ${Math.round(centre)} px apart)`;
  return `overlapping (centres ${Math.round(centre)} px apart)`;
}

/** Degrees into (-180, 180]. */
export function normDeg(deg: number): number {
  let d = ((deg % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

/** Rotation snapping: 0° within ±3°, or 15° steps with Shift. */
export function snapAngle(deg: number, shift: boolean): number {
  const d = normDeg(deg);
  if (shift) return normDeg(Math.round(d / 15) * 15);
  return Math.abs(d) <= 3 ? 0 : d;
}

/** Placement rounded the way it is stored. */
export function roundPlacement(p: DoodlePlacement): DoodlePlacement {
  return { x: round2(p.x), y: round2(p.y), w: round2(p.w), rot: round2(p.rot), hidden: !!p.hidden };
}

export function samePlacement(a: DoodlePlacement, b: DoodlePlacement): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.rot === b.rot && !!a.hidden === !!b.hidden;
}

/** The stored shape of a placement (with its Sanity _type). */
export function placementValue(p: DoodlePlacement) {
  const r = roundPlacement(p);
  return { _type: 'doodlePlacement', x: r.x, y: r.y, w: r.w, rot: r.rot, hidden: r.hidden };
}
