import React from 'react';

const Terms: React.FC = () => {
  return (
    <section className="pt-32 pb-32 px-6 max-w-4xl mx-auto animate-fade-in-up">
      <div className="mb-16">
        <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter text-white uppercase mb-6">Terms of Service</h1>
        <p className="text-slate-400 text-lg leading-relaxed">The operational rules for the MaxBit ecosystem.</p>
      </div>

      <div className="space-y-16">
        <section>
          <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest border-l-2 border-cyan-500 pl-4">1. Order Lock-In</h2>
          <div className="text-slate-400 leading-loose space-y-4">
            <p>Due to the custom nature of our PCs, orders enter the 'Pick & Batch' phase 24 hours after purchase. After this window, cancellations are subject to a $150 processing fee to cover already-unboxed components and allocated labor.</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest border-l-2 border-cyan-500 pl-4">2. Component Availability</h2>
          <div className="text-slate-400 leading-loose space-y-4">
            <p>Specific hardware models (e.g., ASUS vs. MSI GPUs) may fluctuate based on global supply chains. MaxBit guarantees that you will always receive the technical specifications listed or better. If a significant hardware swap is necessary, we will contact you for approval.</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest border-l-2 border-cyan-500 pl-4">3. Performance Disclaimer</h2>
          <div className="text-slate-400 leading-loose space-y-4">
            <p>FPS benchmarks quoted in our catalog are estimates based on testing in controlled environments. Actual in-game performance may vary based on driver updates, ambient room temperatures, and specific game settings.</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest border-l-2 border-cyan-500 pl-4">4. Liability Limitation</h2>
          <div className="text-slate-400 leading-loose space-y-4">
            <p>MaxBit is not liable for data loss or indirect damages resulting from hardware failure. We strongly advise users to maintain regular backups of critical files. Our liability is limited strictly to the repair or replacement of the physical hardware provided.</p>
          </div>
        </section>
      </div>
    </section>
  );
};

export default Terms;