import React, { useState, useEffect } from 'react';
import { MainTab } from '../types';
import { loginUser, registerUser, logoutUser, getStoredAuth, forgotPassword } from '../services/authService';
import { useNavigate, useLocation } from 'react-router-dom';

const DEFAULT_LOGO = localStorage.getItem('maxbit_logo') || "";

interface NavbarProps {
  activeTab: MainTab | null;
  onTabChange: (tab: MainTab) => void;
  cartCount: number;
  onOpenCart: () => void;
  onSearch: (query: string) => void;
  currentUser?: any;       
  onLogout?: () => void;    
  onLoginSuccess?: (user: any) => void;
  isLoginOpen: boolean;                             
  setIsLoginOpen: (open: boolean) => void;         
  switchToRegister: () => void; 
  username: string; 
  setUsername: (value: string) => void;
  allProducts?: any[];
}

const Navbar: React.FC<NavbarProps> = ({ activeTab, onTabChange, cartCount, onOpenCart, onSearch, isLoginOpen, setIsLoginOpen, username, switchToRegister, currentUser, setUsername, onLogout, onLoginSuccess }) => {
  const [scrolled, setScrolled] = useState(false);
  const [localQuery, setLocalQuery] = useState('');
  const [currentLogo, setCurrentLogo] = useState(localStorage.getItem('maxbit_logo') || "");
  const navigate = useNavigate();
  const location = useLocation();

 

  // Auth State
  const [authMode, setAuthMode] = useState<'login' | 'register'| 'forgot'>('login');
  const [authStep, setAuthStep] = useState<'credentials' | 'admin_code'>('credentials');
  const [message, setMessage] = useState<string | null>(null);
  
  // Auth Form State
  const [email, setEmail] = useState(''); 
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); 
  const [adminCode, setAdminCode] = useState(''); 
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);

    const serverLogo = "https://www.maxbitcore.com/uploads/logo.png"; 
    const handleLogoUpdate = () => {
      const newLogo = localStorage.getItem('maxbit_logo');
      setCurrentLogo(newLogo || serverLogo);
    };

    window.addEventListener('logo-updated', handleLogoUpdate);

    return () => {
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('logo-updated', handleLogoUpdate);
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (localQuery.trim()) {
      onSearch(localQuery); 
      onTabChange('home');  
      navigate('/');    
    }
  };

  const validateForm = () => {
    if (authStep === 'credentials') {
      if (!username.trim()) {
        setError('Username is required');
        return false;
      }
     if (authMode !== 'login') {
        if (!email.trim()) {
            setError('Email is required');
            return false;
        }
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(email)) {
            setError('Invalid email format');
            return false;
        }
      }
      if (authMode !== 'forgot' && !password.trim()) {
        setError('Please enter your password');
        return false;
      }

    } else {
        if (!adminCode.trim()) {
          setError('Admin code is required');
          return false;
        }
    }
    return true;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("DEBUG: Current Auth Mode is:", authMode);
    setError(null);
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      let response: any;
      if (authMode === 'forgot') {
          response = await forgotPassword(email);
          if (response.success) {
            setMessage("Verification link sent to your email."); 
            setTimeout(() => setIsLoginOpen(false), 2000);
          } else {
            setError(response.message || "User not found.");
          } 
          setIsLoading(false); 
          return; 
      }
 
      const codeToSend = authStep === 'admin_code' ? adminCode : undefined;

      if (authMode === 'login') {
        const codeToSend = authStep === 'admin_code' ? adminCode : undefined;
        response = await loginUser(username, password, codeToSend);
      } else {
        response = await registerUser(username, email, password);
      }

      console.log("FULL PHP RESPONSE:", response); 

      if (response.requiresAdminCode === true || response.requiresAdminCode === "true") {
          console.log("Switching to admin_code step...");  
          setAuthStep('admin_code');
          setError(null);
          setIsLoading(false);
          return;
      }

      const isActuallySuccess = response.success === true || response.success === "true" || !!response.token;

      if (isActuallySuccess) {
        const userData = {
             email: email, 
             role: response.role || 'user',
             firstName: response.firstName || 'User' 
        };

        if (response.token) {
           localStorage.setItem('maxbit_token', response.token);
           localStorage.setItem('maxbit_role', response.role || 'user');
           localStorage.setItem('maxbit_currentUser', JSON.stringify(userData));
        }
  
        if (onLoginSuccess) {
          onLoginSuccess(userData);
        }
 
        setIsLoginOpen(false);
        resetForm();
        const userRole = response.role || 'user';
        if (userRole === 'admin') {
          navigate('/admin') 
        } else {
          navigate('/dashboard');
        }

      } else {
        console.log("Authentication Error:", response.message);
        setError(response.message || "Authentication failed");
      }

    } catch (err: any) {
      console.error("Critical Catch Error:", err);
      const errorMessage = String(err?.message || "");
      if (errorMessage.includes("Admin code is required")) {
          console.log("Admin security protocol initiated...");
          setAuthStep("admin_code"); 
          setError(null);        
          setIsLoading(!1);          
          return;
        }
      if (errorMessage.includes("exists")) {  
          setError("Account already exists. Please switch to LOGIN mode.");
      } else {
          setError(errorMessage || 'Server connection failed');
      }

    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logoutUser();

    if (onLogout) {
    onLogout(); 
  }

  localStorage.removeItem('maxbit_token');
  localStorage.removeItem('maxbit_role');
  localStorage.removeItem('maxbit_currentUser');
  
  onTabChange('home');
  navigate('/');
  };

  const resetForm = () => {
    setEmail('');
    setUsername('');
    setPassword('');
    setAdminCode('');
    setShowPassword(false);
    setAuthStep('credentials');
    setError(null);
  };

  const openAuthModal = (mode: 'login' | 'register') => {
      setAuthMode(mode);
      resetForm();
      setIsLoginOpen(true);
  };

  const logoContent = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} className="md:gap-3">
      <img 
        src={currentLogo || "https://www.maxbitcore.com/uploads/logo.png"} 
        className="h-8 md:h-10 w-auto object-contain"
        alt="MAXBIT Logo" 
        onError={(e) => {
           e.currentTarget.style.display = 'none';
        }}
      />
      <span className="text-xl md:text-2xl font-black text-white italic">
        MAXBIT
      </span>
    </div>
  );

  // Dedicated Admin Mode View
  if (activeTab === 'admin' && location.pathname !== '/') {
    return (
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0b0f1a] border-b border-rose-500/30 py-3 md:py-4 shadow-[0_10px_40px_-10px_rgba(244,63,94,0.1)]">
        <div className="max-w-[1800px] mx-auto px-4 md:px-12 flex items-center justify-between h-14">
          {/* Left Side */}
          <div className="flex items-center gap-3 md:gap-4">
            {logoContent}
            <div className="h-4 md:h-6 w-px bg-slate-800 hidden sm:block"></div>
            <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-rose-500 animate-pulse hidden sm:block">System Administrator</span>
          </div>
          {/* Right Side */}
          <div className="flex items-center gap-2 md:gap-4">
            <span className="text-[8px] md:text-[9px] font-mono text-slate-500 uppercase hidden sm:block">{currentUser?.firstName || 'ADMIN_OPERATOR'}</span>
            {/* EXIT CONSOLE */}
            <button 
                onClick={() => {
                  onTabChange('home');
                  navigate('/');
                }}
                className="flex items-center gap-2 md:gap-3 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-white transition-colors bg-slate-900/50 px-3 py-1.5 md:px-4 md:py-2 rounded-lg border border-slate-800 hover:border-slate-600"
            >
                <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full"></span>
                Exit<span className="hidden sm:inline"> Console</span>
            </button>
            {/* LOGOUT */}
            <button 
                onClick={handleLogout}
                className="flex items-center gap-2 md:gap-3 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-white transition-colors bg-slate-900/50 px-3 py-1.5 md:px-4 md:py-2 rounded-lg border border-slate-800 hover:border-slate-600"
            >
                Logout<span className="hidden sm:inline"></span>
            </button>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <>
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
      scrolled ? 'bg-[#0b0f1a]/95 backdrop-blur-xl border-b border-slate-800/50 py-2 shadow-2xl' : 'bg-transparent py-3 md:py-4'
    }`}>
      <div className="max-w-[1800px] mx-auto px-4 md:px-12 flex items-center justify-between h-12 md:h-14">
        
        {/* Left: Brand Space */}
        <div className="flex-1 flex justify-start items-center gap-4 md:gap-8">
          <button onClick={() => onTabChange('home')} className="flex items-center hover:scale-[1.03] active:scale-95 transition-all duration-300">
            {logoContent}
          </button>
          
          {/* Desktop Nav Links */}
          <div className="hidden lg:flex items-center gap-6">
             <button 
                onClick={() => onTabChange('home')}
                className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:text-cyan-400 ${
                activeTab === 'home' ? 'text-cyan-400' : 'text-slate-400'
                }`}
            >
                Home
            </button>
            <button 
                onClick={() => onTabChange('configurator')}
                className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:text-cyan-400 ${
                activeTab === 'configurator' ? 'text-cyan-400' : 'text-slate-400'
                }`}
            >
                Configurator
            </button>
          </div>
        </div>

        {/* Center: Search Bar */}
        <div className="flex-1 hidden xl:flex justify-center">
          <form 
            onSubmit={handleSearchSubmit} 
            className="flex items-center bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden focus-within:border-cyan-500 transition-all shadow-lg w-full max-w-md"
          >
            <div className="flex items-center pl-4 text-slate-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input 
              type="text" 
              placeholder="SEARCH HARDWARE..." 
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              className="bg-transparent px-4 py-2 text-[10px] font-bold text-white placeholder-slate-600 outline-none flex-1 uppercase tracking-[0.2em]"
            />
            <button 
              type="submit" 
              className="bg-slate-800 px-6 py-2 text-[10px] font-black text-cyan-400 uppercase tracking-widest hover:bg-cyan-500 hover:text-slate-950 transition-all border-l border-slate-800"
            >
              Search
            </button>
          </form>
        </div>
        
        {/* Right: Actions */}
        <div className="flex-1 flex items-center justify-end gap-2 md:gap-6">
            {/* Auth Actions */}
            {!currentUser ? (
                <button 
                    onClick={() => openAuthModal('login')}
                    className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-white hover:text-cyan-400 transition-colors border border-slate-700 hover:border-cyan-500/50 rounded-lg px-3 py-1.5 md:px-4 md:py-2 bg-slate-900/50 whitespace-nowrap"
                >
                    <span className="md:hidden">Login</span>
                    <span className="hidden md:inline">Login / Register</span>
                </button>
            ) : (
                <div className="flex items-center gap-2 md:gap-3">
                    {currentUser.role === 'admin' && (
                        <button 
                            onClick={() => {
                              onTabChange?.('admin' as any);
                             navigate('/admin');         
                            }}
                            className="flex items-center gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500 hover:text-[#0b0f1a] px-3 py-2 rounded-lg border border-emerald-500/20 transition-all duration-300 shadow-[0_0_15px_rgba(16,185,129,0.05)]"
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>    
                            Console
                        </button>
                    )}

                    <button 
                        onClick={() => navigate('/dashboard')}
                        className="flex flex-col items-end mr-2 group"
                    >
                        <span className="text-[7px] text-cyan-500 font-black uppercase tracking-tighter group-hover:text-white transition-colors">System_Active</span>
                        <span className="text-[9px] text-white font-bold uppercase">{currentUser.firstName}</span>
                    </button>

                    <div className="h-4 w-px bg-slate-800"></div>

                    <button 
                        onClick={handleLogout}
                        className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-rose-500 bg-slate-900/50 px-3 py-1.5 md:px-4 md:py-2 rounded-lg border border-slate-800 hover:border-slate-600 transition-all"
                    >
                        Logout
                    </button>
                </div>
            )}

            {/* Cart Button */}
            <button onClick={onOpenCart} className="relative group flex items-center gap-4 pl-3 md:pl-4 border-l border-slate-800/50">
                <div className="relative">
                <svg className="w-5 h-5 md:w-6 md:h-6 text-slate-300 group-hover:text-cyan-400 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-emerald-500 text-[#0b0f1a] text-[9px] font-black w-3.5 h-3.5 md:w-4 md:h-4 flex items-center justify-center rounded-full ring-2 ring-[#0b0f1a] animate-pulse">
                    {cartCount}
                    </span>
                )}
                </div>
            </button>
        </div>
      </div>
    </nav>

    {/* Authentication Modal */}
    {isLoginOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in-up">
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl w-full max-w-md relative shadow-2xl">
                <button 
                    onClick={() => setIsLoginOpen(false)}
                    className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                <div className="text-center mb-8">
                    <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700">
                        <svg className={`w-6 h-6 ${authStep === 'admin_code' ? 'text-rose-500' : 'text-cyan-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {authStep === 'admin_code' ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                            )}
                        </svg>
                    </div>
                    <h2 className={`text-2xl font-black italic uppercase tracking-tighter ${authStep === 'admin_code' ? 'text-rose-500' : 'text-white'}`}>
                        {authStep === 'admin_code' ? 'Security Clearance' : (authMode === 'login' ? 'System Login' : 'Register Protocol')}
                    </h2>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">
                        {authStep === 'admin_code' ? 'Level 5 Authorization Required' : (authMode === 'login' ? 'Authenticate Identity' : 'Create New Credentials')}
                    </p>
                </div>

                <form onSubmit={handleAuth} className="space-y-4" noValidate>
                    {authStep === 'credentials' ? (
                        <>
                            <div className="space-y-1 text-left">
                                <label className="text-[9px] font-black text-cyan-500 uppercase ml-2 tracking-[0.2em]">
                                    {authMode === 'forgot' ? 'Recovery Identity / Username' : 'Operator ID / Username'}
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="ENTER USERNAME" 
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 px-4 py-3 rounded-xl text-white placeholder-slate-700 outline-none focus:border-cyan-500 transition-all text-xs font-bold  tracking-wider"
                                />
                            </div>

                            {(authMode === 'register' || authMode === 'forgot') && (
                              <div className="space-y-1 text-left mt-4">
                                  <label className="text-[9px] font-black text-cyan-500 uppercase ml-2 tracking-[0.2em]">
                                      Email Address
                                  </label>
                                  <input 
                                      type="email" 
                                      placeholder="ENTER EMAIL" 
                                      value={email}
                                      onChange={(e) => setEmail(e.target.value)}
                                      className="w-full bg-slate-950 border border-slate-800 px-4 py-3 rounded-xl text-white placeholder-slate-700 outline-none focus:border-cyan-500 transition-all text-xs font-bold  tracking-wider"
                                  />
                              </div>
                            )}

                            {authMode !== 'forgot' && (
                                <div className="space-y-1 text-left">
                                    <label className="text-[9px] font-black text-cyan-500 uppercase ml-2 tracking-[0.2em]">
                                        Access Code / Password
                                    </label>
                                    <div className="relative">
                                        <input 
                                            type={showPassword ? "text" : "password"}
                                            placeholder="ENTER PASSWORD" 
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 px-4 py-3 rounded-xl text-white placeholder-slate-700 outline-none focus:border-cyan-500 transition-all text-xs font-bold  tracking-wider"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                                        >
                                            {showPassword ? (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                            ) : (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                            )}
                                        </button>
                                    </div>
                    
                                    {authMode === 'login' && (
                                        <div className="flex justify-end pt-1 px-1">
                                            <button 
                                                type="button"
                                                onClick={() => { setAuthMode('forgot'); setError(null); setMessage(null); }}
                                                className="text-[9px] font-black text-slate-600 hover:text-cyan-400 uppercase tracking-widest transition-colors"
                                            >
                                                Forgot Password?
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="animate-fade-in-up">
                             <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl mb-4 text-center">
                                <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest">
                                    Confidential Access Detected
                                </p>
                             </div>
                             <input 
                                type="password" 
                                placeholder="ENTER ADMIN CODE" 
                                value={adminCode}
                                onChange={(e) => setAdminCode(e.target.value)}
                                autoFocus
                                className="w-full bg-slate-950 border border-rose-900/50 px-4 py-4 rounded-xl text-white placeholder-slate-700 outline-none focus:border-rose-500 transition-colors text-sm font-black uppercase tracking-[0.3em] text-center"
                            />
                        </div>
                    )}

                    {message && (
                        <div className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest text-center bg-emerald-500/10 py-2 rounded border border-emerald-500/20">
                            {message}
                        </div>
                    )}

                    {error && (
                        <div className="text-[9px] text-rose-500 font-bold uppercase tracking-widest text-center bg-rose-500/10 py-2 rounded border border-rose-500/20 animate-pulse">
                            {error}
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className={`w-full py-4 text-slate-900 font-black uppercase tracking-widest text-xs rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 mt-4 shadow-lg ${
                            authStep === 'admin_code' 
                            ? 'bg-rose-500 shadow-rose-500/20 text-white' 
                            : 'maxbit-gradient shadow-cyan-500/10'
                        }`}
                    >
                        {isLoading ? 'Processing...' : (
                            authStep === 'admin_code' ? 'Verify Clearance' : (authMode === 'login' ? 'Access System' : 'Establish Link')
                        )}
                    </button>
                </form>

                <div className="mt-8 flex justify-center border-t border-slate-800 pt-6">
                    {authStep === 'credentials' ? (
                        <button 
                            type="button"
                            onClick={() => { 
                                if (authMode === 'forgot') {
                                    setAuthMode('login');
                                } else if (authMode=== 'login') { 
                                    switchToRegister();
                                } else { 
                                    setAuthMode ('login');
                                }
                                setError(null);
                                setMessage(null);
                            }}
            
                            className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-cyan-400 transition-colors"
                        >
                           {authMode === 'forgot' 
                            ? '< Back to Login'
                            : (authMode === 'login' ? 'Need Access? Register' : 'Have Credentials? Login')}
                        </button>
                    ) : (
                        <button 
                            onClick={() => { setAuthStep('credentials'); setAdminCode(''); setError(null); }}
                            className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-rose-400 transition-colors"
                        >
                            &lt; Cancel Verification
                        </button>
                    )}
                </div>
            </div>
        </div>
    )}
    </>
  );
};

export default Navbar;