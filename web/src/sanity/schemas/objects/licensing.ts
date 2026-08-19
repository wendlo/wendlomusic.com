import { defineField, defineType } from 'sanity';

/** §3.16 licensing — { name, email }. Sync/licensing contact. */
export const licensing = defineType({
  name: 'licensing',
  title: 'Licensing contact',
  type: 'object',
  fields: [
    defineField({ name: 'name', title: 'Name', type: 'string' }),
    defineField({
      name: 'email',
      title: 'Email',
      type: 'string',
      validation: (rule) => rule.email(),
    }),
  ],
  preview: {
    select: { name: 'name', email: 'email' },
    prepare({ name, email }) {
      return { title: name || 'Licensing', subtitle: email };
    },
  },
});
