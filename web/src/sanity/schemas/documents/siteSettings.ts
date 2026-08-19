import { defineArrayMember, defineField, defineType } from 'sanity';
import NavManagerInput from '@/sanity/inputs/NavManagerInput';
import { PAGE_IDS } from '../objects/announcement';

/**
 * §3.1 siteSettings — document (singleton, id `siteSettings`). Global meta,
 * SEO, announcement, theming, page/nav config, band-owned connection URLs.
 */
export const siteSettings = defineType({
  name: 'siteSettings',
  title: 'Site settings',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      description: 'SEO <title> base.',
      initialValue: 'Wendlo',
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 2,
      description: 'Meta / share description.',
    }),
    defineField({
      name: 'announcement',
      title: 'Announcement',
      type: 'announcement',
    }),
    defineField({
      name: 'design',
      title: 'Design',
      type: 'designSettings',
    }),
    defineField({
      name: 'pages',
      title: 'Pages & nav',
      type: 'array',
      description:
        'Single ordered array collapsing order + enabled + labels. Array order = nav order.',
      components: { input: NavManagerInput },
      of: [defineArrayMember({ type: 'navPage' })],
      validation: (rule) =>
        rule.custom((value) => {
          if (!Array.isArray(value)) return true;
          const ids = value
            .map((p) => (p as { pageId?: string })?.pageId)
            .filter(Boolean) as string[];
          const missing = PAGE_IDS.filter((id) => !ids.includes(id));
          if (missing.length) {
            return `Missing required pages: ${missing.join(', ')}.`;
          }
          const extra = ids.filter(
            (id) => !(PAGE_IDS as readonly string[]).includes(id),
          );
          if (extra.length) {
            return `Unexpected pages: ${extra.join(', ')}.`;
          }
          const home = value.find(
            (p) => (p as { pageId?: string })?.pageId === 'home',
          ) as { enabled?: boolean } | undefined;
          if (home && home.enabled === false) {
            return 'The Home page must stay enabled.';
          }
          return true;
        }),
    }),
    defineField({
      name: 'connections',
      title: 'Connections',
      type: 'connectionSettings',
    }),
  ],
  preview: {
    prepare() {
      return { title: 'Site settings' };
    },
  },
});
