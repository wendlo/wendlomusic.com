import { defineField, defineType } from 'sanity';
import DualFocalInput from '@/sanity/inputs/DualFocalInput';

/** Matches "X% Y%" object-position strings (e.g. "50% 50%", "24% 42%"). */
const OBJECT_POSITION = /^\d{1,3}%\s+\d{1,3}%$/;

/**
 * §3.13 heroImage — reused by home/about/tour. Empty image → the frontend uses
 * the baked per-room default. Native hotspot seeds the desktop focal; the two
 * independent CSS object-positions are stored explicitly as strings, edited via
 * DualFocalInput.
 */
export const heroImage = defineType({
  name: 'heroImage',
  title: 'Hero image',
  type: 'object',
  fields: [
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      description: 'Empty → the baked per-room default.',
      options: { hotspot: true },
    }),
    defineField({
      name: 'focalDesktop',
      title: 'Desktop focal',
      type: 'string',
      description: 'CSS object-position "X% Y%" → --focal.',
      initialValue: '50% 50%',
      components: { input: DualFocalInput },
      validation: (rule) =>
        rule.regex(OBJECT_POSITION, { name: 'object-position' }).warning(
          'Expected an "X% Y%" object-position, e.g. 50% 50%.',
        ),
    }),
    defineField({
      name: 'focalMobile',
      title: 'Mobile focal',
      type: 'string',
      description:
        'CSS object-position "X% Y%" → --focal-m. Falls back to desktop, then center.',
      validation: (rule) =>
        rule.regex(OBJECT_POSITION, { name: 'object-position' }).warning(
          'Expected an "X% Y%" object-position, e.g. 24% 42%.',
        ),
    }),
  ],
  preview: {
    select: { media: 'image', focalDesktop: 'focalDesktop' },
    prepare({ media, focalDesktop }) {
      return {
        title: 'Hero image',
        subtitle: focalDesktop || '50% 50%',
        media,
      };
    },
  },
});
