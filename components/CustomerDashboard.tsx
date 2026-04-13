import React, { useState, useEffect } from 'react';

interface CustomerDashboardProps {
  currentUser: any;
  onLogout: () => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({ currentUser, onLogout }) => {
  const [userSubmissions, setUserSubmissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSubmissions = async () => {
      if (!currentUser?.email) return;
      
      try {
        const response = await fetch('https://maxbitcore.com/api/submissions.json');
        if (!response.ok) throw new Error('Failed to fetch');
        
        const allSubmissions = await response.json();
        
        const filteredSubmissions = allSubmissions.filter(
          (sub: any) => sub.userEmail === currentUser.email
        );
        
        setUserSubmissions(filteredSubmissions);
      } catch (error) {
        console.error("Error loading submissions:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubmissions();
  }, [currentUser]);

  const handleDeleteSubmission = async (submissionId: string) => {
    if (!window.confirm('Are you sure you want to terminate this build protocol?')) return;

    setUserSubmissions(prev => prev.filter(sub => sub.id !== submissionId));

    try {
      await fetch('https://maxbitcore.com/api/delete-submission.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: submissionId })
      });
    } catch (error) {
      console.error("Failed to delete from server:", error);
    }
  };

  const [wishlist, setWishlist] = useState<any[]>([]);

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
  }, [currentUser]);

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
              Welcome, <span className="text-slate-400">{currentUser?.username || currentUser?.firstName}</span>
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
                
                {/* NAME */}
                <div className="border-l-2 border-cyan-500/30 pl-4">
                  <p className="text-[9px] text-slate-500 uppercase font-black mb-1">Full Name</p>
                  <p className="text-sm font-bold uppercase italic">{currentUser?.firstName} {currentUser?.lastName}</p>
                </div>

                {/* Email (Comm_Link) */}
                <div className="border-l-2 border-slate-800 pl-4">
                  <p className="text-[9px] text-slate-500 uppercase font-black mb-1">Email</p>
                  <p className="text-sm font-bold lowercase text-cyan-400">{currentUser?.email}</p>
                </div>

                {/* DATE */}
                <div className="border-l-2 border-slate-800 pl-4">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 block mb-1">System Joined</span>
                    <span className="text-sm font-black text-white uppercase italic tracking-wider">
                        {currentUser?.id ? new Date(parseInt(currentUser.id)).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                        }) : 'ACTIVATED'}
                    </span>
                </div>

              </div>
            </div>
            
            {/* WISH LIST CARD */}
            <div className="bg-slate-900/40 border border-white/5 p-8 rounded-3xl backdrop-blur-sm flex-1 flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600">Wish List</h3>
                <span className={`text-[9px] font-black px-2 py-1 rounded ${wishlist.length > 0 ? 'text-cyan-500 bg-cyan-500/10' : 'text-slate-500 bg-slate-800'}`}>
                  {wishlist.length} {wishlist.length === 1 ? 'ITEM' : 'ITEMS'}
                </span>
              </div>
              
              <div className="space-y-4 flex-1">
                {wishlist.length === 0 ? (
                  <div className="flex items-center justify-center h-full min-h-[100px] border border-dashed border-white/5 rounded-xl">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">List is empty</span>
                  </div>
                ) : (
                  wishlist.map((item) => (
                    <div key={item.id} className="border-l-2 border-slate-800 pl-4 py-1 flex justify-between items-center group hover:border-cyan-500/50 transition-colors">
                      <div>
                        {/* Если у товара нет категории, пишем HARDWARE */}
                        <p className="text-[9px] text-slate-500 uppercase font-black mb-1">{item.category || 'HARDWARE'}</p>
                        <p className="text-sm font-bold uppercase italic text-white group-hover:text-cyan-400 transition-colors cursor-pointer line-clamp-1">
                          {item.name}
                        </p>
                      </div>
                      <button 
                        onClick={() => handleRemoveFromWishlist(item.id)}
                        className="text-[10px] font-black text-slate-600 hover:text-rose-500 uppercase tracking-widest transition-colors ml-4"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          {/* ORDERS/PROJECTS SECTION */}
          <div className="lg:col-span-2 flex flex-col">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-6">Operational Log</h3>
            
            {isLoading ? (
              <div className="bg-slate-900/20 border border-dashed border-white/10 rounded-3xl flex-1 flex items-center justify-center p-12 text-center animate-pulse">
                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-500">Scanning Database...</span>
              </div>
            ) : userSubmissions.length === 0 ? (
              <div className="bg-slate-900/20 border border-dashed border-white/10 rounded-3xl flex-1 flex flex-col items-center justify-center p-12 text-center">
                <div className="w-16 h-16 bg-slate-950 border border-white/5 rounded-2xl flex items-center justify-center mb-6 rotate-45 group hover:rotate-90 transition-all duration-500">
                  <span className="text-slate-700 text-2xl -rotate-45">+</span>
                </div>
                <h2 className="text-xl font-black italic uppercase mb-2">No active hardware deployments</h2>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest max-w-xs leading-relaxed">
                  Your mission log is currently empty. Visit the hardware catalog to initiate your first request.
                </p>
                <a href="/configurator" className="mt-8 px-8 py-3 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-cyan-400 transition-all cursor-pointer">
                  Open Catalog
                </a>
              </div>
            ) : (
              <div className="space-y-4">
  
                {userSubmissions.map((submission) => (
                  <div key={submission.id} className="bg-slate-900/40 border border-white/5 p-6 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-cyan-500/30 transition-colors backdrop-blur-sm">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-500">ID: {submission.id}</p>
                        <span className="px-2 py-0.5 bg-slate-800 text-[8px] font-black text-slate-400 rounded uppercase tracking-widest">{submission.deadline}</span>
                      </div>
                      <h3 className="text-white font-bold uppercase text-xl italic tracking-tight">{submission.purpose} SYSTEM</h3>
                      <p className="text-slate-400 text-[11px] font-mono mt-2 leading-relaxed">
                        <span className="text-white">{submission.cpu}</span> &bull; <span className="text-white">{submission.gpu}</span> &bull; {submission.caseSize} <br/>
                        Budget: <span className="text-cyan-400">${submission.budget}</span>
                      </p>
                    </div>
                    
                    <button 
                      onClick={() => handleDeleteSubmission(submission.id)}
                      className="text-rose-500 text-[10px] font-black uppercase tracking-widest border border-rose-500/30 px-6 py-3 rounded-xl hover:bg-rose-500 hover:text-white transition-all w-full md:w-auto text-center"
                    >
                      Terminate
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};