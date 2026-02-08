/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React from 'react';
import { JOURNAL_ARTICLES } from '../constants';
import { JournalArticle } from '../types';

interface JournalProps {
  onArticleClick: (article: JournalArticle) => void;
}

const Journal: React.FC<JournalProps> = ({ onArticleClick }) => {
  return (
    <section id="journal" className="bg-[#0b0f1a] pt-32 pb-32 px-6 md:px-12">
      <div className="max-w-[1800px] mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 pb-8 border-b border-slate-800">
            <div>
                <span className="block text-xs font-bold uppercase tracking-[0.2em] text-cyan-500 mb-4">Engineering Insights</span>
                <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter text-white">THE OVERCLOCK</h2>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {JOURNAL_ARTICLES.map((article) => (
                <div key={article.id} className="group cursor-pointer flex flex-col text-left" onClick={() => onArticleClick(article)}>
                    <div className="w-full aspect-video overflow-hidden mb-6 bg-slate-900 rounded-xl border border-slate-800">
                        <img 
                            src={article.image} 
                            alt={article.title} 
                            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                        />
                    </div>
                    <div className="flex flex-col flex-1 text-left">
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">{article.date}</span>
                        <h3 className="text-2xl font-bold text-white mb-4 leading-tight group-hover:text-cyan-400 transition-colors">{article.title}</h3>
                        <p className="text-slate-400 font-medium leading-relaxed line-clamp-2 text-sm">{article.excerpt}</p>
                    </div>
                </div>
            ))}
        </div>
      </div>
    </section>
  );
};

export default Journal;