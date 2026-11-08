import { defineField, defineType } from 'sanity';
import DoodleCanvasInput from '@/sanity/inputs/DoodleCanvasInput';

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
      name: 'doodles',
      title: 'Doodles & links on the photo',
      description:
        'Pictures, GIFs and text links on top of the home photo. Open the visual editor to add them and drag them into place — separately for desktop and phone.',
      type: 'array',
      of: [{ type: 'doodleImage' }, { type: 'doodleText' }],
      components: { input: DoodleCanvasInput },
    }),
    // Legacy (pre-doodles) fields: hidden, kept so existing data isn't lost.
    defineField({
      name: 'emailCtaEnabled',
      title: 'Email CTA enabled',
      type: 'boolean',
      initialValue: true,
      hidden: true,
    }),
    defineField({
      name: 'emailCtaText',
      title: 'Email CTA text',
      type: 'string',
      description: 'e.g. join our email list!',
      hidden: true,
    }),
    defineField({
      name: 'clickHereEnabled',
      title: 'Click-here arrow enabled',
      type: 'boolean',
      description: 'Hand-drawn arrow GIF (/click-here-white.gif).',
      initialValue: true,
      hidden: true,
    }),
  ],
  preview: {
    prepare() {
      return { title: 'Home' };
    },
  },
});
