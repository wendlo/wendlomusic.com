/**
 * Friendly words for the doodle editor and the doodleImage / doodleText
 * schema previews. Plain TS (no Sanity, no React) so the sandbox and the
 * schema files can share it.
 */

import type { DoodleColor, DoodleLinkKind, RawDoodleLink } from '@/lib/doodles';

export const LINK_KINDS: { value: DoodleLinkKind; title: string; short: string }[] = [
  { value: 'none', title: 'Nothing (just decoration)', short: 'Not a link' },
  { value: 'page', title: 'Go to a page of the site', short: 'Goes to a page' },
  { value: 'email-signup', title: 'Open the email-list sign-up form', short: 'Opens email sign-up' },
  { value: 'message', title: 'Open the “send us a message” form', short: 'Opens the message form' },
  { value: 'url', title: 'Open another website', short: 'Opens a website' },
];

/** All 7 fixed pages, in nav order (mirrors PAGE_IDS in the schema). */
export const PAGES: { id: string; title: string }[] = [
  { id: 'home', title: 'Home' },
  { id: 'about', title: 'About' },
  { id: 'tour', title: 'Tour' },
  { id: 'contact', title: 'Contact' },
  { id: 'music', title: 'Music' },
  { id: 'store', title: 'Store' },
  { id: 'blog', title: 'Blog' },
];

export const COLOR_OPTIONS: { value: DoodleColor; title: string; swatch: string }[] = [
  { value: 'white', title: 'White', swatch: '#ffffff' },
  { value: 'butter', title: 'Butter yellow', swatch: '#F2C14E' },
  // follows Site settings → accent (DoodleCanvasInput sets --persimmon on the editor root)
  { value: 'accent', title: 'Accent', swatch: 'var(--persimmon, #E0A32B)' },
  { value: 'ink', title: 'Dark', swatch: '#1A1714' },
];

export function pageTitle(id: string | undefined): string {
  return PAGES.find((p) => p.id === id)?.title ?? 'a page';
}

/** One line describing where a doodle goes, e.g. "Goes to the Tour page". */
export function linkSummary(link: RawDoodleLink | undefined | null): string {
  switch (link?.kind) {
    case 'page':
      return link.page ? `Goes to the ${pageTitle(link.page)} page` : 'Goes to a page (pick one)';
    case 'email-signup':
      return 'Opens email sign-up';
    case 'message':
      return 'Opens the message form';
    case 'url':
      return link.url ? `Opens ${link.url.replace(/^https?:\/\//i, '')}` : 'Opens a website (add the address)';
    default:
      return 'Not a link';
  }
}
