
import { useState, useEffect, useMemo } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate, useParams } from 'react-router-dom';
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
import { CustomerDashboard } from './components/CustomerDashboard';
import { sendRegistrationEmail } from './services/emailService';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css"
import { enUS } from 'date-fns/locale';


const ProductDetailRoute = ({ publishedProducts, addToCart, setView, navigate }: { 
  publishedProducts: any[], 
  addToCart: (p: any) => void, 
  setView: (v: any) => void,
  navigate: any 
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
      onBack={() => {
        navigate(-1); 
        setView({ type: 'tab', activeTab: 'gaming-pcs' }); 
      }}
      onAddToCart={addToCart} 
    />
  );
}

function App() {
  const [view, setView] = useState<ViewState>({ type: 'tab', activeTab: 'home' });
  const [cartItems, setCartItems] = useState<Product[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [publishedProducts, setPublishedProducts] = useState<Product[]>([]);
  const [showRegister, setShowRegister] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState('');
  const [showRegSuccess, setShowRegSuccess] = useState(false);
  const [password, setPassword] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [appMode, setAppMode] = useState<'landing' | 'dashboard'>('landing');
  const [securityKey, setSecurityKey] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [activeTab, setActiveTab] = useState<string>('home');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  
  const navigate = useNavigate(); 
  const location = useLocation();

  const switchToRegister = () => {
    setIsLoginOpen(false);
    setShowRegister(true);
  };


  const switchToLogin = () => {
    setShowRegister(false);
    setIsLoginOpen(true);
  };

  const handleLoginSuccess = (user: any) => {
    setCurrentUser(user);
    if (user.role !== 'admin') {
      setAppMode('dashboard');
      setView({ type: 'tab', activeTab: 'dashboard' as any });
      navigate('/dashboard');
    }
    console.log("User logged in:", user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setAppMode('landing');
    localStorage.clear(); 
    navigate('/');
    setView({ type: 'tab', activeTab: 'home' });
  };

  useEffect(() => {
    const saved = localStorage.getItem('maxbit_currentUser');
    if (saved) {
      try {
        setCurrentUser(JSON.parse(saved));
      } catch (e) {
        console.error("Ошибка парсинга юзера");
      }
    }
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem('maxbit_token');
    const savedUser = localStorage.getItem('maxbit_currentUser');
    const savedRole = localStorage.getItem('maxbit_role');

    if (savedToken && savedUser) {
      setCurrentUser(JSON.parse(savedUser));
      if (savedRole !== 'admin') {
        setAppMode('dashboard');
     }
    }
  }, []);

  useEffect(() => {
  const params = new URLSearchParams(location.search);
  if (params.get('success') === 'true') {
    const orderId = params.get('orderId') || 'CONFIRMED';
    setCurrentOrderId(orderId);
    setShowSuccessAlert(true);
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
        const response = await fetch('https://maxbitcore.com/api/products.php');
        const data = await response.json();
        if (Array.isArray(data)) {
          const approved = data.filter((p) => p && p.isApproved && p.isPublished);
          setPublishedProducts(approved);
        }
      } catch (e) {
        console.error("Load Error", e);
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

    const path = tab === 'home' ? '/' : `/${tab}`;
    navigate(path);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      trackSearch(query); 
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

  const HomePage = () => (
    <div className="animate-fade-in-up">
      <Hero onExplore={() => handleTabChange('configurator')} />
      <NewInStockBanner 
        newProducts={newProducts} 
        onProductClick={(p) => {navigate(`/product/${p.id}`);}}
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
                  onClick={(p) => navigate(`/product/${p.id}`)} 
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
          isLoginOpen={isLoginOpen}
          setIsLoginOpen={setIsLoginOpen}
          switchToRegister={switchToRegister}
          currentUser={currentUser} 
          onLogout={() => { setCurrentUser(null); setAppMode('landing'); localStorage.clear(); navigate('/'); setView({ type: 'tab', activeTab: 'home' });}}
          onLoginSuccess={(user) => {setCurrentUser(user);if (user.role !== 'admin') {setAppMode('dashboard'); setView({ type: 'tab', activeTab: 'dashboard' }); navigate('/dashboard');}}}
       />
      
      {showSuccessAlert && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-md px-4 animate-fade-in">
          <div className="bg-emerald-500 text-slate-950 p-6 rounded-3xl shadow-[0_0_50px_rgba(16,185,129,0.4)] border border-emerald-400 flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mb-4 border border-white/30">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-1">Payment Received</h2>
            <p className="text-[10px] font-black opacity-90 uppercase tracking-widest mb-6">
              ORDER ID: {currentOrderId} <br />
              Confirmation sent to your email
            </p>
            <button 
              onClick={() => {
                setShowSuccessAlert(false);
                navigate('/gaming-pcs');
              }}
              className="w-full py-3 bg-slate-950 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-slate-800 transition-all active:scale-95"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      )}

      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="/index.html" element={<Navigate to="/" replace />} />

          <Route path="/dashboard" element={
            currentUser ? (
              <CustomerDashboard 
                user={currentUser} 
                onLogout={() => {
                  setCurrentUser(null);
                  setAppMode('landing');
                  navigate('/'); 
                }} 
              />
            ) : (
              <Navigate to="/" replace />
            )
          } />

            <Route path="/configurator" element={<div className="pt-16"><CustomBuildForm /></div>} />
            
            <Route path="/gaming-pcs" element={
              <ProductGrid 
                category={searchQuery ? 'All' : 'Gaming PCs'} 
                onProductClick={(p) => {
                  navigate(`/product/${p.id}`);
                }}
                searchQuery={searchQuery} 
                externalProducts={publishedProducts} 
              />
            } />
            
            <Route path="/components" element={
              <ProductGrid 
                category="Components" 
                onProductClick={(p) => {
                  navigate(`/product/${p.id}`);
                }}
                searchQuery={searchQuery} 
                externalProducts={publishedProducts} 
              />
            } />
            
            <Route path="/peripherals" element={
              <ProductGrid 
                category="Peripherals" 
                onProductClick={(p) => {
                  navigate(`/product/${p.id}`);
                }}
                searchQuery={searchQuery} 
                externalProducts={publishedProducts} 
              />
            } />

            <Route path="/contact" element={<Contact />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/shipping" element={<Shipping />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/returns" element={<Returns />} />
            
            <Route path="/admin" element={
              <AdminDashboard 
               showRegister={showRegister} 
               closeRegister={() => setShowRegister(false)} 
              />
            } />

          <Route path="/product/:id" element={
            <ProductDetailRoute 
              publishedProducts={publishedProducts} 
              addToCart={addToCart} 
              setView={setView} 
              navigate={navigate}
            />
          } />

          <Route path="/checkout" element={
            <Checkout 
              items={cartItems} 
              onBack={() => {
                setView({ type: 'tab', activeTab: 'home' }); 
                navigate('/');            
              }} 
            />
          } />
        </Routes>
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
            navigate('/checkout');
        }}
      />

      {showRegister && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl max-w-2xl w-full relative my-auto animate-fade-in">
            <button onClick={() => setShowRegister(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors">
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

              const userData = { id: Date.now().toString(), firstName, lastName, email, phone, birthDate, password, securityKey, role: email.includes('@maxbitcore.com') ? 'admin' : 'customer' };
              try {
                setShowRegister(false); 
                setCurrentUser(userData);

                if (userData.role !== 'admin') {
                  setAppMode('dashboard'); 
                  navigate('/dashboard'); 
                  setView({ type: 'tab', activeTab: 'dashboard' });
                }

                fetch('https://maxbitcore.com/api/register.php', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(userData)
                })
                .then(res => res.json())
                .then(data => console.log("DB Sync:", data))
                .catch(err => console.error("DB Error:", err));

                sendRegistrationEmail(userData).then(() => console.log("Email sent via EmailJS")) .catch(err => console.error("Email delay", err));
                const users = JSON.parse(localStorage.getItem('maxbit_customers') || '[]');
                localStorage.setItem('maxbit_customers', JSON.stringify([...users, userData]));
                
                localStorage.setItem('maxbit_user', JSON.stringify(userData));
                
                   
                setShowRegSuccess(true); 
                setTimeout(() => setShowRegSuccess(false), 5000);      

                alert("CONNECTION ESTABLISHED. Welcome to MaxBit.");

                setFirstName(''); setLastName(''); setEmail('');
                setPhone(''); setBirthDate(''); setPassword('');
                setConfirmPassword('');;

              } catch (error) {
                console.error("Registration error:", error);
                alert("System breach detected. Try again.");
              }
              }} 
              
              className="space-y-4 text-left">
                
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 text-left">
                  <label className="text-[9px] font-black text-slate-500 uppercase ml-2">
                    First Name *
                  </label>
                  <input 
                    required 
                    type="text"
                    placeholder="ENTER FIRST NAME" 
                    value={firstName} 
                    onChange={e => setFirstName(e.target.value)} 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-[10px] font-black outline-none focus:border-cyan-500 transition-all" 
                  />
                </div>
                <div className="space-y-1 text-left">
                  <label className="text-[9px] font-black text-slate-500 uppercase ml-2">
                    Last Name *
                 </label>
                 <input 
                   required 
                   type="text"
                   placeholder="ENTER LAST NAME" 
                   value={lastName} 
                   onChange={e => setLastName(e.target.value)} 
                   className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-[10px] font-black outline-none focus:border-cyan-500 transition-all" 
                 />
               </div>
             </div>

              {/* Email */}
              <div className="space-y-1 text-left">
                <label className="text-[9px] font-black text-slate-500 uppercase ml-2">
                 Email Address *
                </label>
                <input 
                  required 
                  type="email" 
                  placeholder="EXAMPLE@MAXBITCORE.COM" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-[10px] font-black outline-none focus:border-cyan-500 transition-all" 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 uppercase ml-2">Date of Birth *</label>
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
                <label className="text-[9px] font-black text-slate-500 uppercase ml-2">
                  Phone (Optional)
                </label>
                <input 
                  type="tel" 
                  placeholder="ENTER PHONE NUMBER" 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-[10px] font-black outline-none focus:border-cyan-500 transition-all" 
                />
              </div>
               
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 text-left">
                  <label className="text-[9px] font-black text-slate-500 uppercase ml-2">
                    Create Password *
                  </label>
                  <div className="relative">
                    <input 
                      required 
                      type={showRegPassword ? "text" : "password"}
                      placeholder="••••••••" 
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
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1 text-left">
                  <label className="text-[9px] font-black text-slate-500 uppercase ml-2">
                    Confirm Password *
                  </label>
                  <input 
                    required 
                    type="password" 
                    placeholder="••••••••" 
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)} 
                    className={`w-full bg-slate-950 border rounded-xl px-4 py-3 text-white text-[10px] font-black outline-none transition-all ${
                    confirmPassword && password !== confirmPassword ? "border-rose-500" : "border-slate-800 focus:border-cyan-500"
                  }`}
                />
              </div>
            </div>

           {/* Security Key (если нужен) */}
           {email.includes('@maxbitcore.com') && (
             <div className="space-y-1 text-left mt-4">
               <label className="text-[9px] font-black text-rose-500 uppercase ml-2">
                 Security Key *
               </label>
               <input 
                 required 
                 type="password" 
                 placeholder="ENTER KEY" 
                 value={securityKey} 
                 onChange={e => setSecurityKey(e.target.value)} 
                 className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-[10px] font-black outline-none focus:border-cyan-500 placeholder:text-rose-500/30"
               />
             </div>
           )}

              <button type="submit" className="w-full py-4 bg-cyan-500 text-slate-950 font-black uppercase text-xs rounded-xl hover:bg-cyan-400 transition-all shadow-lg mt-4">Register account</button>
              <button type="button" onClick={switchToLogin} className="w-full mt-4 text-[10px] font-black text-slate-500 uppercase hover:text-cyan-500 transition-colors tracking-widest" > Already have an account? Log In </button>
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