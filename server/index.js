require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const stripeSecret = process.env.STRIPE_SECRET_KEY;
/** Pin API version so Checkout line_items shape stays consistent (see Stripe “migrating prices”). */
const stripeApiVersion = process.env.STRIPE_API_VERSION || '2024-06-20';
const stripe = stripeSecret ? require('stripe')(stripeSecret, { apiVersion: stripeApiVersion }) : null;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const serialPool = require('./serialPool');

const app = express();
app.set('trust proxy', 1);

/** Strip trailing slash so CLIENT_URL=https://site.com/ matches browser Origin. */
const normalizeOrigin = (o) => String(o || '').trim().replace(/\/+$/, '');
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);
try {
  console.log('[maxbit-stripe] CORS allowed origins:', allowedOrigins.join(', ') || '(none)');
} catch {
  /* ignore */
}

app.disable('x-powered-by');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cleanText = (value = '') => String(value).replace(/<[^>]*>?/gm, '').trim();

/** Stripe Checkout Session metadata: each value ≤500 chars — split comma-separated product ids across keys. */
const STRIPE_SESSION_META_VALUE_MAX = 500;
const packProductIdsStripeMetadata = (items) => {
  const ids = [];
  for (const item of items || []) {
    const id = cleanText(String(item.id || '')).slice(0, 120);
    if (id) ids.push(id);
  }
  const uniq = [...new Set(ids)];
  if (!uniq.length) return {};
  const meta = {};
  let chunk = [];
  let chunkLen = 0;
  let idx = 0;
  const flush = () => {
    if (!chunk.length) return;
    const key = idx === 0 ? 'maxbit_product_ids' : `maxbit_product_ids_${idx}`;
    meta[key] = chunk.join(',').slice(0, STRIPE_SESSION_META_VALUE_MAX);
    idx += 1;
    chunk = [];
    chunkLen = 0;
  };
  for (const id of uniq) {
    const need = chunk.length ? 1 + id.length : id.length;
    if (chunkLen + need > STRIPE_SESSION_META_VALUE_MAX && chunk.length) flush();
    chunk.push(id);
    chunkLen += need;
  }
  flush();
  return meta;
};
const safeImageUrl = (value = '') => {
  const url = String(value || '').trim();
  return /^https?:\/\//i.test(url) ? url : undefined;
};

const DATA_DIR = path.join(__dirname, 'data');
const PAYMENTS_FILE = path.join(DATA_DIR, 'stripe-payments.json');
/** Persisted shop orders (Stripe-paid rows for admin UI). */
const SHOP_ORDERS_FILE = path.join(DATA_DIR, 'order.json');
const LEGACY_SHOP_ORDERS_FILE = path.join(DATA_DIR, 'shop-orders.json');

const ZERO_DECIMAL_CURRENCIES = new Set([
  'bif',
  'clp',
  'djf',
  'gnf',
  'jpy',
  'kmf',
  'krw',
  'mga',
  'pyg',
  'rwf',
  'ugx',
  'vnd',
  'vuv',
  'xaf',
  'xof',
  'xpf',
]);

const stripeMinorToMajorUnits = (minor, currency) => {
  const c = String(currency || 'usd').toLowerCase();
  const n = Number(minor) || 0;
  if (ZERO_DECIMAL_CURRENCIES.has(c)) return n;
  return n / 100;
};

const ensureShopOrdersStore = () => {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SHOP_ORDERS_FILE)) {
    if (fs.existsSync(LEGACY_SHOP_ORDERS_FILE)) {
      try {
        fs.renameSync(LEGACY_SHOP_ORDERS_FILE, SHOP_ORDERS_FILE);
      } catch (e) {
        fs.copyFileSync(LEGACY_SHOP_ORDERS_FILE, SHOP_ORDERS_FILE);
      }
    } else {
      fs.writeFileSync(SHOP_ORDERS_FILE, JSON.stringify({ orders: {} }, null, 2));
    }
  }
};

const readShopOrdersStore = () => {
  ensureShopOrdersStore();
  try {
    const raw = fs.readFileSync(SHOP_ORDERS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      orders: typeof parsed.orders === 'object' && parsed.orders ? parsed.orders : {},
    };
  } catch (e) {
    return { orders: {} };
  }
};

const writeShopOrdersStore = (store) => {
  ensureShopOrdersStore();
  fs.writeFileSync(SHOP_ORDERS_FILE, JSON.stringify(store, null, 2));
};

/**
 * Persist a paid checkout session for the admin orders UI (line items, totals, fulfillment status).
 * Preserves fulfillmentStatus and paidAt when the client re-polls payment-status.
 */
const upsertShopOrderFromPaidSession = (session, opts = {}) => {
  if (!session) return null;
  const fromMeta = cleanText((session.metadata && session.metadata.orderId) || '');
  const orderId = fromMeta || cleanText(opts.orderId || '');
  if (!orderId) return null;

  const store = readShopOrdersStore();
  const existing = store.orders[orderId] || {};

  const email = String(
    (session.customer_details && session.customer_details.email) || session.customer_email || ''
  )
    .trim()
    .toLowerCase();

  const totalDetails = session.total_details || {};
  const amountTaxMinor = Number((totalDetails && totalDetails.amount_tax) || 0);
  const amountTotalMinor = Number(session.amount_total || 0);
  const currency = session.currency || 'usd';

  const nextLineItems = [];
  const liData = session.line_items && session.line_items.data;
  if (Array.isArray(liData)) {
    for (const line of liData) {
      const qty = Math.max(1, Number(line.quantity) || 1);
      const product =
        line.price && typeof line.price === 'object' && line.price.product && typeof line.price.product === 'object'
          ? line.price.product
          : null;
      const name =
        cleanText(line.description || (product && product.name) || 'Item').slice(0, 200) || 'Item';
      const totalMinor = Number(line.amount_total || 0);
      const unitMajor = stripeMinorToMajorUnits(totalMinor / qty, currency);
      const id = (line.id && String(line.id).slice(0, 80)) || `line-${nextLineItems.length}`;
      const images = product && product.images;
      const imageUrl = Array.isArray(images) && images[0] ? safeImageUrl(images[0]) : undefined;
      const metaPid =
        product && product.metadata
          ? product.metadata.maxbit_product_id || product.metadata.maxbitProductId
          : null;
      const maxbitProductId = metaPid ? cleanText(String(metaPid)).slice(0, 120) : '';
      const entry = { id, name, priceMajor: unitMajor, quantity: qty };
      if (imageUrl) entry.imageUrl = imageUrl;
      if (maxbitProductId) entry.productId = maxbitProductId;
      nextLineItems.push(entry);
    }
  }

  const mergedLineItems =
    nextLineItems.length > 0 ? nextLineItems : Array.isArray(existing.lineItems) ? existing.lineItems : [];

  const taxMajor = stripeMinorToMajorUnits(amountTaxMinor, currency);
  const totalMajor = stripeMinorToMajorUnits(amountTotalMinor, currency);
  const subtotalMajor = Math.max(0, totalMajor - taxMajor);

  const receiptUrl =
    opts.receiptUrl !== undefined ? opts.receiptUrl : existing.receiptUrl !== undefined ? existing.receiptUrl : null;

  const paidAt = existing.paidAt || new Date().toISOString();
  const fulfillmentStatus = existing.fulfillmentStatus || 'Processing';

  store.orders[orderId] = {
    ...existing,
    id: orderId,
    orderNumber: orderId,
    customerEmail: email || existing.customerEmail || null,
    stripeSessionId: session.id,
    paidAt,
    currency,
    amountTotalMinor,
    amountTaxMinor,
    subtotalMajor,
    taxMajor,
    totalMajor,
    lineItems: mergedLineItems,
    fulfillmentStatus,
    paymentStatus: 'paid',
    receiptUrl,
    ...(opts.serialAllocations !== undefined
      ? { serialAllocations: opts.serialAllocations }
      : {}),
    updatedAt: new Date().toISOString(),
  };

  writeShopOrdersStore(store);
  return store.orders[orderId];
};

const collectMaxbitProductIdsFromPaidSession = (session) => {
  const ids = [];
  const metaObj = session && session.metadata && typeof session.metadata === 'object' ? session.metadata : {};
  for (const [key, rawVal] of Object.entries(metaObj)) {
    if (key !== 'maxbit_product_ids' && !/^maxbit_product_ids_\d+$/.test(key)) continue;
    const metaRaw = typeof rawVal === 'string' ? rawVal : '';
    if (!metaRaw.trim()) continue;
    for (const part of metaRaw.split(',')) {
      const id = cleanText(String(part || '')).slice(0, 120);
      if (id) ids.push(id);
    }
  }
  const liData = session && session.line_items && session.line_items.data;
  if (Array.isArray(liData)) {
    for (const line of liData) {
      const product =
        line.price && typeof line.price === 'object' && line.price.product && typeof line.price.product === 'object'
          ? line.price.product
          : null;
      if (!product || !product.metadata) continue;
      const raw = product.metadata.maxbit_product_id || product.metadata.maxbitProductId;
      const id = cleanText(String(raw || '')).slice(0, 120);
      if (id) ids.push(id);
    }
  }
  return [...new Set(ids)];
};

/**
 * If session.line_items were empty or products not expanded, Stripe still returns IDs via listLineItems.
 */
const collectMaxbitProductIdsWithLineItemsFallback = async (session) => {
  let ids = collectMaxbitProductIdsFromPaidSession(session);
  if (ids.length > 0 || !stripe || !session || !session.id) return ids;
  try {
    const listed = await stripe.checkout.sessions.listLineItems(session.id, {
      limit: 100,
      expand: ['data.price.product'],
    });
    const merged = {
      ...session,
      metadata: session.metadata || {},
      line_items: { data: listed.data || [] },
    };
    ids = collectMaxbitProductIdsFromPaidSession(merged);
  } catch (e) {
    console.warn('listLineItems for mark-sold:', e.message || e);
  }
  return ids;
};

/** Product ids from serial-pool rows at payment — same strings as `products.json` `id` when pool reserved SNs. */
const collectProductIdsFromSerialAllocations = (allocations) => {
  if (!Array.isArray(allocations)) return [];
  const out = [];
  const seen = new Set();
  for (const row of allocations) {
    if (!row || typeof row !== 'object') continue;
    const id = cleanText(String(row.productId || '')).slice(0, 120);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
};

/** Stripe metadata / line items + serial pool (fallback when Stripe omits maxbit ids). */
const mergeMarkSoldProductIds = async (session, serialAllocations) => {
  const fromStripe = await collectMaxbitProductIdsWithLineItemsFallback(session);
  const fromPool = collectProductIdsFromSerialAllocations(serialAllocations);
  const seen = new Set();
  const merged = [];
  for (const id of [...fromStripe, ...fromPool]) {
    const t = cleanText(String(id || '')).slice(0, 120);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    merged.push(t);
  }
  return merged;
};

const DEFAULT_MARK_PRODUCTS_SOLD_URL = 'https://www.maxbitcore.com/api/mark-products-sold.php';

/** Try www and non-www — Node on same host sometimes resolves only one variant. */
const markSoldUrlVariants = (urlStr) => {
  const out = [];
  const s = String(urlStr || '').trim();
  if (s) out.push(s);
  try {
    const u = new URL(s || DEFAULT_MARK_PRODUCTS_SOLD_URL);
    const host = u.hostname;
    const alt = host.startsWith('www.') ? host.slice(4) : `www.${host}`;
    const clone = new URL(u.href);
    clone.hostname = alt;
    out.push(clone.href);
  } catch {
    /* ignore */
  }
  return [...new Set(out.filter(Boolean))];
};

const postMarkProductsSold = async (productIds) => {
  const secret = String(process.env.MARK_PRODUCTS_SOLD_SECRET || '').trim();
  const configured = String(process.env.MARK_PRODUCTS_SOLD_URL || '').trim();
  if (!secret) {
    console.warn('mark-products-sold: skipped — set MARK_PRODUCTS_SOLD_SECRET in server/.env');
    return;
  }
  if (!Array.isArray(productIds) || productIds.length === 0) {
    console.warn(
      'mark-products-sold: skipped — no product IDs (check Stripe metadata maxbit_product_ids* after deploy)'
    );
    return;
  }
  const urlQueue = [
    ...new Set([
      ...markSoldUrlVariants(configured),
      ...markSoldUrlVariants(DEFAULT_MARK_PRODUCTS_SOLD_URL),
    ]),
  ];
  let lastNote = '';
  for (const url of urlQueue) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Maxbit-Mark-Products-Sold-Secret': secret,
        },
        body: JSON.stringify({ productIds }),
      });
      const text = await r.text();
      if (!r.ok) {
        lastNote = `HTTP ${r.status} ${text.slice(0, 300)}`;
        console.warn('[mark-products-sold]', url, lastNote);
        continue;
      }
      try {
        const j = JSON.parse(text);
        console.log(
          '[mark-products-sold] ok',
          j.updated,
          'product(s) → Sold Out via',
          url,
          'ids:',
          Array.isArray(j.ids) ? j.ids.join(',') : productIds.join(',')
        );
        if (j.updated === 0 && Array.isArray(j.ids) && j.ids.length) {
          console.warn(
            'mark-products-sold: 0 rows in products.json — id mismatch (cart id vs products.json `id`):',
            j.ids.join(', ')
          );
        }
      } catch {
        console.log('[mark-products-sold] ok (non-JSON body)', url);
      }
      return;
    } catch (e) {
      lastNote = e.message || String(e);
      console.warn('[mark-products-sold] fetch failed', url, lastNote);
    }
  }
  console.warn('[mark-products-sold] all URLs failed — last:', lastNote);
};

const DEFAULT_ORDER_NOTIFY_PAID_URL = 'https://www.maxbitcore.com/api/notify-order-paid.php';

const formatMoneyNotify = (amountMajor, currency) => {
  const cur = String(currency || 'usd').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(amountMajor);
  } catch {
    return `${Number(amountMajor).toFixed(2)} ${cur}`;
  }
};

const buildShopOrderBodyFromStripeSession = (session) => {
  const orderId = cleanText((session.metadata && session.metadata.orderId) || '');
  const sid = session.id || '';
  const live = session.livemode ? 'live' : 'test';
  const email = String(
    (session.customer_details && session.customer_details.email) || session.customer_email || ''
  )
    .trim()
    .toLowerCase();
  const name = String((session.customer_details && session.customer_details.name) || '').trim() || '—';
  const lines = [];
  lines.push(
    'New paid order (MaxBit checkout)',
    '',
    `Order ID: ${orderId}`,
    `Stripe session: ${sid}`,
    `Stripe mode: ${live}`,
    '',
    'Customer',
    `  Name: ${name}`,
    `  Email: ${email}`,
    ''
  );
  const addr = session.customer_details && session.customer_details.address;
  if (addr && typeof addr === 'object') {
    const line1 = [addr.line1, addr.line2].filter(Boolean).join(', ');
    const csz = [addr.city, addr.state, addr.postal_code].filter(Boolean).join(' ');
    lines.push('Shipping address', `  ${line1}`, `  ${csz}`, `  ${addr.country || ''}`, '');
  }
  lines.push('Items');
  const liData = session.line_items && session.line_items.data;
  const cur = session.currency || 'usd';
  if (Array.isArray(liData)) {
    for (const line of liData) {
      const qty = Math.max(1, Number(line.quantity) || 1);
      const desc = cleanText(line.description || 'Item').slice(0, 220);
      const totalMinor = Number(line.amount_total || 0);
      const unitMajor = stripeMinorToMajorUnits(totalMinor / qty, cur);
      lines.push(`  — ${desc}  (${qty}×)  ${formatMoneyNotify(unitMajor, cur)} ea`);
    }
  }
  const td = session.total_details || {};
  const taxMajor = stripeMinorToMajorUnits(Number(td.amount_tax || 0), cur);
  const totalMajor = stripeMinorToMajorUnits(Number(session.amount_total || 0), cur);
  lines.push(
    '',
    'Totals at checkout',
    `Amount tax: ${formatMoneyNotify(taxMajor, cur)}`,
    `Amount total: ${formatMoneyNotify(totalMajor, cur)}`,
    ''
  );
  return lines.join('\n');
};

const buildCustomerOrderBodyFromStripeSession = (session) => {
  const orderId = cleanText((session.metadata && session.metadata.orderId) || '');
  const email = String(
    (session.customer_details && session.customer_details.email) || session.customer_email || ''
  )
    .trim()
    .toLowerCase();
  const name = String((session.customer_details && session.customer_details.name) || '').trim() || 'Customer';
  const lines = ['Order confirmed (MaxBit)', '', `Order ID: ${orderId}`, '', 'Customer', `  Name: ${name}`, `  Email: ${email}`, ''];
  const addr = session.customer_details && session.customer_details.address;
  if (addr && typeof addr === 'object') {
    const line1 = [addr.line1, addr.line2].filter(Boolean).join(', ');
    const csz = [addr.city, addr.state, addr.postal_code].filter(Boolean).join(' ');
    lines.push('Shipping address', `  ${line1}`, `  ${csz}`, `  ${addr.country || ''}`, '');
  }
  lines.push('Items');
  const liData = session.line_items && session.line_items.data;
  const cur = session.currency || 'usd';
  if (Array.isArray(liData)) {
    for (const line of liData) {
      const qty = Math.max(1, Number(line.quantity) || 1);
      const desc = cleanText(line.description || 'Item').slice(0, 220);
      const totalMinor = Number(line.amount_total || 0);
      const unitMajor = stripeMinorToMajorUnits(totalMinor / qty, cur);
      lines.push(`  — ${desc}  (${qty}×)  ${formatMoneyNotify(unitMajor, cur)} ea`);
    }
  }
  const td = session.total_details || {};
  const taxMajor = stripeMinorToMajorUnits(Number(td.amount_tax || 0), cur);
  const totalMajor = stripeMinorToMajorUnits(Number(session.amount_total || 0), cur);
  lines.push(
    '',
    'Totals at checkout',
    `Amount tax: ${formatMoneyNotify(taxMajor, cur)}`,
    `Amount total: ${formatMoneyNotify(totalMajor, cur)}`,
    ''
  );
  return lines.join('\n');
};

/** Backup path when the browser never POSTs notify-order-paid.php (tab closed). Set ORDER_NOTIFY_FROM_WEBHOOK=false to disable. */
const postPaidOrderNotifyFromWebhookSession = async (session) => {
  if (String(process.env.ORDER_NOTIFY_FROM_WEBHOOK || '').trim().toLowerCase() === 'false') {
    return;
  }
  const secret = String(process.env.MAXBIT_ORDER_NOTIFY_SECRET || process.env.ORDER_NOTIFY_SECRET || '').trim();
  const baseUrl = String(process.env.ORDER_NOTIFY_PAID_URL || '').trim() || DEFAULT_ORDER_NOTIFY_PAID_URL;
  const urlQueue = [...new Set([...markSoldUrlVariants(baseUrl)])];

  const orderId = cleanText((session.metadata && session.metadata.orderId) || '');
  const customerEmail = String(
    (session.customer_details && session.customer_details.email) || session.customer_email || ''
  )
    .trim()
    .toLowerCase();
  if (!orderId || !customerEmail || !EMAIL_RE.test(customerEmail)) {
    console.warn('[order-notify-webhook] skip — missing orderId or customer email');
    return;
  }

  const shopBody = buildShopOrderBodyFromStripeSession(session);
  const custBody = buildCustomerOrderBodyFromStripeSession(session);
  const payload = {
    orderId,
    stripeSessionId: session.id,
    customerName: String((session.customer_details && session.customer_details.name) || '').trim() || 'Customer',
    customerEmail,
    order_body: shopBody,
    customer_order_body: custBody,
  };

  for (const url of urlQueue) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (secret) headers['X-Maxbit-Order-Notify-Secret'] = secret;
      const r = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const t = await r.text().catch(() => '');
      if (!r.ok) {
        console.warn('[order-notify-webhook]', url, r.status, t.slice(0, 400));
        continue;
      }
      console.log('[order-notify-webhook] ok', orderId, 'via', url);
      return;
    } catch (e) {
      console.warn('[order-notify-webhook] fetch failed', url, e.message || e);
    }
  }
  console.warn('[order-notify-webhook] all notify URLs failed for', orderId);
};

const adminOrdersSecret = process.env.ADMIN_ORDERS_SECRET;

const requireAdminOrders = (req, res, next) => {
  if (!adminOrdersSecret || !String(adminOrdersSecret).trim()) {
    return res.status(503).json({ error: 'Admin orders API is not configured (ADMIN_ORDERS_SECRET).' });
  }
  const sent = req.headers['x-maxbit-admin-orders-secret'];
  if (sent !== adminOrdersSecret) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  return next();
};

const ensurePaymentsStore = () => {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(PAYMENTS_FILE)) {
    fs.writeFileSync(PAYMENTS_FILE, JSON.stringify({ processedEvents: [], paidOrders: {} }, null, 2));
  }
};

const readPaymentsStore = () => {
  ensurePaymentsStore();
  try {
    const raw = fs.readFileSync(PAYMENTS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      processedEvents: Array.isArray(parsed.processedEvents) ? parsed.processedEvents : [],
      paidOrders: typeof parsed.paidOrders === 'object' && parsed.paidOrders ? parsed.paidOrders : {},
    };
  } catch (e) {
    return { processedEvents: [], paidOrders: {} };
  }
};

const writePaymentsStore = (store) => {
  ensurePaymentsStore();
  fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(store, null, 2));
};

const formatStripeCaughtError = (error) => {
  if (!error) return 'Failed to create checkout session.';
  if (typeof error.message === 'string' && error.message.trim()) return error.message.trim();
  if (error.raw && typeof error.raw.message === 'string') return error.raw.message.trim();
  if (typeof error.detail === 'string') return error.detail.trim();
  return 'Failed to create checkout session.';
};

/** Stripe Invoice `custom_fields`: max 4 pairs; label/value length caps (API). */
const STRIPE_INV_CF_MAX = 4;
const STRIPE_INV_CF_NAME_MAX = 40;
const STRIPE_INV_CF_VALUE_MAX = 140;

const parseInvoiceCustomFieldsInput = (input) => {
  if (input == null || input === '') return [];
  if (typeof input === 'string') {
    try {
      const j = JSON.parse(input);
      return Array.isArray(j) ? j : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(input) ? input : [];
};

/**
 * Body fields first (per-checkout), then env JSON. Skips duplicate names (case-insensitive). Max 4 rows.
 */
const buildStripeInvoiceCustomFields = (bodyRaw, envRaw) => {
  const rows = [...parseInvoiceCustomFieldsInput(bodyRaw), ...parseInvoiceCustomFieldsInput(envRaw)];
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const name = cleanText(String(row.name ?? row.label ?? '')).slice(0, STRIPE_INV_CF_NAME_MAX);
    const value = cleanText(String(row.value ?? row.val ?? '')).slice(0, STRIPE_INV_CF_VALUE_MAX);
    if (!name || !value) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, value });
    if (out.length >= STRIPE_INV_CF_MAX) break;
  }
  return out.length ? out : undefined;
};

/** Max length for optional `price_data.product_data.description` (shop copy — never used for serial numbers). */
const STRIPE_PRODUCT_DESC_MAX = 999;

/**
 * Stripe rejects legacy top-level line_items.{amount,currency,name,description,images}.
 * Emit only { price, quantity } or { price_data: { currency, unit_amount, product_data }, quantity }.
 */
const sanitizeCheckoutLineItemsForStripe = (raw) => {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const line of raw) {
    const qty = Math.max(1, Math.min(99, Number(line.quantity) || 1));
    if (line.price && typeof line.price === 'string' && /^price_[a-zA-Z0-9]+$/.test(line.price)) {
      out.push({ price: line.price, quantity: qty });
      continue;
    }
    const pdIn = line.price_data;
    if (!pdIn || typeof pdIn !== 'object') {
      throw new Error('Each checkout line must include catalog price id or price_data.');
    }
    const currency = String(pdIn.currency || 'usd')
      .toLowerCase()
      .slice(0, 3);
    const unitAmount = Number(pdIn.unit_amount);
    if (!Number.isFinite(unitAmount)) {
      throw new Error('Invalid price_data.unit_amount.');
    }
    const pr = pdIn.product_data && typeof pdIn.product_data === 'object' ? pdIn.product_data : {};
    const name = cleanText(String(pr.name || 'Item')).slice(0, 120) || 'Item';
    const product_data = { name };
    const desc = cleanText(String(pr.description || '')).slice(0, STRIPE_PRODUCT_DESC_MAX);
    if (desc) product_data.description = desc;
    const imgs = Array.isArray(pr.images)
      ? pr.images
          .map((u) => String(u || '').trim())
          .filter((u) => /^https?:\/\//i.test(u))
          .slice(0, 8)
      : [];
    if (imgs.length) product_data.images = imgs;
    if (pr.metadata && typeof pr.metadata === 'object' && Object.keys(pr.metadata).length) {
      product_data.metadata = pr.metadata;
    }
    out.push({
      quantity: qty,
      price_data: {
        currency,
        unit_amount: Math.round(unitAmount),
        product_data,
      },
    });
  }
  return out;
};

/** Pool-generated serial rows first (invoice), then body/env custom fields. Max 4 total. */
const mergeInvoiceCustomFieldsWithSerials = (bodyRaw, envRaw, serialFieldRows) => {
  const serial =
    Array.isArray(serialFieldRows) && serialFieldRows.length
      ? serialFieldRows
          .map((row) => ({
            name: cleanText(String(row.name || '')).slice(0, STRIPE_INV_CF_NAME_MAX),
            value: cleanText(String(row.value || '')).slice(0, STRIPE_INV_CF_VALUE_MAX),
          }))
          .filter((row) => row.name && row.value)
      : [];
  const base = buildStripeInvoiceCustomFields(bodyRaw, envRaw) || [];
  const merged = [...serial, ...base];
  if (!merged.length) return undefined;
  return merged.slice(0, STRIPE_INV_CF_MAX);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Peek allocated serials then commit reservation (paid). Returns items or undefined. */
async function takeSerialAllocationsFromSession(session) {
  const rid = session.metadata && session.metadata.serialReservationId;
  if (!rid) return undefined;
  const peek = serialPool.peekReservation(rid);
  const items = peek && Array.isArray(peek.items) && peek.items.length ? peek.items : undefined;
  await serialPool.commitReservation(rid);
  return items;
}

/**
 * Receipt URL comes from Charge.receipt_url or Invoice.hosted_invoice_url — not from Checkout Session directly.
 * Stripe may leave receipt_url empty for some methods, or fill it slightly after success; we retry charge.retrieve.
 * ACH / bank debits often have no hosted receipt in the API the same way as cards.
 */
async function resolveChargeReceiptUrlFromCheckoutSession(session) {
  if (!stripe || !session) return null;

  const invRaw = session.invoice;
  if (invRaw && typeof invRaw === 'object' && invRaw.hosted_invoice_url) {
    return invRaw.hosted_invoice_url;
  }
  if (typeof invRaw === 'string' && invRaw.startsWith('in_')) {
    try {
      const inv = await stripe.invoices.retrieve(invRaw);
      if (inv.hosted_invoice_url) return inv.hosted_invoice_url;
      if (inv.invoice_pdf && /^https:\/\//i.test(inv.invoice_pdf)) return inv.invoice_pdf;
    } catch (e) {
      console.warn('invoice retrieve for receipt URL:', e.message || e);
    }
  }

  let pi = session.payment_intent;
  if (!pi) return null;
  if (typeof pi === 'string' && pi) {
    const piId = pi;
    try {
      pi = await stripe.paymentIntents.retrieve(piId, { expand: ['latest_charge', 'charges.data'] });
    } catch (e) {
      console.warn('paymentIntents.retrieve (charges.data expand):', e.message || e);
      try {
        pi = await stripe.paymentIntents.retrieve(piId, { expand: ['latest_charge'] });
      } catch (e2) {
        console.warn('paymentIntents.retrieve for receipt:', e2.message || e2);
        return null;
      }
    }
  }
  if (!pi || typeof pi !== 'object') return null;

  const fromCharge = (ch) => (ch && typeof ch === 'object' && ch.receipt_url ? ch.receipt_url : null);

  const tryChargeWithRetries = async (chargeId) => {
    if (typeof chargeId !== 'string' || !chargeId.startsWith('ch_')) return null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await sleep(650);
      try {
        const ch = await stripe.charges.retrieve(chargeId);
        if (ch.receipt_url) return ch.receipt_url;
      } catch (e) {
        console.warn('charges.retrieve for receipt_url:', e.message || e);
        return null;
      }
    }
    return null;
  };

  const lc = pi.latest_charge;
  const u1 = fromCharge(lc);
  if (u1) return u1;
  if (typeof lc === 'string' && lc) {
    const u = await tryChargeWithRetries(lc);
    if (u) return u;
  }

  const chargeList = pi.charges && pi.charges.data;
  if (Array.isArray(chargeList)) {
    let retriedOne = false;
    for (const ch of chargeList) {
      const u = fromCharge(ch);
      if (u) return u;
      if (!retriedOne && ch && ch.id) {
        retriedOne = true;
        const u2 = await tryChargeWithRetries(ch.id);
        if (u2) return u2;
      }
    }
  }

  if (typeof pi.id === 'string' && pi.id.startsWith('pi_')) {
    try {
      const listed = await stripe.charges.list({ payment_intent: pi.id, limit: 5 });
      let retriedOne = false;
      for (const ch of listed.data || []) {
        const u = fromCharge(ch);
        if (u) return u;
        if (!retriedOne && ch && ch.id) {
          retriedOne = true;
          const u2 = await tryChargeWithRetries(ch.id);
          if (u2) return u2;
        }
      }
    } catch (e) {
      console.warn('charges.list for receipt_url:', e.message || e);
    }
  }

  return null;
}

// Stripe webhook must use raw body for signature verification.
const webhookHandler = async (req, res) => {
  if (!stripe || !webhookSecret) {
    return res.status(500).send('Webhook is not configured.');
  }

  const signature = req.headers['stripe-signature'];
  if (!signature) {
    return res.status(400).send('Missing stripe-signature header.');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error.message);
    return res.status(400).send('Invalid webhook signature.');
  }

  const store = readPaymentsStore();
  if (store.processedEvents.includes(event.id)) {
    return res.status(200).json({ received: true, duplicate: true });
  }

  if (event.type === 'checkout.session.expired') {
    const sessionObj = event.data.object;
    const rid = sessionObj.metadata && sessionObj.metadata.serialReservationId;
    if (rid) {
      try {
        await serialPool.releaseReservation(rid);
      } catch (e) {
        console.warn('serial pool release (checkout.session.expired):', e.message || e);
      }
    }
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderId = cleanText((session && session.metadata && session.metadata.orderId) || '');
    const email = String(
      (session && session.customer_details && session.customer_details.email) ||
      (session && session.customer_email) ||
      ''
    ).trim().toLowerCase();

    if (!orderId) {
      console.error('checkout.session.completed without orderId metadata', { sessionId: session && session.id });
    } else {
      store.paidOrders[orderId] = {
        paid: true,
        paidAt: new Date().toISOString(),
        stripeSessionId: session.id,
        paymentIntentId: session.payment_intent || null,
        amountTotal: session.amount_total || 0,
        currency: session.currency || 'usd',
        customerEmail: email || null,
      };
      console.log(`Stripe payment confirmed for order ${orderId}`);
      if (session.id) {
        try {
          const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
            expand: ['line_items.data.price.product', 'payment_intent.latest_charge', 'invoice'],
          });
          let receiptUrl = null;
          try {
            receiptUrl = await resolveChargeReceiptUrlFromCheckoutSession(fullSession);
          } catch (e) {
            console.warn('receipt URL in webhook:', e.message || e);
          }
          let serialAllocations = null;
          try {
            serialAllocations = await takeSerialAllocationsFromSession(fullSession);
          } catch (se) {
            console.warn('serial reservation (webhook):', se.message || se);
          }
          upsertShopOrderFromPaidSession(fullSession, { receiptUrl, serialAllocations });
          try {
            const ids = await mergeMarkSoldProductIds(fullSession, serialAllocations);
            await postMarkProductsSold(ids);
          } catch (e) {
            console.warn('mark products sold (webhook):', e.message || e);
          }
          try {
            await postPaidOrderNotifyFromWebhookSession(fullSession);
          } catch (e) {
            console.warn('order notify webhook:', e.message || e);
          }
        } catch (e) {
          console.warn('shop order upsert (webhook):', e.message || e);
        }
      }
    }
  }

  store.processedEvents.push(event.id);
  if (store.processedEvents.length > 10000) {
    store.processedEvents = store.processedEvents.slice(-5000);
  }
  writePaymentsStore(store);

  return res.status(200).json({ received: true });
};

['/stripe/webhook', '/server/stripe/webhook'].forEach((p) => {
  app.post(p, express.raw({ type: 'application/json' }), webhookHandler);
});

// Never pass Error into cors callback — Express treats it as an unhandled error → HTML 500.
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const n = normalizeOrigin(origin);
      if (allowedOrigins.includes(n)) return callback(null, true);
      console.warn('CORS blocked Origin:', origin, 'normalized:', n, 'allowed:', allowedOrigins.join(', ') || '(none)');
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);
app.use(express.json({ limit: '100kb' }));

const checkoutSessionLimiter = rateLimit({
  windowMs: Number(process.env.CHECKOUT_RATE_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.CHECKOUT_RATE_MAX || 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many checkout attempts. Try again later.' },
});

/** Public: merge Stripe fulfillment into customer dashboard (email + known order ids only). */
const customerOrdersLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.CUSTOMER_ORDER_LOOKUP_MAX || 120),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again later.' },
});

/** Resolve order row key: exact id or case-insensitive (Stripe metadata orderId casing varies). */
const resolveShopOrderStoreKey = (store, requestedId) => {
  const q = cleanText(String(requestedId || '')).slice(0, 120);
  if (!q) return null;
  const orders = store && store.orders ? store.orders : {};
  if (orders[q]) return q;
  const ql = q.toLowerCase();
  for (const k of Object.keys(orders)) {
    if (String(k).toLowerCase() === ql) return k;
  }
  return null;
};

/** Stripe Checkout Session id — unguessable; safe to match without email (login vs checkout email mismatch). */
const STRIPE_CHECKOUT_SESSION_ID_RE = /^cs_(live|test)_[A-Za-z0-9]+$/;

/** PHP get-orders often uses a different id than Node store key — match by email + orderNumber / Stripe session. */
const resolveCustomerOrderForEmail = (store, email, requestedId) => {
  const ordersMap = store.orders || {};
  const resolvedKey = resolveShopOrderStoreKey(store, requestedId);
  if (resolvedKey) {
    const o = ordersMap[resolvedKey];
    if (o) {
      const cust = String(o.customerEmail || '').trim().toLowerCase();
      /** Stripe checkout email may differ from login email — empty record still matched by id below. */
      if (!cust || cust === email) return { resolvedKey, o };
    }
  }
  let q = cleanText(String(requestedId || '')).slice(0, 120);
  let ql = q.toLowerCase().replace(/^order\s+/i, '').trim();
  if (!ql) return null;

  /** Match by Stripe session id before email-filtered scans (those skip rows when cust !== email). */
  if (STRIPE_CHECKOUT_SESSION_ID_RE.test(q)) {
    const qsid = q.trim().toLowerCase();
    for (const [k, o] of Object.entries(ordersMap)) {
      const sid = String(o.stripeSessionId || '').trim().toLowerCase();
      if (sid && sid === qsid) return { resolvedKey: k, o };
    }
  }

  /** Exact order id / store key match — login email may differ from Stripe customer_details.email on the same order. */
  const exactKey = resolveShopOrderStoreKey(store, requestedId);
  if (exactKey && ordersMap[exactKey]) {
    const o = ordersMap[exactKey];
    const ids = [exactKey, o.id, o.orderNumber].filter(Boolean).map((x) => String(x).toLowerCase());
    if (ids.some((id) => id === ql)) return { resolvedKey: exactKey, o };
  }

  for (const [k, o] of Object.entries(ordersMap)) {
    const cust = String(o.customerEmail || '').trim().toLowerCase();
    if (cust && cust !== email) continue;
    const hay = [k, o.id, o.orderNumber, o.stripeSessionId]
      .filter(Boolean)
      .map((x) => String(x).toLowerCase());
    if (hay.some((h) => h === ql)) return { resolvedKey: k, o };
  }
  /** Loose match: prefixes / minor spelling differences between PHP id and metadata orderId (long ids only). */
  for (const [k, o] of Object.entries(ordersMap)) {
    const cust = String(o.customerEmail || '').trim().toLowerCase();
    if (cust && cust !== email) continue;
    const candidates = [k, o.id, o.orderNumber, o.stripeSessionId].filter(Boolean).map((x) => String(x));
    for (const c of candidates) {
      const cl = c.toLowerCase();
      if (cl === ql) return { resolvedKey: k, o };
      if (ql.length >= 10 && cl.length >= 10 && (cl.includes(ql) || ql.includes(cl))) {
        return { resolvedKey: k, o };
      }
    }
  }
  return null;
};

const assignFulfillmentMatchAliases = (matches, payload, aliases) => {
  const added = new Set();
  for (const raw of aliases) {
    const a = cleanText(String(raw || '')).slice(0, 120);
    if (!a || added.has(a)) continue;
    added.add(a);
    matches[a] = payload;
    const lo = a.toLowerCase();
    if (lo && lo !== a && !matches[lo]) matches[lo] = payload;
  }
};

const customerOrdersLookupHandler = (req, res) => {
  try {
    const email = cleanText(String((req.body && req.body.email) || '')).toLowerCase();
    const rawIds = req.body && req.body.orderIds;
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Invalid email.' });
    }
    const orderIds = Array.isArray(rawIds) ? rawIds : [];
    const ids = [
      ...new Set(
        orderIds.map((x) => cleanText(String(x || '')).slice(0, 120)).filter(Boolean)
      ),
    ].slice(0, 128);
    if (!ids.length) {
      return res.json({ matches: {} });
    }
    const store = readShopOrdersStore();
    const matches = {};
    for (const oid of ids) {
      const hit = resolveCustomerOrderForEmail(store, email, oid);
      if (!hit) continue;
      const { resolvedKey, o } = hit;
      const payload = {
        fulfillmentStatus: cleanText(String(o.fulfillmentStatus || 'Processing')),
      };
      assignFulfillmentMatchAliases(matches, payload, [
        oid,
        resolvedKey,
        o.id,
        o.orderNumber,
        o.stripeSessionId,
      ]);
    }
    return res.json({ matches });
  } catch (e) {
    console.error('customer-orders-lookup:', e);
    return res.status(500).json({ error: 'Lookup failed.' });
  }
};

['/public/customer-orders-lookup', '/server/public/customer-orders-lookup'].forEach((path) => {
  app.post(path, customerOrdersLookupLimiter, customerOrdersLookupHandler);
});

const createCheckoutSession = async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe is not configured.' });
    }

    const { items, email, shipping, orderId, invoiceCustomFields, invoice_custom_fields } = req.body;
    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
      return res.status(400).json({ error: 'Invalid items payload.' });
    }
    if (!EMAIL_RE.test(String(email || ''))) {
      return res.status(400).json({ error: 'Invalid customer email.' });
    }

    const normalizedShipping = Number(shipping);
    if (!Number.isFinite(normalizedShipping) || normalizedShipping < 0 || normalizedShipping > 100000) {
      return res.status(400).json({ error: 'Invalid shipping amount.' });
    }

    const safeOrderId = cleanText(orderId || '');
    if (!safeOrderId || safeOrderId.length > 100) {
      return res.status(400).json({ error: 'Invalid order identifier.' });
    }

    /** Stripe Checkout line item: catalog Price id (`price_...`) or dynamic `price_data` (legacy). */
    const STRIPE_PRICE_ID_RE = /^price_[a-zA-Z0-9]+$/;
    const line_items = [];

    for (const item of items) {
      const rawPriceId = cleanText(String(item.stripePriceId || item.stripe_price_id || '')).trim();
      if (rawPriceId) {
        if (!STRIPE_PRICE_ID_RE.test(rawPriceId)) {
          return res.status(400).json({
            error:
              'Invalid Stripe Price id. Use the Price id from Stripe Dashboard (starts with price_).',
          });
        }
        line_items.push({ price: rawPriceId, quantity: 1 });
        continue;
      }

      const maxbitId = cleanText(String(item.id || '')).slice(0, 120);
      const product_data = {
        name: cleanText(item.name).slice(0, 120) || 'MaxBit Item',
        images: safeImageUrl(item.imageUrl) ? [safeImageUrl(item.imageUrl)] : [],
        ...(maxbitId ? { metadata: { maxbit_product_id: maxbitId } } : {}),
      };
      line_items.push({
        price_data: {
          currency: 'usd',
          product_data,
          unit_amount: Math.round(Number(item.price) * 100),
        },
        quantity: 1,
      });
    }

    const dynamicLines = line_items.filter((line) => line.price_data);
    if (
      dynamicLines.some(
        (line) =>
          !Number.isFinite(line.price_data.unit_amount) || line.price_data.unit_amount <= 0
      )
    ) {
      return res.status(400).json({ error: 'Invalid item pricing.' });
    }

    if (normalizedShipping > 0) {
      line_items.push({
        price_data: {
          currency: 'usd',
          product_data: { name: 'Shipping & Handling' },
          unit_amount: Math.round(normalizedShipping * 100),
        },
        quantity: 1,
      });
    }
    await serialPool.expireStaleReservations();

    let serialReserve = null;
    try {
      serialReserve = await serialPool.reserveForCheckout({
        orderId: safeOrderId,
        items,
        strict:
          String(process.env.SERIAL_POOL_STRICT || '')
            .trim()
            .toLowerCase() === 'true',
      });
    } catch (poolErr) {
      return res.status(409).json({
        error: poolErr.message || 'Serial pool error.',
      });
    }

    /** Serials never go into line item description (visible in Checkout before pay). With invoices on, they merge into Invoice custom_fields (PDF/hosted invoice after payment); fulfillment still uses reservation + webhook. */
    const invoiceCreationEnabled =
      String(process.env.STRIPE_CHECKOUT_INVOICE || '').trim().toLowerCase() !== 'false';
    const useCfSerials =
      invoiceCreationEnabled &&
      serialReserve &&
      Array.isArray(serialReserve.customFields) &&
      serialReserve.customFields.length > 0;

    /** After successful payment, Stripe generates a real Invoice (PDF + hosted page). Set STRIPE_CHECKOUT_INVOICE=false to disable. */
    const invoiceCustomFieldsMerged = mergeInvoiceCustomFieldsWithSerials(
      invoiceCustomFields ?? invoice_custom_fields,
      process.env.STRIPE_INVOICE_CUSTOM_FIELDS,
      useCfSerials ? serialReserve.customFields : null
    );
    const checkoutInvoiceCreation =
      String(process.env.STRIPE_CHECKOUT_INVOICE || '')
        .trim()
        .toLowerCase() === 'false'
        ? null
        : {
            enabled: true,
            invoice_data: {
              description: (
                process.env.STRIPE_INVOICE_DESCRIPTION ||
                `MaxBit order ${safeOrderId}`
              ).slice(0, 500),
              ...(process.env.STRIPE_INVOICE_FOOTER
                ? { footer: String(process.env.STRIPE_INVOICE_FOOTER).slice(0, 5000) }
                : {}),
              metadata: {
                orderId: safeOrderId.slice(0, 500),
              },
              ...(invoiceCustomFieldsMerged ? { custom_fields: invoiceCustomFieldsMerged } : {}),
            },
          };

    let safeLineItems;
    try {
      safeLineItems = sanitizeCheckoutLineItemsForStripe(line_items);
    } catch (sanitizeErr) {
      if (serialReserve && serialReserve.reservationId) {
        try {
          await serialPool.releaseReservation(serialReserve.reservationId);
        } catch (rele) {
          console.warn('serial pool rollback after line_items sanitize:', rele.message || rele);
        }
      }
      return res.status(400).json({ error: sanitizeErr.message || 'Invalid checkout line items.' });
    }

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: safeLineItems,
        mode: 'payment',
        customer_email: String(email).trim().toLowerCase(),
        payment_intent_data: {
          receipt_email: String(email).trim().toLowerCase(),
        },
        billing_address_collection: 'required',
        ...(checkoutInvoiceCreation ? { invoice_creation: checkoutInvoiceCreation } : {}),
        // Stripe Tax must be enabled in Dashboard + origin address; otherwise sessions.create fails.
        ...(process.env.STRIPE_AUTOMATIC_TAX === 'true' ? { automatic_tax: { enabled: true } } : {}),
        success_url: `${allowedOrigins[0]}/checkout?success=true&session_id={CHECKOUT_SESSION_ID}&orderId=${encodeURIComponent(safeOrderId)}`,
        cancel_url: `${allowedOrigins[0]}/checkout`,
        metadata: {
          orderId: safeOrderId,
          ...packProductIdsStripeMetadata(items),
          ...(serialReserve && serialReserve.reservationId
            ? { serialReservationId: serialReserve.reservationId }
            : {}),
        },
      });
    } catch (stripeCreateErr) {
      if (serialReserve && serialReserve.reservationId) {
        try {
          await serialPool.releaseReservation(serialReserve.reservationId);
        } catch (rele) {
          console.warn('serial pool rollback after Stripe session error:', rele.message || rele);
        }
      }
      throw stripeCreateErr;
    }

    if (serialReserve && serialReserve.reservationId) {
      try {
        await serialPool.bindSession(serialReserve.reservationId, session.id);
      } catch (bindErr) {
        console.warn('serial pool bindSession:', bindErr.message || bindErr);
      }
    }

    let checkoutUrl = session.url || null;
    if (!checkoutUrl && session.id) {
      try {
        const refreshed = await stripe.checkout.sessions.retrieve(session.id);
        checkoutUrl = refreshed && refreshed.url ? refreshed.url : null;
      } catch (retrieveError) {
        console.error('Stripe session retrieve failed:', retrieveError);
      }
    }

    if (!checkoutUrl) {
      return res.status(500).json({
        error: 'Stripe did not return a checkout URL. Verify account mode/API version and restart server.',
      });
    }

    res.json({ id: session.id, url: checkoutUrl });
  } catch (error) {
    console.error('Stripe Error:', error);
    res.status(500).json({ error: formatStripeCaughtError(error) });
  }
};

const paymentStatusHandler = async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe is not configured.' });
    }
    const sessionId = cleanText((req.query && req.query.session_id) || '');
    if (!sessionId || !sessionId.startsWith('cs_')) {
      return res.status(400).json({ error: 'Missing or invalid session_id.' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items.data.price.product', 'payment_intent.latest_charge', 'invoice'],
    });
    const metaOrderId = cleanText((session.metadata && session.metadata.orderId) || '');
    const queryOrderId = cleanText((req.query && req.query.orderId) || '');
    if (queryOrderId && metaOrderId && queryOrderId !== metaOrderId) {
      return res.status(400).json({ error: 'Order does not match payment session.' });
    }

    const paymentStatus = session.payment_status || 'unpaid';
    const checkoutStatus = session.status || 'open';
    const paid = paymentStatus === 'paid';
    const totalDetails = session.total_details || {};
    const orderId = metaOrderId || queryOrderId || null;

    if (orderId && paid) {
      const email = String(
        (session.customer_details && session.customer_details.email) || session.customer_email || ''
      )
        .trim()
        .toLowerCase();
      const store = readPaymentsStore();
      store.paidOrders[orderId] = {
        paid: true,
        paidAt: new Date().toISOString(),
        stripeSessionId: session.id,
        paymentIntentId: session.payment_intent || null,
        amountTotal: session.amount_total || 0,
        currency: session.currency || 'usd',
        customerEmail: email || null,
      };
      writePaymentsStore(store);
    }

    const sessionEmail =
      (session.customer_details && session.customer_details.email) ||
      session.customer_email ||
      null;

    let receiptUrl = null;
    if (paid) {
      receiptUrl = await resolveChargeReceiptUrlFromCheckoutSession(session);
      if (orderId) {
        let serialAllocations = undefined;
        try {
          if (session.metadata && session.metadata.serialReservationId) {
            try {
              serialAllocations = await takeSerialAllocationsFromSession(session);
            } catch (se) {
              console.warn('serial reservation (payment-status):', se.message || se);
            }
          }
          upsertShopOrderFromPaidSession(session, { receiptUrl, orderId, serialAllocations });
        } catch (e) {
          console.warn('shop order upsert (payment-status):', e.message || e);
        }
        try {
          const ids = await mergeMarkSoldProductIds(session, serialAllocations);
          await postMarkProductsSold(ids);
        } catch (e) {
          console.warn('mark products sold (payment-status):', e.message || e);
        }
      }
    }

    return res.json({
      paid,
      paymentStatus,
      checkoutStatus,
      orderId,
      email: sessionEmail,
      amountTotal: Number(session.amount_total || 0),
      amountTax: Number((totalDetails && totalDetails.amount_tax) || 0),
      currency: session.currency || 'usd',
      livemode: !!session.livemode,
      receiptUrl,
    });
  } catch (error) {
    console.error('payment-status:', error);
    return res.status(500).json({ error: formatStripeCaughtError(error) });
  }
};

['/create-checkout-session', '/server/create-checkout-session'].forEach((routePath) => {
  app.post(routePath, checkoutSessionLimiter, createCheckoutSession);
});

['/payment-status', '/server/payment-status'].forEach((routePath) => {
  app.get(routePath, paymentStatusHandler);
});

const serialPoolGetHandler = (req, res) => {
  try {
    return res.json(serialPool.getAdminSnapshot());
  } catch (e) {
    console.error('serial-pool GET:', e);
    return res.status(500).json({ error: 'Failed to read serial pool.' });
  }
};

const serialPoolPostHandler = async (req, res) => {
  try {
    const productId = cleanText((req.body && req.body.productId) || '');
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'bundle')) {
      const bundle = typeof req.body.bundle === 'string' ? req.body.bundle : String(req.body.bundle || '');
      const result = await serialPool.pushBundle(productId, bundle);
      return res.json(result);
    }
    const raw = req.body && req.body.serials;
    const arr = Array.isArray(raw)
      ? raw
      : typeof raw === 'string'
        ? raw.split(/[\r\n,]+/)
        : [];
    const cleaned = arr.map((s) => cleanText(String(s))).filter(Boolean);
    const result = await serialPool.pushSerials(productId, cleaned);
    return res.json(result);
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Import failed.' });
  }
};

['/serial-pool', '/server/serial-pool'].forEach((base) => {
  app.get(base, requireAdminOrders, serialPoolGetHandler);
  app.post(base, requireAdminOrders, serialPoolPostHandler);
});

const shopOrdersListHandler = (req, res) => {
  try {
    const store = readShopOrdersStore();
    const list = Object.values(store.orders).sort((a, b) => {
      const ta = new Date(a.paidAt || a.updatedAt || 0).getTime();
      const tb = new Date(b.paidAt || b.updatedAt || 0).getTime();
      return tb - ta;
    });
    return res.json(list);
  } catch (e) {
    console.error('shop-orders list:', e);
    return res.status(500).json({ error: 'Failed to load orders.' });
  }
};

async function notifyCustomerFulfillmentChange(prevRow, nextRow) {
  const prevStatus = cleanText(String(prevRow.fulfillmentStatus || 'Processing'));
  const newStatus = cleanText(String(nextRow.fulfillmentStatus || ''));
  if (!newStatus || prevStatus === newStatus) return;
  const to = String(nextRow.customerEmail || '')
    .trim()
    .toLowerCase();
  if (!to || !EMAIL_RE.test(to)) return;

  const notifySecret = cleanText(
    process.env.MAXBIT_ORDER_NOTIFY_SECRET || process.env.ORDER_NOTIFY_SECRET || ''
  );
  const notifyUrl = cleanText(
    process.env.FULFILLMENT_NOTIFY_URL ||
      'https://www.maxbitcore.com/api/notify-fulfillment-status.php'
  );
  if (!notifySecret) {
    console.warn('[fulfillment-email] MAXBIT_ORDER_NOTIFY_SECRET not set — skip customer email.');
    return;
  }
  const orderId = cleanText(String(nextRow.orderNumber || nextRow.id || ''));
  if (!orderId) return;

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 15000);
    const r = await fetch(notifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Maxbit-Order-Notify-Secret': notifySecret,
      },
      body: JSON.stringify({
        orderId,
        customerEmail: to,
        previousStatus: prevStatus,
        newStatus,
      }),
      signal: ac.signal,
    });
    clearTimeout(timer);
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      console.warn('[fulfillment-email] notify URL returned', r.status, txt.slice(0, 240));
    }
  } catch (e) {
    console.warn('[fulfillment-email]', e.message || e);
  }
}

const shopOrdersPatchHandler = async (req, res) => {
  const id = cleanText((req.params && req.params.id) || '');
  if (!id) return res.status(400).json({ error: 'Missing order id.' });
  const status = cleanText((req.body && req.body.fulfillmentStatus) || '');
  const allowed = ['Processing', 'Shipped', 'Delivered', 'Cancelled'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Invalid fulfillment status.' });
  }
  const store = readShopOrdersStore();
  if (!store.orders[id]) {
    console.warn(
      '[shop-orders PATCH] Order not in store:',
      id,
      'have keys:',
      Object.keys(store.orders || {}).length
    );
    return res.status(404).json({ error: 'Order not found.' });
  }
  const prevRow = { ...store.orders[id] };
  store.orders[id] = {
    ...store.orders[id],
    fulfillmentStatus: status,
    updatedAt: new Date().toISOString(),
  };
  writeShopOrdersStore(store);
  try {
    await notifyCustomerFulfillmentChange(prevRow, store.orders[id]);
  } catch (e) {
    console.warn('notifyCustomerFulfillmentChange:', e.message || e);
  }
  return res.json(store.orders[id]);
};

const shopOrdersDeleteHandler = (req, res) => {
  const id = cleanText((req.params && req.params.id) || '');
  if (!id) return res.status(400).json({ error: 'Missing order id.' });
  const store = readShopOrdersStore();
  if (!store.orders[id]) return res.status(404).json({ error: 'Order not found.' });
  delete store.orders[id];
  writeShopOrdersStore(store);
  return res.json({ ok: true });
};

['/shop-orders', '/server/shop-orders'].forEach((base) => {
  app.get(base, requireAdminOrders, shopOrdersListHandler);
  app.patch(`${base}/:id`, requireAdminOrders, shopOrdersPatchHandler);
  app.delete(`${base}/:id`, requireAdminOrders, shopOrdersDeleteHandler);
  /** POST aliases — many hosts return 501 for PATCH/DELETE before Node; POST is allowed. */
  app.post(`${base}/:id/fulfillment`, requireAdminOrders, shopOrdersPatchHandler);
  app.post(`${base}/:id/delete`, requireAdminOrders, shopOrdersDeleteHandler);
});
console.log('[maxbit-stripe] Shop orders API:', ['/shop-orders', '/server/shop-orders'].join(', '));

// cPanel + Passenger: often request path is /server/...; local dev is /...
const healthHandler = (req, res) => {
  res.json({ ok: true, service: 'maxbit-stripe' });
};
app.get('/healthz', healthHandler);
app.get('/server/healthz', healthHandler);

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (res.headersSent) return next(err);
  const status = typeof err.status === 'number' ? err.status : 500;
  res.status(status).json({ error: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log('[maxbit-stripe] Stripe API version:', stripeApiVersion);
  console.log('[maxbit-stripe] ADMIN_ORDERS_SECRET:', process.env.ADMIN_ORDERS_SECRET ? '(set)' : '(missing — /shop-orders returns 503)');
  console.log(
    '[maxbit-stripe] MARK_PRODUCTS_SOLD_SECRET:',
    String(process.env.MARK_PRODUCTS_SOLD_SECRET || '').trim()
      ? '(set — vitrine → Sold Out after pay)'
      : '(missing — sold PCs stay "In Stock" until you set secret + PHP mark-products-sold.php)'
  );
  const orderSecret = String(process.env.MAXBIT_ORDER_NOTIFY_SECRET || process.env.ORDER_NOTIFY_SECRET || '').trim();
  console.log(
    '[maxbit-stripe] Order emails (webhook → notify-order-paid.php):',
    String(process.env.ORDER_NOTIFY_FROM_WEBHOOK || '').trim().toLowerCase() === 'false'
      ? 'disabled (ORDER_NOTIFY_FROM_WEBHOOK=false)'
      : orderSecret
        ? 'webhook backup ON; secret (set) — must match PHP MAXBIT_ORDER_NOTIFY_SECRET'
        : 'webhook backup ON; secret (empty) — ok if PHP secret also empty; else POST returns 403'
  );
});