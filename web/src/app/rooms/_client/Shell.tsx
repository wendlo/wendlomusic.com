'use client';

/**
 * Shell — the slider + nav runtime, ported from prototype/index.html's <script>.
 *
 * Responsibilities (faithful to the prototype's go()/renderNav()/applyPages):
 *  - A %-measured translateX `.track`: room N sits at translateX(-N*100%).
 *  - `go(pageId)` pushes history (hash) and moves the track.
 *  - HASH is the source of truth: on mount the initial transform is set from
 *    location.hash with NO animation; unknown/disabled ids fall back to
 *    contact → home (prototype clamps to the first enabled page).
 *  - The moving nav dock: bottom-right horizontal on home/about/tour/contact,
 *    side-vertical (top-right) on music/store/blog. GIF pages get handwriting
 *    art that ASSET-SWAPS white↔mustard on active via CSS (unaffected by accent);
 *    about/blog are text labels.
 *    Band-added custom nav items render beside them (own art or text) and
 *    link to a page, a contact-form sheet, or an external site.
 *  - Home doodles (the "click here" GIF, "join our email list!" …) via the
 *    shared <DoodleLayer>; internal doodle links go through followLink().
 *  - Mobile FAB + nav sheet (media-driven layout; JS only toggles the sheet).
 *  - Focus move + aria-live announce on room change.
 *  - Reduced-motion: an opacity fade instead of the slide.
 *
 * Layout mode (desktop vs mobile dock) is CSS-media-driven — there is NO JS
 * autoFit here. The Shell only owns navigation state + the stage class flags.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type {
  DesignSettings,
  NavItem,
  NavPage,
  PageId,
} from '@/lib/content/types';
import { DEFAULT_ASSETS } from '@/lib/content/fallback';
import {
  OPEN_SHEET_EVENT,
  doodleHref,
  linkAvailable,
  type Doodle,
  type DoodleLink,
  type OpenSheetDetail,
} from '@/lib/doodles';
import { DoodleLayer } from '@/components/doodles/DoodleLayer';

/** Pages whose nav dock is the vertical side dock (prototype SIDE_PAGES). */
const SIDE_PAGES: ReadonlySet<PageId> = new Set<PageId>(['music', 'store', 'blog']);
/** Pages with handwriting GIF nav art (prototype GIF_NAV). Others are text. */
const GIF_NAV: ReadonlySet<PageId> = new Set<PageId>([
  'home',
  'tour',
  'contact',
  'music',
  'store',
]);

type CustomNavItem = Extract<NavItem, { kind: 'custom' }>;

export interface ShellProps {
  /**
   * The FIXED pages (order + enabled + labels), from siteSettings.pages. The
   * slide sequence is built from these only.
   */
  pages: NavPage[];
  /** What the nav docks show: enabled fixed pages + custom items, in order. */
  navItems: NavItem[];
  /** Home-page doodles (shown over the home hero only). */
  doodles: Doodle[];
  /** Design settings (accent injected as --persimmon; nav art is unaffected). */
  design: DesignSettings;
  /**
   * The seven room elements, in prototype room order
   * (home, about, tour, contact, music, store, blog). Rendered inside `.track`.
   */
  children: ReactNode;
}

/** Human-facing label for the aria-live announcement. */
function pageLabel(pages: NavPage[], id: PageId): string {
  return pages.find((p) => p.pageId === id)?.label ?? id;
}

/** Accessible name for an image-only custom nav item. */
function linkLabel(link: DoodleLink): string {
  switch (link.kind) {
    case 'page':
      return link.page ?? 'home';
    case 'email-signup':
      return 'join our email list';
    case 'message':
      return 'send us a message';
    case 'url':
      try {
        return new URL(link.url ?? '').hostname.replace(/^www\./, '');
      } catch {
        return 'link';
      }
    default:
      return 'link';
  }
}

export function Shell({
  pages,
  navItems,
  doodles,
  design,
  children,
}: ShellProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);
  const didInit = useRef(false);

  /** Enabled pages, in order — the slide sequence (prototype enabledPages()). */
  const enabled = useMemo(
    () => pages.filter((p) => p.enabled).map((p) => p.pageId),
    [pages],
  );

  /**
   * Doodles live on home only, so a link to a switched-off page (or a form
   * link while Contact is off) could only "land on home" — i.e. do nothing.
   * Render those as plain decoration instead; placement is unchanged.
   */
  const liveDoodles = useMemo(
    () =>
      doodles.map((d) =>
        linkAvailable(d.link, enabled) ? d : { ...d, link: { kind: 'none' as const } },
      ),
    [doodles, enabled],
  );

  const [current, setCurrent] = useState<PageId>(() => enabled[0] ?? 'home');
  const [sheetOpen, setSheetOpen] = useState(false);

  const side = SIDE_PAGES.has(current);

  /**
   * Core navigation. `instant` skips the slide animation (used for the initial
   * hash sync and reduced-motion). Clamps to the first enabled page when given
   * an unknown/disabled id (prototype: list[0] || 'home').
   */
  const go = useCallback(
    (page: PageId, instant = false) => {
      const target = enabled.includes(page) ? page : enabled[0] ?? 'home';
      const track = trackRef.current;
      const nextIdx = Math.max(0, enabled.indexOf(target));

      if (track) {
        const prefersReduced =
          typeof window !== 'undefined' &&
          window.matchMedia('(prefers-reduced-motion:reduce)').matches;

        if (instant) {
          track.style.transition = 'none';
        } else if (prefersReduced) {
          // opacity fade instead of the slide (CSS animates .track opacity)
          track.style.opacity = '0';
          window.requestAnimationFrame(() => {
            if (trackRef.current) trackRef.current.style.opacity = '1';
          });
        }

        track.style.transform = `translateX(${-nextIdx * 100}%)`;

        if (instant) {
          window.requestAnimationFrame(() =>
            window.requestAnimationFrame(() => {
              if (trackRef.current) trackRef.current.style.transition = '';
            }),
          );
        }
      }

      setCurrent(target);

      // reset the scroll position of the room + its inner .content
      const room = track?.querySelector<HTMLElement>(`[data-page="${target}"]`);
      if (room) {
        room.scrollTop = 0;
        const sc = room.querySelector<HTMLElement>('.content');
        if (sc) sc.scrollTop = 0;
      }

      setSheetOpen(false);

      // aria-live announce + focus move to the active room
      if (liveRef.current) liveRef.current.textContent = pageLabel(pages, target);
      if (room && !instant) {
        room.setAttribute('tabindex', '-1');
        room.focus({ preventScroll: true });
      }
    },
    [enabled, pages],
  );

  /** Navigate + push a hash to history (prototype go() is invoked from clicks). */
  const navigate = useCallback(
    (page: PageId) => {
      if (typeof window !== 'undefined') {
        // pushState so Back works; the hashchange handler is guarded via ref
        window.history.pushState(null, '', `#${page}`);
      }
      go(page);
    },
    [go],
  );

  /**
   * Internal links from doodles + custom nav items. Links to switched-off
   * targets were already turned into non-links (liveDoodles, mapNav), so the
   * home fallback is only a guard; the form links slide to contact and ask
   * ContactIsland to open that sheet (it ignores the event when the form
   * doesn't exist).
   */
  const followLink = useCallback(
    (link: DoodleLink) => {
      const toPage = (id: PageId | undefined): PageId =>
        id && enabled.includes(id) ? id : 'home';
      switch (link.kind) {
        case 'page':
          navigate(toPage(link.page));
          break;
        case 'email-signup':
        case 'message': {
          const page = toPage('contact');
          navigate(page);
          if (page === 'contact') {
            window.dispatchEvent(
              new CustomEvent<OpenSheetDetail>(OPEN_SHEET_EVENT, {
                detail: link.kind === 'message' ? 'message' : 'email',
              }),
            );
          }
          break;
        }
        default:
          break;
      }
    },
    [enabled, navigate],
  );

  // ---- mount: hash is the source of truth; set initial transform w/o anim ----
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const fromHash = (): PageId => {
      const raw = window.location.hash.replace(/^#/, '') as PageId;
      if (enabled.includes(raw)) return raw;
      // no hash / unknown / disabled → land on the first enabled page (home)
      return enabled[0] ?? 'home';
    };

    go(fromHash(), true);

    const onHash = () => go(fromHash());
    const onPop = () => go(fromHash());
    window.addEventListener('hashchange', onHash);
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('popstate', onPop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // apply the accent (prototype applyDesign: --persimmon). Nav art is untouched.
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--persimmon',
      design.accent || '#E0A32B',
    );
    document.documentElement.style.setProperty(
      '--stripes',
      `url("${design.stripes.url}")`,
    );
  }, [design.accent, design.stripes.url]);

  // stage class flags (prototype go(): at-home / content / store-active)
  const stageClass = [
    'stage',
    current === 'home' ? 'at-home' : '',
    side ? 'content' : '',
    current === 'store' ? 'store-active' : '',
  ]
    .filter(Boolean)
    .join(' ');

  /** One fixed-page nav link (GIF art or text label), per prototype navLinkHtml. */
  const pageLink = (p: { pageId: PageId; label: string }, key: string) => {
    const on = p.pageId === current;
    const isText = !GIF_NAV.has(p.pageId);
    const cls = ['navlink', isText ? 'text' : '', on ? 'on' : '']
      .filter(Boolean)
      .join(' ');
    return (
      <a
        key={key}
        data-go={p.pageId}
        className={cls}
        aria-label={p.label}
        aria-current={on ? 'page' : undefined}
        href={`#${p.pageId}`}
        onClick={(e) => {
          e.preventDefault();
          navigate(p.pageId);
        }}
      >
        {isText ? p.label : null}
        {p.pageId === 'store' ? <span className="navbadge">0</span> : null}
      </a>
    );
  };

  /**
   * One band-added nav link. Same `navlink` class so it gets the dock/sheet
   * heights + hover; NO data-go (the CSS art selectors key off it). Art is an
   * inline background sized by the asset's aspect ratio; no art → text link.
   */
  const customLink = (item: CustomNavItem, key: string) => {
    const on = item.link.kind === 'page' && item.link.page === current;
    const art = on
      ? (item.imageActive ?? item.image)
      : (item.image ?? item.imageActive);
    const cls = ['navlink', art ? '' : 'text', on ? 'on' : '']
      .filter(Boolean)
      .join(' ');
    const style: CSSProperties | undefined = art
      ? {
          backgroundImage: `url("${art.src}")`,
          aspectRatio: `${art.width} / ${art.height}`,
        }
      : undefined;
    const external = item.link.kind === 'url';
    return (
      <a
        key={key}
        className={cls}
        style={style}
        aria-label={item.label || linkLabel(item.link)}
        aria-current={on ? 'page' : undefined}
        href={doodleHref(item.link)}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        onClick={(e) => {
          if (external) {
            setSheetOpen(false);
            return;
          }
          e.preventDefault();
          followLink(item.link);
        }}
      >
        {art ? null : item.label}
      </a>
    );
  };

  const navLinks = (prefix: string) =>
    navItems.map((item) =>
      item.kind === 'page'
        ? pageLink(item, `${prefix}${item.pageId}`)
        : customLink(item, `${prefix}c-${item.key}`),
    );

  return (
    <div className="device">
      <div ref={stageRef} className={stageClass}>
        {/* logo — floats over the whole stage; only visible/at-home via CSS.
            The built-in brand GIF is black art that CSS inverts to white;
            a band-uploaded logo is `custom` and shown as-is (prototype:
            `logo.classList.toggle('custom', !!CFG.design.logo)`). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={
            design.logo.url && design.logo.url !== DEFAULT_ASSETS.logo
              ? 'logo custom'
              : 'logo'
          }
          src={design.logo.url}
          alt="Wendlo"
          data-go="home"
          onClick={() => navigate('home')}
        />

        {/* home-only doodles (faded out off-home via doodles.css) */}
        <DoodleLayer items={liveDoodles} onLink={followLink} />

        {/* desktop nav dock (bottom on home/about/tour/contact, side on music/store/blog) */}
        <nav className={`nav ${side ? 'side' : 'bottom'}`} aria-label="Sections">
          {navLinks('')}
        </nav>

        {/* the slider */}
        <div ref={trackRef} className="track">
          {children}
        </div>

        {/* mobile FAB + nav sheet (shown only under the mobile media queries) */}
        <button
          className="mnav-btn"
          aria-label="Menu"
          onClick={() => setSheetOpen(true)}
        >
          <i className="ti ti-menu-2" />
        </button>
        <nav
          className={`mnav-sheet${sheetOpen ? ' open' : ''}`}
          aria-label="Sections"
        >
          <button
            className="close"
            aria-label="Close"
            onClick={() => setSheetOpen(false)}
          >
            &times;
          </button>
          {navLinks('m-')}
        </nav>

        {/* aria-live region for room-change announcements */}
        <div ref={liveRef} className="sr-only" aria-live="polite" role="status" />
      </div>
    </div>
  );
}
