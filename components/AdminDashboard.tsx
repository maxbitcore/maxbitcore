
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BuildSubmission, Product, ProductStatus, Review } from '../types';
import { getAnalytics, AnalyticsData, saveAnalytics, OrderRecord, VisitorSession } from '../services/analyticsService';
import { loginUser, registerUser, logoutUser, getStoredAuth } from '../services/authService';

const DEFAULT_LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAw0lEQVR4AYzMQQvBYBgH8P9WlMsuUpOVXBCHXVx8BB/AlJIPICVfYFyX4qA4uDhaKS057wNIHFacpK1wkeROe2tvW++Up97ep///18N//hweP2Zm7AINA9WBgURljOHSwuF4ozgA44UOpqYNjovAmjcg58VwGM3KuK9b0CciJCVNkbvQi0JSQaykIdMvQjNVOPrF7emj8HXV8dy+cVYtbJp7CryFQCFVh1TL4bGyvZz5CeyNynAWJ6b0BwR2q21/Frp/AQAA///WbkgzAAAABklEQVQDABO8Uu1uvDV4AAAAAElFTkSuQmCC==";

const TACTICAL_PALETTE = [
  { color: '#ffffff', name: 'Tactical White' },
  { color: '#94a3b8', name: 'Phantom Slate' },
  { color: '#22d3ee', name: 'Cyber Cyan' },
  { color: '#3b82f6', name: 'Steel Blue' },
  { color: '#a855f7', name: 'Void Purple' },
  { color: '#f43f5e', name: 'Combat Rose' },
  { color: '#b91c1c', name: 'Crimson Ops' },
  { color: '#f59e0b', name: 'Alert Amber' },
  { color: '#84cc16', name: 'Electric Lime' },
  { color: '#10b981', name: 'Emerald Blade' },
];

const DEFAULT_CONFIG = {
  purposes: ['Gaming', 'Classic', 'Universal', 'Working'],
  cpuBrands: ['Intel', 'AMD'],
  gpuBrands: ['NVIDIA', 'RADEON'],
  gpuManufacturers: ['ASUS', 'MSI', 'Gigabyte', 'Sapphire', 'ASRock'],
  ssdSizes: ['1TB', '2TB', '4TB'],
  caseSizes: ['Mid-Tower', 'Full Tower', 'Mini-ITX'],
  caseTypes: ['Panoramic', 'Airflow', 'Stealth', 'Dual-Chamber'],
  aesthetics: ['Stealth Black', 'Alpine White', 'Black RGB', 'White RGB'],
  resolutions: ['1080p (FHD)', '1440p (QHD)', '2160p (4K)']
};

interface RichEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  label: string;
}

const RichEditor: React.FC<RichEditorProps> = ({ value, onChange, placeholder, label }) => {
  const editorRef = useRef<HTMLDivElement>(null);

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">{label}</label>
      <div className="relative bg-slate-950 border border-slate-800 rounded-xl overflow-hidden focus-within:border-cyan-500/50 transition-all">
        <div className="bg-slate-900/50 border-b border-slate-800 p-2 flex flex-wrap gap-2 items-center">
          {/* Group: Typography */}
          <div className="flex bg-slate-950/50 rounded-lg p-0.5 border border-slate-800 gap-0.5">
            <button type="button" onClick={() => exec('bold')} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors" title="Bold">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6zM6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" /></svg>
            </button>
            <button type="button" onClick={() => exec('italic')} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors" title="Italic">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M10 20l4-16m-9 16h6m2-16h6" /></svg>
            </button>
            <button type="button" onClick={() => exec('underline')} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors" title="Underline">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M6 3v7a6 6 0 006 6 6 6 0 006-6V3M4 21h16" /></svg>
            </button>
            <button type="button" onClick={() => exec('strikeThrough')} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors" title="Strikethrough">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M5 12h14M16 6l-8 0M17 18l-10 0" /></svg>
            </button>
          </div>

          {/* Group: Font Sizes */}
          <div className="flex bg-slate-950/50 rounded-lg p-0.5 border border-slate-800 gap-0.5">
            {[
              { label: 'MIN', size: '1', title: 'Small' },
              { label: 'STD', size: '3', title: 'Normal' },
              { label: 'MAG', size: '5', title: 'Large' },
              { label: 'MAX', size: '7', title: 'Huge' }
            ].map((s) => (
              <button
                key={s.size}
                type="button"
                onClick={() => exec('fontSize', s.size)}
                className="px-1.5 py-0.5 hover:bg-slate-800 rounded text-[8px] font-black text-slate-500 hover:text-cyan-400 transition-colors uppercase tracking-tighter"
                title={s.title}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Group: Lists */}
          <div className="flex bg-slate-950/50 rounded-lg p-0.5 border border-slate-800 gap-0.5">
            <button type="button" onClick={() => exec('insertUnorderedList')} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors" title="Bullets">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M9 6l11 0M9 12l11 0M9 18l11 0M5 6l0.01 0M5 12l0.01 0M5 18l0.01 0" /></svg>
            </button>
            <button type="button" onClick={() => exec('insertOrderedList')} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors" title="Numbered List">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M10 6h10M10 12h10M10 18h10M4 6h1v4M4 10h2M4 18h3" /></svg>
            </button>
          </div>

          {/* Group: Alignment */}
          <div className="flex bg-slate-950/50 rounded-lg p-0.5 border border-slate-800 gap-0.5">
            <button type="button" onClick={() => exec('justifyLeft')} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors" title="Align Left">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M4 6h16M4 12h10M4 18h14" /></svg>
            </button>
            <button type="button" onClick={() => exec('justifyCenter')} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors" title="Align Center">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M4 6h16M7 12h10M6 18h12" /></svg>
            </button>
            <button type="button" onClick={() => exec('justifyRight')} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors" title="Align Right">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M4 6h16M10 12h10M6 18h14" /></svg>
            </button>
          </div>

          {/* Action: Clear */}
          <button type="button" onClick={() => exec('removeFormat')} className="p-2 hover:bg-rose-950/30 rounded text-rose-500 hover:text-rose-400 transition-colors" title="Clear Formatting">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M6 18L18 6M6 6l12 12M19 19l-4-4" /></svg>
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block"></div>

          {/* Color Palette */}
          <div className="flex flex-wrap gap-1">
            {TACTICAL_PALETTE.map((item) => (
              <button key={item.color} type="button" onClick={() => exec('foreColor', item.color)} className="w-4 h-4 rounded-sm border border-slate-700 hover:scale-125 transition-transform" style={{ backgroundColor: item.color }} title={item.name} />
            ))}
          </div>
        </div>
        <div 
          ref={editorRef} 
          contentEditable 
          onInput={(e) => onChange(e.currentTarget.innerHTML)} 
          className="p-4 min-h-[60px] outline-none text-white text-sm prose prose-invert max-w-none relative z-10"
        ></div>
        {!value && (
          <div className="absolute top-16 left-0 px-4 py-2 text-slate-600 text-[10px] font-bold uppercase pointer-events-none z-0">{placeholder}</div>
        )}
      </div>
    </div>
  );
};

const AdminDashboard: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'user' | null>(null);
  const [currentLogo, setCurrentLogo] = useState(DEFAULT_LOGO);
  const logoUploadRef = useRef<HTMLInputElement>(null);
  const [activeAdminTab, setActiveAdminTab] = useState<'submissions' | 'orders' | 'catalog' | 'analytics' | 'comments'>('submissions');
  const [catalogMode, setCatalogMode] = useState<'products' | 'assets'>('products');
  const [isProcessing, setIsProcessing] = useState(false);
  const [formKey, setFormKey] = useState(0);
  
  // Product State
  const [publishedProducts, setPublishedProducts] = useState<Product[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductCategory, setNewProductCategory] = useState<'Gaming PCs' | 'Components' | 'Peripherals'>('Gaming PCs');
  const [newProductStatus, setNewProductStatus] = useState<ProductStatus>('In Stock');
  const [newProductImage, setNewProductImage] = useState('');
  const [newProductGallery, setNewProductGallery] = useState<string[]>([]);
  const [newProductComponents, setNewProductComponents] = useState('');
  const [newProductDesc, setNewProductDesc] = useState('');

  // Configurator Assets State
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [caseStyles, setCaseStyles] = useState<Record<string, string>>({});

  const [submissions, setSubmissions] = useState<BuildSubmission[]>([]);
  const [shopOrders, setShopOrders] = useState<OrderRecord[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const assetImageRef = useRef<HTMLInputElement>(null);
  const [activeAssetCategory, setActiveAssetCategory] = useState<string | null>(null);

  useEffect(() => {
    const { token, role } = getStoredAuth();
    if (token && role) { setIsAuthenticated(true); setUserRole(role); }
    const storedLogo = localStorage.getItem('maxbit_logo');
    if (storedLogo) setCurrentLogo(storedLogo);
    
    const loadProducts = () => {
      const storedProducts = localStorage.getItem('maxbit_published_products');
      if (storedProducts) setPublishedProducts(JSON.parse(storedProducts));
    };
    
    loadProducts();
    
    const storedSubmissions = localStorage.getItem('maxbit_submissions');
    if (storedSubmissions) setSubmissions(JSON.parse(storedSubmissions));

    const storedConfig = localStorage.getItem('maxbit_configurator_options');
    if (storedConfig) setConfig(JSON.parse(storedConfig));

    const storedCaseStyles = localStorage.getItem('maxbit_case_styles');
    if (storedCaseStyles) setCaseStyles(JSON.parse(storedCaseStyles));
    
    const analyticsData = getAnalytics();
    setAnalytics(analyticsData);
    if (analyticsData.orders) setShopOrders(analyticsData.orders.sort((a, b) => b.timestamp - a.timestamp));

    window.addEventListener('maxbit-update', loadProducts);
    return () => window.removeEventListener('maxbit-update', loadProducts);
  }, [activeAdminTab]);

  const allComments = useMemo(() => {
    const list: { productId: string; productName: string; productImage: string; review: Review }[] = [];
    publishedProducts.forEach(p => {
      p.reviews?.forEach(r => list.push({ productId: p.id, productName: p.name, productImage: p.imageUrl, review: r }));
    });
    return list.sort((a, b) => new Date(b.review.date).getTime() - new Date(a.review.date).getTime());
  }, [publishedProducts]);

  const notifyUpdate = () => {
    window.dispatchEvent(new CustomEvent('maxbit-update'));
    window.dispatchEvent(new CustomEvent('storage'));
    window.dispatchEvent(new CustomEvent('configurator-updated'));
  };

  const resetProductForm = () => {
    setEditingId(null);
    setNewProductName('');
    setNewProductPrice('');
    setNewProductImage('');
    setNewProductGallery([]);
    setNewProductComponents('');
    setNewProductDesc('');
    setNewProductCategory('Gaming PCs');
    setNewProductStatus('In Stock');
    setFormKey(prev => prev + 1);
  };

  const saveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const now = Date.now();
    
    const existing = publishedProducts.find(p => p.id === editingId);
    const productData: Product = {
      id: editingId || `PUB-${now}`,
      name: newProductName,
      price: parseFloat(newProductPrice),
      category: newProductCategory,
      status: newProductStatus,
      imageUrl: newProductImage,
      gallery: newProductGallery,
      components: newProductComponents,
      description: newProductDesc,
      reviews: existing?.reviews || [],
      isApproved: true,
      isPublished: editingId ? (existing?.isPublished ?? true) : true,
      createdAt: existing?.createdAt || now
    };

    const newList = editingId 
      ? publishedProducts.map(p => p.id === editingId ? productData : p) 
      : [productData, ...publishedProducts];

    setPublishedProducts(newList);
    localStorage.setItem('maxbit_published_products', JSON.stringify(newList));

    resetProductForm();
    notifyUpdate();
  };

  const togglePublish = (productId: string) => {
    const updatedList = publishedProducts.map(p => {
      if (p.id === productId) {
        return { ...p, isPublished: !p.isPublished };
      }
      return p;
    });
    
    setPublishedProducts(updatedList);
    localStorage.setItem('maxbit_published_products', JSON.stringify(updatedList));
    notifyUpdate();
  };

  const handleDeleteProduct = (productId: string) => {
    setPublishedProducts(prev => {
      const updatedList = prev.filter(p => p.id !== productId);
      localStorage.setItem('maxbit_published_products', JSON.stringify(updatedList));
      return updatedList;
    });

    if (editingId === productId) resetProductForm();
    notifyUpdate();
  };

  const startEditProduct = (p: Product) => {
    setEditingId(p.id); 
    setNewProductName(p.name); 
    setNewProductPrice(p.price.toString());
    setNewProductImage(p.imageUrl); 
    setNewProductGallery(p.gallery || []);
    setNewProductComponents(p.components || ''); 
    setNewProductDesc(p.description);
    setNewProductCategory(p.category as any); 
    setNewProductStatus(p.status);
    setCatalogMode('products');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsProcessing(true);
    
    const processed: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.readAsDataURL(files[i]);
      });
      processed.push(dataUrl);
    }

    if (!newProductImage && processed.length > 0) {
      setNewProductImage(processed[0]);
      setNewProductGallery(prev => [...prev, ...processed.slice(1)]);
    } else {
      setNewProductGallery(prev => [...prev, ...processed]);
    }
    
    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const setAsMain = (index: number) => {
    const currentMain = newProductImage;
    const selected = newProductGallery[index];
    setNewProductImage(selected);
    const updatedGallery = [...newProductGallery];
    updatedGallery[index] = currentMain;
    setNewProductGallery(updatedGallery);
  };

  // Asset Management Helpers
  const updateConfig = (key: keyof typeof DEFAULT_CONFIG, value: string) => {
    const newConfig = { ...config, [key]: value.split(',').map(s => s.trim()).filter(Boolean) };
    setConfig(newConfig);
    localStorage.setItem('maxbit_configurator_options', JSON.stringify(newConfig));
    notifyUpdate();
  };

  const handleAssetImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0] && activeAssetCategory) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        const newStyles = { ...caseStyles, [activeAssetCategory]: dataUrl };
        setCaseStyles(newStyles);
        localStorage.setItem('maxbit_case_styles', JSON.stringify(newStyles));
        notifyUpdate();
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  if (!isAuthenticated) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#0b0f1a]">
        <div className="max-w-md w-full bg-slate-950 border border-rose-900/50 p-10 rounded-3xl text-center">
            <h2 className="text-3xl font-black text-white uppercase mb-8 italic">Admin Access Required</h2>
            <button onClick={() => window.location.reload()} className="w-full py-4 bg-rose-600 text-white font-black uppercase tracking-widest rounded-xl">Refresh Neural Link</button>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0b0f1a] pt-32 pb-24 px-6 md:px-12 animate-fade-in-up">
      <div className="max-w-7xl mx-auto space-y-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 border-b border-slate-800 pb-12">
          <div className="flex items-center gap-6">
            <div className="relative group cursor-pointer" onClick={() => logoUploadRef.current?.click()}>
              <img src={currentLogo} className="w-16 h-16 object-contain group-hover:opacity-50 transition-opacity" alt="Logo" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
              </div>
              <input type="file" ref={logoUploadRef} onChange={(e) => {
                if (e.target.files?.[0]) {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const dataUrl = ev.target?.result as string;
                    setCurrentLogo(dataUrl);
                    localStorage.setItem('maxbit_logo', dataUrl);
                    window.dispatchEvent(new CustomEvent('logo-updated'));
                  };
                  reader.readAsDataURL(e.target.files[0]);
                }
              }} className="hidden" accept="image/*" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500">System Administrator</span>
              <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter text-white uppercase leading-none">Command Center</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {(['submissions', 'orders', 'catalog', 'analytics', 'comments'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveAdminTab(tab)} className={`text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-xl transition-all ${activeAdminTab === tab ? 'bg-cyan-500 text-slate-950' : 'bg-slate-900 text-slate-500 border border-slate-800 hover:border-slate-600'}`}>{tab === 'comments' ? 'Reports' : tab}</button>
            ))}
            <button onClick={() => { logoutUser(); window.location.reload(); }} className="text-[10px] font-black text-rose-500 uppercase px-4 py-2 hover:bg-rose-950/30 rounded-lg">Logout</button>
          </div>
        </div>

        {/* CATALOG TAB */}
        {activeAdminTab === 'catalog' && (
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 animate-fade-in-up">
                 <div className="lg:col-span-3 mb-4">
                    <div className="flex gap-4 p-1 bg-slate-900/50 rounded-xl w-fit border border-slate-800">
                        <button onClick={() => setCatalogMode('products')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${catalogMode === 'products' ? 'bg-cyan-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white'}`}>Inventory</button>
                        <button onClick={() => setCatalogMode('assets')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${catalogMode === 'assets' ? 'bg-cyan-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white'}`}>Configurator Assets</button>
                    </div>
                </div>

                {catalogMode === 'products' && (
                    <>
                        <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl h-fit shadow-2xl">
                            <h2 className="text-xl font-black text-white italic uppercase mb-8">{editingId ? 'Modify Unit' : 'Create Unit'}</h2>
                            <form key={formKey} onSubmit={saveProduct} className="space-y-6">
                                <RichEditor label="Identity (Name)" value={newProductName} onChange={setNewProductName} placeholder="ENTER HARDWARE NAME" />
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block ml-1">Sector</label>
                                        <select value={newProductCategory} onChange={e => setNewProductCategory(e.target.value as any)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none text-xs font-bold uppercase">
                                            <option value="Gaming PCs">Systems</option>
                                            <option value="Components">Components</option>
                                            <option value="Peripherals">Peripherals</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block ml-1">Status</label>
                                        <select value={newProductStatus} onChange={e => setNewProductStatus(e.target.value as ProductStatus)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none text-xs font-bold uppercase">
                                            <option value="In Stock">In Stock</option>
                                            <option value="Sold Out">Sold Out</option>
                                            <option value="Pre-Order">Pre-Order</option>
                                            <option value="Coming Soon">Coming Soon</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block ml-1">Credits (Price)</label>
                                    <input required value={newProductPrice} onChange={e => setNewProductPrice(e.target.value)} type="number" placeholder="PRICE ($)" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan-500 font-mono" />
                                </div>
                                <div className="space-y-4">
                                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block ml-1">Visual Evidence</label>
                                  <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full py-4 border-2 border-dashed border-slate-800 rounded-xl text-slate-500 hover:border-cyan-500 hover:text-cyan-500 transition-all uppercase font-black text-[10px] bg-slate-950/50">{isProcessing ? 'SCANNING...' : 'Upload Assets (Multi)'}</button>
                                  <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple className="hidden" accept="image/*" />
                                    {(newProductImage || newProductGallery.length > 0) && (
                                        <div className="grid grid-cols-4 gap-2">
                                          {newProductImage && (
                                            <div className="col-span-4 relative rounded-xl overflow-hidden aspect-video border-2 border-cyan-500 shadow-[0_0_20px_rgba(34,211,238,0.2)]">
                                              <img src={newProductImage} className="w-full h-full object-cover" alt="Main" />
                                              <div className="absolute top-3 left-3 bg-cyan-500 text-slate-950 p-1.5 rounded-lg shadow-xl">
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                              </div>
                                              <button type="button" onClick={() => setNewProductImage('')} className="absolute top-2 right-2 bg-rose-500 text-white p-1 rounded hover:bg-rose-600"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg></button>
                                            </div>
                                          )}
                                          {newProductGallery.map((img, i) => (
                                            <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-slate-800 bg-slate-950 group">
                                              <img src={img} className="w-full h-full object-cover" alt="" />
                                              <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
                                                  <button 
                                                    type="button" 
                                                    onClick={() => setAsMain(i)} 
                                                    title="Set as Primary"
                                                    className="w-10 h-10 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                                                  >
                                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                                  </button>
                                                  <button 
                                                    type="button" 
                                                    onClick={() => {
                                                        const updatedGallery = newProductGallery.filter((_, idx) => idx !== i);
                                                        setNewProductGallery(updatedGallery);
                                                    }} 
                                                    className="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                                                  >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2.5} /></svg>
                                                  </button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                    )}
                                </div>
                                <RichEditor label="Hardware Components" value={newProductComponents} onChange={setNewProductComponents} placeholder="CPU, GPU, RAM details..." />
                                <RichEditor label="Intel Briefing (Description)" value={newProductDesc} onChange={setNewProductDesc} placeholder="Full specs..." />
                                <button type="submit" disabled={isProcessing} className="w-full py-4 maxbit-gradient text-slate-950 font-black uppercase text-sm rounded-xl shadow-lg hover:opacity-90 transition-all">{isProcessing ? 'COMMITTING...' : (editingId ? 'UPDATE RECORD' : 'SAVE TO ARMORY')}</button>
                                {editingId && <button type="button" onClick={resetProductForm} className="w-full py-4 bg-slate-800 text-slate-400 font-black uppercase text-xs rounded-xl hover:text-white transition-all">Abort</button>}
                            </form>
                        </div>
                        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 h-fit">
                            {publishedProducts.map(p => (
                                <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex gap-6 hover:border-slate-600 transition-all group shadow-xl relative">
                                    <div className="w-24 h-32 bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden flex-shrink-0"><img src={p.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" /></div>
                                    <div className="flex-1 flex flex-col justify-between py-1">
                                        <div>
                                            <h3 className="font-black text-white text-base uppercase leading-tight mb-2 italic tracking-tighter" dangerouslySetInnerHTML={{ __html: p.name }}></h3>
                                            <div className="text-sm font-black text-cyan-400 font-mono tracking-tighter">${p.price}</div>
                                            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">{(p as any).isPublished ? 'DEPLOYED' : 'IN ARMORY'}</div>
                                        </div>
                                        <div className="flex gap-4">
                                            <button onClick={() => startEditProduct(p)} className="text-[10px] font-black text-slate-500 hover:text-cyan-400 uppercase tracking-widest transition-colors">Modify</button>
                                            <button 
                                              type="button" 
                                              onClick={() => togglePublish(p.id)}
                                              className={`text-[10px] font-black uppercase tracking-widest transition-all ${(p as any).isPublished ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'text-slate-500 hover:text-white'}`}
                                            >
                                                {(p as any).isPublished ? 'Withdraw' : 'Deploy'}
                                            </button>
                                            <button 
                                              type="button" 
                                              onClick={() => handleDeleteProduct(p.id)} 
                                              className="text-[10px] font-black text-slate-500 hover:text-rose-500 uppercase tracking-widest transition-colors"
                                            > 
                                              Delete
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {catalogMode === 'assets' && (
                    <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-12 animate-fade-in-up">
                        <div className="space-y-8">
                            <h2 className="text-xl font-black text-white italic uppercase pl-2">Configurator Options</h2>
                            <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl space-y-6">
                                {(Object.keys(DEFAULT_CONFIG) as Array<keyof typeof DEFAULT_CONFIG>).map((key) => (
                                    <div key={key} className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block ml-1">{key.replace(/([A-Z])/g, ' $1').trim()}</label>
                                        <textarea 
                                            value={config[key as keyof typeof DEFAULT_CONFIG].join(', ')} 
                                            onChange={(e) => updateConfig(key as keyof typeof DEFAULT_CONFIG, e.target.value)}
                                            placeholder="Item 1, Item 2..."
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan-500 font-bold uppercase text-[10px] min-h-[80px]"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-8">
                            <h2 className="text-xl font-black text-white italic uppercase pl-2">Case Style Assets</h2>
                            <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl space-y-6">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1 mb-4">Map case types to visual sketches</p>
                                <div className="grid grid-cols-1 gap-4">
                                    {config.caseTypes.map((type) => (
                                        <div key={type} className="flex items-center gap-4 p-4 bg-slate-950 border border-slate-800 rounded-2xl group hover:border-cyan-500/30 transition-all">
                                            <div className="w-16 h-20 bg-slate-900 rounded-lg overflow-hidden border border-slate-800 flex-shrink-0 relative">
                                                {caseStyles[type] ? (
                                                    <img src={caseStyles[type]} className="w-full h-full object-cover" alt={type} />
                                                ) : (
                                                    <div className="flex items-center justify-center h-full text-slate-700">
                                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-2">{type}</h4>
                                                <button 
                                                    onClick={() => { setActiveAssetCategory(type); assetImageRef.current?.click(); }}
                                                    className="text-[9px] font-black text-cyan-500 uppercase tracking-widest border border-cyan-500/20 px-3 py-1.5 rounded-lg hover:bg-cyan-500/10 transition-all"
                                                >
                                                    Upload Sketch
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <input type="file" ref={assetImageRef} onChange={handleAssetImageUpload} className="hidden" accept="image/*" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
             </div>
        )}

        {/* SUBMISSIONS TAB */}
        {activeAdminTab === 'submissions' && (
          <div className="space-y-6">
              {submissions.length === 0 ? <div className="py-24 text-center border-2 border-dashed border-slate-800 rounded-3xl text-slate-600 font-bold uppercase tracking-widest">Empty Submissions Log</div> :
                  submissions.map(sub => (
                    <div key={sub.id} className="bg-slate-900/40 border border-slate-800 p-8 rounded-3xl flex flex-col lg:flex-row justify-between gap-8 hover:border-cyan-500/20 transition-all group">
                        <div className="space-y-4">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-500 mb-1 block group-hover:text-white">{sub.purpose} Protocol</span>
                                <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">{sub.userName}</h3>
                                <p className="text-xs text-slate-500 font-mono">{sub.userEmail}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                <div><span className="text-slate-600 mr-2 font-black">CPU:</span> {sub.cpu}</div>
                                <div><span className="text-slate-600 mr-2 font-black">GPU:</span> {sub.gpu}</div>
                                <div><span className="text-slate-600 mr-2 font-black">Budget:</span> ${sub.budget}</div>
                                <div><span className="text-slate-600 mr-2 font-black">Deadline:</span> {sub.deadline}</div>
                            </div>
                        </div>
                        <div className="flex flex-col items-end justify-between text-right">
                             <div className="bg-slate-950 px-6 py-3 rounded-xl border border-slate-800 shadow-inner">
                                <span className="text-[9px] font-black uppercase text-slate-500 block mb-1">Status</span>
                                <span className="text-xs font-black text-white italic">Awaiting Debrief</span>
                             </div>
                             <span className="text-[9px] font-mono text-slate-700 mt-4 uppercase">Logged: {new Date(sub.timestamp).toLocaleString()}</span>
                        </div>
                    </div>
                  ))
              }
          </div>
        )}

        {/* ORDERS TAB */}
        {activeAdminTab === 'orders' && (
           <div className="space-y-6">
              {shopOrders.length === 0 ? <div className="py-24 text-center border-2 border-dashed border-slate-800 rounded-3xl text-slate-600 font-bold uppercase tracking-widest">No transaction records</div> :
                shopOrders.map(order => (
                    <div key={order.id} className="bg-slate-900/40 border border-slate-800 p-8 rounded-3xl group hover:border-emerald-500/30 transition-all">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 pb-6 border-b border-slate-800/50">
                            <div><span className="text-[10px] font-black text-emerald-500 uppercase mb-1 block">Deployed Transaction</span><h3 className="text-xl font-mono font-black text-white tracking-tighter">{order.id}</h3></div>
                            <div className="text-right"><span className="text-3xl font-black text-white italic tracking-tighter">${order.total.toFixed(2)}</span><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">{new Date(order.timestamp).toLocaleDateString()}</p></div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-12 text-xs">
                            <div><h4 className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] mb-4">Payload</h4><div className="space-y-2">{order.items.map((item, idx) => <div key={idx} className="flex justify-between border-b border-slate-800 pb-1"><span className="text-slate-300 font-bold uppercase">{item.name}</span><span className="text-slate-500 font-mono">${item.price}</span></div>)}</div></div>
                            <div><h4 className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] mb-4">Coordinates</h4><p className="text-white font-black italic">{order.customer.name}</p><p className="text-slate-500 font-mono">{order.customer.email}</p><p className="text-slate-400 italic mt-3 bg-slate-950/50 p-3 rounded-lg border border-slate-800">{order.customer.address}</p></div>
                        </div>
                    </div>
                ))
              }
           </div>
        )}

        {/* ANALYTICS TAB */}
        {activeAdminTab === 'analytics' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in-up">
            <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl shadow-xl">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Total Revenue</span>
                <div className="text-3xl font-black text-white italic">${shopOrders.reduce((sum, o) => sum + o.total, 0).toLocaleString()}</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl shadow-xl">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Real Traffic</span>
                <div className="text-3xl font-black text-cyan-500 italic">{analytics?.visits || 0}</div>
            </div>
          </div>
        )}

        {/* REVIEW MODERATION TAB */}
        {activeAdminTab === 'comments' && (
          <div className="space-y-6 animate-fade-in-up">
             <div className="flex justify-between items-center mb-8">
                <h2 className="text-xs font-bold uppercase tracking-[0.4em] text-slate-500 pl-2">Intel Moderation</h2>
                <span className="text-xs font-bold text-amber-500 uppercase tracking-widest">{allComments.length} Reports Logged</span>
             </div>

             <div className="grid gap-4">
                {allComments.map((item, idx) => (
                    <div key={idx} className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row gap-6 hover:border-amber-500/30 transition-all group">
                        <div className="w-16 h-20 bg-slate-950 rounded-lg overflow-hidden flex-shrink-0 border border-slate-800 shadow-lg">
                            <img src={item.productImage} className="w-full h-full object-cover opacity-50 group-hover:opacity-100 transition-opacity" alt="" />
                        </div>
                        
                        <div className="flex-1">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="text-[10px] font-black text-cyan-500 uppercase tracking-widest mb-1">{item.productName}</div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-black text-white italic">{item.review.user}</span>
                                        <span className="text-[9px] font-mono text-slate-600 uppercase">{item.review.date}</span>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => {
                                        if (window.confirm("Confirm permanent removal?")) {
                                            const updated = publishedProducts.map(p => {
                                                if (p.id === item.productId) {
                                                    return { ...p, reviews: p.reviews?.filter(r => r.id !== item.review.id) };
                                                }
                                                return p;
                                            });
                                            setPublishedProducts(updated);
                                            localStorage.setItem('maxbit_published_products', JSON.stringify(updated));
                                            notifyUpdate();
                                        }
                                    }} className="text-[10px] font-black text-slate-500 hover:text-rose-500 uppercase tracking-widest transition-colors">Delete Report</button>
                                </div>
                            </div>
                            <p className="text-slate-400 text-xs italic leading-relaxed border-l-2 border-slate-800 pl-4 group-hover:text-slate-200 transition-colors">"{item.review.comment}"</p>
                        </div>
                    </div>
                ))}
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
