import { defineArrayMember, defineField, defineType } from 'sanity';

/** §3.19 contactForm — messageForm / emailForm. Fixed-key questions. */
export const contactForm = defineType({
  name: 'contactForm',
  title: 'Contact form',
  type: 'object',
  fields: [
    defineField({
      name: 'fields',
      title: 'Fields',
      type: 'array',
      of: [defineArrayMember({ type: 'formField' })],
    }),
    defineField({
      name: 'submitLabel',
      title: 'Submit label',
      type: 'string',
      description: 'e.g. Send / Join.',
    }),
    defineField({
      name: 'successText',
      title: 'Success text',
      type: 'text',
      rows: 2,
      description: 'Post-submit copy (returned by /api/submit).',
    }),
  ],
  preview: {
    select: { submitLabel: 'submitLabel', fields: 'fields' },
    prepare({ submitLabel, fields }) {
      const count = Array.isArray(fields) ? fields.length : 0;
      return {
        title: submitLabel || 'Contact form',
        subtitle: `${count} field${count === 1 ? '' : 's'}`,
      };
    },
  },
});
