
import React from 'react';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
  onClick: (product: Product) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onClick }) => {
  return (
    <div 
      className="group relative bg-slate-900/40 border border-slate-800/50 rounded-[2rem] overflow-hidden cursor-pointer hover:border-cyan-500/40 transition-all duration-700 flex flex-col hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)]" 
      onClick={() => onClick(product)}
    >
      {/* Immersive Image Container */}
      <div className="relative aspect-[4/5] overflow-hidden bg-slate-950">
        <img 
          src={product.imageUrl} 
          alt={product.name.replace(/<[^>]*>?/gm, '')} 
          className="w-full h-full object-cover object-center transition-transform duration-[1.5s] cubic-bezier(0.2, 1, 0.3, 1) group-hover:scale-110"
        />
        
        {/* Artistic Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f1a] via-transparent to-transparent opacity-80 transition-opacity duration-500 group-hover:opacity-40"></div>
        <div className="absolute inset-0 ring-1 ring-inset ring-white/5"></div>

        {/* Status Badge - High Contrast Version */}
        <div className="absolute top-6 right-6 z-20">
            <span className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full border backdrop-blur-xl shadow-lg transition-all duration-500 ${
              product.status === 'In Stock' ? 'bg-slate-950/90 border-emerald-500/50 text-emerald-400 shadow-emerald-500/20' :
              product.status === 'Sold Out' ? 'bg-slate-950/90 border-rose-500/50 text-rose-400 shadow-rose-500/20' :
              'bg-slate-950/90 border-cyan-500/50 text-cyan-400 shadow-cyan-500/20'
            }`}>
                {product.status === 'In Stock' && (
                  <span className="flex h-1.5 w-1.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                )}
                {product.status}
            </span>
        </div>
      </div>
      
      {/* Info Section */}
      <div className="p-8 flex-1 flex flex-col relative bg-[#0b0f1a]/80 backdrop-blur-md">
        <div className="flex justify-between items-start mb-2">
            <span className="text-cyan-500 text-[9px] font-black uppercase tracking-[0.4em]">
                {product.category}
            </span>
            <span className="text-2xl font-black text-white font-mono tracking-tighter">${product.price}</span>
        </div>
        
        <h3 
          className="text-xl font-black text-white mb-3 group-hover:text-cyan-400 transition-colors uppercase tracking-tighter leading-none italic"
          dangerouslySetInnerHTML={{ __html: product.name }}
        />
        
        <div 
          className="text-slate-500 text-[11px] mb-8 line-clamp-2 leading-relaxed font-bold uppercase tracking-widest opacity-80 prose prose-invert prose-xs max-w-none"
          dangerouslySetInnerHTML={{ __html: product.description }}
        />
        
        <div className="mt-auto flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] group-hover:text-cyan-500 transition-colors">
                  Inspect Specs
              </span>
              <div className="h-0.5 w-0 group-hover:w-full bg-cyan-500 transition-all duration-500"></div>
            </div>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-700 ${
              product.status === 'Sold Out' ? 'bg-slate-800 text-slate-600' : 'bg-slate-800/50 border border-slate-700/50 group-hover:bg-cyan-500 text-slate-400 group-hover:text-slate-950 group-hover:shadow-[0_0_30px_rgba(34,211,238,0.5)] group-hover:border-cyan-400'
            }`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
