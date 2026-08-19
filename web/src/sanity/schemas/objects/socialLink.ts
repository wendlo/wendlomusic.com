import { defineField, defineType } from 'sanity';

/** Social platform enum (§3.18) — drives the platform icon. */
export const SOCIAL_PLATFORMS = [
  'instagram',
  'tiktok',
  'facebook',
  'youtube',
  'spotify',
  'apple',
  'soundcloud',
  'twitter',
  'bandcamp',
  'other',
] as const;

/** §3.18 socialLink — array item in contactPage.socials. Drag-ordered. */
export const socialLink = defineType({
  name: 'socialLink',
  title: 'Social link',
  type: 'object',
  fields: [
    defineField({
      name: 'id',
      title: 'Id',
      type: 'string',
      readOnly: true,
      description: 'Stable id (ig/tt/fb/yt/sp/am/sc), auto-generated on add.',
    }),
    defineField({
      name: 'platform',
      title: 'Platform',
      type: 'string',
      options: {
        list: SOCIAL_PLATFORMS.map((id) => ({ title: id, value: id })),
      },
      validation: (rule) => rule.required(),
    }),
    defineField({ name: 'label', title: 'Label', type: 'string' }),
    defineField({
      name: 'url',
      title: 'URL',
      type: 'url',
      validation: (rule) =>
        rule.uri({ scheme: ['http', 'https'], allowRelative: false }),
    }),
    defineField({
      name: 'enabled',
      title: 'Enabled',
      type: 'boolean',
      initialValue: true,
    }),
  ],
  preview: {
    select: { label: 'label', platform: 'platform', enabled: 'enabled' },
    prepare({ label, platform, enabled }) {
      return {
        title: label || platform,
        subtitle: `${platform}${enabled === false ? ' · hidden' : ''}`,
      };
    },
  },
});
