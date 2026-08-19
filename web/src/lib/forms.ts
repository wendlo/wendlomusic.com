/**
 * Shared form-pipeline contract (client + server safe — NO secrets here).
 *
 * The /api/submit endpoint and ContactIsland both import from this module so
 * the field keys, validation rules, honeypot field name and the wire shapes
 * stay in lock-step with contactPage.messageForm / emailForm (§3.20 fixed
 * keys, §6.1 pipeline).
 */

import type { FormFieldKey } from '@/lib/content/types';

/** Which pipeline a submission runs: 'contact' = messageForm, 'email' = emailForm. */
export type SubmissionKind = 'contact' | 'email';

/**
 * Honeypot field name. Rendered visually hidden on the client; a filled value
 * server-side means a bot and the submission is rejected. Named to look like a
 * real field to naive form-fillers.
 */
export const HONEYPOT_FIELD = 'company' as const;

/**
 * Fixed field keys per kind (§3.20). Server-side validation only accepts these
 * keys; anything else in `values` is dropped, never stored.
 */
export const FORM_FIELD_KEYS: Record<SubmissionKind, readonly FormFieldKey[]> = {
  contact: ['name', 'email', 'subject', 'message'],
  email: ['name', 'email', 'location', 'meal', 'message'],
};

/**
 * Fixed column order for the Sheets append (union of both kinds) so rows from
 * either form align in one spreadsheet.
 */
export const SHEET_COLUMNS: readonly FormFieldKey[] = [
  'name',
  'email',
  'subject',
  'message',
  'location',
  'meal',
];

/** Same shape the prototype/client used; kept identical on the server. */
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** POST /api/submit request body. */
export interface SubmitRequestBody {
  kind: SubmissionKind;
  /** Field values keyed by FormFieldKey. */
  values: Record<string, string>;
  /** Turnstile token (present only when the site key is configured). */
  turnstileToken?: string;
  /** The form's successText, passed through on success. */
  successText?: string;
  /** Honeypot — must be empty. Keyed by HONEYPOT_FIELD. */
  [HONEYPOT_FIELD]?: string;
}

/** POST /api/submit response body. */
export interface SubmitResponseBody {
  ok: boolean;
  /** Echoed back on success so the client can render it. */
  successText?: string;
  /** Failure discriminator. 'unconfigured' → show the booking-email fallback. */
  reason?:
    | 'rate_limited'
    | 'turnstile'
    | 'invalid'
    | 'storage'
    | 'unconfigured'
    | 'error';
  /** Keys that failed validation (reason === 'invalid'). */
  fields?: string[];
}

export type ValidationResult =
  | { ok: true; values: Record<FormFieldKey, string> }
  | { ok: false; fields: string[] };

const MAX_FIELD_LENGTH = 5000;

/**
 * Server-side validation: name + email required, email shape checked, unknown
 * keys stripped, values trimmed and length-capped.
 */
export function validateSubmission(
  kind: SubmissionKind,
  raw: Record<string, unknown>,
): ValidationResult {
  const keys = FORM_FIELD_KEYS[kind];
  const values = {} as Record<FormFieldKey, string>;
  const bad: string[] = [];

  for (const key of keys) {
    const v = raw[key];
    values[key] = typeof v === 'string' ? v.trim().slice(0, MAX_FIELD_LENGTH) : '';
  }

  if (!values.name) bad.push('name');
  if (!values.email || !EMAIL_RE.test(values.email)) bad.push('email');

  return bad.length ? { ok: false, fields: bad } : { ok: true, values };
}
