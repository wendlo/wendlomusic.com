/**
 * Kit (formerly ConvertKit) mailing-list signup — V4 API, plain fetch, no deps.
 *
 * Server-only. Never import from client components (it handles the API key).
 *
 * Flow per email-list signup (developers.kit.com/api-reference):
 *   0. resolveFormId — KIT_FORM_ID if set; otherwise GET /v4/forms?status=active
 *      once per server instance and pick the form named "Website signups"
 *      (or the only active form). Cached on success only. If no form can be
 *      determined the signup is NOT sent to Kit (it's still in the Sheet).
 *   1. ensureKitFields — POST /v4/custom_fields {label} for "Location" and
 *      "Best meal" (idempotent: 201 created / 200 already exists), once per
 *      server instance, cached on success only. Failure is NON-fatal: the
 *      subscriber is created without custom fields (the values are in Sheets).
 *   2. POST /v4/subscribers { email_address, first_name, state:"inactive",
 *      fields } — an upsert. `state:"inactive"` is CRITICAL: the API default is
 *      "active", which would bypass double opt-in. "inactive" is what the Kit
 *      UI calls "Unconfirmed". An existing subscriber's state is never changed
 *      by this endpoint (active stays active, cancelled stays cancelled).
 *   3. POST /v4/forms/{formId}/subscribers/{id} { referrer } — adds them to
 *      the double-opt-in form, which makes Kit send the form's confirmation
 *      email (201 = newly added; 200 = already on the form, nothing re-sent).
 *
 * Kit success = steps 2 AND 3 returned 2xx.
 */

import type { ServerEnv } from '@/lib/env';

/** A deadline-bound fetch supplied by the caller (route owns the budget). */
export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

const KIT_API = 'https://api.kit.com/v4';

/** Kit custom-field labels. The band must not rename these in Kit. */
export const KIT_FIELD_LABELS = { location: 'Location', meal: 'Best meal' } as const;
type SiteField = keyof typeof KIT_FIELD_LABELS;
type FieldKeys = Record<SiteField, string>;

/** The name the band gives the double-opt-in form (band guide, step 3). */
export const KIT_FORM_NAME = 'Website signups';

export interface KitConfig {
  apiKey: string;
  /** Numeric id from KIT_FORM_ID, or undefined → found by name (resolveFormId). */
  formId?: string;
}

/**
 * Null (= Kit skipped) unless KIT_API_KEY is set. KIT_FORM_ID is optional:
 * without it the form named "Website signups" is looked up through the API.
 */
export function kitConfig(env: ServerEnv): KitConfig | null {
  if (!env.kitApiKey) return null;
  return { apiKey: env.kitApiKey, formId: env.kitFormId };
}

/**
 * What happened, for the Sheet's "Mailing list" column and logs.
 *  - confirmation_sent  — on the form and Unconfirmed: Kit sent (now, or on
 *                         their first signup) the confirmation email.
 *  - already_subscribed — Kit says they're already an active subscriber.
 *  - not_added          — Kit error/timeout, or Kit kept them off the list
 *                         (e.g. they previously unsubscribed: state cancelled).
 */
export type KitOutcome = 'confirmation_sent' | 'already_subscribed' | 'not_added';

export interface KitResult {
  /** Both Kit calls returned 2xx (drives the "Kit is the only backend" 502). */
  ok: boolean;
  outcome: KitOutcome;
}

interface KitSubscriber {
  id?: number;
  state?: string;
}

function headers(apiKey: string): HeadersInit {
  return {
    'X-Kit-Api-Key': apiKey,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

/** Kit errors are { errors: string[] }. Log status + messages only (no PII). */
async function logKitError(step: string, res: Response): Promise<void> {
  let detail = '';
  try {
    const data = (await res.json()) as { errors?: unknown };
    if (Array.isArray(data.errors)) detail = data.errors.map(String).join('; ');
  } catch {
    // non-JSON body — status is enough
  }
  console.error(`[kit] ${step} failed: HTTP ${res.status}${detail ? ` — ${detail}` : ''}`);
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/* ------------------------------------------------------------------ *
 * Step 1 — custom fields (lazy, cached per instance, success only)
 * ------------------------------------------------------------------ */

const fieldCache = new Map<string, Promise<FieldKeys>>();
/** Longest a signup waits for custom-field creation before going without. */
const FIELD_WAIT_MS = 3_000;

async function createField(cfg: KitConfig, label: string, call: Fetcher): Promise<string> {
  const res = await call(`${KIT_API}/custom_fields`, {
    method: 'POST',
    headers: headers(cfg.apiKey),
    body: JSON.stringify({ label }),
  });
  if (!res.ok) {
    await logKitError(`create custom field "${label}"`, res);
    throw new Error(`custom field ${res.status}`);
  }
  const data = (await res.json()) as { custom_field?: { key?: unknown } };
  const key = data.custom_field?.key;
  // Always use the key Kit returns — never derive it from the label.
  if (typeof key !== 'string' || !key) throw new Error('custom field: no key');
  return key;
}

/** The Kit field keys for location/meal, or null on any failure (non-fatal). */
export async function ensureKitFields(cfg: KitConfig, call: Fetcher): Promise<FieldKeys | null> {
  let pending = fieldCache.get(cfg.apiKey);
  if (!pending) {
    // allSettled: both calls finish before the subscriber is created, even if
    // one fails (no stray request still in flight).
    pending = Promise.allSettled([
      createField(cfg, KIT_FIELD_LABELS.location, call),
      createField(cfg, KIT_FIELD_LABELS.meal, call),
    ]).then(([location, meal]) => {
      if (location.status === 'rejected') throw location.reason;
      if (meal.status === 'rejected') throw meal.reason;
      return { location: location.value, meal: meal.value };
    });
    fieldCache.set(cfg.apiKey, pending);
    // Cache success only: a failure clears the slot so the next request retries.
    pending.catch(() => {
      if (fieldCache.get(cfg.apiKey) === pending) fieldCache.delete(cfg.apiKey);
    });
  }
  // Don't let a slow custom_fields endpoint eat the budget the subscriber
  // calls need: after FIELD_WAIT_MS subscribe without fields (the in-flight
  // creation still finishes, bounded by the per-call cap, and caches on success).
  let timer: ReturnType<typeof setTimeout> | undefined;
  const giveUp = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`no answer within ${FIELD_WAIT_MS}ms`)), FIELD_WAIT_MS);
  });
  try {
    return await Promise.race([pending, giveUp]);
  } catch (err) {
    console.error(`[kit] custom fields unavailable, subscribing without them: ${errMessage(err)}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ *
 * Step 0 — which form? (KIT_FORM_ID, else look it up by name once)
 * ------------------------------------------------------------------ */

const formCache = new Map<string, Promise<string>>();

async function lookupFormId(cfg: KitConfig, call: Fetcher): Promise<string> {
  const res = await call(`${KIT_API}/forms?status=active&per_page=1000`, {
    method: 'GET',
    headers: headers(cfg.apiKey),
  });
  if (!res.ok) {
    await logKitError('list forms', res);
    throw new Error(`list forms ${res.status}`);
  }
  const data = (await res.json()) as { forms?: Array<{ id?: unknown; name?: unknown }> };
  const forms = (data.forms ?? []).filter(
    (f): f is { id: number; name: string } => typeof f.id === 'number' && typeof f.name === 'string',
  );
  const wanted = KIT_FORM_NAME.toLowerCase();
  const named = forms.filter((f) => f.name.trim().toLowerCase() === wanted);
  const pick = named.length === 1 ? named[0] : named.length === 0 && forms.length === 1 ? forms[0] : undefined;
  if (!pick) {
    throw new Error(
      named.length > 1
        ? `${named.length} active forms are named "${KIT_FORM_NAME}"`
        : `no active form named "${KIT_FORM_NAME}" (found ${forms.length} active forms)`,
    );
  }
  return String(pick.id);
}

/** The form to add signups to, or null (logged) when it can't be determined. */
export async function resolveFormId(cfg: KitConfig, call: Fetcher): Promise<string | null> {
  if (cfg.formId) return cfg.formId;
  let pending = formCache.get(cfg.apiKey);
  if (!pending) {
    pending = lookupFormId(cfg, call);
    formCache.set(cfg.apiKey, pending);
    // Cache success only: a failure clears the slot so the next request retries.
    pending.catch(() => {
      if (formCache.get(cfg.apiKey) === pending) formCache.delete(cfg.apiKey);
    });
  }
  try {
    return await pending;
  } catch (err) {
    console.error(
      `[kit] can't tell which Kit form to use — set KIT_FORM_ID, or name the form "${KIT_FORM_NAME}": ${errMessage(err)}`,
    );
    return null;
  }
}

/** Test hook: forget cached field keys and looked-up form ids. */
export function resetKitFieldCache(): void {
  fieldCache.clear();
  formCache.clear();
}

/* ------------------------------------------------------------------ *
 * Steps 2 + 3 — upsert as inactive, then add to the double-opt-in form
 * ------------------------------------------------------------------ */

export interface KitSignup {
  email: string;
  name?: string;
  location?: string;
  meal?: string;
  /** Page the signup came from (optional; Kit parses UTM params from it). */
  referrer?: string;
}

/** Never throws. */
export async function kitSubscribe(
  cfg: KitConfig,
  signup: KitSignup,
  call: Fetcher,
): Promise<KitResult> {
  const failed: KitResult = { ok: false, outcome: 'not_added' };
  try {
    /* 0. which form — without one there's no confirmation email, so don't
          create a subscriber that would sit unconfirmed with nothing sent */
    const formId = await resolveFormId(cfg, call);
    if (!formId) return failed;

    /* 1. custom fields — only needed when there's something to store */
    let fields: Record<string, string> | undefined;
    if (signup.location || signup.meal) {
      const keys = await ensureKitFields(cfg, call);
      if (keys) {
        fields = {};
        if (signup.location) fields[keys.location] = signup.location;
        if (signup.meal) fields[keys.meal] = signup.meal;
      }
    }

    /* 2. create / upsert the subscriber as UNCONFIRMED */
    const created = await call(`${KIT_API}/subscribers`, {
      method: 'POST',
      headers: headers(cfg.apiKey),
      body: JSON.stringify({
        email_address: signup.email,
        first_name: signup.name || undefined,
        state: 'inactive',
        fields,
      }),
    });
    if (!created.ok) {
      await logKitError('create subscriber', created);
      return failed;
    }
    const sub = ((await created.json()) as { subscriber?: KitSubscriber }).subscriber;
    if (typeof sub?.id !== 'number') {
      console.error('[kit] create subscriber: response had no subscriber id');
      return failed;
    }

    /* 3. add to the form (this is what sends the confirmation email) */
    const added = await call(
      `${KIT_API}/forms/${encodeURIComponent(formId)}/subscribers/${sub.id}`,
      {
        method: 'POST',
        headers: headers(cfg.apiKey),
        body: JSON.stringify({ referrer: signup.referrer ?? null }),
      },
    );
    if (!added.ok) {
      await logKitError(`add subscriber to form ${formId}`, added);
      return failed;
    }
    let state = sub.state;
    try {
      const onForm = ((await added.json()) as { subscriber?: KitSubscriber }).subscriber;
      if (typeof onForm?.state === 'string') state = onForm.state;
    } catch {
      // 2xx with an unreadable body — fall back to the create response's state
    }

    if (state === 'active') return { ok: true, outcome: 'already_subscribed' };
    if (state === 'inactive') return { ok: true, outcome: 'confirmation_sent' };
    // cancelled / bounced / complained: Kit keeps them off the list and the API
    // can't change that (re-subscribing needs their consent via Kit itself).
    console.warn(`[kit] subscriber ${sub.id} is "${state ?? 'unknown'}" — not on the list`);
    return { ok: true, outcome: 'not_added' };
  } catch (err) {
    // network error, timeout/abort, or budget exhausted
    console.error(`[kit] signup failed: ${errMessage(err)}`);
    return failed;
  }
}
