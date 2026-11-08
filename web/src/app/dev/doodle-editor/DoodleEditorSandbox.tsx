'use client';

/**
 * Sandbox for the doodle editor: today's look (LEGACY_DOODLES) as the stored
 * array, a fake asset store (the click-here GIF behind a fake Sanity ref, plus
 * blob URLs for uploads), and an on-screen log of every patch the editor
 * sends + the array after applying it — the same patches DoodleCanvasInput
 * hands to the Studio.
 */

import { useCallback, useState } from 'react';
import { CLICK_HERE_SRC, LEGACY_DOODLES, type RawDoodle, type SanityProject } from '@/lib/doodles';
import { DoodleEditor } from '@/sanity/inputs/doodle-editor/DoodleEditor';
import { DoodleSummary } from '@/sanity/inputs/doodle-editor/DoodleSummary';
import { applyPatches } from '@/sanity/inputs/doodle-editor/patches';
import { rawFromDoodle } from '@/sanity/inputs/doodle-editor/raw';
import type { EditorHero, EditorPatch } from '@/sanity/inputs/doodle-editor/types';

const FAKE_CLICK_HERE_REF = 'image-0000000000000000000000000000000000000000-866x575-gif';
const PROJECT: SanityProject = { projectId: 'sandbox', dataset: 'sandbox' };
const HERO: EditorHero = { src: '/defaults/home.jpg', focalDesktop: '50% 50%', focalPhone: '50% 42%' };
const NAV = ['home', 'tour', 'contact', 'music', 'store'];

/** Fake asset store, ref → URL. Module-level so the resolver never changes. */
const FAKE_ASSETS = new Map<string, string>([[FAKE_CLICK_HERE_REF, CLICK_HERE_SRC]]);
const resolveImageUrl = (ref: string) => FAKE_ASSETS.get(ref);

const EXT: Record<string, string> = {
  'image/gif': 'gif',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
};

/** Mimics client.assets.upload: a Sanity-shaped ref (image-<sha1>-WxH-ext) backed by a blob URL. */
async function fakeUpload(file: File): Promise<{ _ref: string }> {
  const url = URL.createObjectURL(file);
  const size = await new Promise<{ w: number; h: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 100, h: img.naturalHeight || 100 });
    img.onerror = () => reject(new Error('The browser could not read that picture.'));
    img.src = url;
  });
  await new Promise((r) => setTimeout(r, 500));
  const hash = Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => b.toString(16).padStart(2, '0')).join('');
  const ref = `image-${hash}-${size.w}x${size.h}-${EXT[file.type] ?? 'png'}`;
  FAKE_ASSETS.set(ref, url);
  return { _ref: ref };
}

const initialValue = (): RawDoodle[] =>
  LEGACY_DOODLES.map((d) => rawFromDoodle(d, d.kind === 'image' ? FAKE_CLICK_HERE_REF : undefined));

interface LogEntry {
  n: number;
  patches: EditorPatch[];
  result: RawDoodle[];
}
interface SandboxDoc {
  value: RawDoodle[];
  log: LogEntry[];
  n: number;
}

const CSS = `
.sbx { min-height: 100vh; background: #eceef2; color: #1f2328; font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; padding: 16px; display: flex; flex-direction: column; gap: 14px; }
.sbx h1 { font-size: 18px; }
.sbx h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: #5b6270; margin-bottom: 6px; }
.sbx-head { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; }
.sbx-head p { color: #5b6270; flex: 1 1 320px; }
.sbx-controls { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; }
.sbx-controls label { display: inline-flex; gap: 6px; align-items: center; cursor: pointer; }
.sbx-controls button { font: inherit; padding: 6px 11px; border-radius: 6px; border: 1px solid #c9ced8; background: #fff; color: inherit; cursor: pointer; }
.sbx-controls button:hover { background: #f4f5f8; }
.sbx-editor { height: 78vh; min-height: 560px; border-radius: 10px; overflow: hidden; border: 1px solid #c9ced8; background: #fff; }
.sbx-editor[data-closed=true] { height: auto; min-height: 0; padding: 16px; }
.sbx-log { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; }
@media (max-width: 900px) { .sbx-log { grid-template-columns: 1fr; } }
.sbx pre { background: #16171b; color: #d7f0d0; font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; padding: 12px; border-radius: 8px; overflow: auto; max-height: 520px; white-space: pre-wrap; word-break: break-word; }
.sbx-entry { margin-bottom: 10px; }
.sbx-entry-head { font-size: 12px; color: #5b6270; margin-bottom: 3px; }
`;

export function DoodleEditorSandbox() {
  const [doc, setDoc] = useState<SandboxDoc>(() => ({ value: initialValue(), log: [], n: 0 }));
  const [open, setOpen] = useState(true);
  const [mode, setMode] = useState<'inline' | 'portal'>('inline');
  const [readOnly, setReadOnly] = useState(false);
  const [failUploads, setFailUploads] = useState(false);

  const onPatch = useCallback((patches: EditorPatch[]) => {
    setDoc((d) => {
      const value = applyPatches(d.value, patches);
      const n = d.n + 1;
      return { value, n, log: [{ n, patches, result: value }, ...d.log].slice(0, 40) };
    });
  }, []);

  const onUpload = useCallback(
    (file: File) =>
      failUploads ? Promise.reject(new Error('(Sandbox: simulated network error.)')) : fakeUpload(file),
    [failUploads],
  );

  const reset = (value: RawDoodle[]) => setDoc((d) => ({ value, n: d.n, log: d.log }));

  return (
    <div className="sbx">
      <style>{CSS}</style>
      <div className="sbx-head">
        <h1>Doodle editor sandbox</h1>
        <p>
          Dev only — nothing is saved. The log shows exactly the patches the Studio would receive (paths are relative
          to <code>homePage.doodles</code>).
        </p>
      </div>
      <div className="sbx-controls">
        <button type="button" onClick={() => setOpen((o) => !o)} data-testid="toggle-editor">
          {open ? 'Close editor' : 'Open editor'}
        </button>
        <label>
          <input
            type="radio"
            name="sbx-mode"
            checked={mode === 'inline'}
            onChange={() => setMode('inline')}
          />
          In the page
        </label>
        <label>
          <input
            type="radio"
            name="sbx-mode"
            checked={mode === 'portal'}
            onChange={() => setMode('portal')}
          />
          Full screen (as in the Studio)
        </label>
        <label>
          <input type="checkbox" checked={readOnly} onChange={(e) => setReadOnly(e.currentTarget.checked)} />
          Read-only
        </label>
        <label>
          <input type="checkbox" checked={failUploads} onChange={(e) => setFailUploads(e.currentTarget.checked)} />
          Make uploads fail
        </label>
        <button type="button" onClick={() => reset(initialValue())}>
          Reset to today’s look
        </button>
        <button type="button" onClick={() => reset([])}>
          Empty
        </button>
      </div>

      <section className="sbx-editor" data-closed={!open || mode === 'portal'}>
        {open ? (
          <>
            {mode === 'portal' ? <p>The editor is open full screen — press Done (or Esc) to come back here.</p> : null}
            <DoodleEditor
              value={doc.value}
              project={PROJECT}
              hero={HERO}
              navPages={NAV}
              readOnly={readOnly}
              onPatch={onPatch}
              onUpload={onUpload}
              onClose={() => setOpen(false)}
              resolveImageUrl={resolveImageUrl}
              mount={mode}
            />
          </>
        ) : (
          <DoodleSummary
            value={doc.value}
            project={PROJECT}
            hero={HERO}
            navPages={NAV}
            resolveImageUrl={resolveImageUrl}
            readOnly={readOnly}
            onOpen={() => setOpen(true)}
          />
        )}
      </section>

      <section className="sbx-log">
        <div>
          <h2>Patches, newest first ({doc.n} sent)</h2>
          <div data-testid="patch-log">
            {doc.log.length === 0 ? <pre>No patches yet — drag something.</pre> : null}
            {doc.log.map((e) => (
              <div key={e.n} className="sbx-entry" data-testid="patch-entry">
                <div className="sbx-entry-head">
                  #{e.n} · {e.patches.length} patch{e.patches.length === 1 ? '' : 'es'}
                </div>
                <pre>{JSON.stringify(e.patches, null, 2)}</pre>
                <details>
                  <summary className="sbx-entry-head">Array after #{e.n}</summary>
                  <pre>{JSON.stringify(e.result, null, 2)}</pre>
                </details>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2>Resulting array ({doc.value.length} items)</h2>
          <pre data-testid="doodles-json">{JSON.stringify(doc.value, null, 2)}</pre>
        </div>
      </section>
    </div>
  );
}
