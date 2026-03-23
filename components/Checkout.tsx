import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe('pk_test_51Sm3CG3BK91l745A0VN63NLnemQi9vl3HWGTDT18c4hLpZfroanzl50rgKu1VtWFGBzhvNqvKcNYFL0kH0KnRDOS00MznZ24qk');

interface CheckoutProps {
  items: Product[];
  onBack: () => void;
}

type CheckoutStep = 'details' | 'processing' | 'success';

const Checkout: React.FC<CheckoutProps> = ({ items, onBack }) => {
  const [step, setStep] = useState<CheckoutStep>('details');
  const [orderId, setOrderId] = useState('');
  
  // Customer Data State
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [zip, setZip] = useState('');
  const [country, setCountry] = useState('');
  
  const [shippingOptions, setShippingOptions] = useState<{id: string, label: string, price: number, date: string}[]>([]);
  const [selectedShippingId, setSelectedShippingId] = useState('');
  const [isLoadingRates, setIsLoadingRates] = useState(false);

  const TAX_RATE = 0.0995; // 9.95%
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  const selectedOption = shippingOptions.find(opt => opt.id === selectedShippingId);
  const shippingCost = selectedOption?.price || 0;
  const estimatedTax = (subtotal + shippingCost) * TAX_RATE; 
  const total = subtotal + shippingCost + estimatedTax;

  useEffect(() => {
    const fetchRates = async () => {
      if (city && country && zip && address) {
        setIsLoadingRates(true);
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL}/get-shipping-rates`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ city, country, zip, address, items })
          });
          const rates = await response.json();
          setShippingOptions(rates);
          if (rates.length > 0) setSelectedShippingId(rates[0].id);
        } catch (err) {
          console.error("Failed to fetch rates:", err);
        } finally {
          setIsLoadingRates(false);
        }
      }
    };

    fetchRates();
  }, [city, country, zip, address]);

  useEffect(() => {
    setOrderId(`MAX-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`);
  }, []);

const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShippingId) return alert("Please select shipping method");

    setStep('processing');

    try {
      const stripe = await stripePromise;

      const response = await fetch('https://maxbitcore.com/api/create-checkout-session.php', { 
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          items: items.map(item => ({
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

      const session = await response.json();
      
      if (session.error) {
        throw new Error(session.error);
      }
  
      if (stripe && session.id) {
        const { error } = await stripe.redirectToCheckout({ 
          sessionId: session.id 
        });
        if (error) throw error;
      } else {
        throw new Error("Failed to create checkout session - No ID received");
      }

    } catch (err: any) {
      console.error("Payment Error:", err);
      setStep('details');
      alert(err.message || "Could not reach the payment gateway.");
    }
  };

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
            Processing Secure Payment
        </h2>   
        <div className="max-w-xs w-full bg-slate-900 h-1 rounded-full overflow-hidden mb-6">
          <div className="h-full bg-cyan-500 animate-pulse w-2/3"></div>
        </div>
        <p className="text-slate-500 font-mono text-[10px] uppercase tracking-widest">Encrypting data / Verifying credentials...</p>
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
                <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest block mb-2">Order Reference</span>
                <span className="text-xl font-bold text-white font-mono">{orderId}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest block mb-2">Estimated Arrival</span>
                <span className="text-xl font-bold text-white">{selectedOption?.date || 'Standard Delivery'}</span>
              </div>
            </div>
            <div className="border-t border-slate-800 pt-8">
              <p className="text-slate-400 leading-relaxed text-sm">
                We've sent a confirmation email to <strong>{email}</strong>.
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 <span className="font-bold uppercase tracking-wide">Admin Notification Sent to info@maxbitcore.com</span>
              </div>
              <p className="text-slate-500 mt-4 text-xs">Your hardware has been allocated and is being prepared for final assembly and stress-testing.</p>
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
          className="group flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-cyan-400 transition-colors mb-12"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 group-hover:-translate-x-1 transition-transform">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to Cart
        </button>

        <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
          
          <div className="space-y-12">
            <div>
              <h1 className="text-4xl font-black italic tracking-tighter text-white mb-2 uppercase">Checkout</h1>
              <p className="text-[10px] text-cyan-500/70 font-bold uppercase tracking-[0.2em]">Secure checkout session / 256-bit Encryption</p>
            </div>
            
            <div className="space-y-12">
              {/* Contact Info */}
              <div className="space-y-6">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-[0.3em] flex items-center gap-4">
                  <span className="w-8 h-px bg-slate-800"></span>
                  Contact Information
                </h2>
                <div className="space-y-4">
                   <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="EMAIL ADDRESS" className="w-full bg-slate-900 border border-slate-800 px-6 py-4 rounded-xl text-white placeholder-slate-600 outline-none focus:border-cyan-500 transition-colors" />
                </div>
              </div>

              {/* Shipping Address */}
              <div className="space-y-6">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-[0.3em] flex items-center gap-4">
                  <span className="w-8 h-px bg-slate-800"></span>
                  Shipping Address
                </h2>
                <div className="space-y-4">
                   <div className="grid grid-cols-2 gap-4">
                      <input required type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="FIRST NAME" className="w-full bg-slate-900 border border-slate-800 px-6 py-4 rounded-xl text-white placeholder-slate-600 outline-none focus:border-cyan-500 transition-colors" />
                      <input required type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="LAST NAME" className="w-full bg-slate-900 border border-slate-800 px-6 py-4 rounded-xl text-white placeholder-slate-600 outline-none focus:border-cyan-500 transition-colors" />
                   </div>
                   <input required type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="STREET ADDRESS" className="w-full bg-slate-900 border border-slate-800 px-6 py-4 rounded-xl text-white placeholder-slate-600 outline-none focus:border-cyan-500 transition-colors" />
                   <div className="grid grid-cols-2 gap-4">
                      <input required type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="CITY" className="w-full bg-slate-900 border border-slate-800 px-6 py-4 rounded-xl text-white placeholder-slate-600 outline-none focus:border-cyan-500 transition-colors" />
                      <input required type="text" value={zip} onChange={(e) => setZip(e.target.value)} placeholder="POSTAL / ZIP CODE" className="w-full bg-slate-900 border border-slate-800 px-6 py-4 rounded-xl text-white placeholder-slate-600 outline-none focus:border-cyan-500 transition-colors" />
                   </div>
                   <input required type="text" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="COUNTRY" className="w-full bg-slate-900 border border-slate-800 px-6 py-4 rounded-xl text-white placeholder-slate-600 outline-none focus:border-cyan-500 transition-colors" />
                </div>
              </div>

              {/* Shipping method */}
              <div className="space-y-6">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-[0.3em] flex items-center gap-4">
                  <span className="w-8 h-px bg-slate-800"></span>
                  Shipping method
                </h2>
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/50">
                  {isLoadingRates ? (
                    <div className="p-8 text-center animate-pulse text-xs text-cyan-500 uppercase tracking-widest font-bold">Calculating rates...</div>
                  ) : shippingOptions.length > 0 ? (
                    shippingOptions.map((option) => (
                      <div key={option.id} onClick={() => setSelectedShippingId(option.id)} className={`flex items-center justify-between p-5 cursor-pointer border-b border-slate-800 last:border-0 transition-colors ${selectedShippingId === option.id ? 'bg-cyan-500/10' : 'hover:bg-slate-800/50'}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedShippingId === option.id ? 'border-cyan-500' : 'border-slate-600'}`}>
                          {selectedShippingId === option.id && <div className="w-2 h-2 bg-cyan-500 rounded-full" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white uppercase tracking-tight">{option.label}</p>
                          <p className="text-[10px] text-slate-500 font-medium">{option.date}</p>
                        </div>
                      </div>
                      <span className="text-sm font-mono font-bold text-white">${option.price.toFixed(2)}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-[10px] text-slate-500 uppercase tracking-widest italic">
                    Enter your shipping address to view rates
                  </div>
                )}
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
  
            <div className="space-y-6">
              {items.map((item, idx) => (
                <div key={item.id} className="flex justify-between items-start">
                  <div className="flex gap-4">
                    <img src={item.imageUrl} className="w-16 h-16 object-cover rounded-xl border border-slate-800" alt="" />
                    <div>
                      <div 
                        className="text-sm font-black uppercase tracking-tighter text-white"
                        dangerouslySetInnerHTML={{ __html: item.name }} 
                      />
                      <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-widest">{item.category}</p>
                    </div>
                  </div>
                  <div className="text-sm font-black text-white font-mono">${item.price}</div>
                </div>
              ))}
            </div>

            <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between text-xs font-bold text-slate-500">
                  <span className="uppercase tracking-widest">Subtotal</span>
                  <span className="text-white font-mono">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span className="uppercase tracking-widest">Shipping</span>
                    <span className={shippingCost === 0 ? 'text-emerald-500' : ''}>{shippingCost === 0 ? 'FREE' : `$${shippingCost.toFixed(2)}`}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span className="uppercase tracking-widest">Estimated Tax (Stripe)</span>
                    <span className="text-white font-mono">${estimatedTax.toFixed(2)}</span>
                  </div>
                </div>
                
                <p className="text-[9px] text-slate-600 uppercase mt-4 italic">
                  * Final tax will be calculated by Stripe based on your precise jurisdiction.
                </p> 

                <div className="border-t border-slate-800 pt-6">
                   <div className="flex justify-between items-center">
                     <span className="font-black italic text-xl text-white uppercase tracking-tighter">Total</span>
                     <div className="flex items-end gap-1">
                       <span className="text-[10px] text-slate-500 mb-1">USD</span>
                       <span className="font-black text-4xl text-white tracking-tighter">${total.toFixed(2)}</span>
                     </div>
                   </div>
                </div>
              </div>

              <div className="mt-8 p-6 border border-dashed border-slate-800 rounded-2xl flex items-center gap-4">
                <div className="text-cyan-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Secure encrypted checkout</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Checkout;