import { defineField, defineType } from 'sanity';
import AccentColorInput from '@/sanity/inputs/AccentColorInput';

/** §3.3 designSettings — accent / logo / stripes theming. */
export const designSettings = defineType({
  name: 'designSettings',
  title: 'Design',
  type: 'object',
  fields: [
    defineField({
      name: 'accent',
      title: 'Accent colour',
      type: 'string',
      description:
        'Hex accent, injected as an inline CSS custom prop. Does NOT affect the nav GIF art.',
      initialValue: '#E0A32B',
      components: { input: AccentColorInput },
      validation: (rule) =>
        rule
          .required()
          .regex(/^#[0-9a-fA-F]{6}$/, {
            name: 'hex',
            invert: false,
          })
          .error('Must be a 6-digit hex colour, e.g. #E0A32B'),
    }),
    defineField({
      name: 'logo',
      title: 'Logo',
      type: 'image',
      description:
        'Empty → default /wendlo-logo.gif (CSS-inverted white). A custom logo is shown as-is (drops the invert).',
      options: { hotspot: false },
    }),
    defineField({
      name: 'stripes',
      title: 'Stripes background',
      type: 'image',
      description:
        'Empty → /defaults/stripes.jpg. Background behind music/store/contact/blog.',
      options: { hotspot: false },
    }),
  ],
  preview: {
    select: { accent: 'accent', media: 'logo' },
    prepare({ accent, media }) {
      return { title: 'Design', subtitle: accent, media };
    },
  },
});
