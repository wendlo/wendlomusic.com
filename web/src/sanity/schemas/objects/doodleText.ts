import { defineField, defineType } from 'sanity';
import { COLOR_OPTIONS, linkSummary } from '@/sanity/inputs/doodle-editor/labels';

/**
 * A line of text on the home photo (homePage.doodles), e.g. "join our email
 * list!". Usually placed with the visual editor (DoodleCanvasInput).
 * Mirrors DoodleText / RawDoodleText in src/lib/doodles.ts.
 */
export const doodleText = defineType({
  name: 'doodleText',
  title: 'Text',
  type: 'object',
  fields: [
    defineField({
      name: 'text',
      title: 'Text',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'color',
      title: 'Colour',
      type: 'string',
      initialValue: 'white',
      options: {
        list: COLOR_OPTIONS.map((c) => ({ title: c.title, value: c.value })),
        layout: 'radio',
        direction: 'horizontal',
      },
    }),
    defineField({
      name: 'shadow',
      title: 'Soft shadow',
      type: 'boolean',
      description: 'Helps it stand out on a busy photo.',
      initialValue: true,
    }),
    defineField({ name: 'link', title: 'When clicked', type: 'doodleLink' }),
    defineField({ name: 'desktop', title: 'On desktop', type: 'doodlePlacement' }),
    defineField({ name: 'phone', title: 'On phone', type: 'doodlePlacement' }),
  ],
  preview: {
    select: { text: 'text', kind: 'link.kind', page: 'link.page', url: 'link.url' },
    prepare({ text, kind, page, url }) {
      return {
        title: text || '(no text)',
        subtitle: linkSummary({ kind, page, url }),
      };
    },
  },
});
