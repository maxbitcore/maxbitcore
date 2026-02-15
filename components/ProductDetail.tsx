
import React, { useState, useEffect } from 'react';
import { trackCartAddition, logAction } from '../services/analyticsService';
import { Product, Review } from '../types';
import { getStoredAuth } from '../services/authService';

interface ProductDetailProps {
  product: Product;
  onBack: () => void;
  onAddToCart: (product: Product) => void;
}

const ProductDetail: React.FC<ProductDetailProps> = ({ product, onBack, onAddToCart }) => {
  const isSoldOut = product.status === 'Sold Out';
  const [activeImage, setActiveImage] = useState(product.imageUrl);
  
  // Review Form State
  const [reviewName, setReviewName] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { role } = getStoredAuth();

  useEffect(() => {
    setActiveImage(product.imageUrl);
  }, [product]);

  const handleAddToCart = () => {
    trackCartAddition(product.id);
    onAddToCart(product);
  };

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewComment.trim()) return;

    setIsSubmitting(true);
    
    const newReview: Review = {
      id: `REV-${Date.now()}`,
      user: reviewName.trim() || (role === 'admin' ? 'System Admin' : 'Guest Operator'),
      rating: reviewRating,
      date: new Date().toLocaleDateString(),
      comment: reviewComment.trim()
    };

    // Update LocalStorage Product DB
    const allProductsRaw = localStorage.getItem('maxbit_published_products_v2');
    if (allProductsRaw) {
      const allProducts: Product[] = JSON.parse(allProductsRaw);
      const updatedProducts = allProducts.map(p => {
        if (p.id === product.id) {
          return { ...p, reviews: [newReview, ...(p.reviews || [])] };
        }
        return p;
      });
      localStorage.setItem('maxbit_published_products_v2', JSON.stringify(updatedProducts));
      
      // Notify parent/context that data changed (simple way is forcing a reload or local update)
      product.reviews = [newReview, ...(product.reviews || [])];
    }

    logAction('CLICK', `Posted Review on ${product.name.replace(/<[^>]*>?/gm, '')}`);
    
    // Reset Form
    setReviewComment('');
    setReviewName('');
    setReviewRating(5);
    setIsSubmitting(false);
  };

  const galleryImages = [product.imageUrl, ...(product.gallery || [])].filter(Boolean);

  return (
    <div className="pt-24 min-h-screen bg-[#0b0f1a] text-slate-200 animate-fade-in-up">
      <div className="max-w-[1800px] mx-auto px-6 md:px-12 pb-24">
        
        {/* Breadcrumb / Back */}
        <button 
          onClick={onBack}
          className="group flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-cyan-400 transition-colors mb-12"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 group-hover:-translate-x-1 transition-transform">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Return to Armory
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 mb-24 items-start">
          
          {/* Left: Images */}
          <div className="flex flex-col gap-6 sticky top-24">
            <div className="w-full aspect-[4/5] bg-slate-950 border border-slate-800/50 overflow-hidden rounded-[3rem] relative shadow-2xl group">
              <img 
                src={activeImage} 
                alt={product.name.replace(/<[^>]*>?/gm, '')} 
                className="w-full h-full object-cover object-center transition-opacity duration-500"
              />
              <div className="absolute top-10 left-10">
                <span className={`flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] px-8 py-4 rounded-full border backdrop-blur-2xl transition-all duration-500 ${
                  product.status === 'In Stock' ? 'bg-slate-950/90 border-emerald-500/50 text-emerald-400' :
                  product.status === 'Sold Out' ? 'bg-slate-950/90 border-rose-500/50 text-rose-400' :
                  'bg-slate-950/90 border-cyan-500/50 text-cyan-400'
                }`}>
                  {product.status}
                </span>
              </div>
            </div>

            {galleryImages.length > 1 && (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                    {galleryImages.map((img, idx) => (
                        <button
                            key={idx}
                            onClick={() => setActiveImage(img)}
                            className={`aspect-square rounded-2xl overflow-hidden border transition-all duration-300 ${
                                activeImage === img ? 'border-cyan-500 ring-2 ring-cyan-500/20' : 'border-slate-800 opacity-60'
                            }`}
                        >
                            <img src={img} alt="" className="w-full h-full object-cover" />
                        </button>
                    ))}
                </div>
            )}
          </div>

          {/* Right: Specs */}
          <div className="flex flex-col justify-center pt-8">
             <div className="mb-10">
                <span className="text-xs font-black text-cyan-500 uppercase tracking-[0.5em] mb-4 block opacity-70">Sector // {product.category}</span>
                <h1 
                  className="text-5xl md:text-7xl font-black italic tracking-tighter text-white mb-8 uppercase leading-[0.85]"
                  dangerouslySetInnerHTML={{ __html: product.name }}
                />
                <span className="text-6xl font-black text-white font-mono tracking-tighter">${product.price}</span>
             </div>

             {product.components && (
               <div className="mb-8">
                  <h3 className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.3em] mb-4">Core Components</h3>
                  <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl">
                    <div 
                      className="text-slate-300 text-sm font-bold uppercase tracking-wide leading-relaxed prose prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: product.components }}
                    />
                  </div>
               </div>
             )}
             
             <div 
               className="text-slate-400 leading-relaxed font-bold text-xl mb-12 border-b border-slate-800/50 pb-12 max-w-xl uppercase tracking-wide prose prose-invert max-w-none"
               dangerouslySetInnerHTML={{ __html: product.description }}
             />

             <button 
               onClick={handleAddToCart}
               disabled={isSoldOut}
               className={`max-w-md w-full py-7 uppercase tracking-[0.4em] text-xs font-black transition-all hover:scale-[1.02] rounded-[1.5rem] ${
                 isSoldOut ? 'bg-slate-800 text-slate-500' : 'maxbit-gradient text-slate-900'
               }`}
             >
               {isSoldOut ? 'ARCHIVE DATA ONLY' : `DEPLOY UNIT — $${product.price}`}
             </button>
          </div>
        </div>

        {/* --- REVIEWS SECTION --- */}
        <div className="border-t border-slate-800/50 pt-24">
            <div className="flex flex-col lg:flex-row gap-20">
                
                {/* Left: Review List */}
                <div className="lg:w-2/3 space-y-12">
                    <div className="flex items-center justify-between mb-12">
                        <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter text-white uppercase">Combat Reports</h2>
                        <span className="bg-slate-900 px-6 py-2 rounded-full border border-slate-800 text-xs font-black text-cyan-500 uppercase tracking-widest">
                            {product.reviews?.length || 0} Logs
                        </span>
                    </div>

                    <div className="space-y-8">
                        {product.reviews && product.reviews.length > 0 ? (
                            product.reviews.map((review) => (
                                <div key={review.id} className="bg-slate-900/30 border border-slate-800 p-8 rounded-[2rem] animate-fade-in-up">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <span className="font-black text-white uppercase italic tracking-tighter text-lg">{review.user}</span>
                                            <div className="flex gap-1 text-cyan-400 mt-2">
                                                {[...Array(5)].map((_, i) => (
                                                    <svg key={i} className={`w-3 h-3 ${i < review.rating ? 'fill-cyan-400' : 'fill-slate-800'}`} viewBox="0 0 20 20">
                                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                    </svg>
                                                ))}
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-mono text-slate-600 uppercase">{review.date}</span>
                                    </div>
                                    <p className="text-slate-400 leading-relaxed font-medium">"{review.comment}"</p>
                                </div>
                            ))
                        ) : (
                            <div className="py-20 text-center border-2 border-dashed border-slate-800 rounded-[2.5rem]">
                                <p className="text-slate-600 font-black uppercase tracking-widest text-xs">No reports filed for this unit yet.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Review Form */}
                <div className="lg:w-1/3">
                    <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] sticky top-24">
                        <h3 className="text-xl font-black text-white italic uppercase tracking-tighter mb-6">File Field Report</h3>
                        <form onSubmit={handleSubmitReview} className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Tactical Callsign</label>
                                <input 
                                    type="text" 
                                    placeholder={role === 'admin' ? 'System Administrator' : 'Enter Codename...'}
                                    value={reviewName}
                                    onChange={(e) => setReviewName(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan-500 text-xs font-bold uppercase transition-all"
                                />
                            </div>
                            
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Efficiency Rating</label>
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5].map((num) => (
                                        <button 
                                            key={num} 
                                            type="button" 
                                            onClick={() => setReviewRating(num)}
                                            className={`w-10 h-10 rounded-lg border transition-all flex items-center justify-center ${
                                                reviewRating >= num ? 'bg-cyan-500 border-cyan-400 text-slate-950' : 'bg-slate-950 border-slate-800 text-slate-600 hover:border-slate-600'
                                            }`}
                                        >
                                            <span className="font-black text-xs">{num}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Intel Briefing</label>
                                <textarea 
                                    required
                                    rows={4}
                                    placeholder="Describe unit performance..."
                                    value={reviewComment}
                                    onChange={(e) => setReviewComment(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan-500 text-xs font-bold uppercase transition-all resize-none"
                                />
                            </div>

                            <button 
                                type="submit" 
                                disabled={isSubmitting}
                                className="w-full py-4 bg-cyan-500 text-slate-950 font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-white transition-all shadow-lg shadow-cyan-500/10"
                            >
                                {isSubmitting ? 'TRANSMITTING...' : 'POST REPORT'}
                            </button>
                        </form>
                        <p className="mt-6 text-[9px] text-slate-600 font-bold uppercase tracking-widest leading-relaxed text-center">
                            By posting, you agree to technical debriefing protocols. Reports are publicly visible.
                        </p>
                    </div>
                </div>

            </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
