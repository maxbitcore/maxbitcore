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
        
        <div className="flex flex-col items-center md:items-end gap-4 order-1 md:order-2">
           <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Accepted Payment Protocols</span>
           <div className="flex gap-4">
              <div className="w-10 h-6 bg-slate-900 rounded border border-slate-800 flex items-center justify-center grayscale hover:grayscale-0 transition-all opacity-50 hover:opacity-100 cursor-default" title="Visa">
                <svg className="h-3" viewBox="0 0 24 24" fill="white"><path d="M1.2 5h4l2.5 11.5L10 5h4l-4 14H6L1.2 5zm17.5 0h-4v14h4v-14zm4 0h-4v14h4v-14z" /></svg>
              </div>
              <div className="w-10 h-6 bg-slate-900 rounded border border-slate-800 flex items-center justify-center grayscale hover:grayscale-0 transition-all opacity-50 hover:opacity-100 cursor-default" title="Mastercard">
                <div className="flex -space-x-2">
                   <div className="w-3 h-3 rounded-full bg-rose-500 opacity-80"></div>
                   <div className="w-3 h-3 rounded-full bg-amber-500 opacity-80"></div>
                </div>
              </div>
              <div className="w-10 h-6 bg-slate-900 rounded border border-slate-800 flex items-center justify-center grayscale hover:grayscale-0 transition-all opacity-50 hover:opacity-100 cursor-default" title="PayPal">
                <svg className="h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7.076 21.337H2.47a.641.641 0 01-.633-.74L4.944 3.723a.641.641 0 01.633-.54h7.19c4.322 0 6.642 2.158 6.014 5.992-.375 2.275-1.742 4.01-3.692 4.935-.95.45-2.072.684-3.21.684H9.15a.641.641 0 00-.632.541l-1.442 5.91-.01.037a.641.641 0 01-.632.441l.642-2.686z" />
                </svg>
              </div>
           </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;