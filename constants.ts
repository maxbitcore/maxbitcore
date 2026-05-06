
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

/** Used when no admin-uploaded logo is stored in localStorage (`maxbit_logo`). */
export const DEFAULT_LOGO_URL = 'https://www.maxbitcore.com/uploads/logo.png';

const LOGO_SITE_ORIGIN = 'https://www.maxbitcore.com';

/**
 * Resolves potentially relative media paths (`/uploads/...`) to absolute
 * URLs so they also work inside mobile webviews.
 */
export function resolveSiteAssetUrl(stored: string | null | undefined): string {
  const raw = (stored ?? '').trim();
  if (!raw) return '';
  if (/^(data|blob):/i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return `${LOGO_SITE_ORIGIN}${path}`;
}

/**
 * Ensures logo URLs work in mobile wrappers (Capacitor/PWA) where relative paths
 * would resolve against the app origin instead of the live site.
 */
export function resolveLogoSrc(stored: string | null | undefined): string {
  const resolved = resolveSiteAssetUrl(stored);
  return resolved || DEFAULT_LOGO_URL;
}
