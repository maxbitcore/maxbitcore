import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface CustomerDashboardProps {
  currentUser: any;
  onLogout: () => void;
  allProducts: any[];
  onSelectProduct: (product: any) => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({ currentUser, onLogout, allProducts, onSelectProduct }) => {
  const [userSubmissions, setUserSubmissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [wishlist, setWishlist] = useState<any[]>([]);

  useEffect(() => {
    console.log("DASHBOARD_DEBUG: Current User Data ->", currentUser);
  }, [currentUser]);

  //  WISHLIST
  useEffect(() => {
    const loadWishlist = () => {
      if (!currentUser?.email) return;
      const stored = localStorage.getItem(`maxbit_wishlist_${currentUser.email}`);
      if (stored) {
        setWishlist(JSON.parse(stored));
      }
    };
    loadWishlist();
    window.addEventListener('wishlist-updated', loadWishlist);
    return () => window.removeEventListener('wishlist-updated', loadWishlist);
  }, [currentUser?.email]);

  //  SUBMISSIONS
  useEffect(() => {
    const loadSubmissions = () => {
      if (!currentUser?.email) return;

      setIsLoading(true);
      try {
        const localData = localStorage.getItem('maxbit_submissions');
        const allSubmissions = localData ? JSON.parse(localData) : [];

        const filtered = allSubmissions.filter(
          (sub: any) => sub.userEmail === currentUser.email
        );

        setUserSubmissions(filtered);
      } catch (error) {
        console.error("CRITICAL ERROR: Failed to parse submissions log", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSubmissions();

    window.addEventListener('maxbit-update', loadSubmissions);
    return () => window.removeEventListener('maxbit-update', loadSubmissions);
  }, [currentUser?.email]);

  const handleDeleteSubmission = async (submissionId: string) => {
    if (!window.confirm('Are you sure you want to terminate this build protocol?')) return;

    setUserSubmissions(prev => prev.filter(sub => sub.id !== submissionId));

    const localData = localStorage.getItem('maxbit_submissions');
    if (localData) {
      const submissions = JSON.parse(localData);
      const updated = submissions.filter((sub: any) => sub.id !== submissionId);
      localStorage.setItem('maxbit_submissions', JSON.stringify(updated));
    }

    try {
      await fetch('https://www.maxbitcore.com/api/delete-submission.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: submissionId })
      });
    } catch (error) {
      console.error("Failed to delete from server:", error);
    }
  };

  const handleRemoveFromWishlist = (productId: string) => {
    const updated = wishlist.filter(item => item.id !== productId);
    setWishlist(updated);
    localStorage.setItem(`maxbit_wishlist_${currentUser?.email}`, JSON.stringify(updated));
    window.dispatchEvent(new Event('wishlist-updated'));
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 pt-24 md:p-10 md:pt-32 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* TOP BAR */}
        <div className="flex justify-between items-center mb-12 border-b border-white/5 pb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500">System Active</span>
            </div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter">
              Welcome, <span className="text-slate-400">{currentUser?.firstName || currentUser?.username || 'OPERATOR'}</span>
            </h1>
          </div>
        </div>

        {/* DASHBOARD GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="flex flex-col gap-8">
            
            {/* PROFILE CARD */}
            <div className="bg-slate-900/40 border border-white/5 p-8 rounded-3xl backdrop-blur-sm">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-6">User Parameters</h3>
              <div className="space-y-6">
                
                {/* FULL NAME (Фикс здесь) */}
                <div className="border-l-2 border-cyan-500/30 pl-4">
                  <p className="text-[9px] text-slate-500 uppercase font-black mb-1">Full Name</p>
                  <p className="text-sm font-bold uppercase italic text-white">
                    {currentUser?.firstName || currentUser?.lastName 
                      ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() 
                      : (currentUser?.username || 'IDENTIFIED OPERATOR')}
                  </p>
                </div>

                {/* EMAIL */}
                <div className="border-l-2 border-slate-800 pl-4">
                  <p className="text-[9px] text-slate-500 uppercase font-black mb-1">Comm_Link (Email)</p>
                  <p className="text-sm font-bold lowercase text-cyan-400">
                    {currentUser?.email || 'OFFLINE / NOT FOUND'}
                  </p>
                </div>

                {/* JOIN DATE */}
                <div className="border-l-2 border-slate-800 pl-4">
                  <p className="text-[9px] text-slate-500 uppercase font-black mb-1">System Joined</p>
                  <p className="text-sm font-bold text-white uppercase italic tracking-wider">
                    {currentUser?.joined ? new Date(currentUser.joined).toLocaleDateString() : 'ACTIVATED'}
                  </p>
                </div>

              </div>
            </div>
            
            {/* WISH LIST */}
            <div className="bg-slate-900/40 border border-white/5 p-8 rounded-3xl backdrop-blur-sm flex-1 flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600">Wish List</h3>
                <span className="text-[9px] font-black px-2 py-1 rounded text-cyan-500 bg-cyan-500/10">
                  {wishlist.length} ITEMS
                </span>
              </div>
              <div className="space-y-4">
                {wishlist.map((item) => (
                    <div 
                      key={item.id} 
                      onClick={() => onSelectProduct(item)}
                      className="group flex items-center gap-4 p-3 bg-slate-950/30 border border-white/5 rounded-2xl hover:border-cyan-500/30 hover:bg-white/5 transition-all cursor-pointer mb-3"
                    >
                      {/* ФОТО ТОВАРА */}
                      <div className="w-16 h-16 bg-slate-900 rounded-xl overflow-hidden border border-white/10 shrink-0 shadow-lg">
                        <img 
                        src={item.imageUrl || 'https://via.placeholder.com/150'} 
                        alt="Unit Preview" 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                         <div className="w-1 h-1 bg-cyan-500 rounded-full" />
                         <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest leading-none">
                           {item.category || 'HARDWARE UNIT'}
                         </p>
                      </div>
      
                      <h4 
                         className="text-sm font-black uppercase italic text-white group-hover:text-cyan-400 transition-colors line-clamp-1 leading-tight"
                         dangerouslySetInnerHTML={{ __html: item.name || 'Unknown Unit' }}
                      />
      
                      <p className="text-xs font-black text-cyan-500 font-mono mt-1">
                        ${item.price || '0.00'}
                      </p>
                    </div>
    
                    {/* DELETE */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFromWishlist(item.id);
                      }}
                      className="p-3 text-[10px] font-black text-slate-700 hover:text-rose-500 uppercase tracking-widest transition-colors"
                      title="Remove from list"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* OPERATIONAL LOG */}
          <div className="lg:col-span-2">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-6">Operational Log</h3>
            <div className="space-y-4">
              {userSubmissions.map((sub) => (
                <div key={sub.id} className="bg-slate-900/40 border border-white/5 p-6 rounded-3xl flex justify-between items-center backdrop-blur-sm">
                  <div>
                    <p className="text-[10px] font-black uppercase text-cyan-500">ID: {sub.id}</p>
                    <h3 className="text-white font-bold uppercase text-xl italic">{sub.purpose} SYSTEM</h3>
                    <p className="text-slate-400 text-[11px] font-mono mt-2">{sub.cpu} &bull; {sub.gpu}</p>
                  </div>
                  <button onClick={() => handleDeleteSubmission(sub.id)} className="text-rose-500 text-[10px] font-black uppercase border border-rose-500/30 px-6 py-3 rounded-xl hover:bg-rose-500 hover:text-white transition-all">Terminate</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};