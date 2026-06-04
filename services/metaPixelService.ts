/**
 * Meta (Facebook) Pixel — catalog match (ViewContent, AddToCart, Purchase) + checkout URL helpers.
 * Set VITE_META_PIXEL_ID in .env before build.
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

let initialized = false;

export function getMetaPixelId(): string {
  return PIXEL_ID;
}

export function isMetaPixelEnabled(): boolean {
  return PIXEL_ID.length > 0;
}

/** Load fbevents.js once and send PageView. */
export function initMetaPixel(): void {
  if (typeof window === 'undefined' || !PIXEL_ID || initialized) return;
  initialized = true;

  const w = window;
  if (!w.fbq) {
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
  }

  w.fbq!('init', PIXEL_ID);
  w.fbq!('track', 'PageView');
}

function safeTrack(event: string, params?: Record<string, unknown>): void {
  if (!PIXEL_ID || typeof window === 'undefined' || !window.fbq) return;
  try {
    if (params) window.fbq('track', event, params);
    else window.fbq('track', event);
  } catch (e) {
    console.warn('Meta Pixel track failed:', e);
  }
}

export function trackMetaViewContent(product: {
  id: string;
  name?: string;
  price?: number;
}): void {
  safeTrack('ViewContent', {
    content_ids: [String(product.id)],
    content_name: product.name,
    content_type: 'product',
    value: Number(product.price) || 0,
    currency: 'USD',
  });
}

export function trackMetaAddToCart(product: {
  id: string;
  name?: string;
  price?: number;
}): void {
  safeTrack('AddToCart', {
    content_ids: [String(product.id)],
    content_name: product.name,
    content_type: 'product',
    value: Number(product.price) || 0,
    currency: 'USD',
  });
}

export function trackMetaPurchase(opts: {
  contentIds: string[];
  value: number;
  currency?: string;
  orderId?: string;
}): void {
  const ids = opts.contentIds.map(String).filter(Boolean);
  if (!ids.length) return;
  safeTrack('Purchase', {
    content_ids: ids,
    content_type: 'product',
    value: opts.value,
    currency: (opts.currency || 'USD').toUpperCase(),
    num_items: ids.length,
    ...(opts.orderId ? { order_id: opts.orderId } : {}),
  });
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
