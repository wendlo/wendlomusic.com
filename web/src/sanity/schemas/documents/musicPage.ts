import { defineArrayMember, defineField, defineType } from 'sanity';
import { SERVICE_IDS } from '../objects/listenLink';

/**
 * §3.9 musicPage — document (singleton). `services` is a fixed-order string[]
 * that drives ListenLinkMatrix ordering (must ship). `entries` is a single
 * ordered mixed array of songs + YouTube embeds; array order = page order.
 */
export const musicPage = defineType({
  name: 'musicPage',
  title: 'Music',
  type: 'document',
  fields: [
    defineField({
      name: 'services',
      title: 'Services (fixed order)',
      type: 'array',
      readOnly: true,
      description:
        'Fixed order driving ListenLinkMatrix ordering. Not editable.',
      of: [defineArrayMember({ type: 'string' })],
      initialValue: [...SERVICE_IDS],
      validation: (rule) =>
        rule.custom((value) => {
          const expected = [...SERVICE_IDS];
          if (!Array.isArray(value)) return true;
          const ok =
            value.length === expected.length &&
            expected.every((s, i) => value[i] === s);
          return ok
            ? true
            : `services must be exactly ${expected.join(', ')} in order.`;
        }),
    }),
    defineField({
      name: 'entries',
      title: 'Entries',
      type: 'array',
      description:
        'Single ordered mixed array; order = page order. Songs alternate sides; YouTube full-width.',
      of: [
        defineArrayMember({ type: 'songEntry' }),
        defineArrayMember({ type: 'youtubeEntry' }),
      ],
    }),
  ],
  preview: {
    select: { entries: 'entries' },
    prepare({ entries }) {
      const count = Array.isArray(entries) ? entries.length : 0;
      return {
        title: 'Music',
        subtitle: `${count} entr${count === 1 ? 'y' : 'ies'}`,
      };
    },
  },
});
