import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Product } from '../types';
import { notifyPaidOrderEmails, stripeMinorToMajor, type OrderNotifyResult } from '../services/orderNotifyService';
import { sanitizeHtml } from '../services/sanitizeHtml';
import { US_STATES } from '../data/usStates';
import { searchPhotonCities, type CitySuggestion } from '../services/addressSearch';
import { CoverImage } from './CoverImage';
import { trackOrder } from '../services/analyticsService';
import { useAuth } from '../contexts/AuthContext';

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

/** Same-origin /server in prod if VITE_API_URL was omitted at build time (common deploy mistake). */
function resolveApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim()) {
    return fromEnv.trim().replace(/\/+$/, '');
  }
  if (import.meta.env.PROD && typeof window !== 'undefined') {
    return `${window.location.origin.replace(/\/+$/, '')}/server`;
  }
  return 'http://localhost:4242';
}

const apiBaseUrl = resolveApiBaseUrl();

const PENDING_CHECKOUT_KEY = 'maxbit_pending_checkout_v1';
const ORDER_ADMIN_NOTIFY_SENT_PREFIX = 'maxbit_order_admin_notify:';
const STRIPE_RECEIPT_STORAGE_KEY = 'maxbit_last_stripe_receipt';

type PendingCheckoutSnapshot = {
  v: 1;
  orderId: string;
  email: string;
  firstName: string;
  lastName: string;
  address: string;
  addressUnit: string;
  city: string;
  usState: string;
  zip: string;
  countryLabel: string;
  items: { id: string; name: string; price: number; imageUrl?: string }[];
  subtotal: number;
  estimatedTax: number;
  total: number;
};

function readPendingCheckoutSnapshot(): PendingCheckoutSnapshot | null {
  try {
    const raw = sessionStorage.getItem(PENDING_CHECKOUT_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<PendingCheckoutSnapshot>;
    if (o && o.v === 1 && typeof o.orderId === 'string') return o as PendingCheckoutSnapshot;
  } catch {
    /* ignore */
  }
  return null;
}

function clearPendingCheckoutSnapshot() {
  try {
    sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
  } catch {
    /* ignore */
  }
}

/** Match typed state name or 2-letter code to a US_STATES code (empty if ambiguous / no match). */
function matchUsStateDraftToCode(draft: string): string {
  const t = draft.trim().toLowerCase();
  if (!t) return '';
  const byCode = US_STATES.find((s) => s.code.toLowerCase() === t);
  if (byCode) return byCode.code;
  const byName = US_STATES.find((s) => s.name.toLowerCase() === t);
  if (byName) return byName.code;
  const starts = US_STATES.filter((s) => s.name.toLowerCase().startsWith(t));
  if (starts.length === 1) return starts[0].code;
  return '';
}

/** Merge stored profile with props/context so checkout can autofill when logged in. */
function readCheckoutProfile(propUser: any, ctxUser: any): Record<string, unknown> | null {
  let fromDisk: Record<string, unknown> | null = null;
  try {
    const raw = localStorage.getItem('maxbit_currentUser') || localStorage.getItem('maxbit_user');
    if (raw) fromDisk = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  const merged: Record<string, unknown> = {
    ...(fromDisk && typeof fromDisk === 'object' ? fromDisk : {}),
    ...(ctxUser && typeof ctxUser === 'object' ? ctxUser : {}),
    ...(propUser && typeof propUser === 'object' ? propUser : {}),
  };
  const email = String(merged.email ?? '').trim();
  return email ? merged : null;
}

/** Prefer separate last name; if only one full-name string exists, treat last token as surname. */
function pickCheckoutFirstLast(u: Record<string, unknown>): { first: string; last: string } {
  const rawFirst = String(
    u.firstName ?? u.first_name ?? u.given_name ?? u.givenName ?? ''
  ).trim();
  let last = String(
    u.lastName ??
      u.last_name ??
      u.lastname ??
      u.surname ??
      u.family_name ??
      u.familyName ??
      ''
  ).trim();

  let first = rawFirst;
  if (!last && /\s/.test(first)) {
    const parts = first.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      last = parts[parts.length - 1] ?? '';
      first = parts.slice(0, -1).join(' ');
    }
  }

  return { first, last };
}

interface CheckoutProps {
  items: Product[];
  onBack: () => void;
  currentUser?: any;
}

type CheckoutStep = 'details' | 'processing' | 'verifying' | 'success';

const Checkout: React.FC<CheckoutProps> = ({ items, onBack, currentUser }) => {
  const navigate = useNavigate();
  const authCtx = useAuth();
  const [step, setStep] = useState<CheckoutStep>('details');
  const [orderId, setOrderId] = useState('');
  
  // Customer Data State
  const [email, setEmail] = useState('');
  /** Set after paid session verify — drives honest copy on success screen */
  const [orderEmailNotifyResult, setOrderEmailNotifyResult] = useState<OrderNotifyResult | null>(null);
  /** Official Stripe receipt page (charge.receipt_url) — open / print / save as PDF */
  const [stripeReceiptUrl, setStripeReceiptUrl] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address, setAddress] = useState('');
  const [addressUnit, setAddressUnit] = useState('');
  const [city, setCity] = useState('');
  const [zip, setZip] = useState('');
  /** US state / territory code when country is US */
  const [usState, setUsState] = useState('');

  const countryCode = 'US';
  const countryLabel = 'United States';

  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [citySuggestOpen, setCitySuggestOpen] = useState(false);
  const cityWrapRef = useRef<HTMLDivElement>(null);
  const skipCitySearchUntilRef = useRef(0);

  const [stateDraft, setStateDraft] = useState('');
  const [stateSuggestOpen, setStateSuggestOpen] = useState(false);
  const stateWrapRef = useRef<HTMLDivElement>(null);
  const skipStatePickBlurUntilRef = useRef(0);

  const filteredUsStates = useMemo(() => {
    const t = stateDraft.trim().toLowerCase();
    if (!t) return US_STATES;
    return US_STATES.filter(
      (s) => s.name.toLowerCase().includes(t) || s.code.toLowerCase().includes(t)
    );
  }, [stateDraft]);

  useEffect(() => {
    if (step !== 'details') return;
    const u = readCheckoutProfile(currentUser, authCtx?.currentUser);
    if (!u?.email) return;
    const em = String(u.email).trim().toLowerCase();
    const { first: fn, last: ln } = pickCheckoutFirstLast(u);
    setEmail((prev) => (prev.trim() === '' ? em : prev));
    setFirstName((prev) => (prev.trim() === '' ? fn : prev));
    setLastName((prev) => (prev.trim() === '' ? ln : prev));
  }, [
    step,
    currentUser?.email,
    currentUser?.firstName,
    currentUser?.lastName,
    authCtx?.currentUser?.email,
    authCtx?.currentUser?.firstName,
    authCtx?.currentUser?.lastName,
  ]);

  useEffect(() => {
    if (step !== 'success' || !orderId) return;
    try {
      const raw = sessionStorage.getItem(STRIPE_RECEIPT_STORAGE_KEY);
      if (!raw) return;
      const o = JSON.parse(raw) as { orderId?: string; receiptUrl?: string };
      if (o.orderId === orderId && typeof o.receiptUrl === 'string' && /^https:\/\//i.test(o.receiptUrl)) {
        setStripeReceiptUrl((prev) => prev || o.receiptUrl || null);
      }
    } catch {
      /* ignore */
    }
  }, [step, orderId]);

  useEffect(() => {
    if (step !== 'details') return;
    if (Date.now() < skipCitySearchUntilRef.current) return;

    const q = city.trim();
    const minLen = usState ? 1 : 2;
    if (q.length < minLen) {
      setCitySuggestions([]);
      setCitySuggestOpen(false);
      return;
    }

    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const list = await searchPhotonCities(q, {
            countryCode,
            usStateCode: usState || undefined,
          });
          setCitySuggestions(list);
          setCitySuggestOpen(list.length > 0);
        } catch {
          setCitySuggestions([]);
          setCitySuggestOpen(false);
        }
      })();
    }, 380);

    return () => window.clearTimeout(handle);
  }, [city, usState, step]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (cityWrapRef.current && !cityWrapRef.current.contains(t)) {
        setCitySuggestOpen(false);
      }
      if (stateWrapRef.current && !stateWrapRef.current.contains(t)) {
        setStateSuggestOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [citySuggestOpen, stateSuggestOpen]);

  const TAX_RATE = 0.0995; // 9.95%
  const checkoutItems = items.filter(
    (item) => item && Number.isFinite(Number(item.price)) && Number(item.price) > 0
  );
  const subtotal = checkoutItems.reduce((sum, item) => sum + item.price, 0);
  const shippingCost = 0;
  const estimatedTax = subtotal * TAX_RATE; 
  const total = subtotal + estimatedTax;

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);

    const verifyReturn = async () => {
      if (q.get('success') !== 'true') {
        setOrderId(
          `MAX-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`
        );
        return;
      }

      const sessionId = q.get('session_id') || '';
      const urlOrderId = q.get('orderId') || '';
      if (!sessionId.startsWith('cs_')) {
        setStep('details');
        alert('This payment link is not valid. Please return to your cart and start checkout again.');
        return;
      }

      if (urlOrderId) setOrderId(urlOrderId);
      setStripeReceiptUrl(null);
      setStep('verifying');

      const params = new URLSearchParams({ session_id: sessionId });
      if (urlOrderId) params.set('orderId', urlOrderId);

      const attempts = 15;
      const delayMs = 1000;
      let lastError: string | null = null;

      for (let i = 0; i < attempts; i++) {
        try {
          const response = await fetch(`${apiBaseUrl}/payment-status?${params.toString()}`);
          const data = await response.json().catch(() => ({}));
          if (response.status === 429) {
            throw new Error('Too many checks at once. Wait a minute, then refresh this page.');
          }
          if (!response.ok) {
            lastError =
              typeof data.error === 'string' ? data.error : `Verification failed (${response.status}).`;
            // Transient server errors — retry
            if (response.status >= 500 && i < attempts - 1) {
              await new Promise((r) => setTimeout(r, delayMs));
              continue;
            }
            throw new Error(lastError);
          }
          if (data.paid) {
            if (typeof data.orderId === 'string' && data.orderId) setOrderId(data.orderId);
            if (typeof data.email === 'string' && data.email) setEmail(data.email);
            const oid = String(data.orderId || urlOrderId || '').trim();
            const receiptRaw = typeof data.receiptUrl === 'string' ? data.receiptUrl.trim() : '';
            const receiptOk = /^https:\/\//i.test(receiptRaw);
            if (receiptOk && oid) {
              setStripeReceiptUrl(receiptRaw);
              try {
                sessionStorage.setItem(
                  STRIPE_RECEIPT_STORAGE_KEY,
                  JSON.stringify({ orderId: oid, receiptUrl: receiptRaw })
                );
              } catch {
                /* private mode */
              }
            }
            const paidEmail =
              (typeof data.email === 'string' && data.email.trim()) || email.trim();
            const pending = readPendingCheckoutSnapshot();
            const snapOk = !!(pending && pending.orderId === oid);

            const lines =
              snapOk && pending!.items.length > 0
                ? pending!.items.map((it) => ({
                    id: it.id,
                    name: it.name,
                    price: it.price,
                    imageUrl:
                      (typeof it.imageUrl === 'string' && it.imageUrl) ||
                      checkoutItems.find((c) => c.id === it.id)?.imageUrl ||
                      '',
                  }))
                : checkoutItems.map((item) => ({
                    id: item.id,
                    name: item.name.replace(/<[^>]*>?/gm, ''),
                    price: item.price,
                    imageUrl: item.imageUrl || '',
                  }));

            const productsForTrack: Product[] = lines.map((i) => ({
              id: i.id,
              name: i.name,
              price: i.price,
              category: '',
              status: 'In Stock',
              imageUrl: i.imageUrl || '',
              description: '',
            }));

            const nameFromForm = snapOk
              ? [pending!.firstName, pending!.lastName].filter(Boolean).join(' ').trim()
              : [firstName, lastName].filter(Boolean).join(' ').trim();
            const street = snapOk
              ? [pending!.address, pending!.addressUnit].filter(Boolean).join(' ').trim()
              : [address.trim(), addressUnit.trim()].filter(Boolean).join(' ').trim();
            const cityLine = snapOk
              ? [pending!.city, [pending!.usState, pending!.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
              : [city.trim(), [usState, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
            const countryForAddr = snapOk ? pending!.countryLabel : countryLabel;
            const fullAddress = [street, cityLine, countryForAddr].filter(Boolean).join(', ') || '—';

            const notifySubtotal = snapOk ? pending!.subtotal : subtotal;
            const notifyTax = snapOk ? pending!.estimatedTax : estimatedTax;
            const notifyTotal = snapOk ? pending!.total : total;

            const payCurrency = typeof data.currency === 'string' ? data.currency : 'usd';
            const stripeChargedTotal = stripeMinorToMajor(Number(data.amountTotal ?? 0), payCurrency);
            const stripeTaxCharged = stripeMinorToMajor(Number(data.amountTax ?? 0), payCurrency);
            const lineSubtotalSum = lines.reduce((s, l) => s + Number(l.price), 0);

            if (oid && lines.length > 0 && paidEmail) {
              trackOrder(
                oid,
                productsForTrack,
                stripeChargedTotal,
                {
                  name: nameFromForm || 'Customer',
                  email: paidEmail,
                  address: fullAddress,
                },
                {
                  subtotal: lineSubtotalSum,
                  tax: stripeTaxCharged,
                  currency: payCurrency,
                }
              );
            }

            let emailNotifySnapshot: OrderNotifyResult | null = null;
            if (oid && paidEmail) {
              try {
                if (!localStorage.getItem(ORDER_ADMIN_NOTIFY_SENT_PREFIX + oid)) {
                  const st = snapOk ? pending!.usState : usState;
                  const result = await notifyPaidOrderEmails({
                    orderId: oid,
                    stripeSessionId: sessionId,
                    customerName: nameFromForm || 'Customer',
                    customerEmail: paidEmail,
                    addressLine1: snapOk ? pending!.address.trim() : address.trim(),
                    addressUnit: snapOk ? pending!.addressUnit.trim() : addressUnit.trim(),
                    city: snapOk ? pending!.city.trim() : city.trim(),
                    state: st || '—',
                    zip: snapOk ? pending!.zip.trim() : zip.trim(),
                    country: snapOk ? pending!.countryLabel : countryLabel,
                    items: lines,
                    subtotal: notifySubtotal,
                    estimatedTax: notifyTax,
                    cartTotal: notifyTotal,
                    stripeAmountTotal: Number(data.amountTotal ?? 0),
                    stripeAmountTax: Number(data.amountTax ?? 0),
                    currency: typeof data.currency === 'string' ? data.currency : 'usd',
                    stripeLivemode: !!data.livemode,
                  });
                  emailNotifySnapshot = result;
                  setOrderEmailNotifyResult(result);
                  if (result.shopNotified) {
                    localStorage.setItem(ORDER_ADMIN_NOTIFY_SENT_PREFIX + oid, '1');
                  }
                } else {
                  emailNotifySnapshot = { shopNotified: true, customerNotified: null };
                  setOrderEmailNotifyResult(emailNotifySnapshot);
                }
              } catch (e) {
                console.warn('Store order notification failed:', e);
                emailNotifySnapshot = { shopNotified: false, customerNotified: false };
                setOrderEmailNotifyResult(emailNotifySnapshot);
              }
            } else {
              setOrderEmailNotifyResult(null);
            }

            try {
              if (emailNotifySnapshot) {
                sessionStorage.setItem('maxbit_last_checkout_notify', JSON.stringify(emailNotifySnapshot));
              } else {
                sessionStorage.removeItem('maxbit_last_checkout_notify');
              }
            } catch {
              /* private mode */
            }

            if (snapOk) clearPendingCheckoutSnapshot();

            setStep('success');
            navigate(`/checkout?verified=true&orderId=${encodeURIComponent(oid)}`, { replace: true });
            return;
          }
          lastError =
            typeof data.paymentStatus === 'string'
              ? `Payment status: ${data.paymentStatus}`
              : 'Payment not confirmed yet.';
        } catch (e: any) {
          const msg = e?.message || 'Payment verification failed.';
          // Network failure — retry unless last attempt
          const isNetwork =
            e instanceof TypeError ||
            /fetch|network|failed to fetch|load failed/i.test(String(msg));
          if (isNetwork && i < attempts - 1) {
            lastError = msg;
            await new Promise((r) => setTimeout(r, delayMs));
            continue;
          }
          setStep('details');
          alert(
            `${msg}\n\nIf this keeps happening, contact support and mention you returned from payment on this page.`
          );
          return;
        }
        await new Promise((r) => setTimeout(r, delayMs));
      }

      setStep('details');
      alert(
        `We could not confirm your payment yet (${lastError || 'unknown reason'}). If money left your account, contact support with your order number: ${urlOrderId || '—'}.`
      );
    };

    verifyReturn();
  }, [navigate]);

const handlePlaceOrder = async (e: React.FormEvent) => {
  e.preventDefault();

  const resolvedState = usState || matchUsStateDraftToCode(stateDraft);
  if (!resolvedState) {
    alert(
      'Please choose a valid U.S. state: type to filter the list, pick a row, or enter the full state name or 2-letter code.'
    );
    return;
  }
  if (resolvedState !== usState) {
    const st = US_STATES.find((s) => s.code === resolvedState);
    setUsState(resolvedState);
    if (st) setStateDraft(st.name);
  }

  setStep('processing');

  try {
    if (!checkoutItems.length) {
      throw new Error('Your cart is empty. Add at least one item before checkout.');
    }

    if (!stripePublishableKey) {
      throw new Error('Online payments are not set up on this site yet. Please contact the store.');
    }

    const response = await fetch(`${apiBaseUrl}/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json'},
      body: JSON.stringify({
        items: checkoutItems.map(item => ({
          id: item.id,
          name: item.name.replace(/<[^>]*>?/gm, ''),
          price: item.price,
          imageUrl: item.imageUrl
        })),
        email: email,
        shipping: shippingCost,
        orderId: orderId
      }),
    });

    const rawText = await response.text();
    let session: { id?: string; error?: string; url?: string } = {};
    try {
      session = rawText ? JSON.parse(rawText) : {};
    } catch {
      session = {};
    }

    if (response.status === 429) {
      throw new Error('Too many attempts. Please wait a few minutes and try again.');
    }

    if (!response.ok) {
      const fromJson =
        typeof session.error === 'string'
          ? session.error
          : session.error && typeof session.error === 'object' && (session.error as { message?: string }).message
            ? String((session.error as { message?: string }).message)
            : '';
      const snippet = rawText.trim().startsWith('{')
        ? ''
        : rawText.replace(/\s+/g, ' ').slice(0, 180);
      throw new Error(
        fromJson ||
          snippet ||
          `Payment could not be started (${response.status}). Try again or contact the store.`
      );
    }

    if (session.error) throw new Error(session.error);
    if (session.url && typeof session.url === 'string') {
      try {
        sessionStorage.setItem(
          PENDING_CHECKOUT_KEY,
          JSON.stringify({
            v: 1,
            orderId,
            email: email.trim(),
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            address: address.trim(),
            addressUnit: addressUnit.trim(),
            city: city.trim(),
            usState: resolvedState,
            zip: zip.trim(),
            countryLabel,
            items: checkoutItems.map((item) => ({
              id: item.id,
              name: item.name.replace(/<[^>]*>?/gm, ''),
              price: item.price,
              imageUrl: item.imageUrl || '',
            })),
            subtotal,
            estimatedTax,
            total,
          } satisfies PendingCheckoutSnapshot)
        );
      } catch {
        /* storage unavailable */
      }
      window.location.assign(session.url);
      return;
    }
    throw new Error('We could not open the payment page. Please try again or contact the store.');

  } catch (err: any) {
    console.error("Payment Error:", err);
    setStep('details');
    alert(err.message || "Could not reach the payment gateway.");
  }
};

  if (step === 'verifying') {
    return (
      <div className="min-h-screen bg-[#0b0f1a] flex flex-col items-center justify-center p-6 text-center">
        <div className="relative w-24 h-24 mb-12">
          <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-cyan-500 rounded-full border-t-transparent animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-10 h-10 text-cyan-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
        </div>
        <h2 className="text-2xl font-black italic text-white uppercase tracking-widest mb-4">
          Checking your payment
        </h2>
        <p className="text-slate-500 font-mono text-[10px] uppercase tracking-widest">
          Please wait…
        </p>
      </div>
    );
  }

  if (step === 'processing') {
    return (
      <div className="min-h-screen bg-[#0b0f1a] flex flex-col items-center justify-center p-6 text-center">
        <div className="relative w-24 h-24 mb-12">
          <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-cyan-500 rounded-full border-t-transparent animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-10 h-10 text-cyan-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
        </div>
        <h2 className="text-2xl font-black italic text-white uppercase tracking-widest mb-4">
            Processing your payment
        </h2>   
        <div className="max-w-xs w-full bg-slate-900 h-1 rounded-full overflow-hidden mb-6">
          <div className="h-full bg-cyan-500 animate-pulse w-2/3"></div>
        </div>
        <p className="text-slate-500 font-mono text-[10px] uppercase tracking-widest">Securing your connection…</p>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen pt-40 pb-24 px-6 bg-[#0b0f1a] text-center">
        <div className="max-w-3xl mx-auto">
          <div className="w-20 h-20 bg-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-[0_0_50px_rgba(16,185,129,0.3)]">
            <svg className="w-10 h-10 text-slate-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="text-emerald-500 font-bold uppercase tracking-[0.3em] text-xs mb-4 block">Thank You For Your Order</span>
          <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter text-white uppercase mb-8">Order Confirmed</h1>
          
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 mb-12 text-left space-y-8">
            <div className="flex flex-col md:flex-row justify-between gap-8">
              <div>
                <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest block mb-2">Order number</span>
                <span className="text-xl font-bold text-white font-mono">{orderId}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest block mb-2">Estimated delivery</span>
                <span className="text-xl font-bold text-white">3-5 Business Days</span>
              </div>
            </div>
            <div className="border-t border-slate-800 pt-8 space-y-4">
              {orderEmailNotifyResult?.shopNotified === false && (
                <div className="flex items-start gap-2 text-xs text-amber-200 bg-amber-500/10 p-3 rounded-lg border border-amber-500/30">
                  <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>
                    We could not send the automatic store notification. Please email{' '}
                    <strong className="text-amber-100">info@maxbitcore.com</strong> with your order number{' '}
                    <strong className="font-mono">{orderId}</strong> so we can process it.
                  </span>
                </div>
              )}
              {orderEmailNotifyResult?.customerNotified === true && (
                <p className="text-slate-400 leading-relaxed text-sm">
                  We&apos;ve sent a confirmation email to <strong>{email}</strong>. Check spam if you don&apos;t see it.
                </p>
              )}
              {orderEmailNotifyResult?.customerNotified === false && (
                <p className="text-slate-400 leading-relaxed text-sm">
                  We could not send an email to <strong>{email}</strong> from our server. Your payment still went through.
                  Save this order number; you can also write to <strong>info@maxbitcore.com</strong>.
                </p>
              )}
              {orderEmailNotifyResult?.shopNotified === true && orderEmailNotifyResult.customerNotified === null && (
                <p className="text-slate-400 leading-relaxed text-sm">
                  If you use card checkout, Stripe may send a separate receipt to <strong>{email}</strong>. If nothing arrives,
                  check spam or contact <strong>info@maxbitcore.com</strong> with order <strong className="font-mono">{orderId}</strong>.
                </p>
              )}
              {!orderEmailNotifyResult && (
                <p className="text-slate-400 leading-relaxed text-sm">
                  Order <strong className="font-mono">{orderId}</strong> is confirmed. Keep this page or note your order number.
                </p>
              )}
              {orderEmailNotifyResult?.shopNotified === true && (
                <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-bold uppercase tracking-wide">
                    Our team at info@maxbitcore.com has been notified
                  </span>
                </div>
              )}
              <p className="text-slate-500 text-xs">Your order is in the queue and will be prepared for assembly and testing.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={onBack}
              className="px-10 py-5 maxbit-gradient text-slate-900 font-black uppercase tracking-widest text-sm rounded-xl hover:scale-105 transition-all shadow-xl"
            >
              Continue Shopping
            </button>
            {stripeReceiptUrl ? (
              <a
                href={stripeReceiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-10 py-5 border border-slate-800 text-white font-black uppercase tracking-widest text-sm rounded-xl hover:bg-slate-900 transition-all inline-flex items-center justify-center"
              >
                View receipt (Stripe)
              </a>
            ) : (
              <button
                type="button"
                disabled
                title="Stripe did not return a receipt link for this charge. Use your card statement or contact info@maxbitcore.com."
                className="px-10 py-5 border border-slate-800 text-slate-500 font-black uppercase tracking-widest text-sm rounded-xl cursor-not-allowed opacity-60"
              >
                View receipt (Stripe)
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-slate-200 animate-fade-in-up">
      <div className="max-w-6xl mx-auto px-6 pt-8 pb-24">
        <button 
          onClick={onBack}
          className="group flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-cyan-400 transition-colors mt-6 sm:mt-0 mb-12"
        >
          <svg xmlns="https://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 group-hover:-translate-x-1 transition-transform">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to Cart
        </button>

        <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
          
          <div className="space-y-12">
            <div>
              <h1 className="text-4xl font-black italic tracking-tighter text-white mb-2 uppercase">Checkout</h1>
              <p className="text-[10px] text-cyan-500/70 font-bold uppercase tracking-[0.2em]">Secure checkout — your details are encrypted</p>
            </div>
            
            <div className="space-y-12">
              {/* Contact Info */}
              <div className="space-y-6">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-[0.3em] flex items-center gap-4">
                  <span className="w-8 h-px bg-slate-800"></span>
                  Contact Information
                </h2>
                <div className="space-y-4">
                   <input
                    id="checkout-email"
                    name="email"
                    autoComplete="email"
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    className="w-full bg-slate-900 border border-slate-800 px-6 py-4 rounded-xl text-white placeholder-slate-600 outline-none focus:border-cyan-500 transition-colors"
                   />
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <input
                    id="checkout-given-name"
                    name="given-name"
                    autoComplete="given-name"
                    required
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    className="w-full bg-slate-900 border border-slate-800 px-6 py-4 rounded-xl text-white placeholder-slate-600 outline-none focus:border-cyan-500 transition-colors"
                   />
                   <input
                    id="checkout-family-name"
                    name="family-name"
                    autoComplete="family-name"
                    required
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                    className="w-full bg-slate-900 border border-slate-800 px-6 py-4 rounded-xl text-white placeholder-slate-600 outline-none focus:border-cyan-500 transition-colors"
                   />
                </div>
              </div>

              {/* Shipping information: address only; name comes from Contact above */}
              <div className="space-y-6">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-[0.3em] flex items-center gap-4">
                  <span className="w-8 h-px bg-slate-800"></span>
                  Shipping Information
                </h2>
                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                  Shipping to: {firstName || '…'} {lastName || ''}
                  {countryLabel ? ` · ${countryLabel}` : ''}
                </p>
                <div className="space-y-4">
                   <input type="hidden" name="shipping-country" value="US" />
                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div ref={stateWrapRef} className="relative w-full sm:col-span-1">
                        <input type="hidden" name="shipping-region" value={usState} readOnly />
                        <input
                          id="checkout-shipping-state"
                          name="shipping-state-search"
                          autoComplete="shipping address-level1"
                          type="text"
                          value={stateDraft}
                          onChange={(e) => {
                            const v = e.target.value;
                            setStateDraft(v);
                            const cur = US_STATES.find((s) => s.code === usState);
                            if (!cur || cur.name !== v.trim()) {
                              setUsState('');
                            }
                            setStateSuggestOpen(true);
                          }}
                          onFocus={() => setStateSuggestOpen(true)}
                          onBlur={() => {
                            window.setTimeout(() => {
                              if (Date.now() < skipStatePickBlurUntilRef.current) return;
                              const code = matchUsStateDraftToCode(stateDraft);
                              if (code) {
                                const st = US_STATES.find((s) => s.code === code);
                                if (st) {
                                  setUsState(code);
                                  setStateDraft(st.name);
                                }
                              }
                              setStateSuggestOpen(false);
                            }, 180);
                          }}
                          placeholder="State (type to search)"
                          className="w-full bg-slate-900 border border-slate-800 px-6 py-4 rounded-xl text-white placeholder-slate-600 outline-none focus:border-cyan-500 transition-colors"
                        />
                        {stateSuggestOpen && filteredUsStates.length > 0 && (
                          <ul
                            role="listbox"
                            className="absolute z-40 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-slate-700 bg-slate-900 py-1 shadow-xl"
                          >
                            {filteredUsStates.map((s) => (
                              <li key={s.code} role="option">
                                <button
                                  type="button"
                                  className="w-full px-4 py-2.5 text-left text-xs text-slate-200 hover:bg-slate-800 focus:bg-slate-800 focus:outline-none"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    skipStatePickBlurUntilRef.current = Date.now() + 800;
                                    setUsState(s.code);
                                    setStateDraft(s.name);
                                    setStateSuggestOpen(false);
                                  }}
                                >
                                  {s.name} <span className="text-slate-500">({s.code})</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div ref={cityWrapRef} className="relative w-full sm:col-span-1">
                        <input
                          id="checkout-shipping-city"
                          name="shipping-city"
                          autoComplete="shipping address-level2"
                          required
                          type="text"
                          value={city}
                          onChange={(e) => {
                            setCity(e.target.value);
                            setCitySuggestOpen(true);
                          }}
                          onFocus={() => setCitySuggestOpen(true)}
                          placeholder="City (type to search)"
                          className="w-full bg-slate-900 border border-slate-800 px-6 py-4 rounded-xl text-white placeholder-slate-600 outline-none focus:border-cyan-500 transition-colors"
                        />
                        {citySuggestOpen && citySuggestions.length > 0 && (
                          <ul
                            role="listbox"
                            className="absolute z-40 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-slate-700 bg-slate-900 py-1 shadow-xl"
                          >
                            {citySuggestions.map((s) => (
                              <li key={s.id} role="option">
                                <button
                                  type="button"
                                  className="w-full px-4 py-2.5 text-left text-xs text-slate-200 hover:bg-slate-800 focus:bg-slate-800 focus:outline-none"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    skipCitySearchUntilRef.current = Date.now() + 800;
                                    setCity(s.cityName);
                                    setCitySuggestions([]);
                                    setCitySuggestOpen(false);
                                  }}
                                >
                                  {s.label}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <input
                        id="checkout-shipping-zip"
                        name="shipping-postal-code"
                        autoComplete="shipping postal-code"
                        required
                        type="text"
                        value={zip}
                        onChange={(e) => setZip(e.target.value)}
                        placeholder="ZIP code"
                        className="w-full bg-slate-900 border border-slate-800 px-6 py-4 rounded-xl text-white placeholder-slate-600 outline-none focus:border-cyan-500 transition-colors"
                      />
                   </div>
                   <div>
                    <input
                      id="checkout-shipping-address"
                      name="shipping-address-line1"
                      autoComplete="off"
                      required
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Street address"
                      className="w-full bg-slate-900 border border-slate-800 px-6 py-4 rounded-xl text-white placeholder-slate-600 outline-none focus:border-cyan-500 transition-colors"
                    />
                    <input
                      id="checkout-shipping-address-unit"
                      name="shipping-address-line2"
                      autoComplete="shipping address-line2"
                      type="text"
                      value={addressUnit}
                      onChange={(e) => setAddressUnit(e.target.value)}
                      placeholder="Apartment, suite, etc. (optional)"
                      className="mt-3 w-full bg-slate-900 border border-slate-800 px-6 py-4 rounded-xl text-white placeholder-slate-600 outline-none focus:border-cyan-500 transition-colors"
                    />
                   </div>
                </div>
              </div>

              {/* Shipping method*/}
              <div className="space-y-6">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-[0.3em] flex items-center gap-4">
                  <span className="w-8 h-px bg-slate-800"></span>
                  Shipping method
                </h2>
                <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-2xl p-6 flex items-center gap-5">
                  <div className="bg-cyan-500/20 p-3 rounded-xl">
                    <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-black italic uppercase tracking-widest text-sm">Free standard shipping</p>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight mt-1">No shipping charge on this order</p>
                  </div>
                </div>
              </div>

              <button 
                type="submit"
                className="w-full mt-8 bg-emerald-400 hover:bg-emerald-300 text-slate-900 font-black text-sm uppercase tracking-widest py-5 rounded-xl transition-all"
              >
                Proceed to Payment — ${total.toFixed(2)}
              </button>
            </div>
          </div>
            
          <div className="lg:pl-12 lg:border-l border-slate-800">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-[0.3em] mb-10">Order Summary</h2>
  
            <div className="space-y-6 mb-10">
              {items.map((item, idx) => (
                <div key={item.id} className="flex justify-between items-start gap-4">
                  <div className="flex gap-4">
                    <CoverImage
                      src={item.imageUrl}
                      alt=""
                      className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border border-slate-800 shrink-0"
                    />
                    <div>
                      <div 
                        className="text-sm font-black uppercase tracking-tighter text-white"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.name) }} 
                      />
                      <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-widest">{item.category}</p>
                    </div>
                  </div>
                  <div className="text-sm font-black text-white font-mono">${item.price}</div>
                </div>
              ))}
            </div>

            <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-5 md:p-6 space-y-4">
              <div className="space-y-2.5">
                <div className="flex justify-between text-[10px] md:text-xs font-bold text-slate-500">
                  <span className="uppercase tracking-widest">Subtotal</span>
                  <span className="text-white font-mono">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[10px] md:text-xs font-bold text-slate-500">
                  <span className="uppercase tracking-widest">Shipping</span>
                  <span className="text-emerald-500 font-black italic">FREE</span>
                </div> 
                <div className="flex justify-between text-[10px] md:text-xs font-bold text-slate-500">
                  <span className="uppercase tracking-widest">Estimated sales tax</span>
                  <span className="text-white font-mono">${estimatedTax.toFixed(2)}</span>
                </div>
              </div>
                
              <p className="text-[8px] text-slate-600 uppercase italic leading-tight border-t border-slate-800/50 pt-3">
                * Final tax is calculated at payment based on your shipping address.
              </p> 

              <div className="pt-2">
                  <div className="flex justify-between items-center">
                    <span className="font-black italic text-xl text-white uppercase tracking-tighter">Total</span>
                    <div className="flex items-end gap-1">
                      <span className="text-[10px] text-slate-500 mb-1">USD</span>
                      <span className="font-black text-3xl text-white tracking-tighter">${total.toFixed(2)}</span>
                    </div>
                  </div>
              </div>
            </div>

            <div className="mt-6 p-4 border border-dashed border-slate-800 rounded-2xl flex items-center gap-4 bg-slate-950/30">
              <div className="text-cyan-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">Checkout is secure and encrypted</span>
          </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Checkout;