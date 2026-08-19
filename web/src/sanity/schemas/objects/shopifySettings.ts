import { defineField, defineType } from 'sanity';

/** §3.23 shopifySettings — on connectionSettings. RECOMMEND env; self-edit only. */
export const shopifySettings = defineType({
  name: 'shopifySettings',
  title: 'Shopify',
  type: 'object',
  fields: [
    defineField({
      name: 'domain',
      title: 'Storefront domain',
      type: 'string',
      description: 'e.g. fep1gx-a1.myshopify.com (else env).',
    }),
    defineField({
      name: 'token',
      title: 'Public Storefront token',
      type: 'string',
    }),
    defineField({
      name: 'apiVersion',
      title: 'API version',
      type: 'string',
      initialValue: '2024-10',
    }),
  ],
});
