import { defineField, defineType } from 'sanity';

/** §3.7 aboutPage — document (singleton). */
export const aboutPage = defineType({
  name: 'aboutPage',
  title: 'About',
  type: 'document',
  fields: [
    defineField({
      name: 'hero',
      title: 'Hero',
      type: 'heroImage',
      description: 'Empty image → /defaults/about.jpg.',
    }),
    defineField({
      name: 'heading',
      title: 'Heading',
      type: 'string',
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'text',
      rows: 8,
      description:
        'PLAIN multiline (line breaks → paragraphs, white-space:pre-line). NOT Portable Text.',
    }),
  ],
  preview: {
    select: { heading: 'heading' },
    prepare({ heading }) {
      return { title: 'About', subtitle: heading };
    },
  },
});
