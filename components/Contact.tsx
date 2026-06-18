import React from 'react';

const Contact: React.FC = () => {
  return (
    <section id="contact" className="pt-10 pb-24 px-6 max-w-7xl mx-auto">
      <div className="mb-12 text-center">
        <h2 className="text-4xl font-bold text-white mb-4">Direct Support</h2>
        <p className="text-slate-400 text-lg">Hardware specialist ready to optimize your build.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Email Card */}
        <div className="bg-slate-900/50 border border-slate-800 p-10 rounded-xl hover:border-cyan-500/30 transition-all group flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-8 border border-cyan-500/20">
            <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="font-bold text-white mb-2 uppercase tracking-widest text-xs">Email Support</h3>
          <a href="mailto:info@maxbitcore.com" className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
            info@maxbitcore.com
          </a>
        </div>

        {/* Phone Card */}
        <div className="bg-slate-900/50 border border-slate-800 p-10 rounded-xl hover:border-cyan-500/30 transition-all group flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-8 border border-cyan-500/20">
            <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
          <h3 className="font-bold text-white mb-2 uppercase tracking-widest text-xs">Hotline</h3>
          <a href="tel:+14252705500" className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
            +1 (425) 270-5500
          </a>
        </div>

        {/* Facebook Card */}
        <div className="bg-slate-900/50 border border-slate-800 p-10 rounded-xl hover:border-cyan-500/30 transition-all group flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-8 border border-cyan-500/20">
            <svg className="w-6 h-6 text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          </div>
          <h3 className="font-bold text-white mb-2 uppercase tracking-widest text-xs">Community</h3>
          <a href="https://www.facebook.com/profile.php?id=61578512340598" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
            @maxbit
          </a>
        </div>

        {/* Instagram Card */}
        <div className="bg-slate-900/50 border border-slate-800 p-10 rounded-xl hover:border-cyan-500/30 transition-all group flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-8 border border-cyan-500/20">
            <svg className="w-6 h-6 text-cyan-400" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
            </svg>
          </div>
          <h3 className="font-bold text-white mb-2 uppercase tracking-widest text-xs">Instagram</h3>
          <a href="https://www.instagram.com/max_bit_core/" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
            @max_bit_core
          </a>
        </div>
      </div>
    </section>
  );
};

export default Contact;