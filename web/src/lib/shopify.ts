/**
 * Shopify Storefront helper.
 *
 * Ported from prototype/index.html's `shopify()` / `initStore()` / cart
 * checkout runtime. Two entry points:
 *
 *   - getProducts()  — SERVER helper (RSC). POSTs the Storefront `products`
 *     query and normalizes the response into a typed Product[] the StoreIsland
 *     renders. Cached via fetch `next: { revalidate: 600, tags }`. Wrapped so a
 *     network error / non-200 / GraphQL error / timeout NEVER escapes: it
 *     returns the baked demo grid (so `next build`'s prerender of `/` succeeds
 *     even with no network in the build sandbox, and the store stays usable).
 *
 *   - createCart(lines) — CLIENT helper. Runs the cartCreate mutation and
 *     returns the Storefront checkoutUrl for window.open(). Token defaults to
 *     the public constant so it works from the browser with no env setup.
 *
 * All config reads env with a code default to the PUBLIC (browser-safe) tokens,
 * matching the prototype — the integration works with no .env, overridable
 * later by env / Sanity connectionSettings.
 */

import { env } from '@/lib/env';

/* ---- public defaults (safe to ship in client code; prototype does) ---- */
const DEFAULT_DOMAIN = 'fep1gx-a1.myshopify.com';
const DEFAULT_TOKEN = '13038a835c47c3e30b20f34cd745adfc';
const DEFAULT_API_VERSION = '2024-10';

const SHOPIFY = {
  domain: env.shopify.domain ?? DEFAULT_DOMAIN,
  token: env.shopify.token ?? DEFAULT_TOKEN,
  apiVersion: env.shopify.apiVersion ?? DEFAULT_API_VERSION,
} as const;

const endpoint = (domain: string, apiVersion: string): string =>
  `https://${domain}/api/${apiVersion}/graphql.json`;

/* ---- public Product shape (the normalized type the island consumes) ---- */
export interface Money {
  amount: string;
  currencyCode: string;
}
export interface ProductImage {
  url: string;
  altText?: string | null;
}
export interface SelectedOption {
  name: string;
  value: string;
}
export interface Variant {
  id: string;
  title: string;
  availableForSale: boolean;
  selectedOptions: SelectedOption[];
  price: Money;
}
export interface Product {
  id: string;
  title: string;
  handle: string;
  availableForSale: boolean;
  featuredImage?: ProductImage | null;
  images: { nodes: ProductImage[] };
  priceRange: { minVariantPrice: Money };
  variants: { nodes: Variant[] };
}

/* ---- cart line shape createCart() accepts ---- */
export interface CartLineInput {
  merchandiseId: string;
  quantity: number;
}

/* ---- raw Storefront response shapes (what GraphQL returns) ---- */
interface RawProduct {
  id: string;
  title: string;
  handle: string;
  availableForSale: boolean;
  featuredImage?: ProductImage | null;
  images?: { nodes?: ProductImage[] | null } | null;
  priceRange?: { minVariantPrice?: Money | null } | null;
  variants?: { nodes?: Variant[] | null } | null;
}
interface ProductsResponse {
  data?: { products?: { nodes?: RawProduct[] | null } | null } | null;
  errors?: { message: string }[];
}

const PRODUCTS_QUERY = `{
  products(first: 24) {
    nodes {
      id
      title
      handle
      availableForSale
      featuredImage { url altText }
      images(first: 8) { nodes { url altText } }
      priceRange { minVariantPrice { amount currencyCode } }
      variants(first: 20) {
        nodes {
          id
          title
          availableForSale
          selectedOptions { name value }
          price { amount currencyCode }
        }
      }
    }
  }
}`;

/**
 * Normalize a raw Storefront product into the strict Product shape. Missing
 * nested collections collapse to empty arrays so the island never dereferences
 * undefined.
 */
function normalize(p: RawProduct): Product {
  return {
    id: p.id,
    title: p.title,
    handle: p.handle,
    availableForSale: !!p.availableForSale,
    featuredImage: p.featuredImage ?? null,
    images: { nodes: p.images?.nodes ?? [] },
    priceRange: {
      minVariantPrice: p.priceRange?.minVariantPrice ?? {
        amount: '0',
        currencyCode: 'USD',
      },
    },
    variants: { nodes: p.variants?.nodes ?? [] },
  };
}

/* ---- baked demo grid: the safe fallback when Shopify is unreachable ---- */
const usd = (a: string): Money => ({ amount: a, currencyCode: 'USD' });
const demoVariants = (
  id: string,
  price: string,
  sizes: [string, boolean][],
): Variant[] =>
  sizes.map(([s, avail]) => ({
    id: `${id}-${s}`,
    title: s,
    availableForSale: avail,
    selectedOptions: [{ name: 'Size', value: s }],
    price: usd(price),
  }));
const singleVariant = (id: string, price: string, avail: boolean): Variant[] => [
  {
    id: `${id}-1`,
    title: 'Default Title',
    availableForSale: avail,
    selectedOptions: [{ name: 'Title', value: 'Default Title' }],
    price: usd(price),
  },
];

export const DEMO_PRODUCTS: Product[] = [
  {
    id: 'demo-tee',
    title: 'Logo Tee',
    handle: 'logo-tee',
    availableForSale: true,
    images: {
      nodes: [
        { url: '/seed/art-downtown.jpg', altText: 'Logo Tee front' },
        { url: '/seed/art-mustbenice.jpg', altText: 'Logo Tee back' },
      ],
    },
    priceRange: { minVariantPrice: usd('30.00') },
    variants: {
      nodes: demoVariants('demo-tee', '30.00', [
        ['S', true],
        ['M', true],
        ['L', true],
        ['XL', false],
      ]),
    },
  },
  {
    id: 'demo-tour-tee',
    title: 'Tour Tee',
    handle: 'tour-tee',
    availableForSale: true,
    images: {
      nodes: [
        { url: '/seed/art-untethered.jpg', altText: 'Tour Tee front' },
        { url: '/seed/art-shadow.jpg', altText: 'Tour Tee detail' },
      ],
    },
    priceRange: { minVariantPrice: usd('32.00') },
    variants: {
      nodes: demoVariants('demo-tour-tee', '32.00', [
        ['S', true],
        ['M', true],
        ['L', false],
      ]),
    },
  },
  {
    id: 'demo-hoodie',
    title: 'Embroidered Hoodie',
    handle: 'embroidered-hoodie',
    availableForSale: true,
    images: { nodes: [{ url: '/seed/art-wasting.jpg', altText: 'Embroidered Hoodie' }] },
    priceRange: { minVariantPrice: usd('65.00') },
    variants: {
      nodes: demoVariants('demo-hoodie', '65.00', [
        ['M', true],
        ['L', true],
        ['XL', true],
      ]),
    },
  },
  {
    id: 'demo-vinyl',
    title: 'Vinyl LP',
    handle: 'vinyl-lp',
    availableForSale: true,
    images: { nodes: [{ url: '/seed/art-mustbenice.jpg', altText: 'Vinyl LP' }] },
    priceRange: { minVariantPrice: usd('35.00') },
    variants: { nodes: singleVariant('demo-vinyl', '35.00', true) },
  },
  {
    id: 'demo-cassette',
    title: 'Cassette',
    handle: 'cassette',
    availableForSale: false,
    images: { nodes: [{ url: '/seed/art-shadow.jpg', altText: 'Cassette' }] },
    priceRange: { minVariantPrice: usd('12.00') },
    variants: { nodes: singleVariant('demo-cassette', '12.00', false) },
  },
  {
    id: 'demo-tote',
    title: 'Canvas Tote',
    handle: 'canvas-tote',
    availableForSale: true,
    images: { nodes: [{ url: '/seed/art-downtown.jpg', altText: 'Canvas Tote' }] },
    priceRange: { minVariantPrice: usd('25.00') },
    variants: { nodes: singleVariant('demo-tote', '25.00', true) },
  },
];

/**
 * SERVER: fetch the live product catalog. Returns a normalized Product[].
 * On ANY failure (no domain/token, network error, non-200, GraphQL errors,
 * timeout, or an empty catalog) returns DEMO_PRODUCTS so the room always has a
 * populated grid and `next build`'s prerender never rejects.
 */
export async function getProducts(): Promise<Product[]> {
  const { domain, token, apiVersion } = SHOPIFY;
  if (!domain || !token) return DEMO_PRODUCTS;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    let res: Response;
    try {
      res = await fetch(endpoint(domain, apiVersion), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': token,
        },
        body: JSON.stringify({ query: PRODUCTS_QUERY }),
        signal: controller.signal,
        next: { revalidate: 600, tags: ['shopify-products'] },
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) return DEMO_PRODUCTS;

    const json = (await res.json()) as ProductsResponse;
    if (json.errors?.length) return DEMO_PRODUCTS;

    const nodes = json.data?.products?.nodes;
    if (!nodes || !nodes.length) return DEMO_PRODUCTS;

    return nodes.map(normalize);
  } catch {
    // network error / abort / malformed JSON — never let it escape
    return DEMO_PRODUCTS;
  }
}

const CART_CREATE_MUTATION = `mutation($lines: [CartLineInput!]!) {
  cartCreate(input: { lines: $lines }) {
    cart { checkoutUrl }
    userErrors { message }
  }
}`;

interface CartCreateResponse {
  data?: {
    cartCreate?: {
      cart?: { checkoutUrl?: string | null } | null;
      userErrors?: { message: string }[] | null;
    } | null;
  } | null;
  errors?: { message: string }[];
}

/**
 * CLIENT: create a Shopify cart from the on-site cart lines and return the
 * hosted checkout URL for window.open(). Throws on error so the caller can
 * surface it (the prototype alerts). Uses the public token by default.
 */
export async function createCart(lines: CartLineInput[]): Promise<string> {
  const { domain, token, apiVersion } = SHOPIFY;
  const res = await fetch(endpoint(domain, apiVersion), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': token,
    },
    body: JSON.stringify({
      query: CART_CREATE_MUTATION,
      variables: { lines },
    }),
  });
  const json = (await res.json()) as CartCreateResponse;
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join('; '));
  }
  const url = json.data?.cartCreate?.cart?.checkoutUrl;
  if (!url) {
    throw new Error(
      json.data?.cartCreate?.userErrors?.[0]?.message || 'no checkout URL',
    );
  }
  return url;
}
