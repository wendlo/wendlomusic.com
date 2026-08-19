import { defineField, defineType } from 'sanity';
import YouTubeUrlInput from '@/sanity/inputs/YouTubeUrlInput';

/**
 * §3.11 youtubeEntry — array item in musicPage.entries (type: 'youtube').
 * Rendered full-width. `caption` is admin-only, NOT shown to visitors.
 */
export const youtubeEntry = defineType({
  name: 'youtubeEntry',
  title: 'YouTube embed',
  type: 'object',
  fields: [
    defineField({
      name: 'url',
      title: 'YouTube URL',
      type: 'url',
      description: 'Any watch/share/shorts/youtu.be URL. Live validity shown below.',
      components: { input: YouTubeUrlInput },
      validation: (rule) =>
        rule
          .required()
          .uri({ scheme: ['http', 'https'], allowRelative: false }),
    }),
    defineField({
      name: 'caption',
      title: 'Caption (admin-only)',
      type: 'string',
      description: 'Admin-only caption; NOT shown to visitors.',
    }),
  ],
  preview: {
    select: { url: 'url', caption: 'caption' },
    prepare({ url, caption }) {
      return { title: caption || 'YouTube embed', subtitle: url };
    },
  },
});
