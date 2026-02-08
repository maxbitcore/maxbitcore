import React, { useState, useEffect } from 'react';
import { BuildSubmission } from '../types';

// Default Data Constants (Fallbacks)
const DEFAULT_CONFIG = {
  purposes: [
    { value: 'Gaming', title: "Gaming Specification", desc: "Priority on frame rates (FPS) and minimal input lag. Ideal for competitive esports and AAA titles." },
    { value: 'Classic', title: "Classic Configuration", desc: "A balanced system for home and office. Reliable performance for browsing, 4K video streaming, and essential productivity." },
    { value: 'Universal', title: "Universal Protocol", desc: "A powerful hybrid for gaming and content creation. Optimized for streaming, video editing, and extreme multitasking." },
    { value: 'Working', title: "Workstation", desc: "Maximum computational endurance. Designed for 3D rendering, heavy compilation, AI workloads, and big data analysis." }
  ],
  cpuBrands: ['Intel', 'AMD'],
  gpuBrands: ['NVIDIA', 'RADEON'],
  gpuManufacturers: ['ASUS', 'MSI', 'Gigabyte', 'Sapphire', 'ASRock', 'PowerColor'],
  ssdSizes: ['1TB', '2TB', '4TB'],
  caseSizes: [
    { value: 'Mid-Tower', title: "Standard Pro", desc: "The gold standard. Fits most ATX builds with ample room for airflow and large GPUs." },
    { value: 'Full Tower', title: "Colossus Class", desc: "Massive volume for E-ATX boards, custom loops, and up to 480mm radiators." },
    { value: 'Mini-ITX', title: "Compact SFF", desc: "Small Form Factor (SFF) engineering. Minimal desk footprint, maximum density." }
  ],
  caseTypes: ['Panoramic', 'Airflow', 'Stealth', 'Dual-Chamber'],
  aesthetics: ['Stealth Black', 'Alpine White', 'Black RGB', 'White RGB', 'Other'],
  resolutions: ['1080p (FHD)', '1440p (QHD)', '2160p (4K)']
};

const DEFAULT_CASE_IMAGES: Record<string, string> = {
  'Panoramic': "/panoramic_sketch.jpg",
  'Airflow': "https://storage.googleapis.com/static.aistudio.google.com/content/file-2.png",
  'Stealth': "https://storage.googleapis.com/static.aistudio.google.com/content/file-0.png",
  'Dual-Chamber': "https://storage.googleapis.com/static.aistudio.google.com/content/file-3.png",
  'Not Specified': "" 
};

interface DeadlineProtocol {
  id: string;
  name: string;
  desc: string;
  color: string;
}

const DEADLINE_PROTOCOLS: DeadlineProtocol[] = [
  { id: 'OVERDRIVE', name: 'OVERDRIVE (ASAP)', desc: 'ULTRA-PRIORITY: Assembly within 24 hours and immediate same-day hardware dispatch.', color: 'text-rose-500' },
  { id: 'RAPID', name: 'RAPID (2-3 Days)', desc: 'Standard priority build with expedited stress-testing and 48h logistics window.', color: 'text-cyan-400' },
  { id: 'VANGUARD', name: 'VANGUARD (1 Week)', desc: 'Deep-level calibration and full quality assurance protocol before deployment.', color: 'text-emerald-400' },
  { id: 'STRATEGIC', name: 'STRATEGIC (2 Weeks)', desc: 'Allocated for specific component sourcing and heavy custom modifications.', color: 'text-amber-400' },
  { id: 'STEADY', name: 'STEADY (Flexible)', desc: 'Standard assembly queue with baseline deployment timeline.', color: 'text-slate-400' }
];

interface AccordionProps {
  id: string;
  title: string;
  value: any;
  isOpen: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}

const AccordionSection: React.FC<AccordionProps> = ({ id, title, value, isOpen, onToggle, children }) => {
  const [allowOverflow, setAllowOverflow] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (isOpen) {
      // Delay allowing overflow to ensure transition animation completes
      timer = setTimeout(() => {
        setAllowOverflow(true);
      }, 500); 
    } else {
      setAllowOverflow(false);
    }
    return () => clearTimeout(timer);
  }, [isOpen]);

  return (
    <div className={`border-b border-slate-800 transition-all ${isOpen ? 'bg-[#0f172a]/40' : ''}`}>
      <button 
        type="button" 
        onClick={() => onToggle(id)} 
        className="w-full py-6 flex items-center justify-between text-left group px-8 outline-none"
      >
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600 group-hover:text-slate-400 transition-colors">{title}</span>
          <span className={`text-lg font-bold uppercase italic tracking-tight transition-colors ${isOpen ? 'text-[#00c2a8]' : (value === 'Not Specified' ? 'text-slate-500' : 'text-white')}`}>{value}</span>
        </div>
        <div className={`w-8 h-8 rounded-full border border-slate-800 flex items-center justify-center transition-all duration-300 ${isOpen ? 'rotate-180 border-[#00c2a8] text-[#00c2a8] bg-[#00c2a8]/10' : 'text-slate-600'}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M19 9l-7 7-7-7" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </button>
      <div className={`transition-all duration-500 ease-in-out px-8 ${isOpen ? 'max-h-[2000px] opacity-100 pb-10' : 'max-h-0 opacity-0'} ${allowOverflow && isOpen ? 'overflow-visible' : 'overflow-hidden'}`}>
        <div className="pt-2">
          {children}
        </div>
      </div>
    </div>
  );
};

const CustomBuildForm: React.FC = () => {
  const [status, setStatus] = useState<'idle' | 'success'>('idle');
  const [activeSections, setActiveSections] = useState<string[]>([]);
  const [hoveredSize, setHoveredSize] = useState<string | null>(null);
  
  // Dynamic Configuration State
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [caseImages, setCaseImages] = useState<Record<string, string>>(DEFAULT_CASE_IMAGES);
  
  // Input states
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [exactBudget, setExactBudget] = useState('');
  const [targetDeadline, setTargetDeadline] = useState('');
  const [requirements, setRequirements] = useState('');

  // Selections
  const [purpose, setPurpose] = useState('Not Specified');
  const [selectedCPUBrand, setSelectedCPUBrand] = useState('Not Specified');
  const [selectedGPUBrand, setSelectedGPUBrand] = useState('Not Specified');
  const [selectedGPUManufacturer, setSelectedGPUManufacturer] = useState('Not Specified');
  const [selectedSSD, setSelectedSSD] = useState('Not Specified');
  const [caseSize, setCaseSize] = useState('Not Specified');
  const [caseType, setCaseType] = useState('Not Specified');
  const [aesthetic, setAesthetic] = useState('Not Specified');
  const [resolution, setResolution] = useState('Not Specified');

  const loadConfig = () => {
    // Load custom configuration if available
    const storedConfig = localStorage.getItem('maxbit_configurator_options');
    if (storedConfig) {
      try {
        const parsed = JSON.parse(storedConfig);
        setConfig(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error("Failed to load configurator options", e);
      }
    }

    // Load custom case images
    const storedCaseStyles = localStorage.getItem('maxbit_case_styles');
    if (storedCaseStyles) {
        setCaseImages(prev => ({
            ...prev,
            ...JSON.parse(storedCaseStyles)
        }));
    }
  };

  useEffect(() => {
    loadConfig();

    const handleConfigUpdate = () => loadConfig();
    window.addEventListener('configurator-updated', handleConfigUpdate);
    window.addEventListener('storage', handleConfigUpdate);

    return () => {
        window.removeEventListener('configurator-updated', handleConfigUpdate);
        window.removeEventListener('storage', handleConfigUpdate);
    };
  }, []);

  // Validation Logic
  const handleInvalid = (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    (e.target as HTMLInputElement).setCustomValidity('Please fill out this field.');
  };

  const handleBudgetInvalid = (e: React.FormEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    if (target.validity.valueMissing) {
      target.setCustomValidity('Please fill out this field.');
    } else {
      target.setCustomValidity('Only numeric input is permitted.');
    }
  };

  const handleEmailInvalid = (e: React.FormEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    if (target.validity.valueMissing) {
      target.setCustomValidity('Please fill out this field.');
    } else if (target.validity.typeMismatch) {
      target.setCustomValidity('A valid email address is required.');
    } else {
      target.setCustomValidity('Please fill out this field.');
    }
  };

  const handleInput = (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    (e.target as HTMLInputElement).setCustomValidity('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newSubmission: BuildSubmission = {
      id: `PROTOCOL-${Date.now()}`,
      timestamp: Date.now(),
      userName,
      userEmail,
      budget: exactBudget,
      deadline: targetDeadline,
      purpose,
      cpu: selectedCPUBrand,
      gpu: selectedGPUBrand,
      ssd: selectedSSD,
      manufacturer: selectedGPUManufacturer,
      caseSize,
      caseType,
      placement: 'Not Specified', // Removed from UI to simplify
      aesthetic,
      resolution,
      requirements
    };

    const existing = JSON.parse(localStorage.getItem('maxbit_submissions') || '[]');
    localStorage.setItem('maxbit_submissions', JSON.stringify([newSubmission, ...existing]));

    setStatus('success');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleSection = (section: string) => {
    setActiveSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section) 
        : [...prev, section]
    );
  };

  const handleGPUBrandChange = (brand: string) => {
    setSelectedGPUBrand(brand);
    setSelectedGPUManufacturer('Not Specified');
  };

  const fieldBg = '#0f172a';

  if (status === 'success') {
    return (
      <section className="py-24 px-6 text-center bg-[#0b0f1a]">
        <div className="max-w-2xl mx-auto p-12 rounded-3xl border border-[#00c2a8]/30 bg-[#0f172a]/40 shadow-2xl animate-fade-in-up">
          <div className="w-16 h-16 bg-[#00c2a8] rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(0,194,168,0.4)]">
            <svg className="w-8 h-8 text-[#1c2d74]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-black text-[#00c2a8] uppercase italic mb-4 tracking-tighter">Mission Deployed</h2>
          <p className="text-slate-400 font-medium uppercase tracking-widest text-sm leading-relaxed">
            Your build request has been logged. Our specialists will contact you shortly.
          </p>
          <button onClick={() => setStatus('idle')} className="mt-8 text-[10px] font-black uppercase tracking-[0.3em] text-[#00c2a8] hover:text-white transition-colors underline underline-offset-4">
            New Build Request
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="py-24 px-6 md:px-12 bg-[#0b0f1a] flex flex-col items-center border-t border-slate-900 relative">
      <div className="max-w-[900px] w-full space-y-12">
        <div className="text-center space-y-4">
          <h2 className="text-4xl md:text-6xl font-black italic tracking-tighter uppercase text-[#00c2a8]">System Configurator</h2>
          <p className="text-slate-500 uppercase tracking-widest text-xs font-bold">Professional hardware assembly guaranteed.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-12">
          
          <div className="space-y-4">
            <div className="px-4 py-2 flex items-center gap-4">
              <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-slate-500 whitespace-nowrap">Hardware Selection</h3>
              <div className="h-px w-full bg-slate-800"></div>
            </div>
            
            <div className="bg-slate-900/40 border border-slate-800 rounded-3xl shadow-2xl overflow-visible">
              
              <AccordionSection id="purpose" title="Target Purpose" value={purpose} isOpen={activeSections.includes('purpose')} onToggle={toggleSection}>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                  {[...config.purposes, { value: 'Not Specified', title: "Undefined", desc: "" }].map((p: any) => {
                     const val = typeof p === 'string' ? p : p.value;
                     const isSelected = purpose === val;
                     return (
                        <div key={val} className="relative">
                        <button 
                            type="button" 
                            onClick={() => setPurpose(val)} 
                            className={`w-full py-5 px-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border ${isSelected ? 'border-[#00c2a8] bg-[#00c2a8]/10 text-[#00c2a8] transition-all' : 'border-slate-800 bg-[#0b0f1a] text-slate-500'}`}
                        >
                            {val}
                        </button>
                        </div>
                     );
                  })}
                </div>
              </AccordionSection>

              <AccordionSection id="cpu" title="CPU" value={selectedCPUBrand} isOpen={activeSections.includes('cpu')} onToggle={toggleSection}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[...config.cpuBrands, 'Not Specified'].map(brand => (
                    <button key={brand} type="button" onClick={() => setSelectedCPUBrand(brand)} className={`py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${selectedCPUBrand === brand ? 'border-[#00c2a8] bg-[#00c2a8]/10 text-[#00c2a8]' : 'border-slate-800 bg-[#0b0f1a] text-slate-500 hover:border-slate-700'}`}>{brand}</button>
                  ))}
                </div>
              </AccordionSection>

              <AccordionSection id="gpu" title="Graphics (GPU)" value={selectedGPUBrand === 'Not Specified' ? 'Not Specified' : `${selectedGPUBrand}${selectedGPUManufacturer !== 'Not Specified' ? ` / ${selectedGPUManufacturer}` : ''}`} isOpen={activeSections.includes('gpu')} onToggle={toggleSection}>
                <div className="space-y-8 py-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[...config.gpuBrands, 'Not Specified'].map(brand => (
                         <button key={brand} type="button" onClick={() => handleGPUBrandChange(brand)} className={`py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${selectedGPUBrand === brand ? 'border-[#00c2a8] bg-[#00c2a8]/10 text-[#00c2a8]' : 'border-slate-800 bg-[#0b0f1a] text-slate-500 hover:border-slate-700'}`}>{brand}</button>
                    ))}
                  </div>
                  {selectedGPUBrand !== 'Not Specified' && (
                    <div className="space-y-4 animate-fade-in-up">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Preferred Brand</label>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        {[...config.gpuManufacturers, 'Not Specified'].map(m => (
                          <button key={m} type="button" onClick={() => setSelectedGPUManufacturer(m)} className={`py-3 rounded-xl text-[9px] font-bold uppercase tracking-widest border transition-all ${selectedGPUManufacturer === m ? 'border-[#00c2a8] bg-[#00c2a8]/10 text-[#00c2a8]' : 'border-slate-800 bg-[#0b0f1a] text-slate-500 hover:border-slate-700'}`}>{m}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </AccordionSection>

              <AccordionSection id="ssd" title="Storage" value={selectedSSD} isOpen={activeSections.includes('ssd')} onToggle={toggleSection}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[...config.ssdSizes, 'Not Specified'].map(size => (
                    <button key={size} type="button" onClick={() => setSelectedSSD(size)} className={`py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${selectedSSD === size ? 'border-[#00c2a8] bg-[#00c2a8]/10 text-[#00c2a8]' : 'border-slate-800 bg-[#0b0f1a] text-slate-500 hover:border-slate-700'}`}>{size}</button>
                  ))}
                </div>
              </AccordionSection>

              <AccordionSection id="case" title="Case Details" value={caseSize === 'Not Specified' && caseType === 'Not Specified' ? 'Not Specified' : `${caseSize} / ${caseType}`} isOpen={activeSections.includes('case')} onToggle={toggleSection}>
                <div className="space-y-12 py-4">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#00c2a8]">Size</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[...config.caseSizes, {value: 'Not Specified', title: 'Pending', desc: 'No Selection'}].map((sizeObj: any) => {
                         const size = typeof sizeObj === 'string' ? sizeObj : sizeObj.value;
                         return (
                            <div key={size} className="relative">
                            <button type="button" onMouseEnter={() => setHoveredSize(size)} onMouseLeave={() => setHoveredSize(null)} onClick={() => setCaseSize(size)} className={`w-full py-5 px-4 rounded-xl border text-center transition-all ${caseSize === size ? 'border-[#00c2a8] bg-[#00c2a8]/10 text-[#00c2a8]' : 'border-slate-800 bg-[#0b0f1a] text-slate-500 hover:border-slate-700'}`}><h4 className="text-[10px] font-black uppercase tracking-widest">{size}</h4></button>
                            {hoveredSize === size && sizeObj.title && (
                                <div className="absolute top-full mt-4 left-1/2 -translate-x-1/2 w-64 p-5 bg-[#0f172a]/95 backdrop-blur-xl border-2 border-[#00c2a8] rounded-2xl shadow-[0_0_50px_rgba(0,194,168,0.4)] z-[999] pointer-events-none animate-fade-in-up">
                                <h4 className="text-[#00c2a8] font-black uppercase italic tracking-tighter text-xs mb-2">{sizeObj.title}</h4>
                                <p className="text-slate-200 text-[9px] font-bold uppercase tracking-widest leading-relaxed">{sizeObj.desc}</p>
                                </div>
                            )}
                            </div>
                         );
                      })}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#00c2a8]">Style</label>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                      {[...config.caseTypes, 'Not Specified'].map(type => (
                        <button 
                          key={type} 
                          type="button" 
                          onClick={() => setCaseType(type)} 
                          className={`group relative aspect-[4/5] rounded-3xl overflow-hidden border-2 transition-all duration-500 
                            ${type === 'Not Specified' 
                              ? 'border-dashed border-slate-800 hover:border-[#00c2a8] bg-transparent' 
                              : `bg-[#0b0f1a] ${caseType === type ? 'border-[#00c2a8] ring-4 ring-[#00c2a8]/20 scale-[1.02] shadow-[0_0_60px_rgba(0,194,168,0.4)]' : 'border-slate-800 grayscale opacity-60 hover:opacity-100 hover:border-slate-600'}`
                            }`}
                        >
                          {type !== 'Not Specified' ? (
                            <>
                              <img 
                                src={caseImages[type]} 
                                alt={type} 
                                className={`w-full h-full object-cover transition-transform duration-1000 
                                  ${caseType === type ? 'scale-110 opacity-100' : 'scale-100 opacity-80'}
                                  ${type === 'Panoramic' && !caseImages[type]?.startsWith('data:') ? 'invert grayscale contrast-125 brightness-90' : ''} 
                                `}
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    (e.target as HTMLImageElement).parentElement?.classList.add('flex', 'items-center', 'justify-center');
                                }} 
                              />
                              <div className={`absolute inset-0 bg-gradient-to-t transition-opacity duration-500 ${caseType === type ? 'from-[#00c2a8]/50 via-[#0b0f1a]/10' : 'from-slate-950/90'}`}></div>
                              <div className="absolute inset-x-0 bottom-0 p-6 z-10 text-center"><h4 className={`text-[10px] font-black uppercase italic tracking-tighter transition-colors ${caseType === type ? 'text-[#00c2a8]' : 'text-white'}`}>{type}</h4></div>
                            </>
                          ) : (
                            <div className="flex flex-col items-center justify-center h-full w-full p-6 text-center">
                               <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center mb-4 transition-colors ${caseType === type ? 'border-[#00c2a8] text-[#00c2a8]' : 'border-slate-700 text-slate-700 group-hover:border-[#00c2a8] group-hover:text-[#00c2a8]'}`}>
                                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                               </div>
                               <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${caseType === type ? 'text-[#00c2a8]' : 'text-slate-600 group-hover:text-[#00c2a8]'}`}>No Style</span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </AccordionSection>

              <AccordionSection id="aesthetic" title="Aesthetic" value={aesthetic} isOpen={activeSections.includes('aesthetic')} onToggle={toggleSection}>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[...config.aesthetics, 'Not Specified'].map(a => (
                    <button key={a} type="button" onClick={() => setAesthetic(a)} className={`py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${aesthetic === a ? 'border-[#00c2a8] bg-[#00c2a8]/10 text-[#00c2a8]' : 'border-slate-800 bg-[#0b0f1a] text-slate-500 hover:border-slate-700'}`}>{a}</button>
                  ))}
                </div>
              </AccordionSection>

              <AccordionSection id="resolution" title="Target Resolution" value={resolution} isOpen={activeSections.includes('resolution')} onToggle={toggleSection}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[...config.resolutions, 'Not Specified'].map(r => (
                    <button key={r} type="button" onClick={() => setResolution(r)} className={`py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${resolution === r ? 'border-[#00c2a8] bg-[#00c2a8]/10 text-[#00c2a8]' : 'border-slate-800 bg-[#0b0f1a] text-slate-500 hover:border-slate-700'}`}>{r}</button>
                  ))}
                </div>
              </AccordionSection>

            </div>
          </div>

          <div className="space-y-10 bg-slate-900/40 border border-slate-800 rounded-3xl p-8 md:p-12 shadow-2xl overflow-visible">
            <div className="border-b border-slate-800 pb-6">
              <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Contact & Delivery</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 overflow-visible">
              <div className="flex flex-col gap-3">
                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-[#00c2a8]">Full Name</label>
                <input required type="text" value={userName} onChange={(e) => setUserName(e.target.value)} onInvalid={handleInvalid} onInput={handleInput} placeholder="e.g. JAMES MILLER" className="w-full border border-slate-800 px-6 py-4 rounded-2xl text-white outline-none focus:border-[#00c2a8] transition-colors uppercase font-bold" style={{ backgroundColor: fieldBg }} />
              </div>

              <div className="flex flex-col gap-3">
                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-[#00c2a8]">Email Address</label>
                <input required type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} onInvalid={handleEmailInvalid} onInput={handleInput} placeholder="OPERATOR@CORE.COM" className="w-full border border-slate-800 px-6 py-4 rounded-2xl text-white outline-none focus:border-[#00c2a8] transition-colors uppercase font-bold" style={{ backgroundColor: fieldBg }} />
              </div>

              <div className="flex flex-col gap-3">
                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-[#00c2a8]">Budget ($)</label>
                <input required type="text" value={exactBudget} pattern="[0-9]*" onChange={(e) => setExactBudget(e.target.value.replace(/[^0-9]/g, ''))} onInvalid={handleBudgetInvalid} onInput={handleInput} placeholder="e.g. 3500" className="w-full border border-slate-800 px-6 py-4 rounded-2xl text-white outline-none focus:border-[#00c2a8] transition-colors font-mono" style={{ backgroundColor: fieldBg }} />
              </div>

              <div className="flex flex-col gap-3">
                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-[#00c2a8]">Deadline</label>
                <div className="relative">
                  <select 
                    required 
                    value={targetDeadline} 
                    onChange={(e) => setTargetDeadline(e.target.value)} 
                    onInvalid={handleInvalid} 
                    onInput={handleInput}
                    className="w-full border border-slate-800 px-6 py-4 rounded-2xl text-white outline-none focus:border-[#00c2a8] transition-colors uppercase font-bold text-xs cursor-pointer appearance-none bg-transparent" 
                    style={{ backgroundColor: fieldBg }}
                  >
                    <option value="" disabled className="text-slate-500">SELECT DEADLINE</option>
                    {DEADLINE_PROTOCOLS.map((protocol) => (
                      <option key={protocol.id} value={protocol.name} className="bg-[#0f172a] text-white">
                        {protocol.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-[11px] font-black uppercase tracking-[0.2em] text-[#00c2a8]">Requirements</label>
              <textarea required rows={4} value={requirements} onChange={(e) => setRequirements(e.target.value)} onInvalid={handleInvalid} onInput={handleInput} placeholder="Operational requirements, specific software targets, single-brand preferences, or aesthetic details..." className="w-full border border-slate-800 px-6 py-4 rounded-2xl text-white outline-none focus:border-[#00c2a8] transition-colors resize-none uppercase font-bold text-xs" style={{ backgroundColor: fieldBg }} />
            </div>
          </div>

          <div className="flex justify-center pt-12">
            <button type="submit" className="w-full md:w-auto px-20 py-6 rounded-2xl font-black uppercase tracking-[0.2em] text-sm hover:opacity-90 transition-all hover:scale-[1.02] shadow-xl bg-[#00c2a8] text-[#1c2d74]">Submit Build Request</button>
          </div>
        </form>
      </div>
    </section>
  );
};

export default CustomBuildForm;