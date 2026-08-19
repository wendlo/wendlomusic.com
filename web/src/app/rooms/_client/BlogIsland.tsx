'use client';

/**
 * BlogIsland — the interactive blog list ↔ single-article toggle.
 *
 * Ports prototype `renderBlog()` (index.html §"blog"): posts are filtered to
 * `published`, sorted newest-first by date (string compare, desc), and shown as
 * a `.bpost` list. Clicking a post swaps to a `.barticle` article view with a
 * `.bback` "all posts" button that returns to the list. No integration needed —
 * this toggle is pure local state, so it lives here as a client island.
 *
 * Post bodies are HTML strings in the fallback. Per the migration rules we do
 * NOT use dangerouslySetInnerHTML (Portable Text lands in a later phase); we
 * parse the simple prototype markup (<p>/<h3>/<blockquote>) into React nodes and
 * render text safely. Unknown/complex markup degrades to plain paragraphs.
 */

import { useState, useEffect, useRef } from 'react';
import type { BlogPost } from '@/lib/content/types';

export interface BlogIslandProps {
  posts: BlogPost[];
}

/** Prototype date format: en-US "Month D, YYYY" from a YYYY-MM-DD string. */
function fmtDate(date: string): string {
  if (!date) return '';
  const d = new Date(date + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Parse the prototype's simple HTML body into safe React blocks. Supports the
 * markup the fallback + prototype prose CSS target: <p>, <h3>, <blockquote>.
 * Inline tags (<b>/<i>/<a>) are stripped to text to avoid dangerouslySetInnerHTML;
 * full rich rendering arrives with Portable Text in a later phase.
 */
function ProseBody({ body }: { body: string }) {
  const src = String(body || '').replace(/<script[\s\S]*?<\/script>/gi, '');
  // Match top-level block elements; fall back to the whole string as one <p>.
  const blockRe = /<(p|h3|blockquote)>([\s\S]*?)<\/\1>/gi;
  const blocks: { tag: string; text: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(src)) !== null) {
    blocks.push({ tag: m[1].toLowerCase(), text: stripInline(m[2]) });
  }
  if (blocks.length === 0) {
    const text = stripInline(src);
    if (text) blocks.push({ tag: 'p', text });
  }
  return (
    <>
      {blocks.map((b, i) => {
        if (b.tag === 'h3') return <h3 key={i}>{b.text}</h3>;
        if (b.tag === 'blockquote') return <blockquote key={i}>{b.text}</blockquote>;
        return <p key={i}>{b.text}</p>;
      })}
    </>
  );
}

/** Strip inline tags and decode a couple of common entities to plain text. */
function stripInline(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

export function BlogIsland({ posts }: BlogIslandProps) {
  const published = posts
    .filter((p) => p.published)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const [activeId, setActiveId] = useState<string | null>(null);
  const active = activeId ? published.find((p) => p.id === activeId) : null;

  // Prototype opens each article scrolled to the top of the room's `.content`
  // (`room.scrollTop=0`). Reset the enclosing scroll container on view change.
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const content = wrapRef.current?.closest('.content') as HTMLElement | null;
    if (content) content.scrollTop = 0;
  }, [activeId]);

  if (active) {
    const ds = fmtDate(active.date);
    const coverUrl = active.cover?.url;
    return (
      <div className="blog-wrap" ref={wrapRef}>
        <div>
          <button
            className="bback"
            type="button"
            data-bback
            onClick={() => setActiveId(null)}
          >
            <i className="ti ti-arrow-left" /> all posts
          </button>
        </div>
        <article className="barticle">
          {coverUrl ? (
            <div
              className="cover"
              style={{ backgroundImage: `url('${coverUrl}')` }}
            />
          ) : null}
          <div className="abody">
            <div className="bdate">{ds}</div>
            <h2>{active.title}</h2>
            <div className="prose">
              <ProseBody body={active.body} />
            </div>
          </div>
        </article>
      </div>
    );
  }

  if (published.length === 0) {
    return (
      <div className="blog-wrap" ref={wrapRef}>
        <div className="blog-empty">Nothing here yet — check back soon.</div>
      </div>
    );
  }

  return (
    <div className="blog-wrap" ref={wrapRef}>
      {published.map((p) => {
        const ds = fmtDate(p.date);
        const coverUrl = p.cover?.url;
        return (
          <div
            key={p.id}
            className="bpost"
            data-post={p.id}
            onClick={() => setActiveId(p.id)}
          >
            {coverUrl ? (
              <div
                className="cover"
                style={{ backgroundImage: `url('${coverUrl}')` }}
              />
            ) : null}
            <div className="binfo">
              <div className="bdate">{ds}</div>
              <h3>{p.title}</h3>
              {p.excerpt ? <div className="bex">{p.excerpt}</div> : null}
              <span className="more">Read post</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
