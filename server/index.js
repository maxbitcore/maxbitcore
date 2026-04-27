require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? require('stripe')(stripeSecret) : null;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const app = express();
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable('x-powered-by');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cleanText = (value = '') => String(value).replace(/<[^>]*>?/gm, '').trim();
const safeImageUrl = (value = '') => {
  const url = String(value || '').trim();
  return /^https?:\/\//i.test(url) ? url : undefined;
};

const DATA_DIR = path.join(__dirname, 'data');
const PAYMENTS_FILE = path.join(DATA_DIR, 'stripe-payments.json');

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

// Stripe webhook must use raw body for signature verification.
const webhookHandler = (req, res) => {
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
    methods: ['GET', 'POST', 'OPTIONS'],
  })
);
app.use(express.json({ limit: '100kb' }));

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

    const line_items = items.map((item) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: cleanText(item.name).slice(0, 120) || 'MaxBit Item',
          images: safeImageUrl(item.imageUrl) ? [safeImageUrl(item.imageUrl)] : [],
        },
        unit_amount: Math.round(Number(item.price) * 100),
      },
      quantity: 1,
    }));

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
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      customer_email: String(email).trim().toLowerCase(),
      billing_address_collection: 'required',
      // Stripe Tax must be enabled in Dashboard + origin address; otherwise sessions.create fails.
      ...(process.env.STRIPE_AUTOMATIC_TAX === 'true' ? { automatic_tax: { enabled: true } } : {}),
      success_url: `${allowedOrigins[0]}/checkout?success=true&session_id={CHECKOUT_SESSION_ID}&orderId=${encodeURIComponent(safeOrderId)}`,
      cancel_url: `${allowedOrigins[0]}/checkout`,
      metadata: {
        orderId: safeOrderId,
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

['/create-checkout-session', '/server/create-checkout-session'].forEach((path) => {
  app.post(path, createCheckoutSession);
});

const paymentStatusHandler = async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe is not configured.' });
    }
    const sessionId = cleanText((req.query && req.query.session_id) || '');
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing session_id.' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const metadataOrderId = cleanText((session && session.metadata && session.metadata.orderId) || '');
    const queryOrderId = cleanText((req.query && req.query.orderId) || '');
    const orderId = metadataOrderId || queryOrderId;
    const paymentStatus = session.payment_status || 'unpaid';
    const checkoutStatus = session.status || 'open';
    const paid = paymentStatus === 'paid' || checkoutStatus === 'complete';
    const totalDetails = session.total_details || {};
    const amountTax = Number(totalDetails.amount_tax || 0);
    const amountShipping = Number(totalDetails.amount_shipping || 0);
    const amountSubtotal = Number(session.amount_subtotal || 0);
    const amountTotal = Number(session.amount_total || 0);

    if (orderId && paid) {
      const store = readPaymentsStore();
      store.paidOrders[orderId] = {
        paid: true,
        paidAt: new Date().toISOString(),
        stripeSessionId: session.id,
        paymentIntentId: session.payment_intent || null,
        amountSubtotal,
        amountTax,
        amountShipping,
        amountTotal,
        currency: session.currency || 'usd',
        customerEmail: session.customer_email || null,
      };
      writePaymentsStore(store);
    }

    return res.json({
      paid,
      livemode: !!session.livemode,
      paymentStatus: paymentStatus,
      checkoutStatus: checkoutStatus,
      orderId: orderId || null,
      email: session.customer_email || null,
      amountSubtotal,
      amountTax,
      amountShipping,
      amountTotal,
      currency: session.currency || 'usd',
    });
  } catch (error) {
    console.error('Payment status check failed:', error);
    return res.status(500).json({ error: formatStripeCaughtError(error) });
  }
};

['/payment-status', '/server/payment-status'].forEach((path) => {
  app.get(path, paymentStatusHandler);
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