import React from 'react';
import { CoverImage } from './CoverImage';

interface HeroProps {
  onExplore: () => void;
}

const Hero: React.FC<HeroProps> = ({ onExplore }) => {
  return (
    <section className="relative w-full h-[42vh] min-h-[320px] md:min-h-[380px] overflow-hidden bg-[#0b0f1a] flex items-center py-6 md:py-8">
      
      {/* Dynamic Background */}
      <div className="absolute inset-0 w-full h-full">
        <CoverImage
          src="https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=2000"
          alt="Hardware circuitry background"
          className="w-full h-full opacity-30 contrast-125 saturate-50"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b0f1a] via-[#0b0f1a]/70 to-transparent"></div>
        {/* Accent Glow */}
        <div className="absolute bottom-0 right-0 w-[50%] h-[50%] bg-cyan-500/10 rounded-full blur-[100px] translate-x-[10%] translate-y-[10%]"></div>
      </div>

      <div className="relative z-10 px-8 md:px-24 max-w-7xl mx-auto w-full">
        <div className="animate-fade-in-up w-full max-w-4xl lg:max-w-5xl">
          <h1 className="font-black text-white tracking-tight mb-3 leading-[1.05] whitespace-nowrap text-[clamp(1.15rem,3.8vw+0.6rem,4.5rem)]">
            Built for <span className="maxbit-text-gradient">Victory</span>
          </h1>
          <p className="max-w-xl text-base md:text-lg text-slate-400 font-medium leading-relaxed mb-5">
            Precision-engineered high-performance hardware. 
            Deployed for absolute dominance.
          </p>
          
          <button 
            onClick={onExplore}
            className="maxbit-gradient px-4 py-2 rounded-md text-slate-900 font-bold uppercase tracking-wide hover:opacity-90 transition-all hover:scale-[1.02] shadow-[0_0_10px_rgba(34,211,238,0.15)] text-[10px] sm:text-xs"
          >
            Design Your PC
          </button>
        </div>
      </div>

      {/* Subtle indicator */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-30">
        <div className="w-1 h-6 bg-gradient-to-b from-cyan-500 to-transparent rounded-full animate-pulse"></div>
      </div>
    </section>
  );
};

export default Hero;