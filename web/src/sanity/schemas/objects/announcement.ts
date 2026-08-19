import { defineField, defineType } from 'sanity';

/** Fixed page identifiers (§3.4). Array order = nav order. */
export const PAGE_IDS = [
  'home',
  'about',
  'tour',
  'contact',
  'music',
  'store',
  'blog',
] as const;

/**
 * §3.2 announcement — site-wide bar. `page` must reference a currently-enabled
 * page; validation warns rather than blocks so a seed never fails.
 */
export const announcement = defineType({
  name: 'announcement',
  title: 'Announcement bar',
  type: 'object',
  fields: [
    defineField({
      name: 'enabled',
      title: 'Show the bar',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'text',
      title: 'Banner text',
      type: 'string',
      description: 'Emoji allowed.',
    }),
    defineField({
      name: 'page',
      title: 'Navigates to',
      type: 'string',
      description:
        'Target page the bar navigates to. Must reference a currently-enabled page.',
      options: {
        list: PAGE_IDS.map((id) => ({ title: id, value: id })),
        layout: 'dropdown',
      },
      initialValue: 'contact',
      validation: (rule) =>
        rule.custom((value, context) => {
          if (!value) return true;
          const doc = context.document as
            | { pages?: Array<{ pageId?: string; enabled?: boolean }> }
            | undefined;
          const pages = doc?.pages;
          if (!Array.isArray(pages)) return true;
          const target = pages.find((p) => p?.pageId === value);
          if (target && target.enabled === false) {
            return `The "${value}" page is currently disabled — the bar would point at a hidden room.`;
          }
          return true;
        }),
    }),
  ],
  preview: {
    select: { enabled: 'enabled', text: 'text' },
    prepare({ enabled, text }) {
      return {
        title: text || 'Announcement bar',
        subtitle: enabled ? 'Enabled' : 'Hidden',
      };
    },
  },
});
