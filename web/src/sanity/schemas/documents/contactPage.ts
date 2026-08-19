import { defineArrayMember, defineField, defineType } from 'sanity';

/** §3.14 contactPage — document (singleton). */
export const contactPage = defineType({
  name: 'contactPage',
  title: 'Contact',
  type: 'document',
  fields: [
    defineField({
      name: 'polaroids',
      title: 'Polaroids',
      type: 'image',
      description: 'Empty → /defaults/contactv2.png.',
      options: { hotspot: false },
    }),
    defineField({
      name: 'heading',
      title: 'Heading',
      type: 'string',
    }),
    defineField({
      name: 'messageButton',
      title: 'Message button',
      type: 'ctaButton',
    }),
    defineField({
      name: 'emailButton',
      title: 'Email button',
      type: 'ctaButton',
    }),
    defineField({
      name: 'bookingEmail',
      title: 'Booking email',
      type: 'string',
      description: 'Also becomes the NOTIFY_EMAIL_TO default.',
      validation: (rule) => rule.email(),
    }),
    defineField({
      name: 'licensing',
      title: 'Licensing',
      type: 'licensing',
    }),
    defineField({
      name: 'socials',
      title: 'Socials',
      type: 'array',
      of: [defineArrayMember({ type: 'socialLink' })],
    }),
    defineField({
      name: 'googleForm',
      title: 'Google Form',
      type: 'googleForm',
    }),
    defineField({
      name: 'messageForm',
      title: 'Message form',
      type: 'contactForm',
      description: 'Fixed keys name/email/subject/message.',
    }),
    defineField({
      name: 'emailForm',
      title: 'Email form',
      type: 'contactForm',
      description: 'Fixed keys name/email/location/meal/message; fields carry placeholder.',
    }),
  ],
  preview: {
    select: { heading: 'heading' },
    prepare({ heading }) {
      return { title: 'Contact', subtitle: heading };
    },
  },
});
