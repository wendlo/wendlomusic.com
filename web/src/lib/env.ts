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

export interface ShopifyEnv {
  domain?: string;
  token?: string;
  apiVersion?: string;
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
    apiVersion: pub(process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION),
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
  mailchimpApiKey?: string;
  mailchimpServerPrefix?: string;
  mailchimpAudienceId?: string;
  emailProviderApiKey?: string;
  notifyEmailTo?: string;
  notifyEmailFrom?: string;
  proxyAllowedHosts?: string;
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
    mailchimpApiKey: pub(process.env.MAILCHIMP_API_KEY),
    mailchimpServerPrefix: pub(process.env.MAILCHIMP_SERVER_PREFIX),
    mailchimpAudienceId: pub(process.env.MAILCHIMP_AUDIENCE_ID),
    emailProviderApiKey: pub(process.env.EMAIL_PROVIDER_API_KEY),
    notifyEmailTo: pub(process.env.NOTIFY_EMAIL_TO),
    notifyEmailFrom: pub(process.env.NOTIFY_EMAIL_FROM),
    proxyAllowedHosts: pub(process.env.PROXY_ALLOWED_HOSTS),
  };
}
