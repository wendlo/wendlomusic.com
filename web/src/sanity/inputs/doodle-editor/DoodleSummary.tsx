'use client';

/**
 * What the form shows inline: small read-only previews (desktop + phone,
 * exactly as the site renders them) and the "Open visual editor" button.
 */

import { useMemo, type ReactNode, type Ref } from 'react';
import type { RawDoodle, SanityProject } from '@/lib/doodles';
import { DoodleCanvas, type GhostNavEntry } from './DoodleCanvas';
import { EditorStyles } from './EditorStyles';
import { resolveDoodles } from './raw';
import type { EditorHero, ImageUrlResolver } from './types';

export interface DoodleSummaryProps {
  value: RawDoodle[];
  project: SanityProject;
  hero: EditorHero;
  navPages: string[];
  navEntries?: GhostNavEntry[];
  resolveImageUrl?: ImageUrlResolver;
  readOnly?: boolean;
  onOpen(): void;
  openButtonRef?: Ref<HTMLButtonElement>;
  /** extra controls after the count */
  extra?: ReactNode;
}

export function DoodleSummary({
  value,
  project,
  hero,
  navPages,
  navEntries,
  resolveImageUrl,
  readOnly,
  onOpen,
  openButtonRef,
  extra,
}: DoodleSummaryProps) {
  const items = useMemo(() => resolveDoodles(value, project, resolveImageUrl), [value, project, resolveImageUrl]);
  const total = value.length;
  const unfinished = total - items.length;
  const count =
    total === 0
      ? 'Nothing on the photo yet.'
      : `${total} ${total === 1 ? 'item' : 'items'} on the photo` +
        (unfinished > 0 ? ` · ${unfinished} not shown yet (no picture or text)` : '');

  return (
    <div className="de-summary">
      <EditorStyles />
      <div className="de-summary-previews" onClick={onOpen} title="Open the visual editor">
        <div className="de-summary-desktop">
          <DoodleCanvas
            device="desktop"
            items={items}
            hero={hero}
            navPages={navPages}
            navEntries={navEntries}
            fit="width"
            maxScale={1}
            captions={false}
          />
          <div className="de-summary-caption">Desktop</div>
        </div>
        <div className="de-summary-phone">
          <DoodleCanvas
            device="phone"
            items={items}
            hero={hero}
            navPages={navPages}
            navEntries={navEntries}
            fit="width"
            maxScale={1}
            captions={false}
          />
          <div className="de-summary-caption">Phone</div>
        </div>
      </div>
      <div className="de-summary-bar">
        <button ref={openButtonRef} type="button" className="de-btn de-btn--primary" onClick={onOpen}>
          {readOnly ? 'Open visual editor (view only)' : 'Open visual editor'}
        </button>
        <span className="de-summary-count">{count}</span>
        {extra}
      </div>
    </div>
  );
}
