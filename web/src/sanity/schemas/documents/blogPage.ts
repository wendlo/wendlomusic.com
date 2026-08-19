import { defineField, defineType } from 'sanity';

/** §3.21 blogPage — document (singleton). */
export const blogPage = defineType({
  name: 'blogPage',
  title: 'Blog',
  type: 'document',
  fields: [
    defineField({
      name: 'heading',
      title: 'Heading',
      type: 'string',
      description: 'e.g. Notes from the van.',
    }),
  ],
  preview: {
    select: { heading: 'heading' },
    prepare({ heading }) {
      return { title: 'Blog', subtitle: heading };
    },
  },
});
