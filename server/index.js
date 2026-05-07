require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? require('stripe')(stripeSecret) : null;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const app = express();
app.set('trust proxy', 1);
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable('x-powered-by');

/**
 * cPanel / Passenger mounts this app at https://host/server, so Express often sees
 * paths like /server/shop-orders while routes are registered as /shop-orders.
 * Strip the mount prefix once so a single route table works everywhere.
 */
app.use((req, _res, next) => {
  const raw = req.url || '/';
  if (!raw.startsWith('/server')) return next();
  let pathAndQuery = raw.slice('/server'.length);
  if (!pathAndQuery || pathAndQuery[0] === '?') {
    req.url = '/' + pathAndQuery;
    return next();
  }
  if (!pathAndQuery.startsWith('/')) pathAndQuery = `/${pathAndQuery}`;
  req.url = pathAndQuery;
  return next();
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cleanText = (value = '') => String(value).replace(/<[^>]*>?/gm, '').trim();
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
    updatedAt: new Date().toISOString(),
  };

  writeShopOrdersStore(store);
  return store.orders[orderId];
};

const collectMaxbitProductIdsFromPaidSession = (session) => {
  const ids = [];
  const metaRaw =
    session && session.metadata && typeof session.metadata.maxbit_product_ids === 'string'
      ? session.metadata.maxbit_product_ids
      : '';
  if (metaRaw.trim()) {
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

const postMarkProductsSold = async (productIds) => {
  const secret = String(process.env.MARK_PRODUCTS_SOLD_SECRET || '').trim();
  const url = String(process.env.MARK_PRODUCTS_SOLD_URL || '').trim() ||
    'https://www.maxbitcore.com/api/mark-products-sold.php';
  if (!secret) {
    console.warn('mark-products-sold: skipped — set MARK_PRODUCTS_SOLD_SECRET in server/.env');
    return;
  }
  if (!Array.isArray(productIds) || productIds.length === 0) {
    console.warn(
      'mark-products-sold: skipped — no product IDs (new checkouts store them on the session; redeploy Node and try a new payment)'
    );
    return;
  }
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
      console.warn('mark-products-sold: HTTP', r.status, text.slice(0, 500));
    } else {
      try {
        const j = JSON.parse(text);
        if (j.updated === 0 && Array.isArray(j.ids) && j.ids.length) {
          console.warn(
            'mark-products-sold: 0 rows updated — product id(s) not found in products.json:',
            j.ids.join(', ')
          );
        }
      } catch {
        /* ignore */
      }
    }
  } catch (e) {
    console.warn('mark-products-sold request failed:', e.message || e);
  }
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
          upsertShopOrderFromPaidSession(fullSession, { receiptUrl });
          try {
            const ids = await collectMaxbitProductIdsWithLineItemsFallback(fullSession);
            await postMarkProductsSold(ids);
          } catch (e) {
            console.warn('mark products sold (webhook):', e.message || e);
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
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      console.warn('CORS blocked Origin:', origin, 'allowed:', allowedOrigins.join(', ') || '(none)');
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

const createCheckoutSession = async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe is not configured.' });
    }

    const { items, email, shipping, orderId } = req.body;
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

    const line_items = items.map((item) => {
      const maxbitId = cleanText(String(item.id || '')).slice(0, 120);
      const product_data = {
        name: cleanText(item.name).slice(0, 120) || 'MaxBit Item',
        images: safeImageUrl(item.imageUrl) ? [safeImageUrl(item.imageUrl)] : [],
        ...(maxbitId ? { metadata: { maxbit_product_id: maxbitId } } : {}),
      };
      return {
        price_data: {
          currency: 'usd',
          product_data,
          unit_amount: Math.round(Number(item.price) * 100),
        },
        quantity: 1,
      };
    });

    if (line_items.some((line) => !Number.isFinite(line.price_data.unit_amount) || line.price_data.unit_amount <= 0)) {
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
    /** Redundant with product_data.metadata — Stripe sometimes omits product metadata on line_items; session meta is reliable. */
    const maxbitProductIdsMeta = items
      .map((item) => cleanText(String(item.id || '')).slice(0, 80))
      .filter(Boolean)
      .join(',')
      .slice(0, 500);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      customer_email: String(email).trim().toLowerCase(),
      payment_intent_data: {
        receipt_email: String(email).trim().toLowerCase(),
      },
      billing_address_collection: 'required',
      // Stripe Tax must be enabled in Dashboard + origin address; otherwise sessions.create fails.
      ...(process.env.STRIPE_AUTOMATIC_TAX === 'true' ? { automatic_tax: { enabled: true } } : {}),
      success_url: `${allowedOrigins[0]}/checkout?success=true&session_id={CHECKOUT_SESSION_ID}&orderId=${encodeURIComponent(safeOrderId)}`,
      cancel_url: `${allowedOrigins[0]}/checkout`,
      metadata: {
        orderId: safeOrderId,
        ...(maxbitProductIdsMeta ? { maxbit_product_ids: maxbitProductIdsMeta } : {}),
      },
    });

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
        try {
          upsertShopOrderFromPaidSession(session, { receiptUrl, orderId });
        } catch (e) {
          console.warn('shop order upsert (payment-status):', e.message || e);
        }
        try {
          const ids = await collectMaxbitProductIdsWithLineItemsFallback(session);
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

const shopOrdersPatchHandler = (req, res) => {
  const id = cleanText((req.params && req.params.id) || '');
  if (!id) return res.status(400).json({ error: 'Missing order id.' });
  const status = cleanText((req.body && req.body.fulfillmentStatus) || '');
  const allowed = ['Processing', 'Shipped', 'Delivered', 'Cancelled'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Invalid fulfillment status.' });
  }
  const store = readShopOrdersStore();
  if (!store.orders[id]) return res.status(404).json({ error: 'Order not found.' });
  store.orders[id] = {
    ...store.orders[id],
    fulfillmentStatus: status,
    updatedAt: new Date().toISOString(),
  };
  writeShopOrdersStore(store);
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
});

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
app.listen(PORT, () => console.log(`🚀 Server is running on port ${PORT}`));