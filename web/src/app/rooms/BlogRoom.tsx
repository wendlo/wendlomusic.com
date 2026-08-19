/**
 * BlogRoom — the "Notes from the van" scrolling stripes page (prototype
 * `data-page="blog"`). Server component: renders the fixed `.bg` + `.content`
 * chrome and the heading, then hands the posts to the <BlogIsland> client island
 * which owns the list ↔ single-article toggle (pure local state, no integration).
 *
 * Markup mirrors prototype index.html lines 401–407 verbatim; the dynamic
 * `.blog-wrap` is produced by the island (prototype `renderBlog()`).
 */

import type { BlogPage } from '@/lib/content/types';
import { BlogIsland } from './_client/BlogIsland';

export interface BlogRoomProps {
  blog: BlogPage;
}

export function BlogRoom({ blog }: BlogRoomProps) {
  return (
    <section className="room" data-page="blog">
      <div className="bg" />
      <div className="content">
        <div className="blog-head">
          <h2>{blog.heading}</h2>
        </div>
        <BlogIsland posts={blog.posts} />
      </div>
    </section>
  );
}
