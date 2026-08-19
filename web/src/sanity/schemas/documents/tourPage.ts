import { defineField, defineType } from 'sanity';

/** §3.8 tourPage — document (singleton). Hero focalMobile default 24% 42%. */
export const tourPage = defineType({
  name: 'tourPage',
  title: 'Tour',
  type: 'document',
  fields: [
    defineField({
      name: 'hero',
      title: 'Hero',
      type: 'heroImage',
      description: 'Empty image → /defaults/shows.jpg. focalMobile default 24% 42%.',
    }),
    defineField({
      name: 'bandsintownArtist',
      title: 'Bandsintown artist',
      type: 'string',
      description: 'e.g. id_14800723. RECOMMEND env override.',
    }),
    defineField({
      name: 'bandsintownAppId',
      title: 'Bandsintown app id',
      type: 'string',
      description: 'RECOMMEND env.',
    }),
    defineField({
      name: 'emptyText',
      title: 'Empty-state text',
      type: 'string',
      description: 'Shown when there are no upcoming shows.',
    }),
    defineField({
      name: 'emptyLinkText',
      title: 'Empty-state link text',
      type: 'string',
      description: 'Blank = no link.',
    }),
    defineField({
      name: 'emptyLinkUrl',
      title: 'Empty-state link URL',
      type: 'url',
      validation: (rule) =>
        rule.uri({ scheme: ['http', 'https'], allowRelative: false }),
    }),
  ],
  preview: {
    prepare() {
      return { title: 'Tour' };
    },
  },
});
