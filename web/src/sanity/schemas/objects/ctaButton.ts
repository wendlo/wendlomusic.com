import { defineField, defineType } from 'sanity';

/** §3.15 ctaButton — { label, sub }. */
export const ctaButton = defineType({
  name: 'ctaButton',
  title: 'CTA button',
  type: 'object',
  fields: [
    defineField({ name: 'label', title: 'Label', type: 'string' }),
    defineField({ name: 'sub', title: 'Subtitle', type: 'string' }),
  ],
  preview: {
    select: { label: 'label', sub: 'sub' },
    prepare({ label, sub }) {
      return { title: label || 'CTA button', subtitle: sub };
    },
  },
});
