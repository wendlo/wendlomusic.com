'use client';

/**
 * Right-hand panel of the doodle editor: details of the selected item, or a
 * short how-to + the list of items when nothing is selected.
 */

import { useState, type Ref } from 'react';
import {
  isWebAddress,
  type DoodleColor,
  type DoodleLinkKind,
  type DoodlePlacement,
  type RawDoodle,
  type RawDoodleLink,
} from '@/lib/doodles';
import { describeAxis, MAX_SIZE, MIN_SIZE, REF, round2, clamp, type Gap } from './geometry';
import { COLOR_OPTIONS, LINK_KINDS, PAGES, pageTitle } from './labels';
import type { Device } from './types';

const DEVICE_WORD: Record<Device, string> = { desktop: 'desktop', phone: 'phone' };

export interface InspectorItem {
  key: string;
  raw: RawDoodle;
  name: string;
  /** image URL for thumbnails */
  src?: string;
  /** resolved placements (defaults filled in) */
  desktop: DoodlePlacement;
  phone: DoodlePlacement;
  /** false = not shown on the site yet (no text / no picture) */
  renderable: boolean;
}

export interface InspectorProps {
  device: Device;
  items: InspectorItem[];
  selected: InspectorItem | null;
  navPages: string[];
  readOnly: boolean;
  gap: Gap | null;
  gapName: string;
  textInputRef?: Ref<HTMLInputElement>;
  onSelect(key: string | null): void;
  onSetField(key: string, field: 'text' | 'color' | 'alt' | 'shadow', value: unknown, coalesce?: string): void;
  onSetLink(key: string, link: RawDoodleLink, coalesce?: string): void;
  onSetPlacement(key: string, device: Device, p: DoodlePlacement, coalesce?: string): void;
  onDuplicate(key: string): void;
  onReorder(key: string, dir: 1 | -1): void;
  onCopyPosition(key: string, from: Device, to: Device): void;
  onDelete(key: string): void;
}

const fmt = (n: number) => String(round2(n));

function NumberField({
  label,
  value,
  step,
  min,
  max,
  hint,
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  hint?: string;
  disabled?: boolean;
  onCommit(n: number): void;
}) {
  // While focused, show what the person typed (e.g. "6.") rather than the
  // re-formatted stored number.
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label style={{ display: 'block' }}>
      <span className="de-label">{label}</span>
      <input
        className="de-input"
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        value={draft ?? fmt(value)}
        disabled={disabled}
        onFocus={() => setDraft(fmt(value))}
        onBlur={() => setDraft(null)}
        onChange={(e) => {
          setDraft(e.currentTarget.value);
          const n = parseFloat(e.currentTarget.value);
          if (Number.isFinite(n)) onCommit(clamp(n, min, max));
        }}
      />
      {hint ? <span className="de-help">{hint}</span> : null}
    </label>
  );
}

function Thumb({ item }: { item: InspectorItem }) {
  if (item.raw._type === 'doodleImage') {
    return (
      <span
        className="de-thumb"
        style={item.src ? { backgroundImage: `url("${item.src}")` } : undefined}
        aria-hidden
      >
        {item.src ? '' : '?'}
      </span>
    );
  }
  return (
    <span className="de-thumb" aria-hidden style={{ fontFamily: 'var(--nav-font)' }}>
      Aa
    </span>
  );
}

function tagsFor(item: InspectorItem): string[] {
  const tags: string[] = [];
  if (!item.renderable) tags.push(item.raw._type === 'doodleText' ? 'no text' : 'no picture');
  if (item.desktop.hidden) tags.push('hidden on desktop');
  if (item.phone.hidden) tags.push('hidden on phone');
  if (item.raw.link?.kind && item.raw.link.kind !== 'none') tags.push('link');
  return tags;
}

export function Inspector(props: InspectorProps) {
  const { selected } = props;
  // keyed so drafts reset and a new text item's field can take focus on mount
  return selected ? <ItemPanel key={selected.key} {...props} item={selected} /> : <NothingSelected {...props} />;
}

function NothingSelected({ items, device, onSelect }: InspectorProps) {
  return (
    <>
      <div className="de-section">
        <div className="de-section-title">How it works</div>
        <ul className="de-tips">
          <li>Click something on the photo to select it, then drag it where you want it.</li>
          <li>Drag a corner to make it bigger or smaller, and the round handle on top to tilt it.</li>
          <li>
            Arrow keys move the selected item 1 px (<span className="de-kbd">Shift</span> = 10 px). While you move
            it, the pink label shows the gap to the nearest item.
          </li>
          <li>Desktop and phone are arranged separately — switch at the top.</li>
          <li>The logo and menu are only shown faded, for reference.</li>
        </ul>
      </div>
      <div className="de-section">
        <div className="de-section-title">On the photo ({items.length})</div>
        {items.length === 0 ? (
          <p className="de-help">Nothing yet. Add a picture, a GIF or some text with the buttons at the top.</p>
        ) : (
          <ul className="de-list">
            {items.map((it) => (
              <li key={it.key}>
                <button type="button" onClick={() => onSelect(it.key)} title="Select">
                  <Thumb item={it} />
                  <span className="de-list-name">{it.name}</span>
                  {tagsFor(it).map((t) => (
                    <span key={t} className="de-tag">
                      {t}
                    </span>
                  ))}
                </button>
              </li>
            ))}
          </ul>
        )}
        {items.some((it) => it[device].hidden) ? (
          <p className="de-help">Faded items with a dashed outline are hidden on {DEVICE_WORD[device]}.</p>
        ) : null}
      </div>
    </>
  );
}

function ItemPanel({
  item,
  device,
  items,
  navPages,
  readOnly,
  gap,
  gapName,
  textInputRef,
  onSelect,
  onSetField,
  onSetLink,
  onSetPlacement,
  onDuplicate,
  onReorder,
  onCopyPosition,
  onDelete,
}: InspectorProps & { item: InspectorItem }) {
  const { key, raw } = item;
  const isText = raw._type === 'doodleText';
  const p = item[device];
  const ref = REF[device];
  const link: RawDoodleLink = raw.link ?? { kind: 'none' };
  const kind = (link.kind ?? 'none') as DoodleLinkKind;
  const linked = kind !== 'none';
  const url = link.url ?? '';
  const urlBad = kind === 'url' && !!url && !isWebAddress(url);
  // The site turns links to switched-off targets into plain decoration (Shell, linkAvailable).
  const pageOff = kind === 'page' && !!link.page && !navPages.includes(link.page);
  const formOff = (kind === 'email-signup' || kind === 'message') && !navPages.includes('contact');
  const index = items.findIndex((it) => it.key === key);
  const other: Device = device === 'desktop' ? 'phone' : 'desktop';
  const setP = (patch: Partial<DoodlePlacement>, coalesce?: string) =>
    onSetPlacement(key, device, { ...p, ...patch }, coalesce);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Thumb item={item} />
        <strong style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.name}
        </strong>
        <button
          type="button"
          className="de-btn de-btn--small"
          onClick={() => onSelect(null)}
          title="Deselect (Esc)"
        >
          Done
        </button>
      </div>

      {isText ? (
        <div className="de-section">
          <label>
            <span className="de-label">Text</span>
            <input
              ref={textInputRef}
              data-key={key}
              className="de-input"
              type="text"
              value={raw.text ?? ''}
              disabled={readOnly}
              onChange={(e) => onSetField(key, 'text', e.currentTarget.value, `text:${key}`)}
            />
          </label>
          {!(raw.text ?? '').trim() ? <p className="de-warn">Type some words — empty text isn’t shown.</p> : null}
          <div>
            <span className="de-label">Colour</span>
            <div className="de-chips" role="group" aria-label="Colour">
              {COLOR_OPTIONS.map((c) => {
                const on = (raw.color ?? 'white') === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    className="de-chip"
                    style={{ background: c.swatch }}
                    aria-pressed={on}
                    aria-label={c.title}
                    title={c.title}
                    disabled={readOnly}
                    onClick={() => onSetField(key, 'color', c.value as DoodleColor)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="de-section">
          <label>
            <span className="de-label">Description</span>
            <input
              className="de-input"
              type="text"
              value={raw._type === 'doodleImage' ? (raw.alt ?? '') : ''}
              placeholder="e.g. hand-drawn arrow"
              disabled={readOnly}
              onChange={(e) => onSetField(key, 'alt', e.currentTarget.value, `alt:${key}`)}
            />
            <span className="de-help">Describe it for people who can’t see it.</span>
          </label>
          {linked && raw._type === 'doodleImage' && !(raw.alt ?? '').trim() ? (
            <p className="de-warn">
              This picture is a link. Add a description — unless the text next to it already says where it goes (then
              it’s fine to leave this empty).
            </p>
          ) : null}
          {!item.renderable ? <p className="de-warn">This item has no picture yet, so it isn’t shown.</p> : null}
        </div>
      )}

      <div className="de-section" role="radiogroup" aria-label="When clicked">
        <div className="de-section-title">When clicked</div>
        {LINK_KINDS.map((k) => (
          <label key={k.value} className="de-radio">
            <input
              type="radio"
              name={`de-link-${key}`}
              checked={kind === k.value}
              disabled={readOnly}
              onChange={() => onSetLink(key, { ...link, kind: k.value })}
            />
            {k.title}
          </label>
        ))}
        {formOff ? (
          <p className="de-warn">
            The Contact page is switched off, and the forms are on it — so on the site this isn’t a link until you
            switch Contact back on in Site settings.
          </p>
        ) : null}
        {kind === 'page' ? (
          <label>
            <span className="de-label">Page</span>
            <select
              className="de-select"
              value={link.page ?? ''}
              disabled={readOnly}
              onChange={(e) => onSetLink(key, { ...link, page: e.currentTarget.value || undefined })}
            >
              <option value="">Choose a page…</option>
              {PAGES.map((pg) => (
                <option key={pg.id} value={pg.id}>
                  {pg.title}
                  {navPages.includes(pg.id) ? '' : ' (switched off right now)'}
                </option>
              ))}
            </select>
            {!link.page ? <span className="de-error">Pick a page.</span> : null}
          </label>
        ) : null}
        {pageOff ? (
          <p className="de-warn">
            The {pageTitle(link.page)} page is switched off, so on the site this isn’t a link until you switch that
            page on in Site settings.
          </p>
        ) : null}
        {kind === 'url' ? (
          <label>
            <span className="de-label">Website address</span>
            <input
              className="de-input"
              type="url"
              inputMode="url"
              placeholder="https://"
              value={url}
              aria-invalid={urlBad || !url}
              disabled={readOnly}
              onChange={(e) => onSetLink(key, { ...link, url: e.currentTarget.value }, `url:${key}`)}
              onBlur={(e) => {
                if (readOnly) return;
                // "bandcamp.com/…" → "https://bandcamp.com/…" (same as the nav manager)
                const v = e.currentTarget.value.trim();
                const fixed = v && !/^https?:\/\//i.test(v) ? `https://${v.replace(/^\/+/, '')}` : v;
                if (fixed !== url) onSetLink(key, { ...link, url: fixed }, `url:${key}`);
              }}
            />
            {!url ? (
              <span className="de-error">Add the website address.</span>
            ) : urlBad ? (
              <span className="de-error">
                The address should look like https://example.com — copy it from your browser’s address bar.
              </span>
            ) : (
              <span className="de-help">Opens in a new tab.</span>
            )}
          </label>
        ) : null}
      </div>

      <div className="de-section">
        <div className="de-section-title">Look</div>
        <label className="de-check">
          <input
            type="checkbox"
            checked={raw.shadow ?? true}
            disabled={readOnly}
            onChange={(e) => onSetField(key, 'shadow', e.currentTarget.checked)}
          />
          Soft shadow (helps it stand out on the photo)
        </label>
      </div>

      <div className="de-section">
        <div className="de-section-title">Position on {DEVICE_WORD[device]}</div>
        <label className="de-check">
          <input
            type="checkbox"
            checked={!!p.hidden}
            disabled={readOnly}
            onChange={(e) => setP({ hidden: e.currentTarget.checked })}
          />
          Hide on {DEVICE_WORD[device]}
        </label>
        <div className="de-num-grid">
          <NumberField
            label="Across %"
            value={p.x}
            step={0.1}
            min={0}
            max={100}
            disabled={readOnly}
            hint={`≈ ${Math.round((p.x / 100) * ref.w)} px from left`}
            onCommit={(n) => setP({ x: n }, `x:${key}:${device}`)}
          />
          <NumberField
            label="Down %"
            value={p.y}
            step={0.1}
            min={0}
            max={100}
            disabled={readOnly}
            hint={`≈ ${Math.round((p.y / 100) * ref.h)} px from top`}
            onCommit={(n) => setP({ y: n }, `y:${key}:${device}`)}
          />
          <NumberField
            label={isText ? 'Text size' : 'Size'}
            value={p.w}
            step={0.1}
            min={MIN_SIZE}
            max={MAX_SIZE}
            disabled={readOnly}
            hint={`≈ ${Math.round((p.w / 100) * ref.w)} px ${isText ? 'letters' : 'wide'}`}
            onCommit={(n) => setP({ w: n }, `w:${key}:${device}`)}
          />
          <NumberField
            label="Tilt °"
            value={p.rot}
            step={1}
            min={-180}
            max={180}
            disabled={readOnly}
            hint="0 = straight"
            onCommit={(n) => setP({ rot: n }, `rot:${key}:${device}`)}
          />
        </div>
        <p className="de-help">
          Measured on a {ref.w}×{ref.h} screen; everything scales together on other sizes.
        </p>
        {gap ? (
          <div className="de-measure" aria-live="polite">
            <span className="de-help">Nearest item: {gapName}</span>
            <span>↔ {describeAxis(gap.dx, gap.ddx, gap.dy)}</span>
            <span>↕ {describeAxis(gap.dy, gap.ddy, gap.dx)}</span>
          </div>
        ) : null}
      </div>

      <div className="de-section">
        <div className="de-section-title">Arrange</div>
        <div className="de-actions">
          <button type="button" className="de-btn de-btn--small" disabled={readOnly} onClick={() => onDuplicate(key)} title="Duplicate (⌘/Ctrl+D)">
            Duplicate
          </button>
          <button
            type="button"
            className="de-btn de-btn--small"
            disabled={readOnly || index === items.length - 1}
            onClick={() => onReorder(key, 1)}
            title="Put it on top of the item above it"
          >
            Bring forward
          </button>
          <button
            type="button"
            className="de-btn de-btn--small"
            disabled={readOnly || index <= 0}
            onClick={() => onReorder(key, -1)}
            title="Put it behind the item below it"
          >
            Send backward
          </button>
        </div>
        <div className="de-actions">
          <button
            type="button"
            className="de-btn de-btn--small"
            disabled={readOnly}
            onClick={() => onCopyPosition(key, 'desktop', 'phone')}
            title="Same spot (as a share of the screen) and the same size in pixels"
          >
            Copy desktop position to phone
          </button>
          <button
            type="button"
            className="de-btn de-btn--small"
            disabled={readOnly}
            onClick={() => onCopyPosition(key, 'phone', 'desktop')}
            title="Same spot (as a share of the screen) and the same size in pixels"
          >
            Copy phone position to desktop
          </button>
        </div>
        <p className="de-help">
          Moving things here changes only the {DEVICE_WORD[device]} layout; the {DEVICE_WORD[other]} one stays as it is.
        </p>
        <div className="de-actions">
          <button
            type="button"
            className="de-btn de-btn--small de-btn--danger"
            disabled={readOnly}
            onClick={() => onDelete(key)}
            title="Delete (Delete key)"
          >
            Delete
          </button>
        </div>
      </div>
    </>
  );
}
