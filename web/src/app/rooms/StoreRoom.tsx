/**
 * StoreRoom — scrolling stripes page with a product grid, product lightbox
 * (image gallery + size picker), and an on-site cart drawer.
 *
 * The Store slice comes from siteSettings.connections.shopify (there is no
 * dedicated StorePage content type). Phase 4 wires the LIVE Shopify Storefront:
 * this server component `await getProducts()` (cached RSC fetch, graceful
 * fallback to a baked demo grid when Shopify is unreachable — see lib/shopify)
 * and hands the normalized products to the client island, which owns the
 * lightbox, size-picker, localStorage cart, and cartCreate → checkout redirect.
 *
 * Server component: renders the room shell + head spacer and hands products +
 * the shopify connection to the client island that owns all interactivity.
 */

import type { ShopifySettings } from '@/lib/content/types';
import { getProducts } from '@/lib/shopify';
import { StoreIsland } from './_client/StoreIsland';

export interface StoreRoomProps {
  /** Shopify connection from siteSettings.connections.shopify. */
  shopify: ShopifySettings;
}

export async function StoreRoom({ shopify }: StoreRoomProps) {
  // Cached, graceful-failing RSC fetch of the live catalog (demo grid fallback).
  const products = await getProducts();

  return (
    <section className="room" data-page="store">
      <div className="bg" />
      <div className="content">
        {/* store-head is an empty spacer in the prototype (matches music/blog). */}
        <div className="store-head" />
        <StoreIsland shopify={shopify} products={products} />
      </div>
    </section>
  );
}
