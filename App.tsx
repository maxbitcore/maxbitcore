
import { useState, useEffect, useMemo, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate, useParams } from 'react-router-dom';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Contact from './components/Contact';
import Footer from './components/Footer';
import CartDrawer from './components/CartDrawer';
import Checkout from './components/Checkout';
import FAQ from './components/FAQ';
import Shipping from './components/Shipping';
import Privacy from './components/Privacy';
import Terms from './components/Terms';
import Returns from './components/Returns';
import CustomBuildForm from './components/CustomBuildForm';
import { ResetPasswordPage } from './components/ResetPasswordPage';
import AdminDashboard from './components/AdminDashboard';
import ProductGrid from './components/ProductGrid';
import ProductDetail from './components/ProductDetail';
import ProductCard from './components/ProductCard';
import NewInStockBanner from './components/NewInStockBanner';
import { trackVisit, trackProductView, trackPageNav, trackSearch } from './services/analyticsService';
import {
  parseMetaCheckoutProducts,
  trackMetaAddToCart,
} from './services/metaPixelService';
import {
  isWindowsLicenseProductId,
  buildWindowsLicenseProduct,
  type WindowsLicenseChoice,
} from './services/windowsLicenseOptions';
import { Product, ViewState, MainTab } from './types';
import { CustomerDashboard } from './components/CustomerDashboard';
import {
  pickJoinedFromAuthPayload,
  logoutUser,
  touchSessionActivity,
  checkSessionIdleExpired,
  logoutDueToIdleSession,
} from './services/authService';
import DatePicker from "react-datepicker";
import 'react-datepicker/dist/react-datepicker.css';
import { enUS } from 'date-fns/locale';


const ProductDetailRoute = ({
  publishedProducts,
  cartItems,
  addToCart,
  setView,
  navigate,
  currentUser,
}: {
  publishedProducts: any[];
  cartItems: Product[];
  addToCart: (p: any) => void;
  setView: (v: any) => void;
  navigate: any;
  currentUser: any;
}) => {
  const { id } = useParams();
  const product = publishedProducts.find(p => p && p.id && p.id.toString() === id);

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0f1a]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Initializing System...</p>
        </div>
      </div>
    );
  }

  return (
    <ProductDetail
      product={product}
      cartItems={cartItems}
      currentUser={currentUser}
      onBack={() => {
        navigate(-1);
        setView({ type: 'tab', activeTab: 'gaming-pcs' });
      }}
      onAddToCart={addToCart}
    />
  );
};

function App() {
  const [view, setView] = useState<ViewState>({ type: 'tab', activeTab: 'home' });
  const [cartItems, setCartItems] = useState<Product[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [publishedProducts, setPublishedProducts] = useState<Product[]>([]);
  const [showRegister, setShowRegister] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [showRegSuccess, setShowRegSuccess] = useState(false);
  const [password, setPassword] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [appMode, setAppMode] = useState<'landing' | 'dashboard'>('landing');
  const [securityKey, setSecurityKey] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [activeTab, setActiveTab] = useState<string>('home');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const metaCheckoutHandledRef = useRef('');
  /** Navbar is in document flow on all breakpoints; no top offset needed. */
  const mainTopClass = 'pt-0';

  const switchToRegister = () => {
    resetRegForm();
    setIsLoginOpen(false);
    setShowRegister(true);
  };


  const switchToLogin = () => {
    resetRegForm();
    setShowRegister(false);
    setIsLoginOpen(true);
  };

  const clearCart = () => {
    setCartItems([]);
    setIsCartOpen(false);
    try {
      localStorage.removeItem('cart');
    } catch {
      /* private mode */
    }
  };

  const handleLoginSuccess = (user: any) => {
    const prevKey = currentUser
      ? String(currentUser.email ?? currentUser.id ?? '').toLowerCase()
      : '';
    const nextKey = String(user?.email ?? user?.id ?? '').toLowerCase();
    if (prevKey && nextKey && prevKey !== nextKey) {
      clearCart();
    }
    setCurrentUser(user);
    if (user.role !== 'admin') {
      setAppMode('dashboard');
      setView({ type: 'tab', activeTab: 'dashboard' as any });
      navigate('/dashboard');
    }
    console.log("User logged in:", user);
  };

  const handleLogout = () => {
    logoutUser();
    clearCart();
    setCurrentUser(null);
    setAppMode('landing');

    navigate('/');
    setView({ type: 'tab', activeTab: 'home' });
  };

  const resetRegForm = () => {
    setFirstName('');
    setLastName('');
    setUsername('');
    setEmail('');
    setPhone('');
    setBirthDate('');
    setPassword('');
    setConfirmPassword('');
    setSecurityKey('');
  };

  /** Restore session; idle >1h → clear auth and show notice (single effect avoids racing restores after logout). */
  useEffect(() => {
    try {
      if (sessionStorage.getItem('maxbit_session_expired')) {
        setSessionExpiredNotice(true);
        sessionStorage.removeItem('maxbit_session_expired');
      }
    } catch {
      /* private mode */
    }

    const token = localStorage.getItem('maxbit_token');

    if (token && checkSessionIdleExpired()) {
      logoutDueToIdleSession();
      clearCart();
      setSessionExpiredNotice(true);
      setCurrentUser(null);
      setAppMode('landing');
      return;
    }

    if (token) {
      touchSessionActivity();
    }

    const savedUser =
      localStorage.getItem('maxbit_currentUser') || localStorage.getItem('maxbit_user');
    const savedRole = localStorage.getItem('maxbit_role');

    if (token && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setCurrentUser(parsedUser);

        if (parsedUser.role !== 'admin' && savedRole !== 'admin') {
          setAppMode('dashboard');
        }
      } catch (e) {
        console.error('Session error: Profile data corrupted');
        localStorage.removeItem('maxbit_currentUser');
      }
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('verified') === 'true') {
      if (cartItems.length > 0) {
        setCartItems([]);
        localStorage.removeItem('cart');
      }
      navigate(location.pathname, { replace: true });
    }
  }, [location.search, navigate, cartItems.length]);

  useEffect(() => {
    const path = location.pathname.replace('/', '') as MainTab;
    if (path && path !== (view.type === 'tab' ? view.activeTab : '')) {
      if (['home', 'configurator', 'gaming-pcs', 'components', 'peripherals', 'contact', 'faq', 'shipping', 'privacy', 'terms', 'returns', 'admin'].includes(path)) {
        setView({ type: 'tab', activeTab: path });
      }
    }
  }, [location]);

  useEffect(() => {
    trackVisit();
  }, []);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible' && localStorage.getItem('maxbit_token')) {
        touchSessionActivity();
      }
    };
    const interval = window.setInterval(tick, 60 * 1000);
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (!localStorage.getItem('maxbit_token')) return;
      if (checkSessionIdleExpired()) {
        logoutDueToIdleSession();
        clearCart();
        setSessionExpiredNotice(true);
        setCurrentUser(null);
        setAppMode('landing');
        navigate('/');
        return;
      }
      touchSessionActivity();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [navigate]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'a' || event.key === 'A')) {
        event.preventDefault();
        setView({ type: 'tab', activeTab: 'admin' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (view.type === 'product') {
      trackProductView(view.product.id, view.product.name);
    }
    if (view.type === 'tab') {
        trackPageNav(view.activeTab);
    } else if (view.type === 'checkout') {
        trackPageNav('checkout');
    }
  }, [view]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('https://www.maxbitcore.com/api/products.php', {
          cache: 'no-store',
        });
        const data = await response.json();
        if (Array.isArray(data)) {
          const approved = data.filter((p) => p && p.isApproved && p.isPublished);
          setPublishedProducts(approved);
          setFilteredProducts(approved);
        }
      } catch (e) {
        console.error("Load Error", e);
        setPublishedProducts([]);
        setFilteredProducts([]);
      }
    };

    loadData();
    window.addEventListener('storage', loadData);
    const onCatalogUpdate = (e: Event) => {
      const d = (e as CustomEvent<{ scope?: string }>).detail;
      if (d?.scope === 'submissions') return;
      void loadData();
    };
    window.addEventListener('maxbit-update', onCatalogUpdate);
    return () => {
      window.removeEventListener('storage', loadData);
      window.removeEventListener('maxbit-update', onCatalogUpdate);
    };
  }, []);

  /** Meta Commerce checkout URL: ?products=id:qty,id:qty — replace cart, then /checkout (no coupon). */
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const productsParam = params.get('products');
    if (!productsParam) return;
    if (!publishedProducts.length) return;

    const sig = `${location.pathname}|${productsParam}`;
    if (metaCheckoutHandledRef.current === sig) return;

    const lines = parseMetaCheckoutProducts(productsParam);
    metaCheckoutHandledRef.current = sig;

    if (!lines.length) {
      navigate('/checkout', { replace: true });
      return;
    }

    const newCart: Product[] = [];
    const missing: string[] = [];

    for (const line of lines) {
      const product = publishedProducts.find((p) => String(p.id) === String(line.id));
      if (!product || product.status === 'Sold Out') {
        missing.push(line.id);
        continue;
      }
      for (let i = 0; i < line.quantity; i++) {
        newCart.push({ ...product });
      }
    }

    setCartItems(newCart);
    setIsCartOpen(false);

    if (missing.length > 0 && newCart.length === 0) {
      alert(
        'Items from Facebook could not be added. Check that catalog product IDs match your store product IDs.'
      );
    } else if (missing.length > 0) {
      console.warn('Meta checkout: some product IDs were not found or sold out:', missing);
    }

    navigate('/checkout', { replace: true });
  }, [location.search, location.pathname, publishedProducts, navigate]);

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
    if (tab !== 'dashboard') {
      setAppMode('landing');
    } else {
      setAppMode('dashboard');
    }

    setView({ type: 'tab', activeTab: tab });

    const path = tab === 'home' ? '/' : `/${tab}`;
    navigate(path);
  };

  const handleSearch = (query: string) => {
    const lowerQuery = query.toLowerCase().trim();
    setSearchQuery(lowerQuery);

    if (!lowerQuery) {
      setFilteredProducts(publishedProducts);
    } else {
      const filtered = publishedProducts.filter((p: any) => {
        if (!p) return false;
        const name = p.name?.toLowerCase() || '';
        const desc = p.description?.toLowerCase() || '';
        const comps = typeof p.components === 'string' ? p.components.toLowerCase() : '';

        return name.includes(lowerQuery) || desc.includes(lowerQuery) || comps.includes(lowerQuery);
      });
      setFilteredProducts(filtered);
      trackSearch(lowerQuery);
    }
    navigate('/gaming-pcs');
  };

  const addToCart = (product: Product) => {
    trackMetaAddToCart({
      id: String(product.id),
      name: String(product.name || 'Product'),
      price: Number(product.price) || 0,
    });
    setCartItems(prev => [...prev, product]);
    setIsCartOpen(true);
  };

  const removeFromCart = (index: number) => {
    setCartItems(prev => {
      const removed = prev[index];
      if (!removed) return prev;
      let next = prev.filter((_, i) => i !== index);
      if (!isWindowsLicenseProductId(String(removed.id))) {
        next = next.filter((item) => String(item.bundleParentId || '') !== String(removed.id));
      }
      return next;
    });
  };

  const setWindowsLicenseForProduct = (productId: string, choice: WindowsLicenseChoice) => {
    const pid = String(productId || '').trim();
    if (!pid) return;
    setCartItems((prev) => {
      const without = prev.filter(
        (item) =>
          !(
            isWindowsLicenseProductId(String(item.id)) &&
            String(item.bundleParentId || '').trim() === pid
          )
      );
      if (choice !== 'home' && choice !== 'pro') return without;
      return [...without, buildWindowsLicenseProduct(choice, pid)];
    });
  };

  const currentTab = view.type === 'tab' ? view.activeTab : null;

  const HomePage = () => (
    <div className="animate-fade-in-up">
      <Hero onExplore={() => handleTabChange('configurator')} />
      <NewInStockBanner 
        newProducts={newProducts} 
        onProductClick={(p) => {navigate(`/product/${p.id}`);}}
      />
      <section className="pt-10 pb-16 md:pt-12 md:pb-20 px-6 md:px-12 bg-[#0b0f1a] border-t border-slate-900">
        <div className="max-w-[1800px] mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
            <div>
              <h2 className="text-3xl md:text-5xl font-black italic tracking-tighter text-white uppercase">Hardware Collection</h2>
            </div>
          </div>
          {filteredProducts && filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {filteredProducts.map(product => (
                <ProductCard 
                  key={product.id} 
                  product={product} 
                  onClick={(p) => navigate(`/product/${p.id}`)} 
                  onAddToCart={addToCart}
                  currentUser={currentUser}
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
  );

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-slate-200 selection:bg-cyan-500/30 flex flex-col">
      <Navbar 
          activeTab={currentTab}
          onTabChange={handleTabChange}
          cartCount={cartItems.length}
          onOpenCart={() => setIsCartOpen(true)}
          onSearch={handleSearch}
          allProducts={publishedProducts}
          resetRegForm={resetRegForm}
          currentUser={currentUser}
          onLogout={handleLogout}
          onLoginSuccess={handleLoginSuccess}
          onOpenRegister={switchToRegister}
       />

      {sessionExpiredNotice && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-md px-4 animate-fade-in">
          <div className="bg-amber-500/95 text-slate-950 p-5 rounded-2xl border border-amber-400 shadow-xl flex flex-col gap-3 text-center">
            <p className="text-sm font-black uppercase tracking-widest">Session expired</p>
            <p className="text-xs font-bold text-slate-900/85">
              You were inactive for over an hour. Please sign in again to continue.
            </p>
            <button
              type="button"
              onClick={() => setSessionExpiredNotice(false)}
              className="py-2.5 bg-slate-950 text-amber-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
      
      <main className={`flex-grow ${mainTopClass}`}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="/index.html" element={<Navigate to="/" replace />} />

          <Route path="/dashboard" element={
            currentUser ? (
              <CustomerDashboard 
                currentUser={currentUser}
                allProducts={publishedProducts}
                onSelectProduct={(product) => navigate(`/product/${product.id}`)}
                onLogout={() => {
                  logoutUser();
                  clearCart();
                  setCurrentUser(null);
                  setAppMode('landing');
                  navigate('/'); 
                }} 
              />
            ) : (
              <Navigate to="/" replace />
            )
          } />

            <Route path="/configurator" element={<div className="pt-4 lg:pt-6"><CustomBuildForm currentUser={currentUser}/></div>} />
            
            <Route path="/gaming-pcs" element={
              <ProductGrid 
                category={searchQuery ? 'All' : 'Gaming PCs'} 
                onProductClick={(p) => {
                  navigate(`/product/${p.id}`);
                }}
                onAddToCart={addToCart}
                searchQuery={searchQuery} 
                externalProducts={filteredProducts}
                currentUser={currentUser}
              />
            } />
            
            <Route path="/components" element={
              <ProductGrid 
                category="Components" 
                onProductClick={(p) => {
                  navigate(`/product/${p.id}`);
                }}
                onAddToCart={addToCart}
                searchQuery={searchQuery} 
                externalProducts={filteredProducts} 
                currentUser={currentUser}
              />
            } />
            
            <Route path="/peripherals" element={
              <ProductGrid 
                category="Peripherals" 
                onProductClick={(p) => {
                  navigate(`/product/${p.id}`);
                }}
                onAddToCart={addToCart}
                searchQuery={searchQuery} 
                externalProducts={filteredProducts} 
                currentUser={currentUser}
              />
            } />

            <Route path="/contact" element={<Contact />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/shipping" element={<Shipping />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/returns" element={<Returns />} />

          <Route path="/reset-password" element={<ResetPasswordPage />} />
            
            <Route path="/admin" element={
              <AdminDashboard 
               showRegister={showRegister} 
               closeRegister={() => setShowRegister(false)} 
              />
            } />

          <Route path="/product/:id" element={
            <ProductDetailRoute
              publishedProducts={publishedProducts}
              cartItems={cartItems}
              addToCart={addToCart}
              setView={setView}
              navigate={navigate}
              currentUser={currentUser}
            />
          } />

          <Route path="/checkout" element={
            <Checkout 
              items={cartItems} 
              currentUser={currentUser}
              onRemoveItem={removeFromCart}
              onSetWindowsLicense={setWindowsLicenseForProduct}
              onBack={() => {
                setView({ type: 'tab', activeTab: 'home' }); 
                navigate('/');            
              }} 
            />
          } />
        </Routes>
      </main>
      
      <Footer onTabChange={handleTabChange} />
      
      <CartDrawer 
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onRemoveItem={removeFromCart}
        onCheckout={() => {
            setIsCartOpen(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            navigate('/checkout');
        }}
      />

      {showRegister && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl max-w-2xl w-full relative my-auto animate-fade-in">
            <button onClick={() => {setShowRegister(false); resetRegForm();}} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="text-center mb-8">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500">MaxBit LLC Protocol</span>
              <h2 className="text-2xl font-black text-white italic uppercase mt-2">Create Customer Profile</h2>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();

              if (password !== confirmPassword) {
                alert("CRITICAL ERROR: PASSWORDS DO NOT MATCH.");
                return;
              }

              const passwordRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])(?=.{8,})/;
              if (!passwordRegex.test(password)) {
                alert("SECURITY BREACH: PASSWORD TOO WEAK. Use 8+ chars, Uppercase, Number and Symbol (!@#$%^&*)");
                return; 
              }

              if (email.includes('@maxbitcore.com') && !securityKey) {
                alert("ACCESS DENIED: SECURITY KEY REQUIRED FOR ADMIN PROTOCOL.");
                return;
              }

              const userData = { id: Date.now().toString(), username, firstName, lastName, email, phone, birthDate, password, securityKey, role: email.includes('@maxbitcore.com') ? 'admin' : 'customer' };
              try {
                const response = await fetch('https://www.maxbitcore.com/api/register.php', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(userData)
                });
    
                const data = await response.json();
                console.log("DB Sync Response:", data);

                if (data.success === true || data.message?.includes("success") || response.ok) {

                    setShowRegister(false);
                    const joined =
                      pickJoinedFromAuthPayload(data) || new Date().toISOString();
                    const userWithJoined = { ...userData, joined };

                    clearCart();
                    setCurrentUser(userWithJoined);

                const users = JSON.parse(localStorage.getItem('maxbit_customers') || '[]');
                localStorage.setItem('maxbit_customers', JSON.stringify([...users, userWithJoined]));
                localStorage.setItem('maxbit_user', JSON.stringify(userWithJoined));
                localStorage.setItem(
                  'maxbit_currentUser',
                  JSON.stringify({
                    id: userWithJoined.id,
                    email: userWithJoined.email,
                    role: userWithJoined.role,
                    firstName: userWithJoined.firstName,
                    lastName: userWithJoined.lastName,
                    username: userWithJoined.username,
                    joined: userWithJoined.joined,
                  }),
                );
                
                   
                setShowRegSuccess(true); 
                setTimeout(() => setShowRegSuccess(false), 5000);      

                alert("CONNECTION ESTABLISHED. Welcome to MaxBit.");

                setFirstName(''); setLastName(''); setEmail(''); setUsername('');
                setPhone(''); setBirthDate(''); setPassword('');
                setConfirmPassword('');;

                   if (userData.role !== 'admin') {
                       setAppMode('dashboard'); 
                       setView({ type: 'tab', activeTab: 'dashboard' });
                       navigate('/dashboard'); 
                   } else {
                       setView({ type: 'tab', activeTab: 'admin' });
                       navigate('/admin'); 
                   }

               } else {
                   alert(`REGISTRATION DENIED: ${data.error || data.message || "User already exists"}`);
               }

             } catch (error) {
    
               console.error("Registration API error:", error);
               alert("CRITICAL SYSTEM FAILURE: Unable to reach database. Try again.");
             } 
              
           }} className="space-y-4 text-left">
                <div className="space-y-1 text-left">
                  <label className="text-[9px] font-black text-cyan-500 uppercase ml-2 tracking-[0.2em]">
                    Username *
                  </label>
                  <input 
                    required
                    type="text" 
                    placeholder="CHOOSE YOUR LOGIN" 
                    value={username} 
                    onChange={e => setUsername(e.target.value)} 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-[10px] font-black outline-none focus:border-cyan-500 placeholder:text-slate-700 transition-all"
                  />
               </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 text-left">
                  <label className="text-[9px] font-black text-cyan-500 uppercase ml-2 tracking-[0.2em]">
                    First Name *
                  </label>
                  <input 
                    required 
                    type="text"
                    placeholder="ENTER FIRST NAME" 
                    autoComplete="given-name"
                    value={firstName} 
                    onChange={e => setFirstName(e.target.value)} 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-[10px] font-black outline-none focus:border-cyan-500 transition-all" 
                  />
               </div>
                <div className="space-y-1 text-left">
                  <label className="text-[9px] font-black text-cyan-500 uppercase ml-2 tracking-[0.2em]">
                    Last Name *
                 </label>
                 <input 
                   required 
                   type="text"
                   placeholder="ENTER LAST NAME" 
                   autoComplete="family-name"
                   value={lastName} 
                   onChange={e => setLastName(e.target.value)} 
                   className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-[10px] font-black outline-none focus:border-cyan-500 transition-all" 
                 />
               </div>
             </div>

              {/* Email */}
              <div className="space-y-1 text-left">
                <label className="text-[9px] font-black text-cyan-500 uppercase ml-2 tracking-[0.2em]">
                 Email Address *
                </label>
                <input 
                  required 
                  type="email" 
                  placeholder="EXAMPLE@MAXBITCORE.COM" 
                  autoComplete="email"
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-[10px] font-black outline-none focus:border-cyan-500 transition-all" 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-cyan-500 uppercase ml-2 tracking-[0.2em]">Date of Birth *</label>
                <div className="custom-datepicker-wrapper">
                  <DatePicker
                    selected={birthDate ? new Date(birthDate.replace(/-/g, '/')) : null}
                    onChange={(date: Date | null) => {
                      if (date) {
                        const y = date.getFullYear();
                        const m = String(date.getMonth() + 1).padStart(2, '0');
                        const d = String(date.getDate()).padStart(2, '0');
                        setBirthDate(`${y}-${m}-${d}`);
                      } else {
                        setBirthDate('');
                      }
                    }}
                    locale={enUS}
                    dateFormat="MM/dd/yyyy"
                    placeholderText="MM/DD/YYYY"
                    showYearDropdown
                    scrollableYearDropdown
                    yearDropdownItemNumber={100}
                    maxDate={new Date()}
                    required
     
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-[10px] font-black uppercase outline-none focus:border-cyan-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1 text-left">
                <label className="text-[9px] font-black text-cyan-500 uppercase ml-2 tracking-[0.2em]">
                  Phone (Optional)
                </label>
                <input 
                  type="tel" 
                  placeholder="ENTER PHONE NUMBER" 
                  autoComplete="tel"
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-[10px] font-black outline-none focus:border-cyan-500 transition-all" 
                />
              </div>
               
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 text-left">
                  <label className="text-[9px] font-black text-cyan-500 uppercase ml-2 tracking-[0.2em]">
                    Create Password *
                  </label>
                  <div className="relative">
                    <input 
                      required 
                      type={showRegPassword ? "text" : "password"}
                      placeholder="••••••••" 
                      autoComplete="new-password"
                      value={password} 
                      onChange={e => setPassword(e.target.value)} 
                      className={`w-full bg-slate-950 border rounded-xl px-4 py-3 pr-10 text-white text-[10px] font-black outline-none transition-all ${
                        password.length > 0 && !/^(?=.*[A-Z])(?=.*[!@#$%^&*])(?=.*[0-9]).{8,}$/.test(password)
                          ? "border-amber-500/50 focus:border-amber-500"
                          : "border-slate-800 focus:border-cyan-500"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cyan-500 transition-colors"
                    >
                      {showRegPassword ? (
                        <svg xmlns="https://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                      ) : (
                        <svg xmlns="https://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1 text-left">
                  <label className="text-[9px] font-black text-cyan-500 uppercase ml-2 tracking-[0.2em]">
                    Confirm Password *
                  </label>
                  <input 
                    required 
                    type="password" 
                    placeholder="••••••••" 
                    autoComplete="new-password"
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)} 
                    className={`w-full bg-slate-950 border rounded-xl px-4 py-3 text-white text-[10px] font-black outline-none transition-all ${
                    confirmPassword && password !== confirmPassword ? "border-rose-500" : "border-slate-800 focus:border-cyan-500"
                  }`}
                />
              </div>
            </div>

           {/* Security Key */}
           {email.includes('@maxbitcore.com') && (
             <div className="space-y-1 text-left mt-4">
               <label className="text-[9px] font-black text-cyan-500 uppercase ml-2 tracking-[0.2em]">
                 Security Key *
               </label>
               <input 
                 required 
                 type="password" 
                 placeholder="ENTER KEY" 
                 autoComplete="off"
                 value={securityKey} 
                 onChange={e => setSecurityKey(e.target.value)} 
                 className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-[10px] font-black outline-none focus:border-cyan-500 placeholder:text-rose-500/30"
               />
             </div>
           )}

              <button type="submit" className="w-full py-4 bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-black uppercase text-xs rounded-xl hover:opacity-90 transition-all shadow-lg shadow-cyan-500/10 mt-4 active:scale-[0.98]" >Register account</button>
              <button  type="button" onClick={switchToLogin} className="w-full mt-4 text-[10px] font-black text-slate-500 uppercase hover:text-cyan-500 transition-colors tracking-widest"> Already have an account? Log In </button>
            </form>
          </div>
        </div>
      )}
      {showRegSuccess && (
        <div className="fixed bottom-10 right-10 z-[10000] animate-in fade-in slide-in-from-right-10 duration-500">
          <div className="bg-slate-950 border-2 border-cyan-500 shadow-[0_0_40px_rgba(6,182,212,0.3)] p-6 rounded-3xl flex items-center gap-5 backdrop-blur-xl">
            <div className="relative">
              <div className="absolute inset-0 bg-cyan-500 rounded-full animate-ping opacity-20"></div>
              <div className="w-12 h-12 bg-cyan-500/10 border border-cyan-500/40 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <div>
              <h4 className="text-white font-black uppercase italic tracking-tighter text-xl leading-none">Access Granted</h4>
              <p className="text-[9px] text-cyan-500 font-black uppercase tracking-[0.3em] mt-2 leading-none">
                Protocol Complete. Check your email.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;