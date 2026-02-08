import React, { useState, useEffect } from 'react';
import { Product } from '../types';

interface NewInStockBannerProps {
  newProducts: Product[];
  onProductClick: (product: Product) => void;
}

const NewInStockBanner: React.FC<NewInStockBannerProps> = ({ newProducts, onProductClick }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if dismissed in this session
    const dismissed = sessionStorage.getItem('maxbit_new_banner_dismissed');
    if (newProducts.length > 0 && !dismissed) {
      setIsVisible(true);
    }
  }, [newProducts]);

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    sessionStorage.setItem('maxbit_new_banner_dismissed', 'true');
  };

  if (!isVisible || newProducts.length === 0) return null;

  const latestProduct = newProducts[0];

  return (
    <div className="relative w-full overflow-hidden bg-slate-950 border-y border-cyan-500/30 animate-fade-in-up z-40">
      <div className="max-w-[1800px] mx-auto px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500 whitespace-nowrap">Inventory Update</span>
          </div>
          <div className="h-4 w-px bg-slate-800 hidden md:block"></div>
          <p className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-2">
            New Loadout Available: <span className="text-cyan-400 italic font-black">"{latestProduct.name}"</span>
          </p>
        </div>

        <div className="flex items-center gap-6">
          <button 
            onClick={() => onProductClick(latestProduct)}
            className="text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 bg-cyan-500 text-slate-950 rounded-lg hover:bg-white transition-all transform hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(34,211,238,0.3)]"
          >
            Inspect Specs
          </button>
          <button 
            onClick={handleDismiss}
            className="text-slate-500 hover:text-white transition-colors"
            title="Dismiss Notification"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Subtle Background Glow */}
      <div className="absolute top-0 right-1/4 w-64 h-full bg-cyan-500/5 blur-3xl pointer-events-none"></div>
    </div>
  );
};

export default NewInStockBanner;