import { defineField, defineType } from 'sanity';
import { isWebAddress } from '@/lib/doodles';
import { PAGE_IDS } from './announcement';

/**
 * Where a home doodle or custom nav item goes when clicked.
 * Kinds mirror DoodleLinkKind in src/lib/doodles.ts.
 */
export const doodleLink = defineType({
  name: 'doodleLink',
  title: 'Link',
  type: 'object',
  options: { collapsible: false },
  fields: [
    defineField({
      name: 'kind',
      title: 'When clicked',
      type: 'string',
      initialValue: 'none',
      options: {
        list: [
          { title: 'Nothing (just decoration)', value: 'none' },
          { title: 'Go to a page of the site', value: 'page' },
          { title: 'Open the email-list sign-up form', value: 'email-signup' },
          { title: 'Open the “send us a message” form', value: 'message' },
          { title: 'Open another website', value: 'url' },
        ],
        layout: 'radio',
      },
    }),
    defineField({
      name: 'page',
      title: 'Page',
      type: 'string',
      options: { list: [...PAGE_IDS] },
      hidden: ({ parent }) => parent?.kind !== 'page',
      validation: (rule) =>
        rule.custom((value, ctx) => {
          const kind = (ctx.parent as { kind?: string } | undefined)?.kind;
          return kind === 'page' && !value ? 'Pick a page' : true;
        }),
    }),
    // A plain string, not type 'url': Sanity always runs its own address check
    // on 'url' fields, even while hidden, so a half-typed address left behind
    // after switching to another kind would block Publish where the band can't
    // see it. This checks the address only while it's actually used.
    defineField({
      name: 'url',
      title: 'Website address',
      type: 'string',
      description: 'The whole address, e.g. https://example.com',
      hidden: ({ parent }) => parent?.kind !== 'url',
      validation: (rule) =>
        rule.custom((value, ctx) => {
          const kind = (ctx.parent as { kind?: string } | undefined)?.kind;
          if (kind !== 'url') return true;
          if (!value?.trim()) return 'Add the website address';
          return isWebAddress(value) ? true : 'The website address should look like https://example.com';
        }),
    }),
  ],
});
