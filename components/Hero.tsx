import React from 'react';

interface HeroProps {
  onExplore: () => void;
}

const Hero: React.FC<HeroProps> = ({ onExplore }) => {
  return (
    <section className="relative w-full h-[60vh] min-h-[500px] overflow-hidden bg-[#0b0f1a] flex items-center">
      
      {/* Dynamic Background */}
      <div className="absolute inset-0 w-full h-full">
        <img 
            src="https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=2000" 
            alt="Hardware Circuitry" 
            className="w-full h-full object-cover opacity-30 contrast-125 saturate-50"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b0f1a] via-[#0b0f1a]/70 to-transparent"></div>
        {/* Accent Glow */}
        <div className="absolute bottom-0 right-0 w-[50%] h-[50%] bg-cyan-500/10 rounded-full blur-[100px] translate-x-[10%] translate-y-[10%]"></div>
      </div>

      <div className="relative z-10 px-8 md:px-24 max-w-7xl mx-auto w-full">
        <div className="animate-fade-in-up">
          <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight mb-4 leading-[1.0]">
            Built for <span className="maxbit-text-gradient block md:inline">Victory</span>
          </h1>
          <p className="max-w-lg text-base md:text-lg text-slate-400 font-medium leading-relaxed mb-8">
            Precision-engineered high-performance hardware. 
            Deployed for absolute dominance.
          </p>
          
          <button 
            onClick={onExplore}
            className="maxbit-gradient px-10 py-4 rounded-xl text-slate-900 font-extrabold uppercase tracking-widest hover:opacity-90 transition-all hover:scale-105 shadow-[0_0_15px_rgba(34,211,238,0.2)] text-sm"
          >
            Design Your PC
          </button>
        </div>
      </div>

      {/* Subtle indicator */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 opacity-30">
        <div className="w-1 h-8 bg-gradient-to-b from-cyan-500 to-transparent rounded-full animate-pulse"></div>
      </div>
    </section>
  );
};

export default Hero;