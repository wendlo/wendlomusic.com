/**
 * DoodleCanvasInput — homePage.doodles (array of doodleImage / doodleText).
 *
 * Inline: read-only previews of the desktop + phone layout and an "Open
 * visual editor" button. The editor itself (doodle-editor/DoodleEditor) is
 * Sanity-free; this file maps its EditorPatches 1:1 onto set / unset / insert,
 * uploads images through the Studio client, and feeds it the hero photo from
 * the same document plus the nav row (fixed pages + custom items) and accent
 * colour from siteSettings.
 *
 * Never-saved field: the site then shows LEGACY_DOODLES (lib/content/map.ts),
 * so this input shows them too. Opening the editor uploads their GIF (Sanity
 * dedupes by content) and the first change stores today's look before itself.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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
import { fallbackContent } from '@/lib/content/fallback';
import {
  CLICK_HERE_SIZE,
  CLICK_HERE_SRC,
  LEGACY_DOODLES,
  assetFromRef,
  linkAvailable,
  linkFrom,
  type RawDoodle,
  type RawDoodleLink,
  type SanityProject,
} from '@/lib/doodles';
import { apiVersion, dataset, safeProjectId } from '@/sanity/env';
import type { GhostNavEntry } from './doodle-editor/DoodleCanvas';
import { DoodleEditor } from './doodle-editor/DoodleEditor';
import { DoodleSummary } from './doodle-editor/DoodleSummary';
import { rawFromDoodle } from './doodle-editor/raw';
import type { EditorHero, EditorPatch } from './doodle-editor/types';

const PROJECT: SanityProject = { projectId: safeProjectId, dataset };
const DEFAULT_NAV = ['home', 'tour', 'contact', 'music', 'store'];
/** Shell's fallback when siteSettings.design.accent is empty. */
const DEFAULT_ACCENT = '#E0A32B';
/** The site's hero when homePage.hero.image is empty (map.ts → fallback.ts). */
const FB_HERO = fallbackContent.home.hero;

/**
 * Nav row + accent from siteSettings. The draft wins when there is one
 * ('drafts.siteSettings' sorts first), matching the Presentation preview;
 * filtering by id keeps this independent of the client's perspective.
 */
const SETTINGS_QUERY = `*[_id in ["drafts.siteSettings", "siteSettings"]] | order(_id asc)[0]{
  "pages": pages[enabled != false]{
    _type, _key, pageId, label,
    "image": image.asset._ref, "imageActive": imageActive.asset._ref, link
  },
  "accent": design.accent
}`;

/** Stands in for the not-yet-uploaded click-here GIF; drawn from public/. */
const PLACEHOLDER_REF = `image-${'0'.repeat(40)}-${CLICK_HERE_SIZE.width}x${CLICK_HERE_SIZE.height}-gif`;
const legacyRaw = (ref: string): RawDoodle[] => LEGACY_DOODLES.map((d) => rawFromDoodle(d, ref));
const resolvePlaceholder = (ref: string) => (ref === PLACEHOLDER_REF ? CLICK_HERE_SRC : undefined);

interface NavRow {
  _type?: string;
  _key?: string;
  pageId?: string;
  label?: string;
  image?: string;
  imageActive?: string;
  link?: RawDoodleLink;
}

interface SettingsResult {
  pages?: unknown;
  accent?: unknown;
}

/** The ghost nav row, by the same rules as mapNav() in lib/content/map.ts. */
function navFromRows(rows: NavRow[]): { pages: string[]; entries: GhostNavEntry[] } {
  // fixed pages first: a custom row can come before the pages that decide whether it shows
  const pages: string[] = [];
  for (const r of rows) {
    if (r?._type !== 'navCustom' && typeof r?.pageId === 'string' && !pages.includes(r.pageId)) {
      pages.push(r.pageId);
    }
  }
  const entries: GhostNavEntry[] = [];
  const placed = new Set<string>();
  rows.forEach((r, i) => {
    if (r?._type === 'navCustom') {
      const link = linkFrom(r.link);
      const label = (r.label ?? '').trim();
      // the editor canvas is the home page: a link to home shows its "open" art
      const on = link.kind === 'page' && link.page === 'home';
      const a = assetFromRef(on ? (r.imageActive ?? r.image) : (r.image ?? r.imageActive), PROJECT);
      if (link.kind === 'none' || (!label && !a) || !linkAvailable(link, pages)) return;
      entries.push({
        key: r._key || `nav${i}`,
        label,
        ...(a ? { art: { src: a.src, ar: a.width / a.height } } : {}),
      });
    } else if (typeof r?.pageId === 'string' && !placed.has(r.pageId)) {
      placed.add(r.pageId);
      entries.push(r.pageId);
    }
  });
  return { pages, entries };
}

/** Studio theme variables the full-screen editor needs (it portals outside the themed tree). */
const THEME_VARS = [
  '--card-bg-color',
  '--card-fg-color',
  '--card-muted-fg-color',
  '--card-border-color',
  '--card-focus-ring-color',
  '--card-muted-bg-color',
];

function captureTheme(el: HTMLElement | null): Record<string, string> | undefined {
  if (!el) return undefined;
  const cs = getComputedStyle(el);
  const out: Record<string, string> = {};
  for (const name of THEME_VARS) {
    const v = cs.getPropertyValue(name).trim();
    if (v) out[name] = v;
  }
  if (cs.fontFamily) out['--de-font'] = cs.fontFamily;
  return out;
}

interface HeroValue {
  image?: { asset?: { _ref?: string } } | null;
  focalDesktop?: string;
  focalMobile?: string;
}

export default function DoodleCanvasInput(props: ArrayOfObjectsInputProps) {
  const { value, onChange, readOnly, renderDefault } = props;
  const stored = Array.isArray(value);
  const heroValue = useFormValue(['hero']) as HeroValue | undefined;
  const client = useClient({ apiVersion });

  const [open, setOpen] = useState(false);
  const [showList, setShowList] = useState(false);
  const [theme, setTheme] = useState<Record<string, string>>();
  const [nav, setNav] = useState<{ pages: string[]; entries?: GhostNavEntry[] }>({ pages: DEFAULT_NAV });
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  /** the uploaded click-here asset, once the editor has been opened on a never-saved field */
  const [seedRef, setSeedRef] = useState<string | null>(null);
  const [seeding, setSeeding] = useState<'idle' | 'busy' | 'failed'>('idle');
  const wrapRef = useRef<HTMLDivElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  /** only the latest settings fetch may apply (mount + every editor open) */
  const fetchSeq = useRef(0);

  const items = useMemo(
    () => (stored ? (value as RawDoodle[]) : legacyRaw(seedRef ?? PLACEHOLDER_REF)),
    [stored, value, seedRef],
  );

  const loadSettings = useCallback(() => {
    const seq = ++fetchSeq.current;
    return client
      .fetch<SettingsResult | null>(SETTINGS_QUERY)
      .then((res) => {
        if (seq !== fetchSeq.current) return;
        if (Array.isArray(res?.pages)) {
          const next = navFromRows(res.pages as NavRow[]);
          if (next.pages.length) setNav(next);
        }
        setAccent((typeof res?.accent === 'string' && res.accent.trim()) || DEFAULT_ACCENT);
      })
      .catch(() => {
        /* keep the current ghost nav + accent */
      });
  }, [client]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  // Same rule as resolveHero(): the focal strings only count with a photo set.
  const heroRef = heroValue?.image?.asset?._ref;
  const focalDesktop = (heroRef ? heroValue?.focalDesktop?.trim() : FB_HERO.focalDesktop) || '50% 50%';
  const focalPhone = (heroRef ? heroValue?.focalMobile?.trim() : FB_HERO.focalMobile) || focalDesktop;
  const hero = useMemo<EditorHero>(() => {
    const a = assetFromRef(heroRef, PROJECT);
    // same width the site requests for heroes (resolveHero(…, 2400))
    return { src: a ? `${a.src}?w=2400&fit=max&auto=format` : FB_HERO.url, focalDesktop, focalPhone };
  }, [heroRef, focalDesktop, focalPhone]);

  // 'Accent' text uses var(--persimmon), which the site sets from siteSettings (Shell).
  const accentVars = useMemo(() => ({ '--persimmon': accent }) as CSSProperties, [accent]);
  const editorVars = useMemo(() => ({ ...theme, '--persimmon': accent }), [theme, accent]);

  const onPatch = useCallback(
    (patches: EditorPatch[]) => {
      const out: FormPatch[] = [];
      // first change to a never-saved field: store today's look, then the change
      if (!stored && seedRef) out.push(setIfMissing(legacyRaw(seedRef)));
      for (const p of patches) {
        if (p.type === 'set') out.push(set(p.value, p.path));
        else if (p.type === 'unset') out.push(unset(p.path));
        else out.push(setIfMissing([]), insert(p.items, p.position, p.path));
      }
      onChange(out);
    },
    [onChange, stored, seedRef],
  );

  const onUpload = useCallback(
    async (file: File) => {
      const doc = await client.assets.upload('image', file, { filename: file.name });
      return { _ref: doc._id };
    },
    [client],
  );

  const openEditor = async () => {
    if (seeding === 'busy') return;
    // pick up nav / accent changes made in Site settings since this form opened
    void loadSettings();
    if (!stored && !readOnly && !seedRef) {
      setSeeding('busy');
      try {
        const res = await fetch(CLICK_HERE_SRC);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const doc = await client.assets.upload('image', await res.blob(), {
          filename: CLICK_HERE_SRC.split('/').pop(),
        });
        setSeedRef(doc._id);
        setSeeding('idle');
      } catch {
        setSeeding('failed');
        return;
      }
    }
    setTheme(captureTheme(wrapRef.current));
    setOpen(true);
  };
  const closeEditor = () => {
    setOpen(false);
    openRef.current?.focus();
  };

  return (
    <div ref={wrapRef} style={accentVars}>
      <DoodleSummary
        value={items}
        project={PROJECT}
        hero={hero}
        navPages={nav.pages}
        navEntries={nav.entries}
        resolveImageUrl={stored ? undefined : resolvePlaceholder}
        readOnly={!!readOnly}
        onOpen={() => void openEditor()}
        openButtonRef={openRef}
        extra={
          // Never saved: the plain list would start empty and its first edit would
          // drop today's look (only the visual editor seeds it), so wait until then.
          stored ? (
            <button
              type="button"
              className="de-btn de-btn--small de-btn--ghost"
              onClick={() => setShowList((s) => !s)}
              aria-expanded={showList}
            >
              {showList ? 'Hide the plain list' : 'Show as a plain list (advanced)'}
            </button>
          ) : null
        }
      />
      {!stored ? (
        <p
          role={seeding === 'failed' ? 'alert' : 'status'}
          style={{
            margin: '8px 0 0',
            fontSize: 13,
            color: seeding === 'failed' ? '#d03a2f' : 'var(--card-muted-fg-color)',
          }}
        >
          {seeding === 'busy'
            ? 'Getting the editor ready…'
            : seeding === 'failed'
              ? 'Couldn’t get the editor ready (is the internet connection OK?). Please try again.'
              : 'This is the look the site shows now. It’s saved here the first time you change something in the visual editor; the plain list is available after that.'}
        </p>
      ) : null}
      {stored && showList ? <div style={{ marginTop: 12 }}>{renderDefault(props)}</div> : null}
      {open ? (
        <DoodleEditor
          value={items}
          project={PROJECT}
          hero={hero}
          navPages={nav.pages}
          navEntries={nav.entries}
          resolveImageUrl={stored ? undefined : resolvePlaceholder}
          readOnly={!!readOnly}
          onPatch={onPatch}
          onUpload={onUpload}
          onClose={closeEditor}
          themeVars={editorVars}
        />
      ) : null}
    </div>
  );
}
