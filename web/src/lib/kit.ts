/**
 * Kit (formerly ConvertKit) mailing-list signup — V4 API, plain fetch, no deps.
 *
 * Server-only. Never import from client components (it handles the API key).
 *
 * SINGLE opt-in: a fan who submits the website form is on the list at once
 * ("Confirmed" in Kit) and Kit sends them nothing at signup.
 *
 * Flow per email-list signup (developers.kit.com/api-reference):
 *   0. resolveFormId — KIT_FORM_ID if set; otherwise GET /v4/forms?status=active
 *      once per server instance and pick the form named "Website signups"
 *      (or the only active form). Cached on success only. No form found →
 *      the fan is still created (step 2), just not added to a form (step 3).
 *   1. ensureKitFields — POST /v4/custom_fields {label} for "Location" and
 *      "Best meal" (idempotent: 201 created / 200 already exists), once per
 *      server instance, cached on success only. Failure is NON-fatal: the
 *      subscriber is created without custom fields (the values are in Sheets).
 *   2. POST /v4/subscribers { email_address, first_name, state:"active",
 *      fields } — an upsert. 201 = new subscriber, on the list now. 200 = the
 *      address already existed: Kit never changes an existing subscriber's
 *      state here (active stays active; unsubscribed "cancelled" and
 *      unconfirmed "inactive" stay so) but it DOES overwrite first_name and
 *      fields, so blank values are never sent.
 *   3. POST /v4/forms/{formId}/subscribers/{id} { referrer } — adds them to
 *      the "Website signups" form (201 = newly added; 200 = already on it).
 *      That form must have "Send confirmation email" UNticked: then Kit sends
 *      nothing, and joining it is what brings back a returning fan who had
 *      unsubscribed or never confirmed. If the box is ticked, Kit emails the
 *      form's confirmation email to people joining it for the first time —
 *      they were created active, so they're on the list either way. A 422
 *      here (form archived/deleted) is logged; a new fan is still on the list.
 */

import type { ServerEnv } from '@/lib/env';

/** A deadline-bound fetch supplied by the caller (route owns the budget). */
export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

const KIT_API = 'https://api.kit.com/v4';

/** Kit custom-field labels. The band must not rename these in Kit. */
export const KIT_FIELD_LABELS = { location: 'Location', meal: 'Best meal' } as const;
type SiteField = keyof typeof KIT_FIELD_LABELS;
type FieldKeys = Record<SiteField, string>;

/** The name the band gives the signup form (band guide, step 3). */
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
 *  - added              — on the list now: new, or a returning fan whom
 *                         joining the form brought back.
 *  - added_no_form      — on the list now, but not on the "Website signups"
 *                         form (it couldn't be found, or refused them).
 *  - already_subscribed — they were already on the list.
 *  - unconfirmed        — they joined the form but Kit still has them as
 *                         Unconfirmed, i.e. the form's "Send confirmation
 *                         email" is still ticked.
 *  - unsubscribed       — they joined the form but Kit still keeps them off
 *                         the list (bounced, complained, or Kit refused).
 *  - form_failed        — a returning fan (unsubscribed / unconfirmed) whom
 *                         only joining the form could bring back, and that
 *                         step was skipped or failed: NOT on the list.
 *  - not_added          — Kit error/timeout before they were created.
 * 'unconfirmed' / 'unsubscribed' are only reported from the state the form
 * step read back — never from the create call's (unchanged) old state.
 */
export type KitOutcome =
  | 'added'
  | 'added_no_form'
  | 'already_subscribed'
  | 'unconfirmed'
  | 'unsubscribed'
  | 'form_failed'
  | 'not_added';

export interface KitResult {
  /**
   * Kit took this signup (or definitively answered for it). false drives the
   * "Kit is the only backend" 502 so the fan sees an error and can retry.
   */
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
 * Steps 2 + 3 — upsert as active, then add to the signup form
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
    /* 0. which form — null still subscribes them, just without the form */
    const formId = await resolveFormId(cfg, call);

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

    /* 2. create / upsert the subscriber as ACTIVE (single opt-in) */
    const created = await call(`${KIT_API}/subscribers`, {
      method: 'POST',
      headers: headers(cfg.apiKey),
      body: JSON.stringify({
        email_address: signup.email,
        first_name: signup.name || undefined,
        state: 'active',
        fields,
      }),
    });
    if (!created.ok) {
      await logKitError('create subscriber', created);
      return failed;
    }
    // 201 (or 202: custom fields added asynchronously) = a brand-new subscriber.
    const isNew = created.status === 201 || created.status === 202;
    const sub = ((await created.json()) as { subscriber?: KitSubscriber }).subscriber;
    if (typeof sub?.id !== 'number') {
      console.error('[kit] create subscriber: response had no subscriber id');
      return failed;
    }
    const before = sub.state ?? (isNew ? 'active' : undefined);

    /* 3. add to the form — attribution, and brings back a returning fan */
    let state = before;
    let onForm = false;
    let stateFromForm = false;
    if (formId) {
      try {
        const added = await call(
          `${KIT_API}/forms/${encodeURIComponent(formId)}/subscribers/${sub.id}`,
          {
            method: 'POST',
            headers: headers(cfg.apiKey),
            body: JSON.stringify({ referrer: signup.referrer ?? null }),
          },
        );
        if (added.ok) {
          onForm = true;
          try {
            const joined = ((await added.json()) as { subscriber?: KitSubscriber }).subscriber;
            if (typeof joined?.state === 'string') {
              state = joined.state;
              stateFromForm = true;
            }
          } catch {
            // 2xx with an unreadable body — keep the create response's state
          }
        } else {
          await logKitError(`add subscriber to form ${formId}`, added);
          // A looked-up form that's gone (archived / re-created): look it up
          // again on the next signup instead of reusing the stale id.
          if (!cfg.formId && (added.status === 404 || added.status === 422)) {
            formCache.delete(cfg.apiKey);
          }
        }
      } catch (err) {
        // The subscriber already exists; only the form step was lost.
        console.error(`[kit] add subscriber to form ${formId} failed: ${errMessage(err)}`);
      }
    }

    if (state === 'active') {
      if (!isNew && before === 'active') return { ok: true, outcome: 'already_subscribed' };
      return { ok: true, outcome: onForm ? 'added' : 'added_no_form' };
    }
    if (!stateFromForm) {
      // A returning fan who isn't active (unsubscribed / unconfirmed): Kit
      // never changes that state in step 2, and the form join that could
      // have brought them back didn't happen or didn't report back.
      console.error(
        `[kit] subscriber ${sub.id} is "${state ?? 'unknown'}" and the form step didn't complete — not on the list`,
      );
      return { ok: false, outcome: 'form_failed' };
    }
    if (state === 'inactive') return { ok: true, outcome: 'unconfirmed' };
    // bounced / complained / cancelled even after joining: Kit keeps them off.
    console.warn(`[kit] subscriber ${sub.id} is "${state}" after joining the form — not on the list`);
    return { ok: true, outcome: 'unsubscribed' };
  } catch (err) {
    // network error, timeout/abort, or budget exhausted
    console.error(`[kit] signup failed: ${errMessage(err)}`);
    return failed;
  }
}
