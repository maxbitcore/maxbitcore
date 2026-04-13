import React, { useState, useEffect } from 'react';
import { MainTab } from '../types';
import { BRAND_NAME } from '../constants';


interface FooterProps {
  onTabChange: (tab: MainTab) => void;
}

const Footer: React.FC<FooterProps> = ({ onTabChange }) => {
  const [currentLogo, setCurrentLogo] = useState(localStorage.getItem('maxbit_logo') || "");

  useEffect(() => {
    // Initial Logo Check
    const storedLogo = localStorage.getItem('maxbit_logo');
    if (storedLogo) {
      setCurrentLogo(storedLogo);
    }

    // Listener for logo updates
    const handleLogoUpdate = () => {
      const newLogo = localStorage.getItem('maxbit_logo');
      if (newLogo) setCurrentLogo(newLogo);
    };
    window.addEventListener('logo-updated', handleLogoUpdate);

    return () => {
        window.removeEventListener('logo-updated', handleLogoUpdate);
    };
  }, []);

  return (
    <footer className="bg-slate-950 pt-16 pb-12 px-6 border-t border-slate-900 mt-auto">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 text-center md:text-left">
        
        <div className="space-y-6">
          <div className="flex items-center justify-center md:justify-start gap-3">
            <img 
              src={currentLogo} 
              alt="MAXBIT Logo" 
              className="h-10 w-auto object-contain"
            />
            <div className="flex items-center">
               <span className="text-3xl font-black italic tracking-tighter text-white">MAXBIT</span>
            </div>
          </div>
          <p className="text-slate-400 text-sm leading-relaxed max-w-xs mx-auto md:mx-0">
            High-performance custom hardware and premium PC components. Engineered for the competitive edge.
          </p>
        </div>
        
        <div>
          <h4 className="font-bold text-white mb-6 uppercase text-xs tracking-widest text-slate-500">Support</h4>
          <ul className="space-y-3 text-slate-400 text-sm">
            <li><button onClick={() => onTabChange('contact')} className="hover:text-cyan-400 transition-colors uppercase font-black tracking-widest text-[10px]">Contact</button></li>
            <li><button onClick={() => onTabChange('faq')} className="hover:text-cyan-400 transition-colors uppercase font-black tracking-widest text-[10px]">FAQ</button></li>
            <li><button onClick={() => onTabChange('shipping')} className="hover:text-cyan-400 transition-colors uppercase font-black tracking-widest text-[10px]">Shipping</button></li>
            <li><button onClick={() => onTabChange('returns')} className="hover:text-cyan-400 transition-colors uppercase font-black tracking-widest text-[10px]">Returns</button></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-white mb-6 uppercase text-xs tracking-widest text-slate-500">System</h4>
          <ul className="space-y-3 text-slate-400 text-sm">
            <li><button onClick={() => onTabChange('privacy')} className="hover:text-cyan-400 transition-colors uppercase font-black tracking-widest text-[10px]">Privacy Policy</button></li>
            <li><button onClick={() => onTabChange('terms')} className="hover:text-cyan-400 transition-colors uppercase font-black tracking-widest text-[10px]">Terms of Service</button></li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-slate-900 flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="text-[10px] uppercase tracking-[0.3em] text-slate-600 order-2 md:order-1">
          <p>© 2025 {BRAND_NAME}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;