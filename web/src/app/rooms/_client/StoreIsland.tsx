'use client';

/**
 * StoreIsland — the interactive half of the Store room, ported verbatim (in
 * behaviour + markup) from prototype/index.html's store runtime:
 *   - product grid (`.store-embed` > `.prod` cards)          [renderProducts]
 *   - pointer-only hover-scrub through a product's images     [mousemove scrub]
 *   - product lightbox with image gallery + size picker       [#pgal]
 *   - on-site cart drawer with qty + subtotal                 [#cartDrawer]
 *   - checkout → Shopify cartCreate → window.open(url)        [cartCheckout]
 *
 * The whole card opens the lightbox on tap/Enter (accessible base); the
 * hover-scrub is a pointer-only enhancement layered on top.
 *
 * Data (Phase 4): products are fetched LIVE from the Shopify Storefront by the
 * server room (StoreRoom → getProducts, cached + graceful-failing) and passed
 * in as a prop. When Shopify is unreachable the server hands us the baked demo
 * grid instead, so this component always renders a populated store. Checkout is
 * a client-side cartCreate mutation (createCart) whose checkoutUrl we open.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ShopifySettings } from '@/lib/content/types';
import {
  createCart,
  type Product,
  type ProductImage,
  type Variant,
} from '@/lib/shopify';

interface CartLine {
  variantId: string;
  title: string;
  size: string;
  amount: number;
  currency: string;
  image: string;
  qty: number;
}

/* ---- helpers, ported from the prototype ---- */
const money = (amount: string | number, currency?: string): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(typeof amount === 'string' ? parseFloat(amount) : amount);

const galleryImgs = (p: Product): ProductImage[] =>
  p.images?.nodes?.length
    ? p.images.nodes
    : p.featuredImage
      ? [p.featuredImage]
      : [];

const sizeLabel = (v: Variant): string =>
  (v.selectedOptions &&
    (v.selectedOptions.find((o) => /size/i.test(o.name)) || ({} as { value?: string }))
      .value) ||
  v.title;

const firstAvail = (vs: Variant[]): number => {
  const k = vs.findIndex((v) => v.availableForSale);
  return k < 0 ? 0 : k;
};

const CART_KEY = 'wendlo_cart';

export interface StoreIslandProps {
  shopify: ShopifySettings;
  /** Normalized products from the server (live Shopify, or demo fallback). */
  products: Product[];
}

export function StoreIsland({ shopify, products }: StoreIslandProps) {
  // shopify connection is reserved for future per-band overrides; the live
  // fetch + checkout default to the public token in lib/shopify.
  void shopify;

  /* ---- cart state (persisted to localStorage, like the prototype) ---- */
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (raw) setCart(JSON.parse(raw) as CartLine[]);
    } catch {
      /* ignore malformed cart */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      /* storage may be full/blocked */
    }
  }, [cart]);

  const cartCount = useMemo(() => cart.reduce((n, l) => n + l.qty, 0), [cart]);
  const cartSubtotal = useMemo(
    () => cart.reduce((s, l) => s + l.amount * l.qty, 0),
    [cart],
  );

  const addToCart = useCallback((product: Product, variant: Variant | undefined) => {
    // Re-check availability at add-time (prototype guards on the variant only;
    // stock may have flipped since render).
    if (!variant || !variant.availableForSale) return;
    setCart((prev) => {
      const line: CartLine = {
        variantId: variant.id,
        title: product.title,
        size: product.variants.nodes.length > 1 ? sizeLabel(variant) : '',
        amount: parseFloat(variant.price.amount),
        currency: variant.price.currencyCode,
        image: galleryImgs(product)[0]?.url || '',
        qty: 1,
      };
      const ex = prev.find((l) => l.variantId === line.variantId);
      if (ex) {
        return prev.map((l) =>
          l.variantId === line.variantId ? { ...l, qty: l.qty + 1 } : l,
        );
      }
      return [...prev, line];
    });
    setCartOpen(true);
  }, []);

  const setQty = useCallback((variantId: string, qty: number) => {
    setCart((prev) =>
      qty <= 0
        ? prev.filter((l) => l.variantId !== variantId)
        : prev.map((l) => (l.variantId === variantId ? { ...l, qty } : l)),
    );
  }, []);

  const checkout = useCallback(async () => {
    if (!cart.length || checkingOut) return;
    setCheckingOut(true);
    try {
      const url = await createCart(
        cart.map((l) => ({ merchandiseId: l.variantId, quantity: l.qty })),
      );
      window.open(url, '_blank');
    } catch (err) {
      console.error('[cart]', err);
      alert(
        'Checkout error: ' + (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setCheckingOut(false);
    }
  }, [cart, checkingOut]);

  /* ---- lightbox state ---- */
  const [gal, setGal] = useState<{ idx: number; i: number; vi: number } | null>(null);
  const galProduct = gal ? products[gal.idx] : null;
  const galImgs = galProduct ? galleryImgs(galProduct) : [];

  const openGallery = useCallback(
    (idx: number) => {
      const p = products[idx];
      if (!p) return;
      if (!galleryImgs(p).length) return;
      setGal({ idx, i: 0, vi: firstAvail(p.variants.nodes) });
    },
    [products],
  );
  const closeGallery = useCallback(() => setGal(null), []);
  const galStep = useCallback(
    (d: number) =>
      setGal((g) =>
        g && galImgs.length
          ? { ...g, i: (g.i + d + galImgs.length) % galImgs.length }
          : g,
      ),
    [galImgs.length],
  );

  useEffect(() => {
    if (!gal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') galStep(-1);
      else if (e.key === 'ArrowRight') galStep(1);
      else if (e.key === 'Escape') closeGallery();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gal, galStep, closeGallery]);

  return (
    <>
      <div className="store-embed" id="store">
        {products.map((p, i) => (
          <ProductCard key={p.id} product={p} onOpen={() => openGallery(i)} />
        ))}
      </div>

      {/* product gallery lightbox */}
      <div
        className={`pgal${gal ? ' open' : ''}`}
        id="pgal"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeGallery();
        }}
      >
        {gal && galProduct && (
          <Lightbox
            product={galProduct}
            imgs={galImgs}
            i={gal.i}
            vi={gal.vi}
            onClose={closeGallery}
            onStep={galStep}
            onDot={(k) => setGal((g) => (g ? { ...g, i: k } : g))}
            onSize={(k) => setGal((g) => (g ? { ...g, vi: k } : g))}
            onAdd={(variant) => {
              addToCart(galProduct, variant);
              closeGallery();
            }}
          />
        )}
      </div>

      {/* cart */}
      <button className="cartbtn" id="cartBtn" onClick={() => setCartOpen(true)}>
        <i className="ti ti-shopping-bag" /> Bag{' '}
        <span
          className="cnt"
          id="cartCnt"
          style={{ display: cartCount ? 'grid' : 'none' }}
        >
          {cartCount}
        </span>
      </button>
      <div
        className={`cartov${cartOpen ? ' open' : ''}`}
        id="cartOv"
        onClick={() => setCartOpen(false)}
      />
      <aside className={`cartdrawer${cartOpen ? ' open' : ''}`} id="cartDrawer">
        <header>
          <h3>Your bag</h3>
          <button
            className="cx"
            id="cartClose"
            aria-label="Close"
            onClick={() => setCartOpen(false)}
          >
            &times;
          </button>
        </header>
        <div className="cartitems" id="cartItems">
          {cart.length ? (
            cart.map((l) => (
              <div className="cartline" key={l.variantId}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l.image} alt={l.title} />
                <div className="cl-info">
                  <b>{l.title}</b>
                  {l.size ? <span className="cl-sz">Size {l.size}</span> : null}
                  <div className="cl-pr">{money(l.amount, l.currency)}</div>
                  <div className="cl-qty">
                    <button onClick={() => setQty(l.variantId, l.qty - 1)}>
                      &minus;
                    </button>
                    <span>{l.qty}</span>
                    <button onClick={() => setQty(l.variantId, l.qty + 1)}>+</button>
                  </div>
                </div>
                <button className="cl-rm" onClick={() => setQty(l.variantId, 0)}>
                  Remove
                </button>
              </div>
            ))
          ) : (
            <div className="cartempty">Your bag is empty.</div>
          )}
        </div>
        <div className="cartfoot">
          <div className="sub">
            <span>Subtotal</span>
            <span id="cartSub">{money(cartSubtotal, cart[0]?.currency)}</span>
          </div>
          <button
            className="co"
            id="cartCheckout"
            disabled={!cart.length || checkingOut}
            onClick={checkout}
          >
            {checkingOut ? '…' : 'Checkout'}
          </button>
        </div>
      </aside>
    </>
  );
}

/* ---- product card: whole card opens lightbox; hover-scrub is pointer-only -- */
function ProductCard({
  product,
  onOpen,
}: {
  product: Product;
  onOpen: () => void;
}) {
  const imgs = galleryImgs(product);
  const [active, setActive] = useState(0);
  const mediaRef = useRef<HTMLDivElement>(null);

  const price = money(
    product.priceRange.minVariantPrice.amount,
    product.priceRange.minVariantPrice.currencyCode,
  );

  // pointer-only hover-scrub through the image set (enhancement)
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    if (imgs.length < 2 || !mediaRef.current) return;
    const r = mediaRef.current.getBoundingClientRect();
    const idx = Math.max(
      0,
      Math.min(imgs.length - 1, Math.floor(((e.clientX - r.left) / r.width) * imgs.length)),
    );
    setActive(idx);
  };
  const onLeave = () => setActive(0);

  return (
    <div
      className="prod"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div
        className="media"
        ref={mediaRef}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
      >
        {imgs.length ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="media-img" src={imgs[active].url} alt={product.title} />
        ) : (
          <div className="noimg">
            <i className="ti ti-shirt" />
          </div>
        )}
        {imgs.length > 1 && (
          <div className="segs">
            {imgs.map((_, k) => (
              <span key={k} className={k === active ? 'on' : ''} />
            ))}
          </div>
        )}
      </div>
      <div className="info">
        <b>{product.title}</b>
        <span className="price">{price}</span>
        <CardAction product={product} onOpen={onOpen} />
      </div>
    </div>
  );
}

/* card CTA: "Sold out" | "Choose size" (multi-variant) | "Add to cart" (single) */
function CardAction({
  product,
  onOpen,
}: {
  product: Product;
  onOpen: () => void;
}) {
  if (!product.availableForSale) {
    return <span className="soldout">Sold out</span>;
  }
  const vs = product.variants.nodes;
  if (vs.length > 1) {
    return (
      <button
        className="buy"
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
      >
        Choose size
      </button>
    );
  }
  return (
    <button
      className="buy"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      Add to cart
    </button>
  );
}

/* ---- lightbox contents ---- */
function Lightbox({
  product,
  imgs,
  i,
  vi,
  onClose,
  onStep,
  onDot,
  onSize,
  onAdd,
}: {
  product: Product;
  imgs: ProductImage[];
  i: number;
  vi: number;
  onClose: () => void;
  onStep: (d: number) => void;
  onDot: (k: number) => void;
  onSize: (k: number) => void;
  onAdd: (v: Variant) => void;
}) {
  const vs = product.variants.nodes;
  const sel = vs[vi];
  const inStock = !!sel?.availableForSale;
  const price = money(
    product.priceRange.minVariantPrice.amount,
    product.priceRange.minVariantPrice.currencyCode,
  );

  return (
    <div className="pgal-inner">
      <button className="pgal-x" id="pgalX" aria-label="Close" onClick={onClose}>
        &times;
      </button>
      <div className="pgal-stage">
        <button
          className="pgal-nav pgal-prev"
          id="pgalPrev"
          aria-label="Previous"
          onClick={() => onStep(-1)}
        >
          &#8249;
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img id="pgalImg" src={imgs[i].url} alt={product.title} />
        <button
          className="pgal-nav pgal-next"
          id="pgalNext"
          aria-label="Next"
          onClick={() => onStep(1)}
        >
          &#8250;
        </button>
      </div>
      <div className="pgal-dots" id="pgalDots">
        {imgs.map((_, k) => (
          <span key={k} className={k === i ? 'on' : ''} onClick={() => onDot(k)} />
        ))}
      </div>
      <div className="pgal-meta">
        <h3 id="pgalTitle">{product.title}</h3>
        <span className="price" id="pgalPrice">
          {price}
        </span>
        <div className="pgal-sizes" id="pgalSizes">
          {vs.length > 1
            ? vs.map((v, k) => (
                <button
                  key={v.id}
                  className={`pgal-size ${k === vi ? 'on' : ''}`}
                  disabled={!v.availableForSale}
                  onClick={() => onSize(k)}
                >
                  {sizeLabel(v)}
                </button>
              ))
            : null}
        </div>
        <div className={`pgal-stock ${inStock ? 'in' : 'out'}`} id="pgalStock">
          {inStock ? 'In stock' : 'Sold out'}
        </div>
        <div id="pgalBuy">
          {inStock ? (
            <button className="buy" onClick={() => onAdd(sel)}>
              Add to cart
            </button>
          ) : (
            <button className="buy" disabled>
              Sold out
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
