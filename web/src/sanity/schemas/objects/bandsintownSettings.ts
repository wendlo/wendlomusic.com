import { defineField, defineType } from 'sanity';

/** §3.24 bandsintownSettings — on connectionSettings. RECOMMEND env. */
export const bandsintownSettings = defineType({
  name: 'bandsintownSettings',
  title: 'Bandsintown',
  type: 'object',
  fields: [
    defineField({
      name: 'artist',
      title: 'Artist id',
      type: 'string',
      description: 'e.g. id_14800723.',
    }),
    defineField({
      name: 'appId',
      title: 'App id',
      type: 'string',
      description: 'Public widget id (else env).',
    }),
  ],
});
