import { defineField, defineType } from 'sanity';

/** §3.17 googleForm — optional Google-Form fallback CTA. */
export const googleForm = defineType({
  name: 'googleForm',
  title: 'Google Form',
  type: 'object',
  fields: [
    defineField({
      name: 'enabled',
      title: 'Show the Google-Form fallback CTA',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'label',
      title: 'CTA label',
      type: 'string',
    }),
    defineField({
      name: 'url',
      title: 'iframe target',
      type: 'url',
      validation: (rule) =>
        rule.uri({ scheme: ['http', 'https'], allowRelative: false }),
    }),
  ],
  preview: {
    select: { label: 'label', enabled: 'enabled' },
    prepare({ label, enabled }) {
      return {
        title: label || 'Google Form',
        subtitle: enabled ? 'Enabled' : 'Hidden',
      };
    },
  },
});
