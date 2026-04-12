import React from 'react';

interface CustomerDashboardProps {
  user: any;
  onLogout: () => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({ user, onLogout }) => {
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
              Welcome, <span className="text-slate-400">{user.firstName}</span>
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
                <p className="text-sm font-bold uppercase italic">{user.firstName} {user.lastName}</p>
              </div>

              {/* Email (Comm_Link) */}
              <div className="border-l-2 border-slate-800 pl-4">
                <p className="text-[9px] text-slate-500 uppercase font-black mb-1">Email</p>
                <p className="text-sm font-bold lowercase text-cyan-400">{user.email}</p>
              </div>

              {/* DATE */}
              <div className="border-l-2 border-slate-800 pl-4">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 block mb-1">System Joined</span>
                  <span className="text-sm font-black text-white uppercase italic tracking-wider">
                      {user.id ? new Date(parseInt(user.id)).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                      }) : 'ACTIVATED'}
                  </span>
              </div>

            </div>
          </div>
          
          {/* WISH LIST CARD */}
            <div className="bg-slate-900/40 border border-white/5 p-8 rounded-3xl backdrop-blur-sm flex-1">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600">Wish List</h3>
                <span className="text-[9px] font-black text-cyan-500 bg-cyan-500/10 px-2 py-1 rounded">1 ITEM</span>
              </div>
              
              <div className="space-y-4">
                {/* Сохраненный товар */}
                <div className="border-l-2 border-slate-800 pl-4 py-1 flex justify-between items-center group">
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-black mb-1">GPU</p>
                    <p className="text-sm font-bold uppercase italic text-white group-hover:text-cyan-400 transition-colors cursor-pointer">NVIDIA RTX 5080</p>
                  </div>
                  <button className="text-[10px] font-black text-cyan-400 hover:text-cyan-300 uppercase tracking-widest transition-colors">
                    + Cart
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* ORDERS/PROJECTS SECTION */}
          <div className="lg:col-span-2 bg-slate-900/20 border border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-slate-950 border border-white/5 rounded-2xl flex items-center justify-center mb-6 rotate-45 group hover:rotate-90 transition-all duration-500">
              <span className="text-slate-700 text-2xl -rotate-45">+</span>
            </div>
            <h2 className="text-xl font-black italic uppercase mb-2">No active hardware deployments</h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest max-w-xs leading-relaxed">
              Your mission log is currently empty. Visit the hardware catalog to initiate your first request.
            </p>
            <button className="mt-8 px-8 py-3 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-cyan-400 transition-all">
              Open Catalog
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};