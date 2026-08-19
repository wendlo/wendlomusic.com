'use client';

/**
 * ShowsPanel — client island for the Tour room's right-half shows list.
 *
 * The `.show` rows / empty state are fetched + rendered on the server (see
 * TourRoom) and passed in as `children`. This island exists only to port the
 * prototype's `#showsList` + `.scroll-hint` behavior (index.html ~L705-711):
 * the hint hides when the list is scrolled to the bottom, when it doesn't
 * overflow, or when there are no shows. That needs the DOM, hence 'use client'.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export interface ShowsPanelProps {
  /** Whether the server rendered real `.show` rows (vs. the empty state). */
  hasShows: boolean;
  /** Server-rendered `.show` rows or the empty-state block. */
  children: ReactNode;
}

export function ShowsPanel({ hasShows, children }: ShowsPanelProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [hintHidden, setHintHidden] = useState(false);

  // Mirrors prototype updateHint(): hide the hint at the bottom or when no overflow.
  const updateHint = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
    setHintHidden(atBottom || el.scrollHeight <= el.clientHeight + 4);
  }, []);

  useEffect(() => {
    updateHint();
    window.addEventListener('resize', updateHint);
    return () => window.removeEventListener('resize', updateHint);
  }, [updateHint, hasShows]);

  return (
    <div className="shows-panel">
      <div className="shows-scrollwrap">
        <div className="shows-list" ref={listRef} onScroll={updateHint}>
          {children}
        </div>
        <div className="shows-fade" />
      </div>
      <div className={`scroll-hint${!hasShows || hintHidden ? ' hide' : ''}`}>
        <i className="ti ti-arrow-down" /> scroll for more
      </div>
    </div>
  );
}
