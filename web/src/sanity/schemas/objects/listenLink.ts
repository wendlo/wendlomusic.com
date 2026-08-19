import { defineField, defineType } from 'sanity';

/** The 8 fixed listen services, in fixed order (§3.9 / §3.12). */
export const SERVICE_IDS = [
  'spotify',
  'apple',
  'amazon',
  'deezer',
  'itunes',
  'napster',
  'tidal',
  'youtube',
] as const;

/**
 * §3.12 listenLink — array item in songEntry.links. 8 fixed-service rows.
 * Only `enabled && url` render on site. Edited via ListenLinkMatrix.
 */
export const listenLink = defineType({
  name: 'listenLink',
  title: 'Listen link',
  type: 'object',
  fields: [
    defineField({
      name: 'service',
      title: 'Service',
      type: 'string',
      readOnly: true,
      options: {
        list: SERVICE_IDS.map((id) => ({ title: id, value: id })),
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'url',
      title: 'URL',
      type: 'url',
      validation: (rule) =>
        rule.uri({ scheme: ['http', 'https'], allowRelative: false }),
    }),
    defineField({
      name: 'enabled',
      title: 'Enabled',
      type: 'boolean',
      initialValue: false,
    }),
  ],
  preview: {
    select: { service: 'service', url: 'url', enabled: 'enabled' },
    prepare({ service, url, enabled }) {
      return {
        title: service,
        subtitle: enabled && url ? url : 'hidden',
      };
    },
  },
});
