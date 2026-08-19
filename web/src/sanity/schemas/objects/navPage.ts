import { defineField, defineType } from 'sanity';
import { PAGE_IDS } from './announcement';

/**
 * §3.4 navPage — array item in siteSettings.pages. Fixed set of 7, drag
 * reordered via NavManagerInput. `label` is only meaningfully editable for the
 * text-nav pages (about + blog); `isTextLabel` gates that in the custom input.
 */
export const navPage = defineType({
  name: 'navPage',
  title: 'Nav page',
  type: 'object',
  fields: [
    defineField({
      name: 'pageId',
      title: 'Page',
      type: 'string',
      readOnly: true,
      options: {
        list: PAGE_IDS.map((id) => ({ title: id, value: id })),
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'enabled',
      title: 'Enabled',
      type: 'boolean',
      initialValue: true,
      validation: (rule) =>
        rule.custom((value, context) => {
          const parent = context.parent as { pageId?: string } | undefined;
          if (parent?.pageId === 'home' && value === false) {
            return 'The Home page cannot be disabled.';
          }
          return true;
        }),
    }),
    defineField({
      name: 'label',
      title: 'Label',
      type: 'string',
      description:
        'Editable only for the text-nav pages (About + Blog). GIF-art pages keep their baked label.',
    }),
    defineField({
      name: 'isTextLabel',
      title: 'Is a text label',
      type: 'boolean',
      readOnly: true,
      description:
        'true for About + Blog; false for GIF pages. Drives label editability.',
      initialValue: false,
    }),
  ],
  preview: {
    select: { pageId: 'pageId', label: 'label', enabled: 'enabled' },
    prepare({ pageId, label, enabled }) {
      return {
        title: label || pageId,
        subtitle: `${pageId}${enabled === false ? ' · disabled' : ''}`,
      };
    },
  },
});
