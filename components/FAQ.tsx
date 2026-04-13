import React from 'react';

const FAQ: React.FC = () => {
  const categories = [
    {
      title: "Assembly & Build Process",
      items: [
        { 
          q: "What is the typical build time for a custom PC?", 
          a: "Every MaxBit system is built to order. Assembly and wiring take 3-5 business days, followed by 48 hours of stress testing. Total turnaround is usually 7-10 business days." 
        },
        { 
          q: "Do you use generic components for RAM or SSDs?", 
          a: "Never. We only use Tier-1 brands like Corsair, Samsung, G.Skill, and Crucial. You will always receive the specific brand or an equivalent premium alternative if stock is fluctuating." 
        },
        { 
          q: "Do I get the original component boxes?", 
          a: "Yes. We ship a separate 'Armory Accessory Box' containing all original component manuals, extra cables, and driver media." 
        },
        { 
          q: "Is there bloatware installed?", 
          a: "Absolutely not. We provide a clean installation of Windows 11 Pro with only the necessary drivers and hardware control software (like RGB sync) pre-installed and optimized." 
        }
      ]
    }
  ];

  return (
    <section className="pt-32 pb-32 px-6 max-w-5xl mx-auto animate-fade-in-up">
      <div className="text-center mb-20">
        <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter text-white uppercase mb-4">The FAQ Terminal</h1>
        <p className="text-slate-400 text-lg">System diagnostics and frequently requested intelligence.</p>
      </div>

      <div className="space-y-16">
        {categories.map((cat, i) => (
          <div key={i}>
            <h2 className="text-sm font-bold uppercase tracking-[0.3em] text-cyan-500 mb-8 border-b border-slate-800 pb-4">{cat.title}</h2>
            <div className="grid gap-6">
              {cat.items.map((item, j) => (
                <div key={j} className="bg-slate-900/50 border border-slate-800 p-8 rounded-2xl group hover:border-cyan-500/30 transition-all">
                  <h3 className="font-bold text-white text-lg mb-4 flex items-start gap-3">
                    <span className="text-cyan-500">Q:</span>
                    {item.q}
                  </h3>
                  <div className="flex items-start gap-3 text-slate-400 leading-relaxed">
                    <span className="text-emerald-500 font-bold">A:</span>
                    <p>{item.a}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default FAQ;