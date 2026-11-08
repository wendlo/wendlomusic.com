'use client';

/**
 * Full-screen visual editor for the home-page doodles. Knows nothing about
 * Sanity: it reads `value` (the stored array) and reports changes as
 * EditorPatches (paths relative to the array). DoodleCanvasInput wires it to
 * the Studio form; /dev/doodle-editor wires it to local state.
 *
 * While a drag is in progress the change stays local (`live`); one patch is
 * sent on pointer-up. Every change keeps a snapshot for Undo/Redo, and undo
 * sets the whole array.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  NEW_PLACEMENTS,
  placementFrom,
  type Doodle,
  type DoodlePlacement,
  type RawDoodle,
  type RawDoodleLink,
  type SanityProject,
} from '@/lib/doodles';
import { DoodleCanvas, type GhostNavEntry } from './DoodleCanvas';
import { EditorStyles } from './EditorStyles';
import {
  boxOf,
  clamp,
  describeAxis,
  MAX_SIZE,
  MIN_SIZE,
  nearestGap,
  placementValue,
  REF,
  round2,
  roundPlacement,
  samePlacement,
  snapAngle,
  type Box,
  type Gap,
} from './geometry';
import { Inspector, type InspectorItem } from './Inspector';
import { applyPatches } from './patches';
import { duplicateItem, newImageItem, newTextItem, refOf, resolveDoodles } from './raw';
import type { Device, EditorHero, EditorPatch, ImageUrlResolver } from './types';

export interface DoodleEditorProps {
  value: RawDoodle[];
  project: SanityProject;
  hero: EditorHero;
  /** enabled fixed page ids (inspector's page list; ghost nav by default) */
  navPages: string[];
  /** the full nav row for the ghost nav, custom items included */
  navEntries?: GhostNavEntry[];
  readOnly?: boolean;
  onPatch(patches: EditorPatch[]): void;
  onUpload(file: File): Promise<{ _ref: string }>;
  onClose(): void;
  /** override image URLs (sandbox fake assets); default = Sanity CDN */
  resolveImageUrl?: ImageUrlResolver;
  /** CSS custom properties copied from the Studio (portal is outside its theme) */
  themeVars?: Record<string, string>;
  /** portal = full screen over everything (Studio); inline = fill the parent */
  mount?: 'portal' | 'inline';
}

const MAX_BYTES = 1024 * 1024;
const WARN_BYTES = 300 * 1024;
const HISTORY_LIMIT = 100;
/** typing / nudging within this window is one undo step */
const COALESCE_MS = 1200;
/** how long a sent change is shown before trusting `value` again */
const OPTIMISTIC_MS = 1500;
/** pointer travel (screen px) before a press becomes a drag */
const DRAG_THRESHOLD = 3;
const CORNERS = ['nw', 'ne', 'sw', 'se'] as const;

type GestureKind = 'move' | 'resize' | 'rotate';
interface Live {
  key: string;
  device: Device;
  placement: DoodlePlacement;
}
interface Notice {
  tone: 'info' | 'warn' | 'error';
  text: string;
}
interface Runtime {
  endGesture: ((commit: boolean) => void) | null;
  flashTimer: number;
  coalesce: { key: string; at: number } | null;
  pendingFocus: string | null;
  insertItems: (items: RawDoodle[], afterKey?: string) => void;
}

const subscribeNoop = () => () => {};
const kb = (n: number) => `${Math.round(n / 1024)} KB`;
const mb = (n: number) => `${(n / (1024 * 1024)).toFixed(1)} MB`;

function withPlacement<T extends Doodle>(d: T, device: Device, p: DoodlePlacement): T {
  return device === 'desktop' ? { ...d, desktop: p } : { ...d, phone: p };
}

function nameFor(raw: RawDoodle, index: number, all: RawDoodle[]): string {
  if (raw._type === 'doodleText') {
    const t = (raw.text ?? '').trim();
    return t ? `“${t}”` : 'Text (empty)';
  }
  const alt = (raw.alt ?? '').trim();
  if (alt) return alt;
  const n = all.slice(0, index + 1).filter((r) => r._type === 'doodleImage').length;
  return `${/-gif$/i.test(refOf(raw)) ? 'GIF' : 'Picture'} ${n}`;
}

function cleanLink(link: RawDoodleLink) {
  // page / url are kept even when another kind is picked, so switching back
  // doesn't lose them; the site only reads the one that matches `kind`.
  return {
    _type: 'doodleLink',
    kind: link.kind ?? 'none',
    ...(link.page ? { page: link.page } : {}),
    ...(link.url !== undefined ? { url: link.url } : {}),
  };
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
}

/** Keep React events inside the editor from reaching Studio handlers above the portal. */
const stop = (e: SyntheticEvent) => e.stopPropagation();
const STOPPERS = {
  onClick: stop,
  onDoubleClick: stop,
  onPointerDown: stop,
  onPointerUp: stop,
  onMouseDown: stop,
  onKeyUp: stop,
  onFocus: stop,
  onBlur: stop,
  onChange: stop,
  onInput: stop,
  onPaste: stop,
  onCopy: stop,
  onCut: stop,
  onDragStart: stop,
  onContextMenu: stop,
};

export function DoodleEditor({
  value,
  project,
  hero,
  navPages,
  navEntries,
  readOnly = false,
  onPatch,
  onUpload,
  onClose,
  resolveImageUrl,
  themeVars,
  mount = 'portal',
}: DoodleEditorProps) {
  const isClient = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const runtime = useRef<Runtime>({
    endGesture: null,
    flashTimer: 0,
    coalesce: null,
    pendingFocus: null,
    insertItems: () => {},
  });

  const [device, setDevice] = useState<Device>('desktop');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [gesture, setGesture] = useState<GestureKind | null>(null);
  const [flash, setFlash] = useState(false);
  const [optimistic, setOptimistic] = useState<RawDoodle[] | null>(null);
  const [history, setHistory] = useState<{ past: RawDoodle[][]; future: RawDoodle[][] }>({
    past: [],
    future: [],
  });
  const [sizes, setSizes] = useState<Record<string, { w: number; h: number }>>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [uploading, setUploading] = useState(false);

  /* ---------------- data ---------------- */

  const current = optimistic ?? value;

  // After sending a change, show it straight away; `value` takes over again
  // once the host has had time to echo it back.
  useEffect(() => {
    if (!optimistic) return;
    const t = window.setTimeout(() => setOptimistic(null), OPTIMISTIC_MS);
    return () => window.clearTimeout(t);
  }, [optimistic]);

  const model = useMemo(
    () => resolveDoodles(current, project, resolveImageUrl),
    [current, project, resolveImageUrl],
  );

  const shown = useMemo(
    () => (live ? model.map((d) => (d._key === live.key ? withPlacement(d, live.device, live.placement) : d)) : model),
    [model, live],
  );

  // Items hidden on this device stay on the canvas, faded, so they can still be picked.
  const hiddenKeys = useMemo(
    () => new Set(shown.filter((d) => d[device].hidden).map((d) => d._key)),
    [shown, device],
  );
  const canvasItems = useMemo(
    () => shown.map((d) => (d[device].hidden ? withPlacement(d, device, { ...d[device], hidden: false }) : d)),
    [shown, device],
  );

  const items: InspectorItem[] = useMemo(
    () =>
      current.map((r, i) => {
        const key = r._key ?? `d${i}`;
        const m = shown.find((d) => d._key === key);
        const defaults = r._type === 'doodleText' ? NEW_PLACEMENTS.text : NEW_PLACEMENTS.image;
        return {
          key,
          raw: r,
          name: nameFor(r, i, current),
          src: m?.kind === 'image' ? m.src : undefined,
          desktop: m?.desktop ?? placementFrom(r.desktop, defaults.desktop),
          phone: m?.phone ?? placementFrom(r.phone, defaults.phone),
          renderable: !!m,
        };
      }),
    [current, shown],
  );
  const selected = items.find((it) => it.key === selectedKey) ?? null;
  const nameOf = (key: string) => items.find((it) => it.key === key)?.name ?? 'item';

  /* ---------------- measuring (reference px) ---------------- */

  const keySig = canvasItems.map((d) => d._key).join('|');
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const els = Array.from(stage.querySelectorAll<HTMLElement>('.doodle[data-key]'));
    const ro = new ResizeObserver(() => {
      const next: Record<string, { w: number; h: number }> = {};
      for (const el of els) next[el.dataset.key ?? ''] = { w: el.offsetWidth, h: el.offsetHeight };
      setSizes((prev) => {
        const keys = Object.keys(next);
        const same =
          keys.length === Object.keys(prev).length &&
          keys.every((k) => prev[k] && prev[k].w === next[k].w && prev[k].h === next[k].h);
        return same ? prev : next;
      });
    });
    els.forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, [keySig, device, isClient]);

  const boxes = useMemo(() => {
    const out: Box[] = [];
    for (const d of shown) {
      const s = sizes[d._key];
      if (!s || d[device].hidden) continue;
      out.push(boxOf(d._key, d[device], s, device));
    }
    return out;
  }, [shown, sizes, device]);

  const selDoodle = selectedKey ? canvasItems.find((d) => d._key === selectedKey) : undefined;
  const selBox =
    selDoodle && sizes[selDoodle._key] ? boxOf(selDoodle._key, selDoodle[device], sizes[selDoodle._key], device) : null;
  const gap: Gap | null = selBox ? nearestGap(selBox, boxes) : null;
  const gapName = gap ? nameOf(gap.to.key) : '';

  /* ---------------- changes ---------------- */

  const emit = useCallback(
    (patches: EditorPatch[], coalesce?: string) => {
      if (readOnly || patches.length === 0) return;
      const rt = runtime.current;
      const now = Date.now();
      const merge = !!coalesce && rt.coalesce?.key === coalesce && now - rt.coalesce.at < COALESCE_MS;
      rt.coalesce = coalesce ? { key: coalesce, at: now } : null;
      if (!merge) setHistory((h) => ({ past: [...h.past, current].slice(-HISTORY_LIMIT), future: [] }));
      setOptimistic(applyPatches(current, patches));
      onPatch(patches);
    },
    [current, onPatch, readOnly],
  );

  const restore = (snapshot: RawDoodle[]) => {
    runtime.current.coalesce = null;
    setOptimistic(snapshot);
    onPatch([{ type: 'set', path: [], value: snapshot }]);
  };
  const undo = () => {
    if (readOnly || history.past.length === 0) return;
    const prev = history.past[history.past.length - 1];
    setHistory({ past: history.past.slice(0, -1), future: [current, ...history.future].slice(0, HISTORY_LIMIT) });
    restore(prev);
  };
  const redo = () => {
    if (readOnly || history.future.length === 0) return;
    const [next, ...rest] = history.future;
    setHistory({ past: [...history.past, current].slice(-HISTORY_LIMIT), future: rest });
    restore(next);
  };

  const setPlacement = (key: string, dev: Device, p: DoodlePlacement, coalesce?: string) =>
    emit([{ type: 'set', path: [{ _key: key }, dev], value: placementValue(p) }], coalesce);

  const insertItems = (newItems: RawDoodle[], afterKey?: string) => {
    const anchor = afterKey ?? current[current.length - 1]?._key;
    emit(
      anchor
        ? [{ type: 'insert', position: 'after', path: [{ _key: anchor }], items: newItems }]
        : [{ type: 'set', path: [], value: [...current, ...newItems] }],
    );
  };
  // the upload finishes after other renders; it must insert into the latest array
  useEffect(() => {
    runtime.current.insertItems = insertItems;
  });

  const showFlash = () => {
    const rt = runtime.current;
    setFlash(true);
    window.clearTimeout(rt.flashTimer);
    rt.flashTimer = window.setTimeout(() => setFlash(false), 1600);
  };

  const nudge = (key: string, dxPx: number, dyPx: number) => {
    const it = items.find((i) => i.key === key);
    if (!it) return;
    const p = it[device];
    const ref = REF[device];
    setPlacement(
      key,
      device,
      { ...p, x: clamp(p.x + (dxPx / ref.w) * 100, 0, 100), y: clamp(p.y + (dyPx / ref.h) * 100, 0, 100) },
      `nudge:${key}:${device}`,
    );
    showFlash();
  };

  const duplicate = (key: string) => {
    const it = items.find((i) => i.key === key);
    if (!it || readOnly) return;
    const ref = REF[device];
    const p = it[device];
    const copy = duplicateItem(it.raw, device, {
      ...p,
      x: clamp(p.x + (20 / ref.w) * 100, 0, 100),
      y: clamp(p.y + (20 / ref.h) * 100, 0, 100),
    });
    insertItems([copy], key);
    setSelectedKey(copy._key ?? null);
  };

  const reorder = (key: string, dir: 1 | -1) => {
    const i = current.findIndex((r) => r._key === key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= current.length) return;
    const next = current.slice();
    [next[i], next[j]] = [next[j], next[i]];
    emit([{ type: 'set', path: [], value: next }]);
  };

  const copyPosition = (key: string, from: Device, to: Device) => {
    const it = items.find((i) => i.key === key);
    if (!it) return;
    const src = it[from];
    // same spot as a share of the screen, same size in pixels
    const w = clamp((src.w * REF[from].w) / REF[to].w, MIN_SIZE, MAX_SIZE);
    setPlacement(key, to, { x: src.x, y: src.y, w, rot: src.rot, hidden: it[to].hidden });
    setNotice({ tone: 'info', text: `Copied the ${from} position to ${to}. Switch to ${to === 'phone' ? 'Phone' : 'Desktop'} to check it.` });
  };

  const remove = (key: string) => {
    if (readOnly) return;
    if (!window.confirm(`Delete ${nameOf(key)}? (Undo brings it back.)`)) return;
    emit([{ type: 'unset', path: [{ _key: key }] }]);
    setSelectedKey(null);
    rootRef.current?.focus();
  };

  const addText = () => {
    const item = newTextItem();
    const key = item._key ?? '';
    insertItems([item]);
    setSelectedKey(key);
    runtime.current.pendingFocus = key;
  };

  const textInputRef = useCallback((el: HTMLInputElement | null) => {
    const rt = runtime.current;
    if (el && rt.pendingFocus && el.dataset.key === rt.pendingFocus) {
      rt.pendingFocus = null;
      el.focus();
      el.select();
    }
  }, []);

  const onFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setNotice({ tone: 'error', text: `“${file.name}” isn’t a picture. Use a GIF, PNG, JPG or WebP file.` });
      return;
    }
    if (file.size > MAX_BYTES) {
      setNotice({
        tone: 'error',
        text: `“${file.name}” is ${mb(file.size)} — the limit is 1 MB so the home page stays quick. Try a smaller version (for a GIF: fewer frames or colours; ezgif.com can shrink it).`,
      });
      return;
    }
    const heavy = file.size > WARN_BYTES;
    setUploading(true);
    setNotice({ tone: 'info', text: `Uploading “${file.name}”…` });
    try {
      const { _ref } = await onUpload(file);
      const item = newImageItem(_ref);
      runtime.current.insertItems([item]);
      setSelectedKey(item._key ?? null);
      setNotice(
        heavy
          ? {
              tone: 'warn',
              text: `Added. Heads-up: “${file.name}” is ${kb(file.size)}, which is on the heavy side and may load slowly on phones. Under 300 KB is best.`,
            }
          : null,
      );
    } catch (err) {
      setNotice({
        tone: 'error',
        text: `Couldn’t upload “${file.name}”. ${err instanceof Error ? err.message : ''} Please try again.`,
      });
    } finally {
      setUploading(false);
    }
  };

  /* ---------------- pointer gestures ---------------- */

  const startGesture = (e: ReactPointerEvent<Element>, key: string, kind: GestureKind) => {
    const stage = stageRef.current;
    const d = canvasItems.find((it) => it._key === key);
    if (!stage || !d || readOnly) return;
    runtime.current.endGesture?.(false);
    const ref = REF[device];
    const dev = device;
    const rect = stage.getBoundingClientRect();
    const k = rect.width / ref.w;
    // the stored placement (the canvas copy has `hidden` cleared)
    const start = items.find((i) => i.key === key)?.[dev] ?? d[dev];
    const cx = rect.left + (start.x / 100) * rect.width;
    const cy = rect.top + (start.y / 100) * rect.height;
    const sx = e.clientX;
    const sy = e.clientY;
    const pid = e.pointerId;
    const startDist = Math.max(1, Math.hypot(sx - cx, sy - cy));
    let latest = start;
    let active = false;
    const save = emit; // the array as it was when the press started

    try {
      e.currentTarget.setPointerCapture(pid);
    } catch {
      /* not capturable (e.g. synthetic events) — window listeners still work */
    }

    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      if (!active) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_THRESHOLD) return;
        active = true;
        setGesture(kind);
      }
      let next: DoodlePlacement;
      if (kind === 'move') {
        next = {
          ...start,
          x: round2(clamp(start.x + ((ev.clientX - sx) / k / ref.w) * 100, 0, 100)),
          y: round2(clamp(start.y + ((ev.clientY - sy) / k / ref.h) * 100, 0, 100)),
        };
      } else if (kind === 'resize') {
        const dist = Math.hypot(ev.clientX - cx, ev.clientY - cy);
        next = { ...start, w: round2(clamp((start.w * dist) / startDist, MIN_SIZE, MAX_SIZE)) };
      } else {
        const deg = (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI + 90;
        next = { ...start, rot: round2(snapAngle(deg, ev.shiftKey)) };
      }
      latest = next;
      setLive({ key, device: dev, placement: next });
    };
    const end = (commit: boolean) => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', cancel, true);
      runtime.current.endGesture = null;
      setLive(null);
      setGesture(null);
      if (commit && active) {
        const final = roundPlacement(latest);
        if (!samePlacement(final, roundPlacement(start))) {
          save([{ type: 'set', path: [{ _key: key }, dev], value: placementValue(final) }]);
        }
      }
    };
    const up = (ev: PointerEvent) => ev.pointerId === pid && end(true);
    const cancel = (ev: PointerEvent) => ev.pointerId === pid && end(false);
    // capture phase: the editor root stops React pointer events from bubbling
    // past it (to keep them away from Studio handlers), so bubbling never
    // reaches window
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', cancel, true);
    runtime.current.endGesture = end;
  };

  useEffect(() => {
    const rt = runtime.current;
    return () => {
      rt.endGesture?.(false);
      window.clearTimeout(rt.flashTimer);
    };
  }, []);

  const onItemPointerDown = (e: ReactPointerEvent<HTMLElement>, key: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault(); // no text selection / native image drag
    setSelectedKey(key);
    e.currentTarget.focus({ preventScroll: true });
    startGesture(e, key, 'move');
  };

  const onHandlePointerDown = (e: ReactPointerEvent<HTMLElement>, kind: GestureKind) => {
    if (e.button !== 0 || !selectedKey) return;
    e.stopPropagation();
    e.preventDefault();
    startGesture(e, selectedKey, kind);
  };

  /* ---------------- keyboard ---------------- */

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation(); // Studio shortcuts stay out of the editor
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key;
    if (key === 'Escape') {
      e.preventDefault();
      if (runtime.current.endGesture) runtime.current.endGesture(false);
      else if (isTyping(e.target)) rootRef.current?.focus();
      else if (selectedKey) setSelectedKey(null);
      else onClose();
      return;
    }
    if (isTyping(e.target)) return;
    if (mod && key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if (mod && key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
      return;
    }
    if (!selectedKey || readOnly) return;
    if (mod && key.toLowerCase() === 'd') {
      e.preventDefault();
      duplicate(selectedKey);
      return;
    }
    if (key === 'Delete' || key === 'Backspace') {
      e.preventDefault();
      remove(selectedKey);
      return;
    }
    const step = e.shiftKey ? 10 : 1;
    const dir: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (dir[key] && !mod) {
      e.preventDefault();
      nudge(selectedKey, dir[key][0], dir[key][1]);
    }
  };

  useEffect(() => {
    if (isClient) rootRef.current?.focus({ preventScroll: true });
  }, [isClient]);

  /* ---------------- render ---------------- */

  const itemProps = (d: Doodle) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => onItemPointerDown(e, d._key),
    onFocus: () => setSelectedKey(d._key),
    tabIndex: 0,
    role: 'button',
    'aria-label': `${nameOf(d._key)}${hiddenKeys.has(d._key) ? ` (hidden on ${device})` : ''}`,
    'aria-hidden': undefined,
    'data-de-hidden': hiddenKeys.has(d._key) ? 'true' : undefined,
    'data-de-selected': d._key === selectedKey ? 'true' : undefined,
  });

  const showGap = !!gap && !!selBox && (gesture === 'move' || gesture === 'resize' || flash);
  const ref = REF[device];

  const overlay =
    selBox && selDoodle ? (
      <>
        {showGap && gap ? <GapMarks a={selBox} gap={gap} name={gapName} refW={ref.w} refH={ref.h} /> : null}
        <div
          className="de-sel"
          style={{
            left: selBox.cx - selBox.w / 2,
            top: selBox.cy - selBox.h / 2,
            width: selBox.w,
            height: selBox.h,
            transform: `rotate(${selDoodle[device].rot}deg)`,
          }}
        >
          <div className="de-sel-outline">
            {!readOnly ? (
              <>
                <span className="de-rot-stem" />
                <button
                  type="button"
                  tabIndex={-1}
                  className="de-rot"
                  aria-label="Tilt"
                  title="Drag to tilt (hold Shift for 15° steps)"
                  onPointerDown={(e) => onHandlePointerDown(e, 'rotate')}
                />
                {CORNERS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    tabIndex={-1}
                    className="de-handle"
                    data-corner={c}
                    aria-label="Resize"
                    title="Drag to resize"
                    onPointerDown={(e) => onHandlePointerDown(e, 'resize')}
                  />
                ))}
              </>
            ) : null}
          </div>
        </div>
      </>
    ) : null;

  const stageClass = [readOnly ? '' : 'de-editable', gesture === 'move' ? 'de-dragging' : '']
    .filter(Boolean)
    .join(' ');

  const ui = (
    <div
      ref={rootRef}
      className="de-root"
      data-mount={mount}
      role="dialog"
      aria-modal={mount === 'portal' ? true : undefined}
      aria-label="Visual editor for the doodles and links on the home photo"
      tabIndex={-1}
      style={themeVars as CSSProperties | undefined}
      {...STOPPERS}
      onKeyDown={onKeyDown}
    >
      <EditorStyles />
      <div className="de-topbar">
        <span className="de-title">Home photo</span>
        <div className="de-seg" role="group" aria-label="Which screen to arrange">
          <button
            type="button"
            aria-pressed={device === 'desktop'}
            onClick={() => setDevice('desktop')}
            title="Arrange for computers and sideways tablets (shown at 1440×900)"
          >
            Desktop
          </button>
          <button
            type="button"
            aria-pressed={device === 'phone'}
            onClick={() => setDevice('phone')}
            title="Arrange for phones and most upright tablets (shown at 390×844)"
          >
            Phone
          </button>
        </div>
        <span className="de-sep" aria-hidden />
        <button
          type="button"
          className="de-btn"
          disabled={readOnly || uploading}
          onClick={() => fileRef.current?.click()}
          title="Upload a picture or GIF (up to 1 MB)"
        >
          {uploading ? 'Uploading…' : '+ Add picture or GIF'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => void onFiles(e.currentTarget.files)}
        />
        <button type="button" className="de-btn" disabled={readOnly} onClick={addText} title="Add a line of text">
          + Add text
        </button>
        <span className="de-sep" aria-hidden />
        <button
          type="button"
          className="de-btn"
          disabled={readOnly || history.past.length === 0}
          onClick={undo}
          title="Undo (⌘/Ctrl+Z)"
        >
          ↶ Undo
        </button>
        <button
          type="button"
          className="de-btn"
          disabled={readOnly || history.future.length === 0}
          onClick={redo}
          title="Redo (⇧⌘/Ctrl+Z)"
        >
          ↷ Redo
        </button>
        <span className="de-hint">Changes save automatically as a draft. Press Publish when you’re happy.</span>
        <button type="button" className="de-btn de-btn--primary" onClick={onClose} title="Close the editor">
          Done
        </button>
      </div>

      {readOnly ? (
        <div className="de-banner" data-tone="info">
          <span>This is read-only right now — you can look around, but not change anything.</span>
        </div>
      ) : null}
      {notice ? (
        <div className="de-banner" data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}>
          <span>{notice.text}</span>
          <button
            type="button"
            className="de-btn de-btn--small de-btn--ghost"
            onClick={() => setNotice(null)}
            aria-label="Dismiss message"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      ) : null}

      <div className="de-main">
        <div className="de-canvas-area" onPointerDown={() => setSelectedKey(null)}>
          <DoodleCanvas
            device={device}
            items={canvasItems}
            hero={hero}
            navPages={navPages}
            navEntries={navEntries}
            fit="contain"
            stageRef={stageRef}
            stageClassName={stageClass}
            itemProps={itemProps}
          >
            {overlay}
          </DoodleCanvas>
          <div className="de-canvas-help">
            Drag to move · drag a corner to resize · round handle to tilt · arrow keys nudge 1 px (Shift = 10 px)
          </div>
        </div>
        <aside className="de-inspector" aria-label="Details">
          <Inspector
            device={device}
            items={items}
            selected={selected}
            navPages={navPages}
            readOnly={readOnly}
            gap={gap}
            gapName={gapName}
            textInputRef={textInputRef}
            onSelect={setSelectedKey}
            onSetField={(key, field, v, coalesce) =>
              emit([{ type: 'set', path: [{ _key: key }, field], value: v }], coalesce)
            }
            onSetLink={(key, link, coalesce) =>
              emit([{ type: 'set', path: [{ _key: key }, 'link'], value: cleanLink(link) }], coalesce)
            }
            onSetPlacement={setPlacement}
            onDuplicate={duplicate}
            onReorder={reorder}
            onCopyPosition={copyPosition}
            onDelete={remove}
          />
        </aside>
      </div>
    </div>
  );

  if (mount === 'inline') return ui;
  return isClient ? createPortal(ui, document.body) : null;
}

/** Pink measuring marks between the selected item and its nearest neighbour. */
function GapMarks({ a, gap, name, refW, refH }: { a: Box; gap: Gap; name: string; refW: number; refH: number }) {
  const b = gap.to;
  const A = { l: a.cx - a.w / 2, r: a.cx + a.w / 2, t: a.cy - a.h / 2, b: a.cy + a.h / 2 };
  const B = { l: b.cx - b.w / 2, r: b.cx + b.w / 2, t: b.cy - b.h / 2, b: b.cy + b.h / 2 };
  const thin = 'calc(1.5px * var(--de-inv))';
  let hLine: CSSProperties | null = null;
  let vLine: CSSProperties | null = null;
  if (gap.dx > 0) {
    const [x1, x2] = A.r <= B.l ? [A.r, B.l] : [B.r, A.l];
    const y = gap.dy < 0 ? (Math.max(A.t, B.t) + Math.min(A.b, B.b)) / 2 : (a.cy + b.cy) / 2;
    hLine = { left: x1, top: y, width: x2 - x1, height: thin, transform: 'translateY(-50%)' };
  }
  if (gap.dy > 0) {
    const [y1, y2] = A.b <= B.t ? [A.b, B.t] : [B.b, A.t];
    const x = gap.dx < 0 ? (Math.max(A.l, B.l) + Math.min(A.r, B.r)) / 2 : (a.cx + b.cx) / 2;
    vLine = { left: x, top: y1, height: y2 - y1, width: thin, transform: 'translateX(-50%)' };
  }
  const below = A.b < refH - 110;
  return (
    <>
      <div className="de-gapbox" style={{ left: B.l, top: B.t, width: b.w, height: b.h }} />
      {hLine ? <div className="de-gapline" style={hLine} /> : null}
      {vLine ? <div className="de-gapline" style={vLine} /> : null}
      <div
        className="de-badge"
        role="status"
        style={{
          left: `clamp(calc(120px * var(--de-inv)), ${a.cx}px, calc(${refW}px - 120px * var(--de-inv)))`,
          top: below ? `calc(${A.b}px + 16px * var(--de-inv))` : `calc(${A.t}px - 16px * var(--de-inv))`,
          transform: below ? 'translateX(-50%)' : 'translate(-50%, -100%)',
        }}
      >
        <div className="de-badge-to">to {name}</div>
        <div>
          ↔ <b>{describeAxis(gap.dx, gap.ddx, gap.dy)}</b>
        </div>
        <div>
          ↕ <b>{describeAxis(gap.dy, gap.ddy, gap.dx)}</b>
        </div>
      </div>
    </>
  );
}
