import { defineArrayMember, defineField, defineType } from 'sanity';

/**
 * §3.22 blogPost — document (one per post, NOT a singleton). List view is
 * newest-first by date. `published` is an explicit site-visibility flag, kept
 * DISTINCT from Sanity's own draft state.
 */
export const blogPost = defineType({
  name: 'blogPost',
  title: 'Blog post',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      description: 'Stable per-post URL / reference.',
      options: { source: 'title', maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'date',
      title: 'Date',
      type: 'date',
      description: 'Drives newest-first sort.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'cover',
      title: 'Cover',
      type: 'image',
      description: '16:9.',
      options: { hotspot: true },
    }),
    defineField({
      name: 'excerpt',
      title: 'Excerpt',
      type: 'text',
      rows: 3,
      description: 'List / summary copy.',
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'array',
      description: 'Portable Text (styles normal/h3/blockquote; marks strong/em/link).',
      of: [
        defineArrayMember({
          type: 'block',
          styles: [
            { title: 'Normal', value: 'normal' },
            { title: 'H3', value: 'h3' },
            { title: 'Quote', value: 'blockquote' },
          ],
          lists: [],
          marks: {
            decorators: [
              { title: 'Strong', value: 'strong' },
              { title: 'Emphasis', value: 'em' },
            ],
            annotations: [
              defineArrayMember({
                name: 'link',
                title: 'Link',
                type: 'object',
                fields: [
                  defineField({
                    name: 'href',
                    title: 'URL',
                    type: 'url',
                    validation: (rule) =>
                      rule.uri({
                        scheme: ['http', 'https', 'mailto', 'tel'],
                        allowRelative: false,
                      }),
                  }),
                ],
              }),
            ],
          },
        }),
      ],
    }),
    defineField({
      name: 'published',
      title: 'Published (site-visible)',
      type: 'boolean',
      description: 'Explicit site-visibility flag, distinct from CMS draft state.',
      initialValue: false,
    }),
  ],
  orderings: [
    {
      title: 'Date, newest first',
      name: 'dateDesc',
      by: [{ field: 'date', direction: 'desc' }],
    },
  ],
  preview: {
    select: { title: 'title', date: 'date', media: 'cover', published: 'published' },
    prepare({ title, date, media, published }) {
      return {
        title: title || 'Blog post',
        subtitle: `${date || 'no date'}${published ? '' : ' · draft'}`,
        media,
      };
    },
  },
});
