
import React, { useState, useEffect, useMemo } from 'react';
import { PRODUCTS } from '../constants';
import { Product } from '../types';
import ProductCard from './ProductCard';

interface ProductGridProps {
  category: 'Gaming PCs' | 'Components' | 'Peripherals' | 'All';
  onProductClick: (product: Product) => void;
  searchQuery?: string;
  externalProducts?: Product[];
}

const ProductGrid: React.FC<ProductGridProps> = ({ category, onProductClick, searchQuery = '' }) => {
  const [deployedProducts, setDeployedProducts] = useState<Product[]>([]);

  const loadPublished = () => {
    const saved = localStorage.getItem('maxbit_published_products_v2');
    if (saved) {
      const all = JSON.parse(saved);
      const onlyActive = all.filter((p: any) => p && p.isPublished === true);
      setDeployedProducts(onlyActive);
    } else {
      setDeployedProducts([]);
    }
  };

  useEffect(() => {
    loadPublished();

    window.addEventListener('storage', loadPublished);
    window.addEventListener('maxbit-update', loadPublished);

    return () => {
      window.removeEventListener('storage', loadPublished);
      window.removeEventListener('maxbit-update', loadPublished);
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const allProducts = [...PRODUCTS, ...deployedProducts];
    
    let list = category === 'All' ? allProducts : allProducts.filter(p => p.category === category);
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => 
        p.name.toLowerCase().includes(q) || 
        (p.description && p.description.toLowerCase().includes(q))
      );
    }
    return list;
  }, [category, searchQuery, deployedProducts]);

  const getSubTitle = () => {
      if (searchQuery) return `Showing results for "${searchQuery}" in ${category}`;
      switch(category) {
          case 'Gaming PCs': return 'Pre-built systems engineered for competitive peak performance.';
          case 'Components': return 'The building blocks of absolute power.';
          case 'Peripherals': return 'Precision input devices for maximum tactical control.';
          default: return 'The full MaxBit hardware ecosystem.';
      }
  };

  return (
    <section className="pt-32 pb-32 px-6 md:px-12 bg-[#0b0f1a]">
      <div className="max-w-[1800px] mx-auto">
        
        {/* Category Header */}
        <div className="flex flex-col items-center text-center mb-24 space-y-4">
          <span className="text-cyan-500 font-bold uppercase tracking-widest text-xs">Shop / {category}</span>
          <h2 className="text-4xl md:text-6xl font-black italic tracking-tighter text-white uppercase">
            {searchQuery ? 'Search Results' : (category === 'All' ? 'Armory' : category)}
          </h2>
          <p className="text-slate-500 max-w-xl text-lg">{getSubTitle()}</p>
          <div className="w-24 h-1 bg-cyan-500 mt-8 rounded-full"></div>
        </div>

        {/* Specialized Grid */}
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
            {filteredProducts.map(product => (
              <ProductCard key={product.id} product={product} onClick={onProductClick} />
            ))}
          </div>
        ) : (
          <div className="py-32 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-800 rounded-3xl bg-slate-900/10">
              <div className="w-20 h-20 bg-slate-900 rounded-2xl flex items-center justify-center mb-8 border border-slate-800 animate-pulse">
                <svg className="w-10 h-10 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <p className="font-black italic text-2xl text-slate-600 uppercase tracking-tighter mb-2">Awaiting Stock Deployment</p>
              <p className="text-slate-700 font-bold uppercase tracking-[0.2em] text-xs">Loadout sector is currently empty. Prepare for supply drop.</p>
              {searchQuery && (
                 <p className="text-cyan-500 text-[10px] font-black uppercase tracking-widest mt-6 bg-cyan-500/5 px-4 py-2 rounded-full border border-cyan-500/10">No matches for tactical query: "{searchQuery}"</p>
              )}
          </div>
        )}
      </div>
    </section>
  );
};

export default ProductGrid;
