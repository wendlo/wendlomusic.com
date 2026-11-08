/**
 * Shared types for the doodle editor. The editor never imports Sanity: it
 * speaks EditorPatch, which DoodleCanvasInput maps 1:1 onto set / unset /
 * insert from 'sanity' and the dev sandbox applies with applyPatches().
 * Paths are relative to the doodles array.
 */

/** Sanity-style path segment: field name, array index, or keyed array item. */
export type PathSegment = string | number | { _key: string };

export type EditorPatch =
  | { type: 'set'; path: PathSegment[]; value: unknown }
  | { type: 'unset'; path: PathSegment[] }
  | { type: 'insert'; position: 'before' | 'after'; path: PathSegment[]; items: unknown[] };

export type Device = 'desktop' | 'phone';

export interface EditorHero {
  /** background image URL */
  src: string;
  /** CSS background-position, "X% Y%" */
  focalDesktop: string;
  focalPhone: string;
}

/**
 * Turns an image asset ref into a URL. Return undefined to fall back to the
 * Sanity CDN URL from assetFromRef(). The sandbox uses it for fake assets.
 */
export type ImageUrlResolver = (ref: string) => string | undefined;
