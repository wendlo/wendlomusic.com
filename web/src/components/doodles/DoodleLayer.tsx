'use client';

/**
 * Renders home-page doodles. The SAME component draws them on the site
 * (device="auto": desktop/phone chosen by the phone media queries) and in the
 * Studio editor canvas (device="desktop" | "phone", interactive=false), so the
 * editor is pixel-for-pixel the site. Geometry lives in doodles.css.
 */

import type { CSSProperties, HTMLAttributes, MouseEvent } from 'react';
import { doodleHref, doodleVars, type Doodle, type DoodleLink } from '@/lib/doodles';

export interface DoodleLayerProps {
  items: Doodle[];
  /** 'auto' = site (media queries); explicit device = editor canvas */
  device?: 'auto' | 'desktop' | 'phone';
  /** false in the editor: no anchors, nothing navigates */
  interactive?: boolean;
  /** site: called for internal links (page / email-signup / message) */
  onLink?: (link: DoodleLink, e: MouseEvent<HTMLAnchorElement>) => void;
  /** editor: extra props per item (pointer handlers, data attributes) */
  itemProps?: (d: Doodle) => HTMLAttributes<HTMLElement> & Record<`data-${string}`, string | undefined>;
  className?: string;
  style?: CSSProperties;
}

export function DoodleLayer({
  items,
  device = 'auto',
  interactive = true,
  onLink,
  itemProps,
  className,
  style,
}: DoodleLayerProps) {
  return (
    <div className={className ? `doodles ${className}` : 'doodles'} data-device={device} style={style}>
      {items.map((d) => {
        const classes = [
          'doodle',
          `doodle--${d.kind}`,
          d.shadow ? 'doodle--shadow' : '',
          d.desktop.hidden ? 'hide-desktop' : '',
          d.phone.hidden ? 'hide-phone' : '',
        ]
          .filter(Boolean)
          .join(' ');
        const vars = doodleVars(d) as CSSProperties;
        const content =
          d.kind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.src} alt={d.alt} width={d.width} height={d.height} draggable={false} />
          ) : (
            d.text
          );
        const extra = itemProps?.(d) ?? {};
        const href = interactive ? doodleHref(d.link) : '';

        if (href) {
          const external = d.link.kind === 'url';
          // A linked image with no alt text is a decorative twin of a text
          // link (e.g. the "click here" arrow): keep it out of the a11y tree.
          const decorative = d.kind === 'image' && !d.alt;
          return (
            <a
              key={d._key}
              className={classes}
              style={vars}
              href={href}
              data-key={d._key}
              {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              {...(decorative ? { 'aria-hidden': true, tabIndex: -1 } : {})}
              onClick={
                external
                  ? undefined
                  : (e) => {
                      e.preventDefault();
                      onLink?.(d.link, e);
                    }
              }
              {...extra}
            >
              {content}
            </a>
          );
        }
        return (
          <span
            key={d._key}
            className={classes}
            style={vars}
            data-key={d._key}
            {...(d.kind === 'image' && !d.alt ? { 'aria-hidden': true } : {})}
            {...extra}
          >
            {content}
          </span>
        );
      })}
    </div>
  );
}
