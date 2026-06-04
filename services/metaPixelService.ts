/**
 * Meta (Facebook) Pixel — catalog match (ViewContent, AddToCart, Purchase, InitiateCheckout).
 * Base snippet is injected into index.html at build time (vite.config.ts).
 */

declare global {
  interface Window {
    fbq?: FbqFn;
    _fbq?: FbqFn;
  }
}

type FbqFn = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  push?: FbqFn;
  loaded?: boolean;
  version?: string;
};

const PIXEL_ID = (import.meta.env.VITE_META_PIXEL_ID || '').trim();

export function getMetaPixelId(): string {
  return PIXEL_ID;
}

export function isMetaPixelEnabled(): boolean {
  return PIXEL_ID.length > 0;
}

/** Fallback bootstrap if index.html snippet missing (local dev). */
export function ensureMetaPixelLoaded(): void {
  if (typeof window === 'undefined' || !PIXEL_ID || window.fbq) return;

  const w = window;
  const n: FbqFn = function (...args: unknown[]) {
    if (n.callMethod) {
      n.callMethod.apply(n, args);
    } else {
      n.queue!.push(args);
    }
  };
  n.queue = [];
  n.loaded = true;
  n.version = '2.0';
  w.fbq = n;
  if (!w._fbq) w._fbq = n;

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  const first = document.getElementsByTagName('script')[0];
  first?.parentNode?.insertBefore(script, first);

  w.fbq!('init', PIXEL_ID);
  w.fbq!('track', 'PageView');
}

function safeTrack(event: string, params?: Record<string, unknown>): void {
  if (!PIXEL_ID || typeof window === 'undefined') return;
  ensureMetaPixelLoaded();
  if (!window.fbq) return;
  try {
    if (params) window.fbq('track', event, params);
    else window.fbq('track', event);
  } catch (e) {
    console.warn('Meta Pixel track failed:', e);
  }
}

function productEventParams(product: { id: string; name?: string; price?: number }) {
  const id = String(product.id);
  return {
    content_ids: [id],
    contents: [{ id, quantity: 1 }],
    content_name: product.name,
    content_type: 'product',
    value: Number(product.price) || 0,
    currency: 'USD',
  };
}

function purchaseEventParams(opts: {
  contentIds: string[];
  value: number;
  currency?: string;
  orderId?: string;
}) {
  const counts = new Map<string, number>();
  for (const raw of opts.contentIds) {
    const id = String(raw);
    if (!id) continue;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  const content_ids = [...counts.keys()];
  const contents = content_ids.map((id) => ({ id, quantity: counts.get(id) || 1 }));
  return {
    content_ids,
    contents,
    content_type: 'product',
    value: opts.value,
    currency: (opts.currency || 'USD').toUpperCase(),
    num_items: opts.contentIds.length,
    ...(opts.orderId ? { order_id: opts.orderId } : {}),
  };
}

export function trackMetaViewContent(product: {
  id: string;
  name?: string;
  price?: number;
}): void {
  safeTrack('ViewContent', productEventParams(product));
}

export function trackMetaAddToCart(product: {
  id: string;
  name?: string;
  price?: number;
}): void {
  safeTrack('AddToCart', productEventParams(product));
}

export function trackMetaInitiateCheckout(items: {
  id: string;
  name?: string;
  price?: number;
}[]): void {
  const valid = items.filter((i) => i?.id);
  if (!valid.length) return;
  const contentIds = valid.map((i) => String(i.id));
  const value = valid.reduce((s, i) => s + (Number(i.price) || 0), 0);
  safeTrack(
    'InitiateCheckout',
    purchaseEventParams({ contentIds, value, currency: 'USD' })
  );
}

export function trackMetaPurchase(opts: {
  contentIds: string[];
  value: number;
  currency?: string;
  orderId?: string;
}): void {
  const ids = opts.contentIds.map(String).filter(Boolean);
  if (!ids.length) return;
  safeTrack('Purchase', purchaseEventParams({ ...opts, contentIds: ids }));
}

export type MetaCheckoutLine = { id: string; quantity: number };

/** Meta Commerce checkout URL: products=id:qty,id:qty (commas/colons may be URL-encoded). */
export function parseMetaCheckoutProducts(raw: string | null | undefined): MetaCheckoutLine[] {
  if (!raw || !String(raw).trim()) return [];
  const out: MetaCheckoutLine[] = [];
  for (const part of String(raw).split(',')) {
    const seg = part.trim();
    if (!seg) continue;
    const colon = seg.indexOf(':');
    const id = (colon >= 0 ? seg.slice(0, colon) : seg).trim();
    const qtyRaw = colon >= 0 ? seg.slice(colon + 1).trim() : '1';
    const parsed = parseInt(qtyRaw, 10);
    const quantity = Math.max(1, Math.min(99, Number.isFinite(parsed) ? parsed : 1));
    if (id) out.push({ id, quantity });
  }
  return out;
}
