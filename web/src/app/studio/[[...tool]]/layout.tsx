/**
 * Studio layout — renders children directly.
 *
 * The embedded Sanity Studio ships its own full-viewport UI and must escape the
 * site's global CSS / chrome. This nested layout deliberately does nothing but
 * pass children through, so the Studio owns the whole route subtree.
 */
export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
