/**
 * Applies EditorPatches to a plain array, immutably — the same semantics as
 * Sanity's set / unset / insert for the paths the editor emits. Used by the
 * dev sandbox (its "dataset") and by the editor for optimistic updates, so the
 * canvas never flickers back while the Studio round-trips a patch.
 */

import type { EditorPatch, PathSegment } from './types';

type Node = unknown;

const isKeyed = (s: PathSegment): s is { _key: string } => typeof s === 'object' && s !== null;

function indexIn(arr: unknown[], seg: PathSegment): number {
  if (typeof seg === 'number') return seg < 0 ? arr.length + seg : seg;
  if (isKeyed(seg)) {
    return arr.findIndex((it) => (it as { _key?: string } | null)?._key === seg._key);
  }
  return -1;
}

function setIn(node: Node, path: PathSegment[], value: unknown): Node {
  if (path.length === 0) return value;
  const [seg, ...rest] = path;
  if (Array.isArray(node)) {
    const i = indexIn(node, seg);
    if (i < 0 || i >= node.length) return node; // missing item: no-op, like Sanity
    const copy = node.slice();
    copy[i] = setIn(copy[i], rest, value);
    return copy;
  }
  if (typeof seg !== 'string') return node;
  const obj = { ...((node && typeof node === 'object' ? node : {}) as Record<string, unknown>) };
  obj[seg] = setIn(obj[seg], rest, value);
  return obj;
}

function unsetIn(node: Node, path: PathSegment[]): Node {
  if (path.length === 0) return undefined;
  const [seg, ...rest] = path;
  if (Array.isArray(node)) {
    const i = indexIn(node, seg);
    if (i < 0 || i >= node.length) return node;
    if (rest.length === 0) return node.filter((_, j) => j !== i);
    const copy = node.slice();
    copy[i] = unsetIn(copy[i], rest);
    return copy;
  }
  if (!node || typeof node !== 'object' || typeof seg !== 'string') return node;
  const obj = { ...(node as Record<string, unknown>) };
  if (rest.length === 0) delete obj[seg];
  else obj[seg] = unsetIn(obj[seg], rest);
  return obj;
}

function getIn(node: Node, path: PathSegment[]): Node {
  let cur = node;
  for (const seg of path) {
    if (Array.isArray(cur)) cur = cur[indexIn(cur, seg)];
    else if (cur && typeof cur === 'object' && typeof seg === 'string') cur = (cur as Record<string, unknown>)[seg];
    else return undefined;
  }
  return cur;
}

function insertIn(node: Node, path: PathSegment[], position: 'before' | 'after', items: unknown[]): Node {
  if (path.length === 0) return node;
  const parentPath = path.slice(0, -1);
  const last = path[path.length - 1];
  const parent = getIn(node, parentPath);
  const arr = Array.isArray(parent) ? parent : [];
  let i = indexIn(arr, last);
  if (i < 0) i = position === 'after' ? arr.length - 1 : 0;
  const at = position === 'after' ? i + 1 : i;
  const next = [...arr.slice(0, at), ...items, ...arr.slice(at)];
  return setIn(node, parentPath, next);
}

export function applyPatch<T>(root: T[], patch: EditorPatch): T[] {
  let out: Node;
  switch (patch.type) {
    case 'set':
      out = setIn(root, patch.path, patch.value);
      break;
    case 'unset':
      out = unsetIn(root, patch.path);
      break;
    case 'insert':
      out = insertIn(root, patch.path, patch.position, patch.items);
      break;
  }
  return Array.isArray(out) ? (out as T[]) : [];
}

export function applyPatches<T>(root: T[], patches: EditorPatch[]): T[] {
  return patches.reduce((acc, p) => applyPatch(acc, p), root);
}
