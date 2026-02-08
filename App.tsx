
import React, { useState, useEffect, useMemo } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Contact from './components/Contact';
import Assistant from './components/Assistant';
import Footer from './components/Footer';
import CartDrawer from './components/CartDrawer';
import Checkout from './components/Checkout';
import FAQ from './components/FAQ';
import Shipping from './components/Shipping';
import Privacy from './components/Privacy';
import Terms from './components/Terms';
import Returns from './components/Returns';
import CustomBuildForm from './components/CustomBuildForm';
import AdminDashboard from './components/AdminDashboard';
import ProductGrid from './components/ProductGrid';
import ProductDetail from './components/ProductDetail';
import ProductCard from './components/ProductCard';
import NewInStockBanner from './components/NewInStockBanner';
import { trackVisit, trackProductView, trackPageNav, trackSearch } from './services/analyticsService';
import { Product, ViewState, MainTab } from './types';

function App() {
  const [view, setView] = useState<ViewState>({ type: 'tab', activeTab: 'home' });
  const [cartItems, setCartItems] = useState<Product[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [publishedProducts, setPublishedProducts] = useState<Product[]>([]);

  // Track site visit once on load
  useEffect(() => {
    trackVisit();
  }, []);

  // Admin Mode Shortcut Listener
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl + Shift + A (Access Admin)
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'a' || event.key === 'A')) {
        event.preventDefault();
        setView({ type: 'tab', activeTab: 'admin' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Track product views
  useEffect(() => {
    if (view.type === 'product') {
      trackProductView(view.product.id, view.product.name);
    }
    
    // Log Navigation
    if (view.type === 'tab') {
        trackPageNav(view.activeTab);
    } else if (view.type === 'checkout') {
        trackPageNav('checkout');
    }
  }, [view]);

  // Load user products on mount with safety checks
  useEffect(() => {
    const loadData = () => {
      try {
        const raw = localStorage.getItem('maxbit_published_products');
        if (raw) {
          const saved = JSON.parse(raw);
          if (Array.isArray(saved)) {
            // Исправление: фильтруем только опубликованные товары для витрины
            const approved = saved.filter((p: Product) => p && p.isApproved === true && p.isPublished === true);
            setPublishedProducts(approved);
          }
        } else {
          setPublishedProducts([]);
        }
      } catch (e) {
        console.error("Corrupted product database. Resetting view.", e);
        setPublishedProducts([]);
      }
    };

    loadData();
    window.addEventListener('storage', loadData);
    window.addEventListener('maxbit-update', loadData);
    return () => {
      window.removeEventListener('storage', loadData);
      window.removeEventListener('maxbit-update', loadData);
    };
  }, [view]);

  // Identify "new" products (added within the last 48 hours)
  const newProducts = useMemo(() => {
    if (!publishedProducts || !Array.isArray(publishedProducts)) return [];
    const now = Date.now();
    const fortyEightHours = 48 * 60 * 60 * 1000;
    return publishedProducts
      .filter(p => p && p.createdAt && (now - p.createdAt < fortyEightHours))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [publishedProducts]);

  const handleTabChange = (tab: MainTab) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setSearchQuery('');
    setView({ type: 'tab', activeTab: tab });
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      trackSearch(query); // Log Search Event
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setView({ type: 'tab', activeTab: 'gaming-pcs' });
    }
  };

  const addToCart = (product: Product) => {
    setCartItems(prev => [...prev, product]);
    setIsCartOpen(true);
  };

  const removeFromCart = (index: number) => {
    setCartItems(prev => {
      const newItems = [...prev];
      newItems.splice(index, 1);
      return newItems;
    });
  };

  const currentTab = view.type === 'tab' ? view.activeTab : null;

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-slate-200 selection:bg-cyan-500/30 flex flex-col">
      <Navbar 
          activeTab={currentTab}
          onTabChange={handleTabChange}
          cartCount={cartItems.length}
          onOpenCart={() => setIsCartOpen(true)}
          onSearch={handleSearch}
      />
      
      <main className="flex-grow">
        {view.type === 'tab' && view.activeTab === 'home' && (
          <div className="animate-fade-in-up">
            <Hero onExplore={() => handleTabChange('configurator')} />
            
            <NewInStockBanner 
              newProducts={newProducts} 
              onProductClick={(p) => setView({ type: 'product', product: p })}
            />
            
            <section className="py-24 px-6 md:px-12 bg-[#0b0f1a] border-t border-slate-900">
              <div className="max-w-[1800px] mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-6">
                  <div>
                    <h2 className="text-3xl md:text-5xl font-black italic tracking-tighter text-white uppercase">Hardware Collection</h2>
                  </div>
                </div>

                {publishedProducts && publishedProducts.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    {publishedProducts.map(product => (
                      <ProductCard 
                        key={product.id} 
                        product={product} 
                        onClick={(p) => setView({ type: 'product', product: p })} 
                      />
                    ))}
                  </div>
                ) : (
                  <div className="py-24 border-2 border-dashed border-slate-800 rounded-3xl flex flex-col items-center justify-center text-center px-6">
                    <div className="w-20 h-20 bg-slate-900 rounded-2xl flex items-center justify-center mb-8 border border-slate-800">
                      <svg className="w-10 h-10 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-black italic text-slate-500 uppercase tracking-tighter mb-4">No Hardware Published</h3>
                    <p className="text-slate-600 max-w-sm text-sm font-bold uppercase tracking-widest leading-relaxed">
                      This space is reserved for approved custom PC configurations and newly deployed inventory.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {view.type === 'tab' && view.activeTab === 'configurator' && (
          <div className="animate-fade-in-up pt-16">
            <CustomBuildForm />
          </div>
        )}

        {view.type === 'tab' && (view.activeTab === 'gaming-pcs' || view.activeTab === 'components' || view.activeTab === 'peripherals') && (
          <ProductGrid 
            category={view.activeTab === 'gaming-pcs' ? (searchQuery ? 'All' : 'Gaming PCs') : view.activeTab === 'components' ? 'Components' : 'Peripherals'}
            onProductClick={(p) => setView({ type: 'product', product: p })}
            searchQuery={searchQuery}
            externalProducts={publishedProducts}
          />
        )}

        {view.type === 'product' && (
          <ProductDetail 
            product={view.product} 
            onBack={() => setView({ type: 'tab', activeTab: 'home' })} 
            onAddToCart={addToCart} 
          />
        )}

        {view.type === 'tab' && view.activeTab === 'admin' && (
          <AdminDashboard />
        )}

        {view.type === 'tab' && view.activeTab === 'contact' && <Contact />}
        {view.type === 'tab' && view.activeTab === 'faq' && <FAQ />}
        {view.type === 'tab' && view.activeTab === 'shipping' && <Shipping />}
        {view.type === 'tab' && view.activeTab === 'privacy' && <Privacy />}
        {view.type === 'tab' && view.activeTab === 'terms' && <Terms />}
        {view.type === 'tab' && view.activeTab === 'returns' && <Returns />}

        {view.type === 'checkout' && (
            <Checkout 
                items={cartItems}
                onBack={() => setView({ type: 'tab', activeTab: 'home' })}
            />
        )}
      </main>

      <Footer onTabChange={handleTabChange} />
      
      <Assistant />
      
      <CartDrawer 
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onRemoveItem={removeFromCart}
        onCheckout={() => {
            setIsCartOpen(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setView({ type: 'checkout' });
        }}
      />
    </div>
  );
}

export default App;
