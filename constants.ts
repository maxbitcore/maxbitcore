
import React from 'react';
import { Product, JournalArticle } from './types';

// Emptied for user-driven publishing
export const PRODUCTS: Product[] = [];

export const JOURNAL_ARTICLES: JournalArticle[] = [
  {
    id: 1,
    title: "Overclocking the 14th Gen",
    date: "June 15, 2025",
    excerpt: "A guide to squeezing every drop of performance from your new CPU.",
    image: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=1000",
    content: React.createElement(React.Fragment, null,
      React.createElement("p", { className: "mb-6" }, "Overclocking is no longer just for the extreme enthusiasts."),
      React.createElement("p", { className: "mb-6" }, "The key is thermal management. Without a 360mm AIO, you are likely to hit thermal throttling before you see the gains of your voltage tweaks.")
    )
  }
];

export const BRAND_NAME = 'MAXBIT';
