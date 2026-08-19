'use client';

/**
 * HomeIsland — the home slide's local interactivity, factored out so both the
 * home room and the Shell chrome can share one implementation.
 *
 * The home-only chrome (rotated "join our email list!" CTA + click-here arrow)
 * physically renders in the Shell (it floats over the whole stage), but its
 * *behaviour* belongs to Home: clicking it must slide to the contact room and
 * open the email-list modal. Both surfaces map to the prototype's
 * `data-go="contact" data-sheet="email"` attributes (index.html lines 354-355).
 *
 * This module exposes a callable hook the Shell adopts in Phase 4. The
 * navigate-to-contact half works now; opening the email sheet is a no-op until
 * the contact room's email modal exists.
 */

import { useCallback } from 'react';
import type { PageId } from '@/lib/content/types';

export interface EmailCtaActionOptions {
  /**
   * Shell navigation primitive — pushes the hash + slides the track.
   * (The Shell's own `go`/`navigate`.)
   */
  navigate: (page: PageId) => void;
  /**
   * Opens a named sheet/modal on the destination room. Optional: until the
   * contact room's email modal is wired (Phase 4) this is undefined and the
   * CTA simply lands on the contact room.
   */
  openSheet?: (sheet: 'email') => void;
}

/**
 * Returns the click handler for the "join our email list!" CTA and the
 * click-here arrow. Faithful to `data-go="contact" data-sheet="email"`.
 */
export function useEmailCtaAction({
  navigate,
  openSheet,
}: EmailCtaActionOptions): () => void {
  return useCallback(() => {
    navigate('contact');
    // TODO(phase-4): open the email-list modal on the contact room via the
    // contact room's real sheet API. `data-sheet="email"` in the prototype.
    // No-op today so the build/nav still works without the modal.
    openSheet?.('email');
  }, [navigate, openSheet]);
}
