import emailjs from '@emailjs/browser';

export type PaidOrderLine = { id: string; name: string; price: number };

export type PaidOrderNotifyPayload = {
  orderId: string;
  stripeSessionId: string;
  customerName: string;
  customerEmail: string;
  addressLine1: string;
  addressUnit: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  items: PaidOrderLine[];
  subtotal: number;
  estimatedTax: number;
  cartTotal: number;
  /** Stripe Checkout totals in smallest currency unit (e.g. cents for USD). */
  stripeAmountTotal: number;
  stripeAmountTax: number;
  currency: string;
  stripeLivemode: boolean;
};

const ZERO_DECIMAL = new Set([
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

function stripeMinorToMajor(minor: number, currency: string): number {
  const c = (currency || 'usd').toLowerCase();
  if (ZERO_DECIMAL.has(c)) return minor;
  return minor / 100;
}

const formatMoney = (amount: number, currency: string) => {
  const cur = (currency || 'usd').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${cur}`;
  }
};

export function buildPaidOrderPlainText(p: PaidOrderNotifyPayload): string {
  const lines: string[] = [
    'New paid order (MaxBit checkout)',
    '',
    `Order ID: ${p.orderId}`,
    `Stripe session: ${p.stripeSessionId}`,
    `Stripe mode: ${p.stripeLivemode ? 'live' : 'test'}`,
    '',
    'Customer',
    `  Name: ${p.customerName}`,
    `  Email: ${p.customerEmail}`,
    '',
    'Shipping address',
    `  ${p.addressLine1}${p.addressUnit ? `, ${p.addressUnit}` : ''}`,
    `  ${p.city}, ${p.state} ${p.zip}`,
    `  ${p.country}`,
    '',
    'Items',
  ];
  for (const it of p.items) {
    lines.push(`  — ${it.name}  (${it.id})  ${formatMoney(it.price, p.currency)}`);
  }
  lines.push(
    '',
    'Totals (cart at checkout)',
    `  Subtotal: ${formatMoney(p.subtotal, p.currency)}`,
    `  Estimated tax: ${formatMoney(p.estimatedTax, p.currency)}`,
    `  Total: ${formatMoney(p.cartTotal, p.currency)}`,
    '',
    'Stripe charge',
    `  Amount total: ${formatMoney(stripeMinorToMajor(p.stripeAmountTotal, p.currency), p.currency)}`,
    `  Amount tax (Stripe): ${formatMoney(stripeMinorToMajor(p.stripeAmountTax, p.currency), p.currency)}`,
    ''
  );
  return lines.join('\n');
}

async function sendViaEmailJs(p: PaidOrderNotifyPayload, templateId: string): Promise<void> {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID?.trim() || 'service_2bhrbcn';
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY?.trim() || 'ewqLULf0b6_PZy8W5';
  const order_body = buildPaidOrderPlainText(p);
  await emailjs.send(
    serviceId,
    templateId,
    {
      order_id: p.orderId,
      order_body,
      customer_email: p.customerEmail,
      reply_to: p.customerEmail,
    },
    publicKey
  );
}

async function sendViaHttp(p: PaidOrderNotifyPayload, url: string, secret: string): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) headers['X-Maxbit-Order-Notify-Secret'] = secret;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...p, order_body: buildPaidOrderPlainText(p) }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Order notify HTTP ${res.status}: ${t.slice(0, 200)}`);
  }
}

/**
 * Notifies the store (info@maxbitcore.com) after Stripe marks the session paid.
 * Configure either EmailJS template (VITE_EMAILJS_TEMPLATE_ORDER_PAID) or HTTP POST (VITE_ORDER_NOTIFY_URL).
 */
export async function notifyShopOwnerOfPaidOrder(p: PaidOrderNotifyPayload): Promise<void> {
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ORDER_PAID?.trim();
  if (templateId) {
    await sendViaEmailJs(p, templateId);
    return;
  }

  const urlOff =
    typeof import.meta.env.VITE_ORDER_NOTIFY_URL === 'string' &&
    import.meta.env.VITE_ORDER_NOTIFY_URL.trim().toLowerCase() === 'off';
  if (urlOff) {
    console.warn(
      '[orderNotify] VITE_ORDER_NOTIFY_URL is "off" and no EmailJS template — skipping store email.'
    );
    return;
  }

  const url =
    import.meta.env.VITE_ORDER_NOTIFY_URL?.trim() ||
    'https://www.maxbitcore.com/api/notify-order-paid.php';
  const secret = import.meta.env.VITE_ORDER_NOTIFY_SECRET?.trim() || '';
  await sendViaHttp(p, url, secret);
}
