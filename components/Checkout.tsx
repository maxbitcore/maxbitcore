import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Product } from '../types';
import { sanitizeHtml } from '../services/sanitizeHtml';
import { US_STATES } from '../data/usStates';
import {
  resolveUsStateCode,
  searchPhotonAddresses,
  searchPhotonCities,
  type AddressSuggestion,
  type CitySuggestion,
  type ParsedPlaceAddress,
} from '../services/addressSearch';
import { CoverImage } from './CoverImage';

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

interface CheckoutProps {
  items: Product[];
  onBack: () => void;
}

type CheckoutStep = 'details' | 'processing' | 'verifying' | 'success';

const Checkout: React.FC<CheckoutProps> = ({ items, onBack }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState<CheckoutStep>('details');
  const [orderId, setOrderId] = useState('');
  
  // Customer Data State
  const [email, setEmail] = useState('');
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

  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressSuggestOpen, setAddressSuggestOpen] = useState(false);
  const addressWrapRef = useRef<HTMLDivElement>(null);
  const skipAddressSearchUntilRef = useRef(0);

  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [citySuggestOpen, setCitySuggestOpen] = useState(false);
  const cityWrapRef = useRef<HTMLDivElement>(null);
  const skipCitySearchUntilRef = useRef(0);

  const applyParsedAddress = (p: ParsedPlaceAddress) => {
    setAddress(p.street);
    setCity(p.city);
    setZip(p.postal);
    if (p.countryCode === 'US' || !p.countryCode) {
      setUsState(resolveUsStateCode(p.regionRaw));
    }
  };

  useEffect(() => {
    if (step !== 'details') return;
    if (Date.now() < skipAddressSearchUntilRef.current) return;

    const q = address.trim();
    if (q.length < 3) {
      setAddressSuggestions([]);
      setAddressSuggestOpen(false);
      return;
    }

    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const list = await searchPhotonAddresses(q, {
            countryCode,
            usStateCode: usState || undefined,
            city: city || undefined,
            postal: zip || undefined,
          });
          setAddressSuggestions(list);
          setAddressSuggestOpen(list.length > 0);
        } catch {
          setAddressSuggestions([]);
          setAddressSuggestOpen(false);
        }
      })();
    }, 380);

    return () => window.clearTimeout(handle);
  }, [address, step]);

  useEffect(() => {
    if (step !== 'details') return;
    if (Date.now() < skipCitySearchUntilRef.current) return;

    const q = city.trim();
    if (q.length < 2) {
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
      if (addressWrapRef.current && !addressWrapRef.current.contains(t)) {
        setAddressSuggestOpen(false);
      }
      if (cityWrapRef.current && !cityWrapRef.current.contains(t)) {
        setCitySuggestOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [addressSuggestOpen, citySuggestOpen]);

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
            setStep('success');
            const oid = String(data.orderId || urlOrderId || '').trim();
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
            <div className="border-t border-slate-800 pt-8">
              <p className="text-slate-400 leading-relaxed text-sm">
                We've sent a confirmation email to <strong>{email}</strong>.
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 <span className="font-bold uppercase tracking-wide">Our team at info@maxbitcore.com has been notified</span>
              </div>
              <p className="text-slate-500 mt-4 text-xs">Your order is in the queue and will be prepared for assembly and testing.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={onBack}
              className="px-10 py-5 maxbit-gradient text-slate-900 font-black uppercase tracking-widest text-sm rounded-xl hover:scale-105 transition-all shadow-xl"
            >
              Continue Shopping
            </button>
            <button 
              className="px-10 py-5 border border-slate-800 text-white font-black uppercase tracking-widest text-sm rounded-xl hover:bg-slate-900 transition-all"
            >
              Download Receipt
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-slate-200 animate-fade-in-up">
      <div className="max-w-6xl mx-auto px-6 pt-32 pb-24">
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
                      <select
                        id="checkout-shipping-state"
                        name="shipping-region"
                        autoComplete="shipping address-level1"
                        required
                        value={usState}
                        onChange={(e) => setUsState(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 px-6 py-4 rounded-xl text-white outline-none focus:border-cyan-500 transition-colors [&>option]:bg-slate-900 [&>option]:text-white"
                      >
                        <option value="">Select state</option>
                        {US_STATES.map(({ code, name }) => (
                          <option key={code} value={code}>
                            {name}
                          </option>
                        ))}
                      </select>
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
                          onFocus={() => {
                            if (citySuggestions.length > 0) setCitySuggestOpen(true);
                          }}
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
                   <div ref={addressWrapRef} className="relative">
                    <input
                      id="checkout-shipping-address"
                      name="shipping-address-line1"
                      autoComplete="shipping street-address"
                      required
                      type="text"
                      value={address}
                      onChange={(e) => {
                        setAddress(e.target.value);
                        setAddressSuggestOpen(true);
                      }}
                      onFocus={() => {
                        if (addressSuggestions.length > 0) setAddressSuggestOpen(true);
                      }}
                      placeholder="Street address (type for address suggestions)"
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
                    {addressSuggestOpen && addressSuggestions.length > 0 && (
                      <ul
                        role="listbox"
                        className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-700 bg-slate-900 py-1 shadow-xl"
                      >
                        {addressSuggestions.map((s) => (
                          <li key={s.id} role="option">
                            <button
                              type="button"
                              className="w-full px-4 py-2.5 text-left text-xs text-slate-200 hover:bg-slate-800 focus:bg-slate-800 focus:outline-none"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                skipAddressSearchUntilRef.current = Date.now() + 800;
                                applyParsedAddress(s.parsed);
                                setAddressSuggestions([]);
                                setAddressSuggestOpen(false);
                              }}
                            >
                              {s.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
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
                      className="w-16 h-16 rounded-xl border border-slate-800 shrink-0"
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