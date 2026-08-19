import { defineArrayMember, defineField, defineType } from 'sanity';
import ListenLinkMatrix from '@/sanity/inputs/ListenLinkMatrix';
import SmartLinkImport from '@/sanity/inputs/SmartLinkImport';

/**
 * §3.10 songEntry — array item in musicPage.entries (type: 'song'). Songs
 * alternate art/text sides automatically on the page.
 *
 * The object-level input is wrapped by SmartLinkImport (§6.2): an "Import
 * from a link" panel above the default fields that fills title/art/links/
 * source from a DistroKid HyperFollow or TuneCore smart link via /api/proxy.
 */
export const songEntry = defineType({
  name: 'songEntry',
  title: 'Song',
  type: 'object',
  components: { input: SmartLinkImport },
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'tag',
      title: 'Tag',
      type: 'string',
      description: 'e.g. Single / EP / Cover.',
    }),
    defineField({
      name: 'blurb',
      title: 'Blurb',
      type: 'text',
      rows: 3,
      description: 'Smart-quotes preserved.',
    }),
    defineField({
      name: 'art',
      title: 'Cover art',
      type: 'image',
      description: 'Square cover. Auto-filled from smart-link og:image on import.',
      options: { hotspot: true },
    }),
    defineField({
      name: 'links',
      title: 'Listen links',
      type: 'array',
      description: '8 fixed-service rows, rendered in music.services order.',
      components: { input: ListenLinkMatrix },
      of: [defineArrayMember({ type: 'listenLink' })],
    }),
    defineField({
      name: 'source',
      title: 'Smart link source',
      type: 'url',
      description: 'Smart link this was imported from; enables the Re-import action.',
      validation: (rule) =>
        rule.uri({ scheme: ['http', 'https'], allowRelative: false }),
    }),
  ],
  preview: {
    select: { title: 'title', tag: 'tag', media: 'art' },
    prepare({ title, tag, media }) {
      return { title: title || 'Song', subtitle: tag, media };
    },
  },
});
