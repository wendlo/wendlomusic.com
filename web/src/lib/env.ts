/**
 * Typed environment accessor.
 *
 * Groups the PUBLIC (browser-safe, NEXT_PUBLIC_*) config the site reads today,
 * plus a typed seam for server secrets that land in a later phase. Values are
 * read once at module load. Nothing throws here yet — the fallback content path
 * must run with an empty environment (no Sanity project configured).
 *
 * NOTE (phase-4): `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` must be un-escaped
 * (`replace(/\\n/g, '\n')`) when it is actually consumed — see MIGRATION-PLAN
 * §6.1. It is intentionally left raw here since it is unused until then.
 */

/**
 * Read a public var, returning undefined when unset/empty.
 *
 * Hardened against dashboard paste mistakes: surrounding quotes and stray
 * whitespace are stripped (a value pasted as `"abc123"` into Vercel would
 * otherwise reach `createClient()` verbatim and throw at import, which takes
 * the whole build down at "Collecting page data").
 */
function pub(value: string | undefined): string | undefined {
  const v = value?.trim().replace(/^['"]+|['"]+$/g, '').trim();
  return v ? v : undefined;
}

/**
 * Sanity project ids / dataset names may only contain a-z, 0-9 and dashes.
 * Anything else is treated as "not configured" (with a loud build-log warning)
 * rather than letting `@sanity/client` throw at module evaluation.
 */
export function sanityId(
  name: string,
  value: string | undefined,
): string | undefined {
  const v = pub(value)?.toLowerCase();
  if (!v) return undefined;
  if (!/^[a-z0-9-]+$/.test(v)) {
    console.warn(
      `[env] ${name}="${value}" is not a valid Sanity id (a-z, 0-9, dashes only) — ` +
        'ignoring it and falling back to baked content. Fix the value in Vercel → Settings → Environment Variables.',
    );
    return undefined;
  }
  return v;
}

export interface SanityEnv {
  /** When set, the content resolver switches to the Sanity branch. */
  projectId?: string;
  dataset?: string;
  apiVersion?: string;
}

/**
 * NOTE: no apiVersion here on purpose. The Storefront API version is pinned in
 * code (SHOPIFY_STOREFRONT_API_VERSION in src/lib/shopify.ts) because it is
 * coupled to the query code; NEXT_PUBLIC_SHOPIFY_API_VERSION is ignored.
 */
export interface ShopifyEnv {
  domain?: string;
  token?: string;
}

export interface BandsintownEnv {
  artist?: string;
  appId?: string;
}

export interface PublicEnv {
  sanity: SanityEnv;
  shopify: ShopifyEnv;
  bandsintown: BandsintownEnv;
}

/** Public (browser-safe) environment. */
export const env: PublicEnv = {
  sanity: {
    projectId: sanityId('NEXT_PUBLIC_SANITY_PROJECT_ID', process.env.NEXT_PUBLIC_SANITY_PROJECT_ID),
    dataset: sanityId('NEXT_PUBLIC_SANITY_DATASET', process.env.NEXT_PUBLIC_SANITY_DATASET),
    apiVersion: pub(process.env.NEXT_PUBLIC_SANITY_API_VERSION),
  },
  shopify: {
    domain: pub(process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN),
    token: pub(process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN),
  },
  bandsintown: {
    artist: pub(process.env.NEXT_PUBLIC_BANDSINTOWN_ARTIST_ID),
    appId: pub(process.env.NEXT_PUBLIC_BANDSINTOWN_APP_ID),
  },
};

/**
 * Server-only secrets. Typed now, resolved/validated in a later phase. Reading
 * these from a client component is a mistake — they are only defined server-side.
 */
export interface ServerEnv {
  sanityReadToken?: string;
  sanityRevalidateSecret?: string;
  turnstileSecretKey?: string;
  googleSheetsId?: string;
  googleServiceAccountEmail?: string;
  /** RAW, still `\n`-escaped; un-escape at point of use (phase-4). */
  googleServiceAccountPrivateKey?: string;
  /** Kit (formerly ConvertKit) V4 API key — NOT the V3 key. */
  kitApiKey?: string;
  /** Kit form id (digits only; anything else is treated as unset). */
  kitFormId?: string;
  emailProviderApiKey?: string;
  notifyEmailTo?: string;
  notifyEmailFrom?: string;
  proxyAllowedHosts?: string;
}

/**
 * A numeric id (e.g. a Kit form id). Anything that isn't all digits after the
 * usual quote/whitespace cleanup is treated as unset, with a log line, rather
 * than being sent to an API as a broken URL segment.
 */
function numericId(name: string, value: string | undefined): string | undefined {
  const v = pub(value);
  if (!v) return undefined;
  if (!/^\d+$/.test(v)) {
    console.warn(
      `[env] ${name} is not a number — ignoring it (the form is looked up by name instead). ` +
        'Fix the value in Vercel → Settings → Environment Variables.',
    );
    return undefined;
  }
  return v;
}

/**
 * Wendlo's Cloudflare Turnstile widget — the PUBLIC site key (it ships to every
 * visitor's browser). Used whenever TURNSTILE_SECRET_KEY is set but no site key
 * is, so the server never demands a token the form can't produce. If the widget
 * is ever replaced in Cloudflare, set BOTH new keys in Vercel.
 */
export const DEFAULT_TURNSTILE_SITE_KEY = '0x4AAAAAAF3zz7BZE7FRxDLQ';

/**
 * The Turnstile site key for the form, read on the server when the page
 * renders (build / ISR) and handed to the form as a prop. The computed name
 * stops Next from inlining it at build time.
 */
export function turnstileSiteKey(): string | undefined {
  const name = ['NEXT_PUBLIC', 'TURNSTILE', 'SITE', 'KEY'].join('_');
  return (
    pub(process.env[name]) ??
    (pub(process.env.TURNSTILE_SECRET_KEY) ? DEFAULT_TURNSTILE_SITE_KEY : undefined)
  );
}

/** Read the server secrets. Call only in server code (routes / RSC). */
export function serverEnv(): ServerEnv {
  return {
    sanityReadToken: pub(process.env.SANITY_API_READ_TOKEN),
    sanityRevalidateSecret: pub(process.env.SANITY_REVALIDATE_SECRET),
    turnstileSecretKey: pub(process.env.TURNSTILE_SECRET_KEY),
    googleSheetsId: pub(process.env.GOOGLE_SHEETS_ID),
    googleServiceAccountEmail: pub(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL),
    googleServiceAccountPrivateKey: pub(
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    ),
    kitApiKey: pub(process.env.KIT_API_KEY),
    kitFormId: numericId('KIT_FORM_ID', process.env.KIT_FORM_ID),
    emailProviderApiKey: pub(process.env.EMAIL_PROVIDER_API_KEY),
    notifyEmailTo: pub(process.env.NOTIFY_EMAIL_TO),
    notifyEmailFrom: pub(process.env.NOTIFY_EMAIL_FROM),
    proxyAllowedHosts: pub(process.env.PROXY_ALLOWED_HOSTS),
  };
}
