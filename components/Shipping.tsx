import React from 'react';

const Shipping: React.FC = () => {
  return (
    <section className="pt-32 pb-32 px-6 max-w-6xl mx-auto animate-fade-in-up">
      {/* Original Content Header */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center mb-24">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-500 mb-4 block">Logistics Intelligence</span>
          <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter text-white uppercase mb-8">Armor-Crate Protocol</h1>
          <div className="space-y-6 text-slate-400 leading-relaxed">
            <p>
              High-performance hardware is fragile. Standard courier handling is often too rough for a 20lb graphics card or tempered glass side panels. That's why we engineered the <strong>Armor-Crate Protocol</strong>.
            </p>
            <p>
              Every PC is packed with an internal high-density 'Instapak' foam that expands to perfectly cradle your internal components, preventing GPU sag or cable disconnects during transit. 
            </p>
          </div>
        </div>
        <div className="relative">
          <div className="absolute inset-0 bg-cyan-500/20 blur-[100px] rounded-full"></div>
          <div className="relative aspect-video rounded-3xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl flex flex-col">
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent z-[1] pointer-events-none" />
            <img
              src="https://images.unsplash.com/photo-1566576721346-d4a3b4eaad5b?auto=format&fit=crop&q=80&w=1000"
              alt="MaxBit PC packed for transit: reinforced carton and internal cushioning"
              className="absolute inset-0 w-full h-full object-cover opacity-50"
            />
            <div className="relative z-[2] mt-auto p-6 md:p-8 space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-500 mb-2">Visual reference</p>
                <h2 className="text-lg md:text-xl font-black text-white uppercase tracking-tight italic leading-tight">
                  Packaging system
                </h2>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed max-w-md">
                  Illustrates how finished rigs leave the lab: cushioned interior, braced GPU bay, and outer shell sized to survive carrier handling—not
                  loose retail boxes tossed in a mailbag.
                </p>
              </div>
              <ul className="flex flex-wrap gap-2">
                {['Instapak-style cradle', 'GPU lock bracket', 'Moisture barrier wrap'].map((label) => (
                  <li
                    key={label}
                    className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-slate-950/80 border border-white/10 text-slate-300"
                  >
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Re-integrated feature cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-24">
        {[
          {
            title: "Domestic Logistics",
            desc: "For all USA orders, we utilize FedEx Ground and UPS Express. All shipments are fully insured for the total retail value of the system. A signature is mandatory for all PC deliveries."
          },
          {
            title: "Real-Time Tracking",
            desc: "Once your build passes final stress testing, you receive an automated briefing with your tracking number and a link to view high-res photos of your specific build."
          }
        ].map((feat, i) => (
          <div key={i} className="bg-slate-900/50 border border-slate-800 p-10 rounded-2xl group hover:border-cyan-500/30 transition-all">
            <h3 className="text-white font-bold mb-4 uppercase tracking-widest text-sm border-b border-slate-800 pb-4 group-hover:text-cyan-400 transition-colors">{feat.title}</h3>
            <p className="text-slate-400 text-sm leading-loose">{feat.desc}</p>
          </div>
        ))}
      </div>

      {/* Detailed Logistics Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="bg-slate-900/30 border border-slate-800 p-12 rounded-3xl">
            <h2 className="text-2xl font-bold text-white mb-6 italic">Damage Recovery Protocol</h2>
            <p className="text-slate-400 mb-8 leading-relaxed">
            In the extremely rare event that your system arrives damaged, do not worry. <strong>DO NOT POWER ON THE SYSTEM</strong> if there is visible glass breakage. Contact our support immediately. We will arrange a prioritized return and build a replacement rig for you on an expedited schedule.
            </p>
            <div className="flex flex-wrap gap-4">
                <span className="px-4 py-2 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-widest border border-emerald-500/20 rounded-full">Fully Insured</span>
                <span className="px-4 py-2 bg-cyan-500/10 text-cyan-400 text-[10px] font-bold uppercase tracking-widest border border-cyan-500/20 rounded-full">Anti-Static Sealed</span>
            </div>
        </div>
        <div className="bg-slate-900/30 border border-slate-800 p-12 rounded-3xl">
            <h2 className="text-2xl font-bold text-white mb-6 italic">Specialized Handling</h2>
            <p className="text-slate-400 mb-8 leading-relaxed">
                Every PC shipment includes an internal GPU-locking bracket for massive cards (RTX 4090/5090) and reinforced side-wall inserts. We treat every delivery as a mission-critical deployment.
            </p>
            <ul className="space-y-4 text-sm">
                <li className="flex gap-4 text-slate-300">
                    <span className="text-cyan-500 font-black">»</span> High-Density Shock Absorption
                </li>
                <li className="flex gap-4 text-slate-300">
                    <span className="text-cyan-500 font-black">»</span> Moisture-Barrier Internal Wrapping
                </li>
            </ul>
        </div>
      </div>
    </section>
  );
};

export default Shipping;