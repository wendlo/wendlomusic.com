import { defineField, defineType } from 'sanity';
import { linkSummary } from '@/sanity/inputs/doodle-editor/labels';

/**
 * A picture or GIF on the home photo (homePage.doodles). Usually placed with
 * the visual editor (DoodleCanvasInput); the fields are the fallback.
 * Mirrors DoodleImage / RawDoodleImage in src/lib/doodles.ts.
 */
export const doodleImage = defineType({
  name: 'doodleImage',
  title: 'Picture or GIF',
  type: 'object',
  fields: [
    defineField({
      name: 'image',
      title: 'Picture or GIF',
      type: 'image',
      description: 'GIFs keep moving. Keep files under 1 MB (under 300 KB is best).',
      options: { accept: 'image/*' },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'alt',
      title: 'Description',
      type: 'string',
      description: 'Describe it for people who can’t see it.',
      validation: (rule) =>
        rule
          .custom((value, ctx) => {
            const kind = (ctx.parent as { link?: { kind?: string } } | undefined)?.link?.kind;
            return kind && kind !== 'none' && !(value ?? '').trim()
              ? 'This picture is a link — add a description, unless the text next to it already says where it goes.'
              : true;
          })
          .warning(),
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
    select: {
      media: 'image',
      alt: 'alt',
      kind: 'link.kind',
      page: 'link.page',
      url: 'link.url',
    },
    prepare({ media, alt, kind, page, url }) {
      return {
        title: alt || 'Picture or GIF',
        subtitle: linkSummary({ kind, page, url }),
        media,
      };
    },
  },
});
