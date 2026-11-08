'use client';

/**
 * Sanity Visual Editing overlay with a refresh handler, mounted by the root
 * layout only inside a draft-mode session.
 *
 * The site reads content with server fetches (no live loader), so the
 * Presentation preview only changes when the RSC tree is re-rendered.
 * next-sanity's default handler ignores 'mutation' refreshes; this one
 * re-renders on both the refresh button ('manual') and Studio edits
 * ('mutation'), so changes show in the preview within about a second.
 */

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { VisualEditing, type VisualEditingProps } from 'next-sanity/visual-editing';

type RefreshHandler = NonNullable<VisualEditingProps['refresh']>;

export default function PreviewVisualEditing() {
  const router = useRouter();

  const refresh = useCallback<RefreshHandler>(
    (payload) => {
      if (payload.source === 'manual' || payload.source === 'mutation') {
        router.refresh();
        return Promise.resolve();
      }
      return false;
    },
    [router],
  );

  return <VisualEditing refresh={refresh} />;
}
