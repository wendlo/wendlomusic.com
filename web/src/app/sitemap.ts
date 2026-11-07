import type { MetadataRoute } from 'next';

/** /sitemap.xml — static; fixed lastModified so builds are deterministic. */
const LAST_MODIFIED = '2026-11-07';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://wendlomusic.com/',
      lastModified: LAST_MODIFIED,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: 'https://wendlomusic.com/privacy',
      lastModified: LAST_MODIFIED,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
