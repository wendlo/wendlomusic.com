import { defineField, defineType } from 'sanity';
import { isWebAddress } from '@/lib/doodles';
import { PAGE_IDS } from './announcement';

/**
 * navCustom — a band-made nav item in siteSettings.pages, alongside the 7
 * fixed navPage rows. Hand-drawn art (or the label as text) that goes to a
 * page, opens a form sheet, or opens another website. Edited inline in
 * NavManagerInput; rendered by the site's nav dock.
 */

/** The dock is narrow: more than this many custom items won't fit. */
export const MAX_CUSTOM_NAV = 3;

export interface NavLinkValue {
  _type?: string;
  kind?: string;
  page?: string;
  url?: string;
}

const NAV_LINK_KINDS = new Set(['page', 'email-signup', 'message', 'url']);

/**
 * What's wrong with a custom nav item's link, as a friendly phrase, or null
 * when it goes somewhere. Shared by the schema validation and the Studio input
 * so both say the same thing. Mirrors linkFrom() in src/lib/doodles.ts, which
 * turns anything invalid into "not a link".
 */
export function navLinkProblem(link: NavLinkValue | null | undefined): string | null {
  const kind = link?.kind;
  if (!kind || !NAV_LINK_KINDS.has(kind)) return 'choose where it goes';
  if (kind === 'page') {
    if (!link?.page) return 'choose which page it opens';
    if (!(PAGE_IDS as readonly string[]).includes(link.page)) return 'choose which page it opens';
  }
  if (kind === 'url') {
    const url = (link?.url ?? '').trim();
    if (!url) return 'add the website address';
    if (!isWebAddress(url)) {
      return 'the website address should look like https://example.com';
    }
  }
  return null;
}

/** Short "where it goes" line, e.g. "→ tour page", "→ example.com". */
export function navLinkSummary(link: NavLinkValue | null | undefined): string {
  switch (link?.kind) {
    case 'page':
      return link.page ? `→ ${link.page} page` : '→ (choose a page)';
    case 'email-signup':
      return '→ opens email sign-up';
    case 'message':
      return '→ opens “send us a message”';
    case 'url': {
      const url = (link.url ?? '').trim();
      if (!url) return '→ (add a website address)';
      try {
        return `→ ${new URL(url).hostname.replace(/^www\./, '')}`;
      } catch {
        return `→ ${url}`;
      }
    }
    default:
      return '→ (nowhere yet)';
  }
}

export const navCustom = defineType({
  name: 'navCustom',
  title: 'Custom nav link',
  type: 'object',
  initialValue: {
    enabled: true,
    link: { _type: 'doodleLink', kind: 'page', page: 'home' },
  },
  fields: [
    defineField({
      name: 'label',
      title: 'Label',
      type: 'string',
      description: 'Shown as the link text, or read aloud for a picture',
      validation: (rule) => rule.required().error('Give the link a name.'),
    }),
    defineField({
      name: 'image',
      title: 'Art',
      type: 'image',
      options: { accept: 'image/*' },
      description:
        'Hand-drawn art for the link (white looks best). Leave empty to show the label as text.',
    }),
    defineField({
      name: 'imageActive',
      title: 'Art while open',
      type: 'image',
      options: { accept: 'image/*' },
      description: 'Art to show while that page is open (optional)',
    }),
    defineField({
      name: 'link',
      title: 'Where it goes',
      type: 'doodleLink',
      validation: (rule) =>
        rule.required().custom((value) => {
          const problem = navLinkProblem(value as NavLinkValue | undefined);
          return problem ? `A nav link has to go somewhere — ${problem}.` : true;
        }),
    }),
    defineField({
      name: 'enabled',
      title: 'Show in the nav',
      type: 'boolean',
      initialValue: true,
    }),
  ],
  preview: {
    select: {
      label: 'label',
      media: 'image',
      enabled: 'enabled',
      kind: 'link.kind',
      page: 'link.page',
      url: 'link.url',
    },
    prepare({ label, media, enabled, kind, page, url }) {
      const summary = navLinkSummary({ kind, page, url });
      return {
        title: label || 'Custom link',
        subtitle: `${summary}${enabled === false ? ' · hidden' : ''}`,
        media,
      };
    },
  },
});
