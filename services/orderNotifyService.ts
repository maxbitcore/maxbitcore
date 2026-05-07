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

export function stripeMinorToMajor(minor: number, currency: string): number {
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

function buildOrderPlainText(p: PaidOrderNotifyPayload, variant: 'shop' | 'customer'): string {
  const header: string[] =
    variant === 'shop'
      ? [
          'New paid order (MaxBit checkout)',
          '',
          `Order ID: ${p.orderId}`,
          `Stripe session: ${p.stripeSessionId}`,
          `Stripe mode: ${p.stripeLivemode ? 'live' : 'test'}`,
          '',
        ]
      : ['Order confirmed (MaxBit)', '', `Order ID: ${p.orderId}`, ''];
  const lines: string[] = [
    ...header,
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
    'Totals at checkout',
    `Subtotal: ${formatMoney(p.subtotal, p.currency)}`,
    `Amount tax: ${formatMoney(stripeMinorToMajor(p.stripeAmountTax, p.currency), p.currency)} (со Stripe)`,
    `Amount total: ${formatMoney(stripeMinorToMajor(p.stripeAmountTotal, p.currency), p.currency)} (со Stripe)`,
    ''
  );
  return lines.join('\n');
}

/** Full text for the store inbox (includes Stripe session / mode). */
export function buildPaidOrderPlainText(p: PaidOrderNotifyPayload): string {
  return buildOrderPlainText(p, 'shop');
}

/** Customer-friendly text: same items and totals, no Stripe session or test/live line. */
export function buildCustomerOrderPlainText(p: PaidOrderNotifyPayload): string {
  return buildOrderPlainText(p, 'customer');
}

export type OrderNotifyResult = {
  shopNotified: boolean;
  /** From PHP notify-order-paid.php: second mail() to the customer */
  customerNotified: boolean | null;
};

async function sendViaHttp(p: PaidOrderNotifyPayload, url: string, secret: string): Promise<OrderNotifyResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) headers['X-Maxbit-Order-Notify-Secret'] = secret;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...p,
      order_body: buildPaidOrderPlainText(p),
      customer_order_body: buildCustomerOrderPlainText(p),
    }),
  });
  const t = await res.text().catch(() => '');
  let data: { ok?: boolean; customer_notified?: boolean; error?: string } = {};
  try {
    data = JSON.parse(t) as typeof data;
  } catch {
    /* non-JSON body */
  }
  if (!res.ok || data.ok === false) {
    const msg = typeof data.error === 'string' ? data.error : t.slice(0, 200);
    throw new Error(`Order notify HTTP ${res.status}: ${msg}`);
  }
  const customerNotified =
    typeof data.customer_notified === 'boolean' ? data.customer_notified : null;
  return { shopNotified: true, customerNotified };
}

/**
 * After Stripe marks the session paid: POST JSON to notify-order-paid.php.
 * The script sends two messages via PHP mail() (host SMTP / relay — e.g. to Gmail / Google Workspace):
 * 1) full details to info@maxbitcore.com
 * 2) confirmation to the customer email
 */
export async function notifyPaidOrderEmails(p: PaidOrderNotifyPayload): Promise<OrderNotifyResult> {
  const urlOff =
    typeof import.meta.env.VITE_ORDER_NOTIFY_URL === 'string' &&
    import.meta.env.VITE_ORDER_NOTIFY_URL.trim().toLowerCase() === 'off';
  if (urlOff) {
    console.warn('[orderNotify] VITE_ORDER_NOTIFY_URL is "off" — skipping order emails.');
    return { shopNotified: false, customerNotified: false };
  }

  const url =
    import.meta.env.VITE_ORDER_NOTIFY_URL?.trim() ||
    'https://www.maxbitcore.com/api/notify-order-paid.php';
  const secret = import.meta.env.VITE_ORDER_NOTIFY_SECRET?.trim() || '';
  return sendViaHttp(p, url, secret);
}

/** @deprecated Use notifyPaidOrderEmails */
export async function notifyShopOwnerOfPaidOrder(p: PaidOrderNotifyPayload): Promise<void> {
  await notifyPaidOrderEmails(p);
}
