/**
 * NavManagerInput — siteSettings.pages (array of navPage + navCustom).
 *
 * Top: a live preview of the menu row as the site draws it (enabled rows in
 * array order, on a dark background). Below: one row per item, fixed pages
 * and the band's custom links mixed, in array order (= nav order).
 *  - Fixed pages: up/down reorder, enable toggle (Home locked on), editable
 *    label for the text-nav pages (About + Blog) only.
 *  - Custom links (max MAX_CUSTOM_NAV): same reorder/toggle, plus an inline
 *    editor (label, normal/active art upload, where it goes) and Remove.
 * Field edits are path-scoped set()/unset() patches at [{_key}, field];
 * reordering rewrites the whole array via set().
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  insert,
  set,
  setIfMissing,
  unset,
  useClient,
  useFormValue,
  type ArrayOfObjectsInputProps,
  type FormPatch,
} from 'sanity';

import { assetFromRef, linkAvailable, linkFrom } from '@/lib/doodles';
import { apiVersion, dataset, safeProjectId } from '@/sanity/env';
import { PAGE_IDS } from '@/sanity/schemas/objects/announcement';
import {
  MAX_CUSTOM_NAV,
  navLinkProblem,
  navLinkSummary,
  type NavLinkValue,
} from '@/sanity/schemas/objects/navCustom';

interface ImageValue {
  _type?: string;
  asset?: { _ref?: string; _type?: string };
}

interface NavPageRow {
  _key: string;
  _type?: 'navPage';
  pageId?: string;
  enabled?: boolean;
  label?: string;
  isTextLabel?: boolean;
}

interface NavCustomRow {
  _key: string;
  _type: 'navCustom';
  label?: string;
  image?: ImageValue;
  imageActive?: ImageValue;
  link?: NavLinkValue;
  enabled?: boolean;
}

type NavRow = NavPageRow | NavCustomRow;
type ArtField = 'image' | 'imageActive';

interface SlotStatus {
  busy?: boolean;
  error?: string;
  note?: string;
}

/** Fixed pages drawn as handwriting GIFs, with their art's aspect ratio (rooms.css). Others are text. */
const GIF_ASPECT: Record<string, number> = {
  home: 446 / 156,
  tour: 353 / 152,
  contact: 584 / 150,
  music: 439 / 150,
  store: 391 / 143,
};

/** Desktop bottom-dock sizes at full width (rooms.css .nav.bottom). */
const DOCK_ART_H = 32;
const DOCK_TEXT_PX = 25;
const DOCK_GAP = 22;
const STRIP_PAD_X = 18;

const MAX_BYTES = 1024 * 1024;
const WARN_BYTES = 300 * 1024;

const LINK_KINDS = [
  { value: 'page', title: 'Go to a page of the site' },
  { value: 'email-signup', title: 'Open the email-list sign-up form' },
  { value: 'message', title: 'Open the “send us a message” form' },
  { value: 'url', title: 'Open another website' },
] as const;

const PROJECT = { projectId: safeProjectId, dataset };

const isCustom = (row: NavRow): row is NavCustomRow => row?._type === 'navCustom';

function artOf(img: ImageValue | undefined) {
  return assetFromRef(img?.asset?._ref, PROJECT);
}

/** The page a custom item can't reach because it's hidden (forms need contact), or null. */
function hiddenTarget(row: NavCustomRow, enabledPages: readonly string[]): string | null {
  const link = linkFrom(row.link);
  if (link.kind === 'none' || linkAvailable(link, enabledPages)) return null;
  return link.kind === 'page' ? (link.page ?? null) : 'contact';
}

/** Same rules the site's nav mapping uses to skip a custom item (map.ts mapNavCustom + mapNav). */
function droppedBySite(row: NavCustomRow, enabledPages: readonly string[]): boolean {
  if (linkFrom(row.link).kind === 'none') return true;
  if (!row.label?.trim() && !artOf(row.image) && !artOf(row.imageActive)) return true;
  return hiddenTarget(row, enabledPages) !== null;
}

function hiddenTargetNote(page: string): string {
  return page === 'contact'
    ? 'Left out of the menu while the contact page is hidden (the forms are there).'
    : `Left out of the menu while the ${page} page is hidden.`;
}

function makeKey(): string {
  return `nav${Math.random().toString(36).slice(2, 12)}`;
}

function formatBytes(b: number): string {
  return b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

/** Fixed pages' display label, as the site shows it. */
function fixedLabel(row: NavPageRow): string {
  return row.label?.trim() || row.pageId || '';
}

export default function NavManagerInput(props: ArrayOfObjectsInputProps<NavRow>) {
  const { value, onChange, readOnly, focusPath } = props;
  const items: NavRow[] = useMemo(() => (Array.isArray(value) ? value : []), [value]);
  const client = useClient({ apiVersion });

  /** Explicit open/closed per custom row; unset rows follow the focus path. */
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [slots, setSlots] = useState<Record<string, SlotStatus>>({});

  const customCount = items.filter(isCustom).length;
  const hiddenPages = useMemo(
    () => new Set(items.filter((r) => !isCustom(r) && r.enabled === false).map((r) => (r as NavPageRow).pageId)),
    [items],
  );
  /** What the site treats as switched on (map.ts mapNav: fixed rows, enabled unless false). */
  const enabledPages = useMemo(
    () =>
      items
        .filter((r): r is NavPageRow => !isCustom(r) && r.enabled !== false && !!r.pageId)
        .map((r) => r.pageId as string),
    [items],
  );

  // A click on a validation marker in the Studio focuses [{_key}, ...] — open that row.
  const head = focusPath?.[0];
  const focusedKey =
    head && typeof head === 'object' && '_key' in head ? (head as { _key: string })._key : undefined;
  const isOpen = (key: string) => expanded[key] ?? key === focusedKey;

  const move = useCallback(
    (from: number, to: number) => {
      if (readOnly) return;
      if (to < 0 || to >= items.length) return;
      const next = items.slice();
      const [row] = next.splice(from, 1);
      next.splice(to, 0, row);
      onChange(set(next));
    },
    [items, onChange, readOnly],
  );

  const setEnabled = useCallback(
    (item: NavRow, enabled: boolean) => {
      if (readOnly) return;
      if (!isCustom(item) && item.pageId === 'home' && !enabled) return; // Home is locked on.
      onChange(set(enabled, [{ _key: item._key }, 'enabled']));
    },
    [onChange, readOnly],
  );

  const setLabel = useCallback(
    (item: NavRow, label: string) => {
      if (readOnly) return;
      onChange(label ? set(label, [{ _key: item._key }, 'label']) : unset([{ _key: item._key }, 'label']));
    },
    [onChange, readOnly],
  );

  const setLinkField = useCallback(
    (item: NavCustomRow, field: 'kind' | 'page' | 'url', v: string) => {
      if (readOnly) return;
      const at = [{ _key: item._key }, 'link'];
      const patches: FormPatch[] = [setIfMissing({ _type: 'doodleLink' }, at)];
      patches.push(v ? set(v, [...at, field]) : unset([...at, field]));
      onChange(patches);
    },
    [onChange, readOnly],
  );

  const setSlot = useCallback((slot: string, status: SlotStatus) => {
    setSlots((s) => ({ ...s, [slot]: status }));
  }, []);

  const uploadArt = useCallback(
    async (item: NavCustomRow, field: ArtField, file: File) => {
      if (readOnly) return;
      const slot = `${item._key}:${field}`;
      if (!file.type.startsWith('image/')) {
        setSlot(slot, { error: 'That file isn’t a picture — use a GIF, PNG, JPG, WEBP or SVG.' });
        return;
      }
      if (file.size > MAX_BYTES) {
        setSlot(slot, {
          error: `That file is ${formatBytes(file.size)} — the limit is 1 MB. Try exporting it smaller (for a GIF: fewer frames or colours).`,
        });
        return;
      }
      setSlot(slot, { busy: true });
      try {
        const asset = await client.assets.upload('image', file, { filename: file.name });
        onChange(
          set({ _type: 'image', asset: { _type: 'reference', _ref: asset._id } }, [{ _key: item._key }, field]),
        );
        setSlot(
          slot,
          file.size > WARN_BYTES
            ? {
                note: `Uploaded — but it’s ${formatBytes(file.size)}. The menu loads on every page, so under 300 KB is kinder to phones.`,
              }
            : {},
        );
      } catch (err) {
        setSlot(slot, { error: `Upload failed: ${err instanceof Error ? err.message : 'please try again.'}` });
      }
    },
    [client, onChange, readOnly, setSlot],
  );

  const removeArt = useCallback(
    (item: NavCustomRow, field: ArtField) => {
      if (readOnly) return;
      onChange(unset([{ _key: item._key }, field]));
      setSlot(`${item._key}:${field}`, {});
    },
    [onChange, readOnly, setSlot],
  );

  const addCustom = useCallback(() => {
    if (readOnly || customCount >= MAX_CUSTOM_NAV) return;
    const _key = makeKey();
    const row: NavCustomRow = {
      _type: 'navCustom',
      _key,
      label: 'new link',
      enabled: true,
      link: { _type: 'doodleLink', kind: 'page', page: 'home' },
    };
    onChange([setIfMissing([]), insert([row], 'after', [-1])]);
    setExpanded((e) => ({ ...e, [_key]: true }));
  }, [customCount, onChange, readOnly]);

  const removeCustom = useCallback(
    (item: NavCustomRow) => {
      if (readOnly) return;
      const name = item.label?.trim() ? `the “${item.label.trim()}” link` : 'this custom link';
      if (!window.confirm(`Remove ${name} from the menu?`)) return;
      onChange(unset([{ _key: item._key }]));
    },
    [onChange, readOnly],
  );

  return (
    <div className="wendlo-nav-manager" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <style>{FOCUS_CSS}</style>

      <PreviewStrip items={items} enabledPages={enabledPages} />

      {customCount > MAX_CUSTOM_NAV && (
        <div role="alert" style={{ ...noticeStyle, color: CRITICAL }}>
          The menu only has room for {MAX_CUSTOM_NAV} custom links — please remove{' '}
          {customCount - MAX_CUSTOM_NAV}.
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          border: `1px solid ${BORDER}`,
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        {items.map((item, i) => {
          const enabled = item.enabled !== false;
          const custom = isCustom(item);
          const open = custom && isOpen(item._key);
          return (
            <div
              key={item._key}
              style={{
                borderTop: i === 0 ? 'none' : `1px solid ${BORDER}`,
                background: enabled ? 'var(--card-bg-color)' : 'var(--card-muted-bg-color, var(--card-bg-color))',
                color: 'var(--card-fg-color)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  opacity: enabled ? 1 : 0.7,
                }}
              >
                {/* Reorder */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={readOnly || i === 0}
                    onClick={() => move(i, i - 1)}
                    style={arrowStyle(readOnly || i === 0)}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={readOnly || i === items.length - 1}
                    onClick={() => move(i, i + 1)}
                    style={arrowStyle(readOnly || i === items.length - 1)}
                  >
                    ▼
                  </button>
                </div>

                {/* Order index */}
                <span
                  style={{
                    width: 18,
                    textAlign: 'right',
                    fontSize: 12,
                    color: MUTED,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {i + 1}
                </span>

                <Thumb item={item} />

                {custom ? (
                  <CustomSummary item={item} enabledPages={enabledPages} />
                ) : (
                  <FixedSummary item={item} readOnly={readOnly} onLabel={(v) => setLabel(item, v)} />
                )}

                {custom && (
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setExpanded((e) => ({ ...e, [item._key]: !open }))}
                    style={buttonStyle()}
                  >
                    {open ? 'Done' : 'Edit'}
                  </button>
                )}

                <EnabledToggle
                  enabled={enabled}
                  locked={!custom && item.pageId === 'home'}
                  readOnly={readOnly}
                  onToggle={(v) => setEnabled(item, v)}
                />
              </div>

              {open && (
                <CustomEditor
                  item={item}
                  readOnly={readOnly}
                  hiddenPages={hiddenPages}
                  slots={slots}
                  onLabel={(v) => setLabel(item, v)}
                  onLink={(field, v) => setLinkField(item, field, v)}
                  onUpload={(field, file) => void uploadArt(item, field, file)}
                  onRemoveArt={(field) => removeArt(item, field)}
                  onRemove={() => removeCustom(item)}
                  onDone={() => setExpanded((e) => ({ ...e, [item._key]: false }))}
                />
              )}
            </div>
          );
        })}
        {items.length === 0 && (
          <div style={{ padding: 12, fontSize: 12, color: MUTED }}>
            No pages yet — seed siteSettings to populate the 7 fixed pages.
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={addCustom}
          disabled={readOnly || customCount >= MAX_CUSTOM_NAV}
          style={buttonStyle({ disabled: readOnly || customCount >= MAX_CUSTOM_NAV })}
        >
          + Add a custom link
        </button>
        <span style={{ fontSize: 12, color: MUTED }}>
          {customCount >= MAX_CUSTOM_NAV
            ? `The menu has room for ${MAX_CUSTOM_NAV} custom links — remove one to add another.`
            : `${customCount} of ${MAX_CUSTOM_NAV} custom links used. New links go at the end — use ▲ to move them.`}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Preview strip — the desktop menu row, as the site draws it.
 * ------------------------------------------------------------------ */

function PreviewStrip({ items, enabledPages }: { items: NavRow[]; enabledPages: readonly string[] }) {
  // Which page to pretend is open (its item shows the "active" art).
  const [openPage, setOpenPage] = useState<string>('home');
  const visible = items.filter((r) => r.enabled !== false);
  // Text items in their "open" state use the accent, as on the site (Shell sets --persimmon).
  const accent = (useFormValue(['design', 'accent']) as string | undefined)?.trim() || '#E0A32B';

  // The row is drawn at its real size; when the Studio pane is narrower than
  // that, shrink it (right-anchored, like the site) rather than clip it.
  const frameRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const frame = frameRef.current;
    const row = rowRef.current;
    if (!frame || !row || typeof ResizeObserver === 'undefined') return;
    // offsetWidth ignores transforms, so applying the scale never re-triggers this.
    const fit = () => {
      const room = frame.clientWidth - 2 * STRIP_PAD_X;
      const need = row.offsetWidth;
      setScale(need > room && room > 0 ? room / need : 1);
    };
    const ro = new ResizeObserver(fit);
    ro.observe(frame);
    ro.observe(row);
    return () => ro.disconnect();
  }, []);

  const pageOf = (row: NavRow): string | undefined =>
    isCustom(row) ? (row.link?.kind === 'page' ? row.link.page : undefined) : row.pageId;

  return (
    <div style={{ '--persimmon': accent } as CSSProperties}>
      <div
        ref={frameRef}
        style={{
          borderRadius: 6,
          background: 'linear-gradient(160deg, #3a332c 0%, #1a1714 55%, #0e0d0c 100%)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.08)',
          padding: `22px ${STRIP_PAD_X}px 16px`,
          overflow: 'hidden',
        }}
      >
        <div
          ref={rowRef}
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: DOCK_GAP,
            width: 'max-content',
            marginLeft: 'auto',
            // When too wide, auto margin resolves to 0, so the row starts at the left edge.
            transform: scale < 1 ? `scale(${scale})` : undefined,
            transformOrigin: 'left bottom',
          }}
        >
          {visible.map((row) => {
            const page = pageOf(row);
            const on = !!page && page === openPage;
            const dropped = isCustom(row) && droppedBySite(row, enabledPages);
            const hidden = isCustom(row) ? hiddenTarget(row, enabledPages) : null;
            const title = dropped
              ? hidden
                ? hiddenTargetNote(hidden)
                : 'Not shown on the site until it has a label and somewhere to go'
              : page
                ? `Show as if the ${page} page is open`
                : navLinkSummary((row as NavCustomRow).link);
            return (
              <button
                key={row._key}
                type="button"
                aria-pressed={on}
                title={title}
                onClick={() => page && setOpenPage(page)}
                style={{
                  margin: 0,
                  padding: 0,
                  border: 0,
                  background: 'none',
                  font: 'inherit',
                  color: 'inherit',
                  display: 'flex',
                  alignItems: 'flex-end',
                  height: DOCK_ART_H,
                  cursor: page ? 'pointer' : 'default',
                  opacity: dropped ? 0.3 : on ? 1 : 0.9,
                  outline: dropped ? '1px dashed rgba(255,255,255,.6)' : undefined,
                  outlineOffset: 4,
                  borderRadius: 3,
                }}
              >
                <DockItem row={row} on={on} />
              </button>
            );
          })}
          {visible.length === 0 && (
            <span style={{ color: 'rgba(255,255,255,.6)', fontSize: 12 }}>Nothing is switched on.</span>
          )}
        </div>
      </div>
      <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>
        Preview of the menu row on a computer screen{scale < 1 ? ' (shrunk to fit here)' : ''}, as if the{' '}
        <strong>{openPage}</strong> page is open. Click an item to see it while its page is open. Changes show on
        the site after you publish.
      </div>
    </div>
  );
}

function DockItem({ row, on }: { row: NavRow; on: boolean }) {
  if (isCustom(row)) {
    const normal = artOf(row.image);
    const active = artOf(row.imageActive);
    const art = on && active ? active : normal;
    if (art) {
      return (
        <ArtImg
          src={art.src}
          alt={row.label ?? ''}
          style={{ height: DOCK_ART_H, width: 'auto', aspectRatio: `${art.width} / ${art.height}`, filter: SHADOW }}
        />
      );
    }
    return <span style={dockTextStyle(on)}>{row.label?.trim() || 'new link'}</span>;
  }
  const id = row.pageId ?? '';
  const aspect = GIF_ASPECT[id];
  if (aspect) {
    return (
      <span
        role="img"
        aria-label={fixedLabel(row)}
        style={{
          display: 'block',
          height: DOCK_ART_H,
          aspectRatio: String(aspect),
          backgroundImage: `url(/nav/${id}-${on ? 'mustard' : 'white'}.gif)`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundSize: 'contain',
          filter: SHADOW,
        }}
      />
    );
  }
  return <span style={dockTextStyle(on)}>{fixedLabel(row)}</span>;
}

/* ------------------------------------------------------------------ *
 * Rows
 * ------------------------------------------------------------------ */

/** Small dark chip showing the item's art (white art is invisible on white). */
function Thumb({ item }: { item: NavRow }) {
  let content: ReactNode;
  if (isCustom(item)) {
    const art = artOf(item.image);
    content = art ? (
      <ArtImg src={art.src} alt="" style={{ maxHeight: 20, maxWidth: 66, width: 'auto', height: 'auto' }} />
    ) : (
      <span style={thumbTextStyle}>“{item.label?.trim() || 'new link'}”</span>
    );
  } else {
    const id = item.pageId ?? '';
    const aspect = GIF_ASPECT[id];
    content = aspect ? (
      <span
        aria-hidden
        style={{
          display: 'block',
          height: 18,
          aspectRatio: String(aspect),
          maxWidth: 66,
          backgroundImage: `url(/nav/${id}-white.gif)`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundSize: 'contain',
        }}
      />
    ) : (
      <span style={thumbTextStyle}>{fixedLabel(item)}</span>
    );
  }
  return (
    <span
      style={{
        flex: 'none',
        width: 76,
        height: 30,
        borderRadius: 4,
        background: '#1a1714',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {content}
    </span>
  );
}

function FixedSummary({
  item,
  readOnly,
  onLabel,
}: {
  item: NavPageRow;
  readOnly?: boolean;
  onLabel: (v: string) => void;
}) {
  const isHome = item.pageId === 'home';
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>
        {item.pageId ?? '—'}
        {isHome && <span style={{ color: MUTED, fontWeight: 400 }}> · locked on</span>}
      </div>
      {item.isTextLabel === true ? (
        <input
          type="text"
          value={item.label ?? ''}
          onChange={(e) => onLabel(e.currentTarget.value)}
          readOnly={readOnly}
          placeholder="Nav label"
          style={{ ...inputStyle, marginTop: 4, maxWidth: 220, fontSize: 12, padding: '4px 6px' }}
        />
      ) : (
        <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
          {item.label ? `“${item.label}” · ` : ''}GIF-art label (baked)
        </div>
      )}
    </div>
  );
}

function CustomSummary({ item, enabledPages }: { item: NavCustomRow; enabledPages: readonly string[] }) {
  const problems = customProblems(item);
  const toHidden = hiddenTarget(item, enabledPages);
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{item.label?.trim() || 'untitled link'}</span>
        <span
          style={{
            flex: 'none',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '.04em',
            textTransform: 'uppercase',
            padding: '1px 5px',
            borderRadius: 3,
            border: `1px solid ${BORDER}`,
            color: MUTED,
          }}
        >
          custom
        </span>
      </div>
      <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{navLinkSummary(item.link)}</div>
      {problems.map((p) => (
        <div key={p} style={{ fontSize: 11, color: CRITICAL, marginTop: 2 }}>
          {p}
        </div>
      ))}
      {toHidden && (
        <div style={{ fontSize: 11, color: CAUTION, marginTop: 2 }}>{hiddenTargetNote(toHidden)}</div>
      )}
    </div>
  );
}

function customProblems(item: NavCustomRow): string[] {
  const out: string[] = [];
  if (!item.label?.trim()) out.push('Needs a label.');
  const link = navLinkProblem(item.link);
  if (link) out.push(`Needs somewhere to go — ${link}.`);
  return out;
}

function EnabledToggle({
  enabled,
  locked,
  readOnly,
  onToggle,
}: {
  enabled: boolean;
  locked: boolean;
  readOnly?: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        color: MUTED,
        cursor: readOnly || locked ? 'default' : 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      <input
        type="checkbox"
        checked={enabled}
        disabled={readOnly || locked}
        onChange={(e) => onToggle(e.currentTarget.checked)}
      />
      {enabled ? 'Shown' : 'Hidden'}
    </label>
  );
}

/* ------------------------------------------------------------------ *
 * Custom link editor (inline, under its row)
 * ------------------------------------------------------------------ */

function CustomEditor({
  item,
  readOnly,
  hiddenPages,
  slots,
  onLabel,
  onLink,
  onUpload,
  onRemoveArt,
  onRemove,
  onDone,
}: {
  item: NavCustomRow;
  readOnly?: boolean;
  hiddenPages: Set<string | undefined>;
  slots: Record<string, SlotStatus>;
  onLabel: (v: string) => void;
  onLink: (field: 'kind' | 'page' | 'url', v: string) => void;
  onUpload: (field: ArtField, file: File) => void;
  onRemoveArt: (field: ArtField) => void;
  onRemove: () => void;
  onDone: () => void;
}) {
  const kind = item.link?.kind ?? '';
  const knownKind = LINK_KINDS.some((k) => k.value === kind);
  const id = item._key;
  // Active art only means something for links to a page; keep it reachable if already set.
  const showActive = kind === 'page' || !!item.imageActive;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: '12px 14px 14px 62px',
        borderTop: `1px dashed ${BORDER}`,
      }}
    >
      <Field label="Label" htmlFor={`${id}-label`} hint="Shown as the link text, or read aloud for a picture.">
        <input
          id={`${id}-label`}
          type="text"
          value={item.label ?? ''}
          onChange={(e) => onLabel(e.currentTarget.value)}
          readOnly={readOnly}
          placeholder="e.g. merch"
          style={{ ...inputStyle, maxWidth: 280 }}
        />
      </Field>

      <ArtSlot
        title="Art"
        hint="Hand-drawn art for the link (white looks best). Leave empty to show the label as text."
        image={item.image}
        status={slots[`${id}:image`]}
        readOnly={readOnly}
        onPick={(file) => onUpload('image', file)}
        onRemove={() => onRemoveArt('image')}
      />

      {showActive && (
        <ArtSlot
          title="Art while that page is open (optional)"
          hint={
            kind === 'page'
              ? 'Swapped in while the page this link goes to is open — like the mustard versions of the built-in links.'
              : 'Only used when the link goes to a page of the site.'
          }
          image={item.imageActive}
          status={slots[`${id}:imageActive`]}
          readOnly={readOnly}
          onPick={(file) => onUpload('imageActive', file)}
          onRemove={() => onRemoveArt('imageActive')}
        />
      )}

      <Field label="Where it goes" htmlFor={`${id}-kind`}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            id={`${id}-kind`}
            value={knownKind ? kind : ''}
            disabled={readOnly}
            onChange={(e) => onLink('kind', e.currentTarget.value)}
            style={{ ...inputStyle, width: 'auto' }}
          >
            {!knownKind && (
              <option value="" disabled>
                Choose…
              </option>
            )}
            {LINK_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.title}
              </option>
            ))}
          </select>

          {kind === 'page' && (
            <select
              aria-label="Page"
              value={item.link?.page ?? ''}
              disabled={readOnly}
              onChange={(e) => onLink('page', e.currentTarget.value)}
              style={{ ...inputStyle, width: 'auto' }}
            >
              {!item.link?.page && (
                <option value="" disabled>
                  Choose a page…
                </option>
              )}
              {PAGE_IDS.map((p) => (
                <option key={p} value={p}>
                  {hiddenPages.has(p) ? `${p} (hidden)` : p}
                </option>
              ))}
            </select>
          )}

          {kind === 'url' && (
            <input
              aria-label="Website address"
              type="url"
              inputMode="url"
              value={item.link?.url ?? ''}
              placeholder="https://example.com"
              readOnly={readOnly}
              onChange={(e) => onLink('url', e.currentTarget.value)}
              onBlur={(e) => {
                const v = e.currentTarget.value.trim();
                const fixed = v && !/^https?:\/\//i.test(v) ? `https://${v.replace(/^\/+/, '')}` : v;
                if (fixed !== (item.link?.url ?? '')) onLink('url', fixed);
              }}
              style={{ ...inputStyle, flex: '1 1 220px', maxWidth: 360 }}
            />
          )}
        </div>
        {kind === 'url' && (
          <div style={hintStyle}>Opens in a new tab. Paste the whole address, starting with https://</div>
        )}
      </Field>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onRemove}
          disabled={readOnly}
          style={{ ...buttonStyle({ disabled: readOnly }), color: CRITICAL }}
        >
          Remove this link
        </button>
        <button type="button" onClick={onDone} style={buttonStyle()}>
          Done
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label htmlFor={htmlFor} style={{ fontSize: 12, fontWeight: 600 }}>
        {label}
      </label>
      {children}
      {hint && <div style={hintStyle}>{hint}</div>}
    </div>
  );
}

function ArtSlot({
  title,
  hint,
  image,
  status,
  readOnly,
  onPick,
  onRemove,
}: {
  title: string;
  hint: string;
  image: ImageValue | undefined;
  status: SlotStatus | undefined;
  readOnly?: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const art = artOf(image);
  const busy = !!status?.busy;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ fontSize: 12, fontWeight: 600 }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span
          style={{
            flex: 'none',
            minWidth: 96,
            height: 48,
            padding: '0 10px',
            borderRadius: 4,
            background: '#1a1714',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {art ? (
            <ArtImg src={art.src} alt="" style={{ height: DOCK_ART_H, width: 'auto', maxWidth: 220 }} />
          ) : (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.55)' }}>{busy ? 'Uploading…' : 'No art'}</span>
          )}
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = ''; // so picking the same file again still fires
            if (file) onPick(file);
          }}
        />
        <button
          type="button"
          disabled={readOnly || busy}
          onClick={() => fileRef.current?.click()}
          style={buttonStyle({ disabled: readOnly || busy })}
        >
          {busy ? 'Uploading…' : art ? 'Replace…' : 'Upload…'}
        </button>
        {art && (
          <button
            type="button"
            disabled={readOnly || busy}
            onClick={onRemove}
            style={buttonStyle({ disabled: readOnly || busy })}
          >
            Remove
          </button>
        )}
      </div>
      {status?.error && <div style={{ ...hintStyle, color: CRITICAL }}>{status.error}</div>}
      {status?.note && <div style={{ ...hintStyle, color: CAUTION }}>{status.note}</div>}
      <div style={hintStyle}>{hint} GIF, PNG, WEBP or SVG, up to 1 MB.</div>
    </div>
  );
}

/** Untransformed CDN image (keeps GIFs animated). */
function ArtImg({ src, alt, style }: { src: string; alt: string; style?: CSSProperties }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} draggable={false} style={{ display: 'block', ...style }} />;
}

/* ------------------------------------------------------------------ *
 * Styles — Studio theme variables, so light and dark mode both work.
 * ------------------------------------------------------------------ */

const BORDER = 'var(--card-border-color, rgba(128,128,128,.3))';
const MUTED = 'var(--card-muted-fg-color, #888)';
const CRITICAL = 'var(--card-badge-critical-fg-color, #d33)';
const CAUTION = 'var(--card-badge-caution-fg-color, #b7791f)';
const SHADOW = 'drop-shadow(0 2px 6px rgba(0, 0, 0, .62))';

const FOCUS_CSS = `.wendlo-nav-manager :is(button, input, select):focus-visible {
  outline: 2px solid var(--card-focus-ring-color, #2276fc);
  outline-offset: 1px;
}`;

const hintStyle: CSSProperties = { fontSize: 11, color: MUTED, lineHeight: 1.4 };

const noticeStyle: CSSProperties = {
  fontSize: 12,
  padding: '8px 10px',
  borderRadius: 4,
  border: `1px solid ${BORDER}`,
};

const inputStyle: CSSProperties = {
  width: '100%',
  font: 'inherit',
  fontSize: 13,
  padding: '6px 8px',
  borderRadius: 4,
  border: `1px solid ${BORDER}`,
  background: 'var(--card-bg-color)',
  color: 'var(--card-fg-color)',
};

const thumbTextStyle: CSSProperties = {
  color: '#fff',
  fontFamily: 'var(--nav-font)',
  fontWeight: 700,
  fontSize: 11,
  textTransform: 'lowercase',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: 70,
};

function dockTextStyle(on: boolean): CSSProperties {
  return {
    fontFamily: 'var(--nav-font)',
    fontWeight: 700,
    fontSize: DOCK_TEXT_PX,
    lineHeight: 1,
    textTransform: 'lowercase',
    whiteSpace: 'nowrap',
    color: on ? 'var(--persimmon, #e0a32b)' : '#fff',
    textShadow: '0 2px 6px rgba(0, 0, 0, .62)',
  };
}

function buttonStyle({ disabled = false }: { disabled?: boolean } = {}): CSSProperties {
  return {
    flex: 'none',
    font: 'inherit',
    fontSize: 12,
    fontWeight: 600,
    padding: '5px 10px',
    borderRadius: 4,
    border: `1px solid ${BORDER}`,
    background: 'var(--card-bg-color)',
    color: 'var(--card-fg-color)',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };
}

function arrowStyle(disabled: boolean): CSSProperties {
  return {
    width: 22,
    height: 16,
    lineHeight: '12px',
    fontSize: 9,
    padding: 0,
    borderRadius: 3,
    border: `1px solid ${BORDER}`,
    background: 'var(--card-bg-color)',
    color: 'var(--card-fg-color)',
    opacity: disabled ? 0.35 : 1,
    cursor: disabled ? 'default' : 'pointer',
  };
}
