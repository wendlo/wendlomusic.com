import { defineField, defineType } from 'sanity';

/** §3.6 homePage — document (singleton). Ken-Burns applies to this hero only. */
export const homePage = defineType({
  name: 'homePage',
  title: 'Home',
  type: 'document',
  fields: [
    defineField({
      name: 'hero',
      title: 'Hero',
      type: 'heroImage',
      description: 'Empty image → /defaults/home.jpg.',
    }),
    defineField({
      name: 'emailCtaEnabled',
      title: 'Email CTA enabled',
      type: 'boolean',
      initialValue: true,
    }),
    defineField({
      name: 'emailCtaText',
      title: 'Email CTA text',
      type: 'string',
      description: 'e.g. join our email list!',
    }),
    defineField({
      name: 'clickHereEnabled',
      title: 'Click-here arrow enabled',
      type: 'boolean',
      description: 'Hand-drawn arrow GIF (/click-here-white.gif).',
      initialValue: true,
    }),
  ],
  preview: {
    prepare() {
      return { title: 'Home' };
    },
  },
});
