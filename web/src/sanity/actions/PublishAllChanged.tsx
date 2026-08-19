/**
 * PublishAllChanged — the "Publish site" Studio TOOL (Phase 5 one-click
 * publish story).
 *
 * A top-level Studio tool (registered via defineConfig `tools`, the robust v6
 * pattern — document actions only see one open document, but a tool can query
 * the whole dataset) that lists every draft document and publishes them all in
 * ONE transaction: for each `drafts.<id>` doc, `createOrReplace` the published
 * id with the draft's content + `delete` the draft. Editors preview with the
 * Presentation tool, then press one button here to take the whole set live.
 *
 * Uses `useClient` (Studio's authenticated client) — no extra tokens/env, so
 * the unconfigured-placeholder Studio path is untouched (the tool only runs
 * inside a mounted, configured Studio).
 */

import { useCallback, useEffect, useState } from 'react';
import { useClient, type Tool } from 'sanity';
import { apiVersion } from '@/sanity/env';

interface DraftDoc {
  _id: string;
  _type: string;
  [key: string]: unknown;
}

const DRAFTS_QUERY = "*[_id in path('drafts.**')]{_id,_type}";
const DRAFTS_FULL_QUERY = "*[_id in path('drafts.**')]";
const DRAFT_PREFIX = 'drafts.';

/* Plain inline styles (no @sanity/ui import — it is not hoisted in this
 * node_modules tree; the tool renders fine with neutral HTML). */
const S = {
  wrap: {
    maxWidth: '40rem',
    margin: '0 auto',
    padding: '2.5rem 1.5rem',
    fontFamily: 'inherit',
  },
  h1: { fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem' },
  sub: { fontSize: '0.875rem', color: '#6e7683', margin: '0 0 1.5rem' },
  list: { listStyle: 'none', padding: 0, margin: '0 0 1.5rem' },
  li: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    padding: '0.5rem 0.75rem',
    border: '1px solid #e3e4e8',
    borderRadius: '4px',
    marginBottom: '0.375rem',
    fontSize: '0.875rem',
  },
  type: { color: '#6e7683' },
  btn: (disabled: boolean) => ({
    padding: '0.6rem 1.1rem',
    borderRadius: '4px',
    border: '1px solid transparent',
    background: disabled ? '#c8cbd1' : '#101112',
    color: '#fff',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: disabled ? 'default' : 'pointer',
  }),
  ghostBtn: {
    padding: '0.6rem 1.1rem',
    borderRadius: '4px',
    border: '1px solid #e3e4e8',
    background: 'transparent',
    color: 'inherit',
    fontSize: '0.875rem',
    cursor: 'pointer',
    marginLeft: '0.5rem',
  },
  ok: { color: '#2f7d4f', fontSize: '0.875rem', marginTop: '1rem' },
  err: { color: '#c0392b', fontSize: '0.875rem', marginTop: '1rem' },
} as const;

function publishedIdOf(draftId: string): string {
  return draftId.startsWith(DRAFT_PREFIX)
    ? draftId.slice(DRAFT_PREFIX.length)
    : draftId;
}

function PublishAllChanged() {
  const client = useClient({ apiVersion });
  const [drafts, setDrafts] = useState<DraftDoc[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishedCount, setPublishedCount] = useState<number | null>(null);

  // Bumping this re-runs the draft-list effect (initial load, Refresh button,
  // and after a publish).
  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    client.fetch<DraftDoc[]>(DRAFTS_QUERY).then(
      (docs) => {
        if (cancelled) return;
        setDrafts(docs);
        setError(null);
      },
      (err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load drafts');
        setDrafts([]);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [client, reloadKey]);

  const publishAll = useCallback(async () => {
    setBusy(true);
    setError(null);
    setPublishedCount(null);
    try {
      // Re-fetch FULL draft documents at publish time (the list view only
      // projects _id/_type; the transaction needs whole documents).
      const fullDrafts = await client.fetch<DraftDoc[]>(DRAFTS_FULL_QUERY);
      if (fullDrafts.length === 0) {
        setDrafts([]);
        setPublishedCount(0);
        return;
      }
      let tx = client.transaction();
      for (const draft of fullDrafts) {
        // Strip revision/system-update fields; Content Lake assigns fresh ones.
        const { _rev: _drop1, _updatedAt: _drop2, ...doc } = draft;
        void _drop1;
        void _drop2;
        tx = tx
          .createOrReplace({ ...doc, _id: publishedIdOf(draft._id) })
          .delete(draft._id);
      }
      await tx.commit({ visibility: 'sync' });
      setPublishedCount(fullDrafts.length);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setBusy(false);
    }
  }, [client, load]);

  const hasDrafts = (drafts?.length ?? 0) > 0;

  return (
    <div style={S.wrap}>
      <h1 style={S.h1}>Publish site</h1>
      <p style={S.sub}>
        Every document with unpublished changes is listed below. One click
        publishes them all together.
      </p>

      {drafts === null ? (
        <p style={S.sub}>Loading drafts…</p>
      ) : hasDrafts ? (
        <ul style={S.list}>
          {drafts.map((d) => (
            <li key={d._id} style={S.li}>
              <span>{publishedIdOf(d._id)}</span>
              <span style={S.type}>{d._type}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p style={S.sub}>
          No unpublished changes — everything on the site is live.
        </p>
      )}

      <div>
        <button
          type="button"
          style={S.btn(busy || !hasDrafts)}
          disabled={busy || !hasDrafts}
          onClick={() => void publishAll()}
        >
          {busy
            ? 'Publishing…'
            : hasDrafts
              ? `Publish all (${drafts?.length ?? 0})`
              : 'Nothing to publish'}
        </button>
        <button
          type="button"
          style={S.ghostBtn}
          disabled={busy}
          onClick={load}
        >
          Refresh
        </button>
      </div>

      {publishedCount !== null && publishedCount > 0 ? (
        <p style={S.ok} role="status">
          Published {publishedCount} document
          {publishedCount === 1 ? '' : 's'}. The site cache updates via the
          Sanity webhook (or within a minute).
        </p>
      ) : null}
      {error ? (
        <p style={S.err} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The Studio tool registration consumed by sanity.config.ts `tools`. */
export const publishAllTool: Tool = {
  name: 'publish-all',
  title: 'Publish site',
  component: PublishAllChanged,
};

export default PublishAllChanged;
