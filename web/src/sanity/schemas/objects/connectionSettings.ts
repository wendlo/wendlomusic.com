import { defineField, defineType } from 'sanity';

/**
 * §3.5 connectionSettings — the only band-owned connection config. Secrets live
 * in env; this holds genuinely band-owned URLs + optional self-edit overrides.
 */
export const connectionSettings = defineType({
  name: 'connectionSettings',
  title: 'Connections',
  type: 'object',
  fields: [
    defineField({
      name: 'emailWebhookUrl',
      title: 'Email webhook URL',
      type: 'url',
      description: 'Optional legacy passthrough POST target for the email form.',
      validation: (rule) =>
        rule.uri({ scheme: ['http', 'https'], allowRelative: false }),
    }),
    defineField({
      name: 'contactWebhookUrl',
      title: 'Contact webhook URL',
      type: 'url',
      description: 'Optional legacy passthrough POST target for the message form.',
      validation: (rule) =>
        rule.uri({ scheme: ['http', 'https'], allowRelative: false }),
    }),
    defineField({
      name: 'shopify',
      title: 'Shopify',
      type: 'shopifySettings',
    }),
    defineField({
      name: 'bandsintown',
      title: 'Bandsintown',
      type: 'bandsintownSettings',
    }),
    defineField({
      name: 'googleForm',
      title: 'Google Form',
      type: 'googleForm',
    }),
  ],
});
