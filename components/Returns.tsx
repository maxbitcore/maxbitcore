import React from 'react';

const Returns: React.FC = () => {
  return (
    <section className="pt-32 pb-32 px-6 max-w-4xl mx-auto animate-fade-in-up">
      <div className="mb-16">
        <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter text-white uppercase mb-6">RETURN POLICY</h1>
        <p className="text-slate-400 text-lg leading-relaxed">MaxBit - Gaming PC Returns & Warranty Policy.</p>
      </div>

      <div className="space-y-16">
        <section>
          <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest border-l-2 border-cyan-500 pl-4">1. Return Autorization Required</h2>
          <div className="text-slate-400 leading-loose space-y-4">
            <p>All return requests must be submitted in writing to max@maxbitcore.com. Returns sent without prior authorization will be refused and returned to sender. Once approved, all returns must be shipped to MaxBit business address.</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest border-l-2 border-cyan-500 pl-4">2. Change of Mind / Satisfaction Returns</h2>
          <div className="text-slate-400 leading-loose space-y-4">
            <p>Customers may request a return within 7 calendar days of confirmed delivery if they decide they no longer want the PC. The PC must be returned in the exact same condition as received, including: original shipping box, all internal and external packaging materials, foam inserts, accessories, cables, manuals, and documentation. All shipping costs are the responsibility of the customer, including: original outbound shipping, return shipping to MaxBit. Returned systems are subject to a mandatory inspection and diagnostic evaluation prior to any refund approval. Any physical, cosmetic, electrical, or internal damage will: be deducted from the refund or result in a denied refund if damage is deemed excessive or intentional</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest border-l-2 border-cyan-500 pl-4">3. BIOS, Firmware & User-Induced Damage Protection </h2>
          <div className="text-slate-400 leading-loose space-y-4">
            <p>Any changes made to the system without prior written approval from Hall of Tech are done entirely at the customer's own risk, including but not limited to: BIOS configuration changes, voltage, frequency, or power limit adjustments, enabling or disabling XMP/EXPO, PBO, manual overclocking or undervolting, firmware flashing or rollback. If a system becomes unstable, fails, or stops functioning as a result of BIOS or firmware changes made by the customer, the following will apply: warranty is immediately void, the system is not eligible for refunds, repair costs will be billed to the customer. MaxBit is not responsible for damage caused by: customer experimentation, performance tuning, third-party software or guide, failure to contact MaxBit for support before making changes.</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest border-l-2 border-cyan-500 pl-4">4. Inspection, Diagnostics & Refund Processing</h2>
          <div className="text-slate-400 leading-loose space-y-4">
            <ul className="list-disc list-inside space-y-2">
                <p>Refunds are not automatic and will only be issued after inspection is completed. Hall of Tech reserves the right to: test system stability, verify component serial numbers, check BIOS, firmware, and software integrity. If damage, missing parts, altered components, or signs of misuse are found: repair, replacement, or labor costs will be deducted from the refund. Refunds are issued to the original payment method only. Refund processing time after inspection: 3-7 business days</p>
            </ul>
            <p className="bg-slate-900/50 p-4 border border-slate-800 rounded-xl mt-4">
                Original shipping charges are non-refundable. Return shipping costs are the responsibility of the customer. MAXBIT is not liable for systems damaged or lost during return transit.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest border-l-2 border-cyan-500 pl-4">5. Warranty Voidance & Misuse Policy</h2>
          <div className="text-slate-400 leading-loose space-y-4">
            <p>The warranty and refund eligibility are immediately void if any of the following occur: physical damage (drops, impacts, bent pins, cracked PCBs, broken ports), liquid damage or environmental damage, unauthorized repairs, upgrades, or part swaps, removal or tampering with serial numbers or security seals, BIOS or firmware modifications without Maxbit approval Software misuse, malware, crypto mining, or OS corruption caused by user activity, improper power sources, surge damage, or incorrect cabling</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest border-l-2 border-cyan-500 pl-4">6. Non-Returnable & Final Sale Items</h2>
          <div className="text-slate-400 leading-loose space-y-4">
             <p>The following items and services cannot be returned: Custom-built PCs made to customer-selected specifications, clearance, discounted, or promotional systems, PCs returned without original packaging or accessories, Digital Assets & Licenses (All digital software keys, including Windows OS licenses and game bundles, are non-refundable once the system has been initialized)</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest border-l-2 border-cyan-500 pl-4">5. Dead on Arrival (DOA) / Damage</h2>
          <div className="text-slate-400 leading-loose space-y-4">
            <p>If your system arrives damaged or fails to boot, you must contact MAXBIT Support within <strong>48 hours</strong> of delivery. Claims submitted after 48 hours may be denied. MaxBit reserves the right to determine whether the issue qualifies for: Repair, Replacement, Partial or full refund (at our sole discretion)</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest border-l-2 border-cyan-500 pl-4">6. Chargebacks, Fraud & Abuse Protectio</h2>
          <div className="text-slate-400 leading-loose space-y-4">
            <p>Initiating a chargeback without first contacting MaxBit may result in: immediate warranty voidance, permanent denial of future service or purchases. All systems are documented with: Build photos, Serial numbers, Pre-shipment testing records, Packaging condition documentation</p>
          </div>
        </section>
      </div>
    </section>
  );
};

export default Returns;