import { defineField, defineType } from 'sanity';

/** Fixed form-field keys (§3.20) — drive columns/merge mapping downstream. */
export const FORM_FIELD_KEYS = [
  'name',
  'email',
  'subject',
  'message',
  'location',
  'meal',
] as const;

/** Form field input kinds (§3.20). */
export const FORM_FIELD_TYPES = ['text', 'email', 'textarea'] as const;

/** §3.20 formField — array item in contactForm.fields. */
export const formField = defineType({
  name: 'formField',
  title: 'Form field',
  type: 'object',
  fields: [
    defineField({
      name: 'key',
      title: 'Key',
      type: 'string',
      readOnly: true,
      description:
        'Read-only fixed key. Drives Sheets columns + Submissions + Mailchimp merge mapping.',
      options: {
        list: FORM_FIELD_KEYS.map((k) => ({ title: k, value: k })),
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'label',
      title: 'Label',
      type: 'string',
      description: 'Visible question text.',
    }),
    defineField({
      name: 'type',
      title: 'Type',
      type: 'string',
      options: {
        list: FORM_FIELD_TYPES.map((t) => ({ title: t, value: t })),
        layout: 'radio',
      },
      initialValue: 'text',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'required',
      title: 'Required',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'placeholder',
      title: 'Placeholder',
      type: 'string',
      description: 'Used by emailForm fields only.',
    }),
  ],
  preview: {
    select: { key: 'key', label: 'label', type: 'type' },
    prepare({ key, label, type }) {
      return { title: label || key, subtitle: `${key} · ${type}` };
    },
  },
});
