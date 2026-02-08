import React from 'react';

const Returns: React.FC = () => {
  return (
    <section className="pt-32 pb-32 px-6 max-w-4xl mx-auto animate-fade-in-up">
      <div className="mb-16">
        <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter text-white uppercase mb-6">RETURN POLICY</h1>
        <p className="text-slate-400 text-lg leading-relaxed">Official protocols for hardware returns and exchanges.</p>
      </div>

      <div className="space-y-16">
        <section>
          <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest border-l-2 border-cyan-500 pl-4">1. 14-Day Return Window</h2>
          <div className="text-slate-400 leading-loose space-y-4">
            <p>You have 14 calendar days from the date of delivery to request a return for your MAXBIT custom system. To be eligible for a return, the system must be in its original professional packaging and in the same condition as received.</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest border-l-2 border-cyan-500 pl-4">2. Restocking Fees</h2>
          <div className="text-slate-400 leading-loose space-y-4">
            <p>All custom-built computers are subject to a <strong>15% restocking fee</strong>. Since each PC is a unique configuration built to order, this fee covers the specialized labor, testing, and depreciation of individual components.</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest border-l-2 border-cyan-500 pl-4">3. Shipping & Handling</h2>
          <div className="text-slate-400 leading-loose space-y-4">
            <ul className="list-disc list-inside space-y-2">
                <li>Original shipping charges are non-refundable.</li>
                <li>Return shipping costs are the responsibility of the customer.</li>
            </ul>
            <p className="bg-slate-900/50 p-4 border border-slate-800 rounded-xl mt-4">
                We strongly recommend using a trackable shipping service and purchasing full shipping insurance. MAXBIT is not liable for systems damaged or lost during return transit.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest border-l-2 border-cyan-500 pl-4">4. Non-Returnable Items</h2>
          <div className="text-slate-400 leading-loose space-y-4">
             <p>The following items and services cannot be returned:</p>
             <div className="grid gap-4 mt-4">
                <div className="bg-slate-900/40 p-5 rounded-xl border border-slate-800">
                    <strong className="text-white block text-xs uppercase tracking-widest mb-2">Digital Assets & Licenses</strong>
                    <p className="text-sm">All digital software keys, including Windows OS licenses and game bundles, are non-refundable once the system has been initialized.</p>
                </div>
                <div className="bg-slate-900/40 p-5 rounded-xl border border-slate-800">
                    <strong className="text-white block text-xs uppercase tracking-widest mb-2">Consumables & Liquids</strong>
                    <p className="text-sm">Used thermal compounds, custom liquid cooling additives, and specialized coolants cannot be returned or credited once the cooling loop has been filled or the seal is broken.</p>
                </div>
                <div className="bg-slate-900/40 p-5 rounded-xl border border-slate-800">
                    <strong className="text-white block text-xs uppercase tracking-widest mb-2">User-Induced Damage</strong>
                    <p className="text-sm">Any hardware showing visible evidence of customer-induced physical damage, including bent CPU pins, cracked PCB traces, or damage caused by improper overclocking and third-party BIOS flashing.</p>
                </div>
                <div className="bg-slate-900/40 p-5 rounded-xl border border-slate-800">
                    <strong className="text-white block text-xs uppercase tracking-widest mb-2">Security & Identification</strong>
                    <p className="text-sm">Systems or individual components where factory serial numbers or warranty stickers have been removed, altered, or tampered with.</p>
                </div>
                <div className="bg-slate-900/40 p-5 rounded-xl border border-slate-800">
                    <strong className="text-white block text-xs uppercase tracking-widest mb-2">Custom Aesthetics</strong>
                    <p className="text-sm">Specialized services such as custom laser engraving, UV printing, or bespoke automotive-grade paint jobs are permanent and non-refundable.</p>
                </div>
             </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest border-l-2 border-cyan-500 pl-4">5. Dead on Arrival (DOA) / Damage</h2>
          <div className="text-slate-400 leading-loose space-y-4">
            <p>If your system arrives damaged or fails to boot, you must contact MAXBIT Support within <strong>48 hours</strong> of delivery. In cases of verified DOA, we will provide a prepaid return label and prioritize a repair or replacement at no additional cost to you.</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest border-l-2 border-cyan-500 pl-4">6. RMA Requirement</h2>
          <div className="text-slate-400 leading-loose space-y-4">
            <p>No returns will be accepted without a valid <strong>Return Merchandise Authorization (RMA)</strong> number. Please contact our support team to initiate an RMA request before shipping any product back to our facility.</p>
          </div>
        </section>
      </div>
    </section>
  );
};

export default Returns;