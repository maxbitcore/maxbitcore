import React, { useState, useEffect } from 'react';
import { trackOrder } from '../services/analyticsService';
import { Product } from '../types';

interface CheckoutProps {
  items: Product[];
  onBack: () => void;
}

type CheckoutStep = 'details' | 'processing' | 'success';
type ShippingMethod = 'standard' | 'express';

const Checkout: React.FC<CheckoutProps> = ({ items, onBack }) => {
  const [step, setStep] = useState<CheckoutStep>('details');
  const [orderId, setOrderId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'square' | 'card' | 'paypal'>('square');
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('standard');
  
  // Customer Data State
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [zip, setZip] = useState('');
  const [country, setCountry] = useState('');

  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  const shippingCost = shippingMethod === 'express' ? 49 : 0;
  const taxes = subtotal * 0.0825; // 8.25% Tax Rate
  const total = subtotal + shippingCost + taxes;

  useEffect(() => {
    // Generate a unique order ID for the session
    setOrderId(`MAX-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`);
  }, []);

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('processing');
    
    // Simulate payment and order processing
    // In a real Square implementation, we would call: await card.tokenize();
    setTimeout(() => {
      trackOrder(
        orderId, 
        items, 
        total, 
        {
          name: `${firstName} ${lastName}`,
          email: email,
          address: `${address}, ${city}, ${zip}, ${country}`
        }
      );
      
      // Simulate Backend Email Trigger to Admin
      console.log(`[System]: Sending payment receipt to ${email}`);
      console.log(`[System]: Sending new order notification to info@maxbitcore.com`);
      
      setStep('success');
    }, 3000);
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
            {paymentMethod === 'square' ? 'Connecting to Square...' : 'Processing Secure Payment'}
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
                <span className="text-xl font-bold text-white">{shippingMethod === 'express' ? '3-5 Business Days' : '7-10 Business Days'}</span>
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

              {/* Shipping Method */}
              <div className="space-y-6">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-[0.3em] flex items-center gap-4">
                  <span className="w-8 h-px bg-slate-800"></span>
                  Delivery Method
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { id: 'standard', label: 'Standard Delivery', price: 'Free', time: '7-10 Business Days', icon: 'M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4' },
                    { id: 'express', label: 'Express Priority', price: '$49', time: '3-5 Business Days', icon: 'M13 10V3L4 14h7v7l9-11h-7z' }
                  ].map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setShippingMethod(method.id as any)}
                      className={`flex flex-col p-5 rounded-xl border text-left transition-all ${
                        shippingMethod === method.id 
                          ? 'border-cyan-500 bg-cyan-500/10' 
                          : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-3">
                        <div className={shippingMethod === method.id ? 'text-cyan-400' : 'text-slate-600'}>
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={method.icon} />
                          </svg>
                        </div>
                        <span className="text-[10px] font-black text-cyan-400">{method.price}</span>
                      </div>
                      <div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${shippingMethod === method.id ? 'text-white' : 'text-slate-400'}`}>{method.label}</span>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">{method.time}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xs font-bold text-slate-500 uppercase tracking-[0.3em] flex items-center gap-4">
                    <span className="w-8 h-px bg-slate-800"></span>
                    Payment Method
                  </h2>
                </div>
                
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {[
                    { id: 'square', label: 'Square', icon: 'M4 4h16v16H4V4zm2 2v12h12V6H6zm2 2h8v8H8V8z' },
                    { id: 'card', label: 'Credit Card', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
                    { id: 'paypal', label: 'PayPal', icon: 'M7.076 21.337H2.47a.641.641 0 01-.633-.74L4.944 3.723a.641.641 0 01.633-.54h7.19c4.322 0 6.642 2.158 6.014 5.992-.375 2.275-1.742 4.01-3.692 4.935-.95.45-2.072.684-3.21.684H9.15a.641.641 0 00-.632.541l-1.442 5.91-.01.037a.641.641 0 01-.632.441l.642-2.686z' }
                  ].map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setPaymentMethod(method.id as any)}
                      className={`flex flex-col items-center gap-3 p-4 rounded-xl border transition-all ${
                        paymentMethod === method.id 
                          ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400' 
                          : 'border-slate-800 bg-slate-900/50 text-slate-500 hover:border-slate-700'
                      }`}
                    >
                      <svg className="w-6 h-6" fill={method.id === 'paypal' || method.id === 'square' ? 'currentColor' : 'none'} stroke={method.id === 'paypal' || method.id === 'square' ? 'none' : 'currentColor'} viewBox="0 0 24 24">
                        {method.id === 'paypal' || method.id === 'square' ? (
                          <path d={method.icon} />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={method.icon} />
                        )}
                      </svg>
                      <span className="text-[8px] font-black uppercase tracking-widest">{method.label}</span>
                    </button>
                  ))}
                </div>

                <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl min-h-[200px] flex flex-col justify-center">
                   {paymentMethod === 'square' && (
                     <div className="animate-fade-in-up space-y-4">
                        <div className="flex items-center justify-between mb-2">
                           <span className="text-[10px] font-black uppercase tracking-widest text-white">Square Secure Payment</span>
                           <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16v16H4V4zm2 2v12h12V6H6zm2 2h8v8H8V8z" /></svg>
                        </div>
                        {/* 
                           In a real implementation, the Square Web Payments SDK attaches the form here.
                           Example Code:
                           <div id="card-container"></div> 
                        */}
                        <div className="bg-[#0b0f1a] border border-slate-700 rounded-lg p-4">
                            <div className="flex flex-col gap-3">
                                <label className="text-[9px] font-bold text-slate-500 uppercase">Card Details (Square Hosted)</label>
                                <div className="h-10 bg-slate-800/50 rounded border border-slate-800 flex items-center px-3">
                                    <div className="w-full h-2 bg-slate-700/50 rounded animate-pulse"></div>
                                </div>
                            </div>
                        </div>
                        <p className="text-[9px] text-slate-500 mt-2">
                           Payment processed securely by Square. Your card details are never stored on our servers.
                        </p>
                     </div>
                   )}

                   {paymentMethod === 'card' && (
                     <div className="space-y-4 animate-fade-in-up">
                        <input required type="text" placeholder="CARD NUMBER" className="w-full bg-[#0b0f1a] border border-slate-800 px-6 py-4 rounded-xl text-white placeholder-slate-600 outline-none focus:border-cyan-500 transition-colors font-mono" />
                        <div className="grid grid-cols-2 gap-4">
                           <input required type="text" placeholder="MM / YY" className="w-full bg-[#0b0f1a] border border-slate-800 px-6 py-4 rounded-xl text-white placeholder-slate-600 outline-none focus:border-cyan-500 transition-colors font-mono" />
                           <input required type="text" placeholder="CVC / CVV" className="w-full bg-[#0b0f1a] border border-slate-800 px-6 py-4 rounded-xl text-white placeholder-slate-600 outline-none focus:border-cyan-500 transition-colors font-mono" />
                        </div>
                     </div>
                   )}

                   {paymentMethod === 'paypal' && (
                     <div className="text-center py-6 space-y-4 animate-fade-in-up">
                        <svg className="h-8 mx-auto text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M7.076 21.337H2.47a.641.641 0 01-.633-.74L4.944 3.723a.641.641 0 01.633-.54h7.19c4.322 0 6.642 2.158 6.014 5.992-.375 2.275-1.742 4.01-3.692 4.935-.95.45-2.072.684-3.21.684H9.15a.641.641 0 00-.632.541l-1.442 5.91-.01.037a.641.641 0 01-.632.441l.642-2.686z" />
                        </svg>
                        <p className="text-xs text-slate-500 max-w-xs mx-auto">You will be redirected to PayPal to complete your purchase securely.</p>
                     </div>
                   )}
                </div>
              </div>

              <button 
                type="submit"
                className="w-full py-6 maxbit-gradient text-slate-950 uppercase tracking-[0.2em] text-sm font-black rounded-xl hover:scale-[1.02] transition-all shadow-xl"
              >
                Place Order — ${total.toFixed(2)}
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
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-slate-500">
                  <span className="uppercase tracking-widest">Shipping</span>
                  <span className={shippingCost === 0 ? 'text-emerald-500' : ''}>{shippingCost === 0 ? 'FREE' : `$${shippingCost.toFixed(2)}`}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-slate-500">
                  <span className="uppercase tracking-widest">Estimated Tax (8.25%)</span>
                  <span>${taxes.toFixed(2)}</span>
                </div>
              </div>
              
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
              <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest">
                All hardware is fully insured during transit / 3-year warranty included.
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Checkout;