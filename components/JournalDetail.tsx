/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React from 'react';
import { JournalArticle } from '../types';

interface JournalDetailProps {
  article: JournalArticle;
  onBack: () => void;
}

const JournalDetail: React.FC<JournalDetailProps> = ({ article, onBack }) => {
  return (
    <div className="min-h-screen bg-[#0b0f1a] text-slate-200 animate-fade-in-up">
       {/* Hero Image for Article */}
       <div className="w-full h-[50vh] md:h-[60vh] relative overflow-hidden">
          <img 
             src={article.image} 
             alt={article.title} 
             className="w-full h-full object-cover opacity-50"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f1a] to-transparent"></div>
       </div>

       <div className="max-w-3xl mx-auto px-6 md:px-12 -mt-32 relative z-10 pb-32">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 md:p-16 shadow-2xl">
             <div className="flex justify-between items-center mb-12 border-b border-slate-800 pb-8">
                <button 
                  onClick={onBack}
                  className="group flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-cyan-400 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 group-hover:-translate-x-1 transition-transform">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                  Back to Journal
                </button>
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{article.date}</span>
             </div>

             <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter text-white mb-12 leading-tight text-center">
               {article.title}
             </h1>

             <div className="prose prose-invert prose-lg mx-auto font-medium leading-loose text-slate-300">
               {article.content}
             </div>
             
             <div className="mt-16 pt-12 border-t border-slate-800 flex justify-center">
                 <span className="text-2xl font-black italic tracking-tighter text-white">MAXBIT</span>
             </div>
          </div>
       </div>
    </div>
  );
};

export default JournalDetail;