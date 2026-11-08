'use client';

/**
 * The WYSIWYG canvas: a 'stage' div at the exact reference size (1440x900 or
 * 390x844) holding the hero photo, faded ghosts of the logo + nav, and the
 * site's own <DoodleLayer>, scaled down as a whole with transform: scale(k).
 * Because the layer sizes everything in cqw of that reference-size box, what
 * shows here is what the site shows at that screen size.
 *
 * Not given the class "stage": doodles.css hides doodles under
 * .stage:not(.at-home).
 */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react';
import { DoodleLayer, type DoodleLayerProps } from '@/components/doodles/DoodleLayer';
import type { Doodle } from '@/lib/doodles';
import { REF } from './geometry';
import type { Device, EditorHero } from './types';

/** Nav art aspect ratios (public/nav/<id>-white.gif). */
const NAV_AR: Record<string, number> = {
  home: 446 / 156,
  tour: 353 / 152,
  contact: 584 / 150,
  music: 439 / 150,
  store: 391 / 143,
};

/** Same numbers as .logo / .nav in rooms.css at the reference sizes. */
const CHROME = {
  desktop: { logoH: 82, navLinkH: 32, navTextPx: 25, navGap: 22 },
  phone: { logoH: 46, navLinkH: 23, navTextPx: 19, navGap: 15 },
} as const;

/** A band-added nav item (siteSettings navCustom) as the ghost nav draws it. */
export interface GhostNavCustom {
  key: string;
  /** shown (lowercase, like .navlink.text) when there is no art */
  label: string;
  /** art as the home page shows it, with its width / height ratio */
  art?: { src: string; ar: number };
}
/** A fixed page id, or a custom item. */
export type GhostNavEntry = string | GhostNavCustom;

export interface DoodleCanvasProps {
  device: Device;
  items: Doodle[];
  hero: EditorHero;
  /** enabled fixed page ids, in nav order */
  navPages: string[];
  /** the full nav row (fixed pages + custom items), in order; default navPages */
  navEntries?: GhostNavEntry[];
  /** contain = fit inside the parent box; width = fit the parent's width */
  fit: 'contain' | 'width';
  maxScale?: number;
  itemProps?: DoodleLayerProps['itemProps'];
  stageRef?: Ref<HTMLDivElement>;
  stageClassName?: string;
  /** captions on the logo/nav ghosts */
  captions?: boolean;
  className?: string;
  style?: CSSProperties;
  /** overlay content, positioned in reference px inside the stage */
  children?: ReactNode;
}

export function DoodleCanvas({
  device,
  items,
  hero,
  navPages,
  navEntries,
  fit,
  maxScale = 1.5,
  itemProps,
  stageRef,
  stageClassName,
  captions = true,
  className,
  style,
  children,
}: DoodleCanvasProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setBox((prev) => (prev && prev.w === r.width && prev.h === r.height ? prev : { w: r.width, h: r.height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ref = REF[device];
  const k = box
    ? Math.max(
        0.05,
        Math.min(maxScale, box.w / ref.w, fit === 'contain' && box.h > 0 ? box.h / ref.h : Infinity),
      )
    : null;
  const scale = k ?? 0.25;
  // captions stay screen-sized, so on a tiny canvas they'd cover the photo
  const showCaptions = captions && scale >= 0.4;
  const chrome = CHROME[device];
  const focal = device === 'phone' ? hero.focalPhone : hero.focalDesktop;

  return (
    <div
      ref={outerRef}
      className={className ? `de-canvas-fit ${className}` : 'de-canvas-fit'}
      data-fit={fit}
      style={style}
    >
      <div
        className="de-stage-frame"
        style={{ width: ref.w * scale, height: ref.h * scale, visibility: k ? 'visible' : 'hidden' }}
      >
        <div
          ref={stageRef}
          className={stageClassName ? `de-stage ${stageClassName}` : 'de-stage'}
          data-device={device}
          style={
            {
              width: ref.w,
              height: ref.h,
              transform: `scale(${scale})`,
              '--de-inv': String(1 / scale),
            } as CSSProperties
          }
        >
          <div
            className="de-hero"
            style={{ backgroundImage: `url("${hero.src}")`, backgroundPosition: focal || '50% 50%' }}
          />

          {/* Same stacking as the site (Shell): logo, then doodles, then nav —
              so doodles paint over the logo but under the nav. */}
          <div className="de-ghost" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="de-ghost-logo" src="/wendlo-logo.gif" alt="" style={{ height: chrome.logoH }} />
            {showCaptions ? (
              <span
                className="de-ghost-caption"
                style={{ left: '4.6%', top: `calc(3.6% + ${chrome.logoH + 8}px)` }}
              >
                logo — change it in Site settings
              </span>
            ) : null}
          </div>

          <DoodleLayer items={items} device={device} interactive={false} itemProps={itemProps} />

          <div className="de-ghost de-ghost--navlayer" aria-hidden>
            <div
              className="de-ghost-nav"
              data-device={device}
              style={{ gap: chrome.navGap }}
            >
              {showCaptions ? <span className="de-ghost-caption de-ghost-caption--nav">nav — change it in Site settings</span> : null}
              {(navEntries ?? navPages).map((id) =>
                typeof id !== 'string' ? (
                  id.art ? (
                    <span
                      key={`c-${id.key}`}
                      className="de-ghost-navlink"
                      style={{
                        height: chrome.navLinkH,
                        width: chrome.navLinkH * id.art.ar,
                        backgroundImage: `url("${id.art.src}")`,
                      }}
                    />
                  ) : (
                    <span key={`c-${id.key}`} className="de-ghost-navtext" style={{ fontSize: chrome.navTextPx }}>
                      {id.label}
                    </span>
                  )
                ) : NAV_AR[id] ? (
                  <span
                    key={id}
                    className="de-ghost-navlink"
                    style={{
                      height: chrome.navLinkH,
                      width: chrome.navLinkH * NAV_AR[id],
                      // the home link is the active one on the home page
                      backgroundImage: `url("/nav/${id}-${id === 'home' ? 'mustard' : 'white'}.gif")`,
                    }}
                  />
                ) : (
                  <span key={id} className="de-ghost-navtext" style={{ fontSize: chrome.navTextPx }}>
                    {id}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>
        {/* same box as the stage but not clipped, so handles can poke out */}
        {children ? (
          <div
            className="de-overlay"
            style={
              {
                width: ref.w,
                height: ref.h,
                transform: `scale(${scale})`,
                '--de-inv': String(1 / scale),
              } as CSSProperties
            }
          >
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
