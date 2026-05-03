
import React, { useState, useEffect } from 'react';
import { trackCartAddition, logAction } from '../services/analyticsService';
import { Product, Review } from '../types';
import { getStoredAuth } from '../services/authService';
import { toggleWishlist, checkIsWishlisted } from '../services/wishlistUtils';
import { useAuth } from '../contexts/AuthContext';
import { sanitizeHtml } from '../services/sanitizeHtml';
import { CoverImage } from './CoverImage';

/** Shown in the review "Your login" field for logged-in shoppers. */
function pickReviewerDisplayName(propUser: any, ctxUser: any): string {
  const u = propUser || ctxUser;
  if (u && typeof u === 'object') {
    const fn = String(u.firstName || '').trim();
    const ln = String(u.lastName || '').trim();
    const full = [fn, ln].filter(Boolean).join(' ').trim();
    if (full) return full;
    const un = String(u.username || '').trim();
    if (un) return un;
    const em = String(u.email || '').trim();
    if (em) {
      const local = em.split('@')[0]?.trim();
      if (local) return local;
      return em;
    }
  }
  const { firstName, email } = getStoredAuth();
  if (String(firstName || '').trim()) return String(firstName).trim();
  const e = String(email || '').trim();
  if (e) return e.split('@')[0]?.trim() || e;
  return '';
}

function hasRegisteredSession(propUser: any, ctxUser: any): boolean {
  if (propUser?.email || ctxUser?.email) return true;
  const { token, email } = getStoredAuth();
  return Boolean(token && email);
}

function sessionReviewerEmail(propUser: any, ctxUser: any): string {
  return String(propUser?.email || ctxUser?.email || getStoredAuth().email || '')
    .trim()
    .toLowerCase();
}

function isReviewOwner(review: Review, sessionEmail: string): boolean {
  if (!sessionEmail || !review.authorEmail) return false;
  return String(review.authorEmail).trim().toLowerCase() === sessionEmail;
}

interface ProductDetailProps {
  product: Product;
  currentUser?: any;
  onBack: () => void;
  onAddToCart: (product: Product) => void;
  openLoginModal?: () => void;
}

const ProductDetail: React.FC<ProductDetailProps> = ({
  product,
  currentUser: currentUserProp,
  onBack,
  onAddToCart,
  openLoginModal,
}) => {
  const { email, role } = getStoredAuth();
  const [activeImage, setActiveImage] = useState(product.imageUrl);
  const isSoldOut = product.status === 'Sold Out';

  const authCtx = useAuth();
  const wishlistEmail =
    (currentUserProp?.email || authCtx?.currentUser?.email || email || '').trim();

  const [isWishlisted, setIsWishlisted] = useState(() =>
    wishlistEmail ? checkIsWishlisted(product.id, wishlistEmail) : false,
  );

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const em =
      (currentUserProp?.email || authCtx?.currentUser?.email || getStoredAuth().email || '').trim();
    if (!em) {
      if (openLoginModal) openLoginModal();
      else window.dispatchEvent(new Event('maxbit-open-login'));
      return;
    }

    const nextState = toggleWishlist(product, em);
    setIsWishlisted(nextState);

    logAction('CLICK', `${nextState ? 'Added' : 'Removed'} ${product.name} from Wishlist`);
  };
  
  // Review Form State
  const [reviewName, setReviewName] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editComment, setEditComment] = useState('');
  const [editRating, setEditRating] = useState(5);

  const sessionEmail = sessionReviewerEmail(currentUserProp, authCtx?.currentUser);
  const registered = hasRegisteredSession(currentUserProp, authCtx?.currentUser);
  const hasOwnReview =
    registered &&
    Boolean(sessionEmail) &&
    Boolean((product.reviews || []).some((r) => isReviewOwner(r as Review, sessionEmail)));

  useEffect(() => {
    setActiveImage(product.imageUrl);
    const em = (
      currentUserProp?.email ||
      authCtx?.currentUser?.email ||
      getStoredAuth().email ||
      ''
    ).trim();
    setIsWishlisted(em ? checkIsWishlisted(product.id, em) : false);
  }, [product, currentUserProp?.email, authCtx?.currentUser?.email, email]);

  useEffect(() => {
    const registered = hasRegisteredSession(currentUserProp, authCtx?.currentUser);
    if (!registered) {
      setReviewName('');
      return;
    }
    setReviewName(pickReviewerDisplayName(currentUserProp, authCtx?.currentUser));
  }, [
    product.id,
    currentUserProp?.email,
    currentUserProp?.firstName,
    currentUserProp?.lastName,
    currentUserProp?.username,
    authCtx?.currentUser?.email,
    authCtx?.currentUser?.firstName,
    authCtx?.currentUser?.lastName,
    authCtx?.currentUser?.username,
  ]);

  const handleAddToCart = () => {
    trackCartAddition(product.id);
    onAddToCart(product);
  };

  const persistReviews = async (nextReviews: Review[]) => {
    const res = await fetch('https://www.maxbitcore.com/api/products.php');
    if (!res.ok) throw new Error('Could not load products');
    const freshProducts = await res.json();

    const updatedProducts = freshProducts.map((p: Product) => {
      if (p.id === product.id) {
        return { ...p, reviews: nextReviews };
      }
      return p;
    });

    const saveRes = await fetch('https://www.maxbitcore.com/api/save_products.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedProducts),
    });
    if (!saveRes.ok) throw new Error('Could not save reviews');

    localStorage.setItem('maxbit_published_products_v2', JSON.stringify(updatedProducts));
    product.reviews = nextReviews;
    window.dispatchEvent(new CustomEvent('maxbit-update'));
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewComment.trim()) return;

    if (registered && sessionEmail && hasOwnReview) {
      alert('You already left a review for this product. Edit or delete it in the list on the left.');
      return;
    }

    setIsSubmitting(true);

    const newReview: Review = {
      id: `REV-${Date.now()}`,
      user: reviewName.trim() || (role === 'admin' ? 'System Admin' : 'Guest Operator'),
      rating: reviewRating,
      date: new Date().toLocaleDateString(),
      comment: reviewComment.trim(),
      ...(registered && sessionEmail ? { authorEmail: sessionEmail } : {}),
    };

    const updatedReviews = [newReview, ...(product.reviews || [])];

    try {
      await persistReviews(updatedReviews);
      logAction('CLICK', `Posted Review on ${product.name.replace(/<[^>]*>?/gm, '')}`);

      setReviewComment('');
      setReviewName(
        hasRegisteredSession(currentUserProp, authCtx?.currentUser)
          ? pickReviewerDisplayName(currentUserProp, authCtx?.currentUser)
          : ''
      );
      setReviewRating(5);
    } catch (error) {
      console.error('Failed to sync report:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditReview = (r: Review) => {
    setEditingReviewId(r.id);
    setEditComment(r.comment);
    setEditRating(r.rating);
  };

  const cancelEditReview = () => {
    setEditingReviewId(null);
    setEditComment('');
    setEditRating(5);
  };

  const saveEditReview = async () => {
    if (!editingReviewId || !editComment.trim()) return;
    setIsSubmitting(true);
    try {
      const next = (product.reviews || []).map((r: Review) =>
        r.id === editingReviewId
          ? {
              ...r,
              comment: editComment.trim(),
              rating: editRating,
              date: `${new Date().toLocaleDateString()} (edited)`,
            }
          : r
      );
      await persistReviews(next);
      logAction('CLICK', `Edited review on ${product.name.replace(/<[^>]*>?/gm, '')}`);
      cancelEditReview();
    } catch (error) {
      console.error('Failed to save edited review:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!window.confirm('Delete this review? You cannot undo this.')) return;
    setIsSubmitting(true);
    try {
      const next = (product.reviews || []).filter((r: Review) => r.id !== reviewId);
      await persistReviews(next);
      if (editingReviewId === reviewId) cancelEditReview();
      logAction('CLICK', `Deleted review on ${product.name.replace(/<[^>]*>?/gm, '')}`);
    } catch (error) {
      console.error('Failed to delete review:', error);
    } finally {
      setIsSubmitting(false);
    }
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
          <svg xmlns="https://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 group-hover:-translate-x-1 transition-transform">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Return to Armory
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 mb-24 items-start">
          
          {/* Left: Images */}
          <div className="flex flex-col gap-6 lg:sticky lg:top-24 h-fit z-10">
            <div className="w-full aspect-[4/5] bg-slate-950 border border-slate-800/50 overflow-hidden rounded-[2rem] md:rounded-[3rem] relative shadow-2xl group">
              <CoverImage
                src={activeImage}
                alt={product.name.replace(/<[^>]*>?/gm, '')}
                className="w-full h-full transition-opacity duration-500"
              />
              <div className="absolute top-6 left-6 md:top-10 md:left-10">
                <span className={`flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] px-6 py-3 md:px-8 md:py-4 rounded-full border backdrop-blur-2xl transition-all duration-500 ${
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
                            <CoverImage
                              src={img}
                              alt={`Gallery ${idx + 1}`}
                              className="w-full h-full"
                            />
                        </button>
                    ))}
                </div>
            )}
          </div>

          {/* Right: Specs */}
          <div className="relative z-20 bg-[#0b0f1a] flex flex-col justify-center pt-4 lg:pt-0">
              <div className="mb-10">
                 <span className="text-xs font-black text-cyan-500 uppercase tracking-[0.5em] mb-4 block opacity-70">Sector // {product.category}</span>
                 <h1 
                   className="text-5xl md:text-7xl font-black italic tracking-tighter text-white mb-8 uppercase leading-[0.85]"
                   dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.name) }}
                 />
                 <span className="text-6xl font-black text-white font-mono tracking-tighter">${product.price}</span>
              </div>

             {product.components && (
               <div className="mb-8">
                  <h3 className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.3em] mb-4">Core Components</h3>
                  <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl">
                    <div 
                      className="text-slate-300 text-sm font-bold uppercase tracking-wide leading-relaxed prose prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.components) }}
                    />
                  </div>
               </div>
             )}
             
             <div 
               className="text-slate-400 leading-relaxed font-bold text-xl mb-12 border-b border-slate-800/50 pb-12 max-w-xl uppercase tracking-wide prose prose-invert max-w-none"
               dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description) }}
             />

             <button 
               onClick={handleAddToCart}
               disabled={isSoldOut}
               className={`max-w-md w-full py-7 uppercase tracking-[0.4em] text-xs font-black transition-all hover:scale-[1.02] rounded-[1.5rem] ${
                 isSoldOut ? 'bg-slate-800 text-slate-500' : 'maxbit-gradient text-slate-900'
               }`}
             >
               {isSoldOut ? 'Out of stock' : `Add to cart — $${product.price}`}
             </button>
             <button
                 type="button"
                 onClick={handleWishlistClick}
                 className={`mt-4 w-20 h-20 shrink-0 rounded-[1.5rem] flex items-center justify-center border transition-all ${
                     isWishlisted ? 'border-rose-500/50 text-rose-500' : 'border-slate-700/50 text-slate-400 hover:text-rose-500'
                 }`}
             >
                 <svg className="w-6 h-6" fill={isWishlisted ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                 </svg>
             </button>
          </div>
        </div>

        {/* --- REVIEWS SECTION --- */}
        <div className="border-t border-slate-800/50 pt-24">
            <div className="flex flex-col lg:flex-row gap-20">
                
                {/* Left: Review List */}
                <div className="lg:w-2/3 space-y-12">
                    <div className="flex items-center justify-between mb-12">
                        <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter text-white">Customer reviews</h2>
                        <span className="bg-slate-900 px-6 py-2 rounded-full border border-slate-800 text-xs font-semibold text-cyan-500 tracking-wide">
                            {product.reviews?.length || 0}{' '}
                            {(product.reviews?.length || 0) === 1 ? 'review' : 'reviews'}
                        </span>
                    </div>

                    <div className="space-y-8">
                        {product.reviews && product.reviews.length > 0 ? (
                            product.reviews.map((raw) => {
                              const review = raw as Review;
                              const owned = registered && isReviewOwner(review, sessionEmail);
                              const isEditing = editingReviewId === review.id;
                              return (
                                <div
                                  key={review.id}
                                  className="bg-slate-900/30 border border-slate-800 p-8 rounded-[2rem] animate-fade-in-up"
                                >
                                  <div className="flex justify-between items-start gap-4 mb-6">
                                    <div>
                                      <span className="font-black text-white uppercase italic tracking-tighter text-lg">
                                        {review.user}
                                      </span>
                                      {!isEditing && (
                                        <div className="flex gap-1 text-cyan-400 mt-2">
                                          {[...Array(5)].map((_, i) => (
                                            <svg
                                              key={i}
                                              className={`w-3 h-3 ${i < review.rating ? 'fill-cyan-400' : 'fill-slate-800'}`}
                                              viewBox="0 0 20 20"
                                            >
                                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                            </svg>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex flex-col items-end gap-2 shrink-0 text-right">
                                      <span className="text-[10px] font-mono text-slate-600 uppercase">
                                        {review.date}
                                      </span>
                                      {owned && !isEditing && (
                                        <div className="flex gap-4">
                                          <button
                                            type="button"
                                            disabled={isSubmitting}
                                            onClick={() => startEditReview(review)}
                                            className="text-xs font-semibold text-cyan-400 hover:underline disabled:opacity-40"
                                          >
                                            Edit
                                          </button>
                                          <button
                                            type="button"
                                            disabled={isSubmitting}
                                            onClick={() => void handleDeleteReview(review.id)}
                                            className="text-xs font-semibold text-rose-400 hover:underline disabled:opacity-40"
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {isEditing ? (
                                    <div className="space-y-4 border-t border-slate-800/80 pt-6">
                                      <p className="text-xs font-medium text-slate-500">Editing your review</p>
                                      <div>
                                        <span className="text-sm font-medium text-slate-300 mb-2 block">
                                          Rating (1–5)
                                        </span>
                                        <div className="flex gap-2">
                                          {[1, 2, 3, 4, 5].map((num) => (
                                            <button
                                              key={num}
                                              type="button"
                                              onClick={() => setEditRating(num)}
                                              className={`w-10 h-10 rounded-lg border transition-all flex items-center justify-center ${
                                                editRating >= num
                                                  ? 'bg-cyan-500 border-cyan-400 text-slate-950'
                                                  : 'bg-slate-950 border-slate-800 text-slate-600 hover:border-slate-600'
                                              }`}
                                            >
                                              <span className="font-black text-xs">{num}</span>
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                      <textarea
                                        value={editComment}
                                        onChange={(e) => setEditComment(e.target.value)}
                                        rows={4}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan-500 text-sm resize-none"
                                      />
                                      <div className="flex flex-wrap gap-3">
                                        <button
                                          type="button"
                                          disabled={isSubmitting || !editComment.trim()}
                                          onClick={() => void saveEditReview()}
                                          className="px-5 py-2.5 rounded-xl bg-cyan-500 text-slate-950 text-sm font-bold hover:bg-white disabled:opacity-40"
                                        >
                                          Save changes
                                        </button>
                                        <button
                                          type="button"
                                          disabled={isSubmitting}
                                          onClick={cancelEditReview}
                                          className="px-5 py-2.5 rounded-xl border border-slate-700 text-sm font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-slate-400 leading-relaxed font-medium">
                                      &ldquo;{review.comment}&rdquo;
                                    </p>
                                  )}
                                </div>
                              );
                            })
                        ) : (
                            <div className="py-20 text-center border-2 border-dashed border-slate-800 rounded-[2.5rem]">
                                <p className="text-slate-600 font-medium text-sm">No reviews yet. Be the first to share your experience.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Review Form */}
                <div className="lg:w-1/3">
                    <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] lg:sticky lg:top-24 h-fit bg-[#0b0f1a] z-10">
                        <h3 className="text-xl font-bold text-white tracking-tight mb-2">Write a review</h3>
                        <p className="text-sm text-slate-500 mb-6">Share how this product worked for you. Your login and comment will appear below.</p>
                        {hasOwnReview ? (
                          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400 leading-relaxed">
                            <p className="font-semibold text-white mb-2">You already reviewed this product</p>
                            <p>
                              Use <span className="text-cyan-400">Edit</span> or{' '}
                              <span className="text-rose-400">Delete</span> next to your review in the list on the
                              left.
                            </p>
                          </div>
                        ) : (
                        <form onSubmit={handleSubmitReview} className="space-y-6">
                            <div>
                                <label htmlFor="review-display-name" className="text-sm font-medium text-slate-300 mb-2 block">Your login</label>
                                <input 
                                    id="review-display-name"
                                    type="text" 
                                    placeholder={
                                      hasRegisteredSession(currentUserProp, authCtx?.currentUser)
                                        ? 'Your login (editable)'
                                        : 'e.g. Alex or nickname'
                                    }
                                    value={reviewName}
                                    onChange={(e) => setReviewName(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan-500 text-sm transition-all placeholder:text-slate-600"
                                />
                            </div>
                            
                            <div>
                                <label className="text-sm font-medium text-slate-300 mb-2 block">Rating (1 = poor, 5 = excellent)</label>
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
                                <label htmlFor="review-comment" className="text-sm font-medium text-slate-300 mb-2 block">Your comments</label>
                                <textarea 
                                    id="review-comment"
                                    required
                                    rows={4}
                                    placeholder="What did you like or dislike? Would you recommend it?"
                                    value={reviewComment}
                                    onChange={(e) => setReviewComment(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan-500 text-sm transition-all resize-none placeholder:text-slate-600"
                                />
                            </div>

                            <button 
                                type="submit" 
                                disabled={isSubmitting}
                                className="w-full py-4 bg-cyan-500 text-slate-950 font-bold text-sm rounded-xl hover:bg-white transition-all shadow-lg shadow-cyan-500/10"
                            >
                                {isSubmitting ? 'Submitting…' : 'Submit review'}
                            </button>
                        </form>
                        )}
                        <p className="mt-6 text-xs text-slate-500 leading-relaxed text-center">
                            Your review will be public once it is posted. Please stay respectful and honest.
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
