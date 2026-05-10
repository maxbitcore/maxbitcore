import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BuildSubmission, Product, ProductStatus, Review } from '../types';
import { getAnalytics, AnalyticsData, VisitorSession } from '../services/analyticsService';
import {
  BUILTIN_CONFIGURATOR_OPTION_KEYS,
  BUILTIN_CONFIGURATOR_OPTION_KEY_SET,
  CONFIGURATOR_SECTION_LABELS_KEY,
  DEFAULT_CONFIGURATOR_STRING_LISTS,
  formatConfiguratorSectionTitle,
  normalizeStoredConfiguratorConfig,
  parseConfiguratorSectionLabels,
  resolveConfiguratorSectionTitle,
  sanitizeNewConfiguratorSectionKey,
} from '../services/configuratorOptions';
import { resolveSiteAssetUrl } from '../constants';
import { loginUser, registerUser, getStoredAuth } from '../services/authService';
import emailjs from '@emailjs/browser';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer} from 'recharts';

const DEFAULT_LOGO = localStorage.getItem('maxbit_logo') || "";

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

function formatTrafficDateTime(ms: number | undefined): string {
  const t = Number(ms);
  if (!Number.isFinite(t) || t <= 0) return '—';
  try {
    return new Date(t).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '—';
  }
}

function trafficSessionDurationSec(session: VisitorSession): number {
  const start = Number(session.startTime) || 0;
  const end = Number(session.lastActive) || start;
  if (!start) return 0;
  return Math.max(0, Math.round((end - start) / 1000));
}

/** Stable key to merge repeat visits from the same actor in Live Traffic. */
function trafficGroupKey(session: VisitorSession): string {
  const u = String(session?.user || '').trim().toLowerCase();
  const sid = String(session?.id || '').trim();
  if (!u || u === 'guest') return sid ? `guest:${sid}` : `guest:${Number(session?.startTime || 0)}`;
  if (u === 'admin') return '__admin__';
  if (u === 'registered_user') {
    return sid ? `registered:${sid}` : `registered:${Number(session?.startTime || 0)}`;
  }
  return u;
}

const FULFILLMENT_STATUSES = ['Processing', 'Shipped', 'Delivered', 'Cancelled'] as const;
type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

const DEFAULT_CASE_STYLE_ASSETS: Record<string, string> = {
  Panoramic: 'https://www.maxbitcore.com/uploads/panoramic.png',
  Airflow: 'https://www.maxbitcore.com/uploads/airflow.png',
  Stealth: 'https://www.maxbitcore.com/uploads/stealth.jpg',
  'Dual-Chamber': 'https://www.maxbitcore.com/uploads/dual_chamber.png',
};

type AdminMergedOrder = {
  key: string;
  orderNumber: string;
  customerEmail: string;
  /** Same currency amount as `amount` when set (e.g. from API `total` / `totalMajor`). */
  total?: number;
  amount: number;
  timestamp: number;
  paymentStatus: string;
  fulfillmentStatus?: FulfillmentStatus | string;
  managedByNode: boolean;
  lineItems?: {
    id: string;
    name: string;
    priceMajor: number;
    quantity: number;
    imageUrl?: string;
    productId?: string;
  }[];
  currency?: string;
  /** Allocated unit serials ({ productId, serial }) when serial pool was used. */
  serialAllocations?: { productId: string; serial: string }[];
};

function resolveAdminApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim()) {
    return fromEnv.trim().replace(/\/+$/, '');
  }
  if (import.meta.env.PROD && typeof window !== 'undefined') {
    return `${window.location.origin.replace(/\/+$/, '')}`;
  }
  return 'http://localhost:4242';
}

function normalizePhpShopOrder(ord: any): AdminMergedOrder {
  /** Prefer human-readable order id (matches Stripe metadata.orderId / checkout orderNumber). */
  const primary = String(
    ord.orderNumber ?? ord.order_number ?? ord.order_id ?? ord.id ?? ''
  ).trim();
  const fallbackKey = `php-${Number(ord.timestamp) || Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const id = (primary || fallbackKey).slice(0, 120);
  const ts = Number(ord.timestamp);
  const created = ord.created_at ? Date.parse(String(ord.created_at)) : NaN;
  return {
    key: id,
    orderNumber: String(ord.orderNumber ?? ord.order_id ?? ord.id ?? id),
    customerEmail: String(ord.customerEmail ?? ord.customer_email ?? ord.customer?.email ?? ''),
    amount: Number(ord.total ?? ord.amount ?? ord.total_amount) || 0,
    timestamp: Number.isFinite(ts) && ts > 0 ? ts : Number.isFinite(created) ? created : Date.now(),
    paymentStatus: String(ord.status ?? 'PAID'),
    fulfillmentStatus: ord.fulfillment_status,
    managedByNode: false,
  };
}

function normalizeNodeShopOrder(o: any): AdminMergedOrder | null {
  const key = String(o.id || '').trim();
  if (!key) return null;
  const paidMs = Date.parse(String(o.paidAt || ''));
  const updatedMs = Date.parse(String(o.updatedAt || ''));
  const ts = Number.isFinite(paidMs) ? paidMs : Number.isFinite(updatedMs) ? updatedMs : Date.now();
  return {
    key,
    orderNumber: String(o.orderNumber || key),
    customerEmail: String(o.customerEmail || ''),
    amount: Number(o.totalMajor) || 0,
    timestamp: ts,
    paymentStatus: 'PAID',
    fulfillmentStatus: (o.fulfillmentStatus as string) || 'Processing',
    managedByNode: true,
    lineItems: Array.isArray(o.lineItems) ? o.lineItems : undefined,
    currency: o.currency,
    serialAllocations: Array.isArray(o.serialAllocations) ? o.serialAllocations : undefined,
  };
}

function mergeAdminShopOrders(phpRows: any[], nodeRows: any[]): AdminMergedOrder[] {
  const map = new Map<string, AdminMergedOrder>();
  for (const ord of phpRows) {
    const p = normalizePhpShopOrder(ord);
    map.set(p.key, p);
  }
  for (const row of nodeRows) {
    const n = normalizeNodeShopOrder(row);
    if (n) map.set(n.key, n);
  }
  return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
}

/** Same value as server `ADMIN_ORDERS_SECRET`. Vite env at build time, or saved in this browser (see Orders tab). */
const ADMIN_ORDERS_SECRET_LS_KEY = 'maxbit_admin_orders_secret';

function getAdminOrdersSecret(): string {
  const env =
    typeof import.meta.env.VITE_ADMIN_ORDERS_SECRET === 'string'
      ? import.meta.env.VITE_ADMIN_ORDERS_SECRET.trim()
      : '';
  if (env) return env;
  try {
    return localStorage.getItem(ADMIN_ORDERS_SECRET_LS_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

interface AdminDashboardProps {
  showRegister: boolean;      
  closeRegister: () => void;
}

interface RichEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  label: string;
}

const RichEditor: React.FC<RichEditorProps> = ({ value, onChange, placeholder, label }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isUpdatingRef = useRef(false);

  useEffect(() => {
    if (!isUpdatingRef.current && editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      isUpdatingRef.current = true;
      onChange(editorRef.current.innerHTML);
      setTimeout(() => { isUpdatingRef.current = false; }, 0);
    }
  };

  const exec = (cmd: string, val?: string) => {
    editorRef.current?.focus();
    if (cmd === 'createLink') {
      const url = window.prompt('Enter Deployment URL:');
      if (url) document.execCommand(cmd, false, url);
    } else {
      document.execCommand(cmd, false, val);
    }
    handleInput();
  };

return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">{label}</label>
      <div className="relative bg-slate-950 border border-slate-800 rounded-xl overflow-hidden focus-within:border-cyan-500/50 transition-all">
        <div className="bg-slate-900/50 border-b border-slate-800 p-2 flex flex-wrap gap-2 items-center">

          {/* Group: Typography */}
          <div className="flex bg-slate-950/50 rounded-lg p-0.5 border border-slate-800 gap-0.5">
            <button type="button" onMouseDown={(e) => { e.preventDefault(); exec('bold'); }} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6zM6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" /></svg>
            </button>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); exec('italic'); }} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors">
               <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M10 20l4-16m-9 16h6m2-16h6" /></svg>
            </button>
          </div>
          <div className="flex bg-slate-950/50 rounded-lg p-0.5 border border-slate-800 gap-0.5">

            {/* Underline */}
            <button 
              type="button" 
              onMouseDown={(e) => { e.preventDefault(); exec('underline'); }} 
              className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors" 
              title="Underline"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                <path d="M6 3v7a6 6 0 006 6 6 6 0 006-6V3M4 21h16" />
              </svg>
            </button>

            {/*  Strikethrough */}
            <button 
              type="button" 
              onMouseDown={(e) => { e.preventDefault(); exec('strikeThrough'); }} 
              className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors" 
              title="Strikethrough"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                <path d="M5 12h14M16 6l-8 0M17 18l-10 0" />
              </svg>
            </button>
          </div>

          <div className="flex bg-slate-950/50 rounded-lg p-0.5 border border-slate-800 gap-0.5">
            {['1', '3', '5', '7'].map((size, idx) => (
              <button
                key={size}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); exec('fontSize', size); }}
                className="px-1.5 py-0.5 hover:bg-slate-800 rounded text-[8px] font-black text-slate-500 hover:text-cyan-400 uppercase"
              >
                {['MIN', 'STD', 'MAG', 'MAX'][idx]}
              </button>
            ))}
          </div>

          {/* Group: Lists */}
          <div className="flex bg-slate-950/50 rounded-lg p-0.5 border border-slate-800 gap-0.5">
            <button type="button" onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList'); }} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors" title="Bullets">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M9 6l11 0M9 12l11 0M9 18l11 0M5 6l0.01 0M5 12l0.01 0M5 18l0.01 0" /></svg>
            </button>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); exec('insertOrderedList'); }} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors" title="Numbered List">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M10 6h10M10 12h10M10 18h10M4 6h1v4M4 10h2M4 18h3" /></svg>
            </button>
          </div>

          {/* Group: Alignment */}
          <div className="flex bg-slate-950/50 rounded-lg p-0.5 border border-slate-800 gap-0.5">
            <button type="button" onMouseDown={(e) => { e.preventDefault(); exec('justifyLeft'); }} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors" title="Align Left">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M4 6h16M4 12h10M4 18h14" /></svg>
            </button>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); exec('justifyCenter'); }} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors" title="Align Center">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M4 6h16M7 12h10M6 18h12" /></svg>
            </button>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); exec('justifyRight'); }} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors" title="Align Right">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M4 6h16M10 12h10M6 18h14" /></svg>
            </button>
          </div> 

          {/* Action: Clear */}
          <button type="button" onMouseDown={(e) => { e.preventDefault(); exec('removeFormat'); }} className="p-2 hover:bg-rose-950/30 rounded text-rose-500 hover:text-rose-400 transition-colors" title="Clear Formatting">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M6 18L18 6M6 6l12 12M19 19l-4-4" /></svg>
          </button>
          <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block"></div>
          {/* Color Palette */}
          <div className="flex flex-wrap gap-1 ml-2">
            {TACTICAL_PALETTE.map((item) => (
              <button 
                key={item.color} 
                type="button" 
                onMouseDown={(e) => { e.preventDefault(); exec('foreColor', item.color); }} 
                className="w-4 h-4 rounded-sm border border-slate-700 hover:scale-125 transition-transform" 
                style={{ backgroundColor: item.color }} 
              />
            ))}
          </div>
        </div>
        <div 
          ref={editorRef} 
          contentEditable 
          onInput={handleInput}
          suppressContentEditableWarning={true}
          className="p-4 min-h-[80px] outline-none text-white text-sm prose prose-invert max-w-none relative z-10"
        ></div>
      </div>
    </div>
  );
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({ showRegister, closeRegister }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'user' | null>(null);
  const [currentLogo, setCurrentLogo] = useState(localStorage.getItem('maxbit_logo') || ""); 
  const logoUploadRef = useRef<HTMLInputElement>(null);

  // 2. NAVIGATION STATE
  const [activeAdminTab, setActiveAdminTab] = useState<'submissions' | 'orders' | 'catalog' | 'analytics' | 'comments'>('submissions');
  const [catalogMode, setCatalogMode] = useState<'products' | 'configurator' | 'serials'>('products');
  const [serialPoolSnapshot, setSerialPoolSnapshot] = useState<{
    pools: Record<string, number>;
    reservations: number;
    ttlMinutes: number;
  } | null>(null);
  const [serialPoolLoading, setSerialPoolLoading] = useState(false);
  const [serialImportProductId, setSerialImportProductId] = useState('');
  const [serialImportText, setSerialImportText] = useState('');
  /** true = one multiline block = one PC in pool (all lines on one invoice). false = legacy one SN per line. */
  const [serialImportAsBundle, setSerialImportAsBundle] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
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
  const [newProductStripePriceId, setNewProductStripePriceId] = useState('');

  // Configurator Assets State
  const [config, setConfig] = useState<Record<string, string[]>>(() => ({
    ...DEFAULT_CONFIGURATOR_STRING_LISTS,
  }));
  const [configDrafts, setConfigDrafts] = useState<Record<string, string>>({});
  const [newSectionKeyDraft, setNewSectionKeyDraft] = useState('');
  const [newSectionTitleDraft, setNewSectionTitleDraft] = useState('');
  const [sectionLabels, setSectionLabels] = useState<Record<string, string>>({});
  const [caseStyles, setCaseStyles] = useState<Record<string, string>>({
    ...DEFAULT_CASE_STYLE_ASSETS,
  });

  const [submissions, setSubmissions] = useState<BuildSubmission[]>([]);
  const [shopOrders, setShopOrders] = useState<AdminMergedOrder[]>([]);
  const [shopOrdersStripeError, setShopOrdersStripeError] = useState<string | null>(null);
  const [ordersSecretDraft, setOrdersSecretDraft] = useState('');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');
  const [trafficRange, setTrafficRange] = useState<'recent' | 'month'>('recent');
  const [expandedTrafficGroups, setExpandedTrafficGroups] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const assetImageRef = useRef<HTMLInputElement>(null);
  const [activeAssetCategory, setActiveAssetCategory] = useState<string | null>(null);

  const uploadImageToServer = async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await fetch('/upload.php', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || "Load error");
    }
    return data.url;
  };

  const syncWithServer = async (updatedList: any[], fileName: string = 'save_products.php') => {
    try {
      const response = await fetch(`/api/${fileName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedList)
      });

      const result = await response.json();
      console.log("SYNC RESULT:", result);
    } catch (error) {
      console.error(`MaxBit Server: Sync failed for ${fileName}`, error);
    }
  };

  const notifyUpdate = () => {
    window.dispatchEvent(new CustomEvent('maxbit-update'));
    window.dispatchEvent(new CustomEvent('storage'));
    window.dispatchEvent(new CustomEvent('configurator-updated'));
  };

  /** Many hosts serve index.html with HTTP 200 for unknown routes — breaks response.json(). */
  const adminBodyLooksLikeHtml = (body: string) => /^\s*</.test(body || '');

  /** Avoid dumping HTML error pages into alerts; 501 often means PATCH/DELETE blocked before Node. */
  const summarizeAdminFetchError = (status: number, body: string): string => {
    const raw = (body || '').trim();
    if (adminBodyLooksLikeHtml(raw)) {
      if (status === 501) {
        return `HTTP ${status}: Not Implemented — the host often blocks PATCH/DELETE. Ensure /shop-orders is proxied to Node and allowed by Apache/LiteSpeed/nginx.`;
      }
      return `HTTP ${status}: HTML error page instead of JSON (check API URL and proxy).`;
    }
    if (raw.length > 400) return `${raw.slice(0, 400)}…`;
    return raw || String(status);
  };

  const getAdminApiBaseCandidates = (): string[] => {
    const primary = resolveAdminApiBaseUrl().replace(/\/+$/, '');
    const candidates: string[] = [];
    if (/\/server$/i.test(primary)) {
      // Prefer non-/server first in production (common reverse-proxy setup).
      candidates.push(primary.replace(/\/server$/i, ''));
      candidates.push(primary);
    } else {
      candidates.push(primary);
      candidates.push(`${primary}/server`);
    }
    return [...new Set(candidates.filter(Boolean))];
  };

  const shopOrdersPathCandidatesForBase = (base: string): string[] => {
    const b = base.replace(/\/+$/, '');
    if (/\/server$/i.test(b)) return ['/shop-orders'];
    return ['/shop-orders', '/server/shop-orders'];
  };

  const shopOrdersPathVariantsForFetch = (base: string, path: string): string[] => {
    if (!path.startsWith('/shop-orders')) return [path];
    const suffix = path.slice('/shop-orders'.length);
    return shopOrdersPathCandidatesForBase(base).map((p) => `${p}${suffix}`);
  };

  const fetchNodeOrdersApi = async (
    path: string,
    init: RequestInit,
    adminSecret: string
  ): Promise<{ response: Response; base: string }> => {
    const bases = getAdminApiBaseCandidates();
    const headers = {
      ...(init.headers || {}),
      'X-Maxbit-Admin-Orders-Secret': adminSecret,
    } as Record<string, string>;

    let lastResponse: Response | null = null;
    let lastError: unknown = null;
    for (const base of bases) {
      const b = base.replace(/\/+$/, '');
      for (const p of shopOrdersPathVariantsForFetch(b, path)) {
        try {
          const response = await fetch(`${b}${p}`, { ...init, headers });
          if (response.status === 404) {
            lastResponse = response;
            continue;
          }
          return { response, base: b };
        } catch (e) {
          lastError = e;
        }
      }
    }

    if (lastResponse) {
      return { response: lastResponse, base: bases[0] || '' };
    }
    throw (lastError instanceof Error ? lastError : new Error('Could not reach Node orders API.'));
  };

  const updateNodeOrderFulfillment = async (orderKey: string, status: FulfillmentStatus) => {
    const adminSecret = getAdminOrdersSecret();
    if (!adminSecret) return;
    try {
      const { response: r } = await fetchNodeOrdersApi(
        `/shop-orders/${encodeURIComponent(orderKey)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fulfillmentStatus: status }),
        },
        adminSecret
      );
      if (!r.ok) {
        const t = await r.text();
        let detail = summarizeAdminFetchError(r.status, t);
        try {
          const j = JSON.parse(t) as { error?: string };
          if (j && typeof j.error === 'string' && j.error.trim()) detail = j.error.trim();
        } catch {
          /* keep summarized */
        }
        throw new Error(detail);
      }
      setShopOrders((prev) =>
        prev.map((o) => (o.key === orderKey ? { ...o, fulfillmentStatus: status } : o))
      );
    } catch (err) {
      console.error('Fulfillment update failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(
        `Could not update order status.\n\n${msg}\n\nIf this says "blocked by CORS" or "Failed to fetch", add your site URL to CLIENT_URL on the Node server (comma-separated), e.g. https://www.maxbitcore.com`
      );
    }
  };

  const deleteNodeShopOrder = async (orderKey: string) => {
    const adminSecret = getAdminOrdersSecret();
    if (!adminSecret) return;
    try {
      const { response: r } = await fetchNodeOrdersApi(
        `/shop-orders/${encodeURIComponent(orderKey)}`,
        { method: 'DELETE' },
        adminSecret
      );
      if (!r.ok) {
        const t = await r.text();
        let detail = summarizeAdminFetchError(r.status, t);
        try {
          const j = JSON.parse(t) as { error?: string };
          if (j && typeof j.error === 'string' && j.error.trim()) detail = j.error.trim();
        } catch {
          /* keep summarized */
        }
        throw new Error(detail);
      }
      setShopOrders((prev) => prev.filter((o) => o.key !== orderKey));
    } catch (err) {
      console.error('Order delete failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Could not delete order.\n\n${msg}`);
    }
  };

  const refreshSerialPool = async () => {
    const secret = getAdminOrdersSecret();
    if (!secret) {
      setSerialPoolSnapshot(null);
      return;
    }
    setSerialPoolLoading(true);
    try {
      const bases = getAdminApiBaseCandidates();
      let found = false;
      outer: for (const base of bases) {
        const b = base.replace(/\/+$/, '');
        const urls = /\/server$/i.test(b)
          ? [`${b}/serial-pool`]
          : [`${b}/serial-pool`, `${b}/server/serial-pool`];
        for (const url of urls) {
          const r = await fetch(url, {
            headers: { 'X-Maxbit-Admin-Orders-Secret': secret },
          });
          const text = await r.text();
          if (!r.ok) continue;
          if (adminBodyLooksLikeHtml(text)) continue;
          try {
            const data = JSON.parse(text) as {
              pools: Record<string, number>;
              reservations: number;
              ttlMinutes: number;
            };
            setSerialPoolSnapshot(data);
            found = true;
            break outer;
          } catch {
            continue;
          }
        }
      }
      if (!found) setSerialPoolSnapshot(null);
    } finally {
      setSerialPoolLoading(false);
    }
  };

  const submitSerialImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const secret = getAdminOrdersSecret();
    const pid = serialImportProductId.trim();
    if (!secret || !pid) return;
    const trimmedText = serialImportText.trim();
    if (!trimmedText) return;
    if (!serialImportAsBundle) {
      const serials = serialImportText.split(/[\r\n,]+/).map((s) => s.trim()).filter(Boolean);
      if (!serials.length) return;
    }
    setSerialPoolLoading(true);
    try {
      const bases = getAdminApiBaseCandidates();
      const tried: string[] = [];
      let imported = false;
      let stoppedEarly = false;
      let okWasHtml = false;
      outer: for (const base of bases) {
        const b = base.replace(/\/+$/, '');
        const urls = /\/server$/i.test(b)
          ? [`${b}/serial-pool`]
          : [`${b}/serial-pool`, `${b}/server/serial-pool`];
        for (const url of urls) {
          tried.push(url);
          let r: Response;
          try {
            const body = serialImportAsBundle
              ? { productId: pid, bundle: serialImportText }
              : {
                  productId: pid,
                  serials: serialImportText.split(/[\r\n,]+/).map((s) => s.trim()).filter(Boolean),
                };
            r = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Maxbit-Admin-Orders-Secret': secret,
              },
              body: JSON.stringify(body),
            });
          } catch (err) {
            stoppedEarly = true;
            alert(
              `Network error calling ${url}: ${err instanceof Error ? err.message : String(err)}. Check VITE_API_URL / Node URL.`
            );
            break outer;
          }
          const text = await r.text();
          if (r.ok) {
            if (adminBodyLooksLikeHtml(text)) {
              okWasHtml = true;
              continue;
            }
            try {
              JSON.parse(text);
            } catch {
              continue;
            }
            setSerialImportText('');
            await refreshSerialPool();
            alert('Serial numbers added to the pool.');
            imported = true;
            break outer;
          }
          if (r.status !== 404) {
            stoppedEarly = true;
            alert(text.slice(0, 220) || 'Import failed.');
            break outer;
          }
        }
      }
      if (!imported && !stoppedEarly && tried.length) {
        alert(
          okWasHtml
            ? `Serial pool URL returned HTML (SPA/index), not the Node API — JSON parse failed.\nTried:\n${tried.join(
                '\n'
              )}\n\nSet VITE_API_URL in .env to the real Node/Passenger base URL (the one that serves /serial-pool), rebuild, redeploy.`
            : `Serial pool API not found (404 on all URLs). Tried:\n${tried.join(
                '\n'
              )}\n\nSet VITE_API_URL to your Node base URL and redeploy the frontend, or open the site URL that proxies to Passenger.`
        );
      }
    } finally {
      setSerialPoolLoading(false);
    }
  };

  useEffect(() => {
    if (activeAdminTab === 'catalog' && catalogMode === 'serials') {
      refreshSerialPool();
    }
  }, [activeAdminTab, catalogMode]);

  const resetProductForm = () => {
    setEditingId(null);
    setNewProductName('');
    setNewProductPrice('');
    setNewProductStripePriceId('');
    setNewProductImage('');
    setNewProductGallery([]);
    setNewProductComponents('');
    setNewProductDesc('');
    setNewProductCategory('Gaming PCs');
    setNewProductStatus('In Stock');
    setCatalogMode('products'); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const { token } = getStoredAuth();
    if (token) setIsAuthenticated(true);
  }, []);

  const handleDirectUpload = async (e: React.ChangeEvent<HTMLInputElement>, category: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);

    try {
        const url = resolveSiteAssetUrl(await uploadImageToServer(file));
        const updatedStyles = { ...caseStyles, [category]: url };
        setCaseStyles(updatedStyles);
        localStorage.setItem('maxbit_case_styles', JSON.stringify(updatedStyles));
        notifyUpdate();
    } catch (error) {
        console.error("Style upload failed:", error);
        alert("Failed to upload image to server.");
    } finally {
        setIsProcessing(false);
    }
};

  useEffect(() => {
    const { token, role } = getStoredAuth();
    if (token && role) { setIsAuthenticated(true); setUserRole(role); }
    const storedLogo = localStorage.getItem('maxbit_logo');
    if (storedLogo) setCurrentLogo(storedLogo);

    const loadAllData = async () => {
      setIsLoading(true);
      console.log("DEBUG: loadAllData START");
      try {
        try {
          const prodRes = await fetch('https://www.maxbitcore.com/api/products.php', { cache: 'no-store' });
          if (prodRes.ok) {
            const prodText = await prodRes.text();
            if (!adminBodyLooksLikeHtml(prodText)) {
              try {
                const prodData = JSON.parse(prodText);
                if (Array.isArray(prodData)) {
                  setPublishedProducts(prodData);
                  localStorage.setItem('maxbit_published_products_v2', JSON.stringify(prodData));
                }
              } catch {
                /* ignore malformed JSON */
              }
            }
          }
        } catch (e) {
          console.error("Products Sync Failed:", e);
          const localProd = localStorage.getItem('maxbit_published_products_v2');
          if (localProd) setPublishedProducts(JSON.parse(localProd));
        }

        try {
          const subRes = await fetch(`/api/get-submissions.php?v=${Date.now()}`);
          const text = await subRes.text(); 
          if (text && text.trim().startsWith('[')) { 
            const subData = JSON.parse(text);
            setSubmissions(subData);
          } else {
            console.warn("RADAR: Received empty or invalid response for submissions.");
            setSubmissions([]);
          }
        } catch (e) {
          console.error("Submissions channel offline:", e);
          setSubmissions([]);
        }

        try {
          let phpOrders: any[] = [];
          const orderRes = await fetch('https://www.maxbitcore.com/api/get-orders.php');
          if (orderRes.ok) {
            const orderText = await orderRes.text();
            if (!adminBodyLooksLikeHtml(orderText)) {
              try {
                const orderData = JSON.parse(orderText);
                if (Array.isArray(orderData)) phpOrders = orderData;
              } catch {
                /* ignore */
              }
            }
          }

          let nodeOrders: any[] = [];
          let stripeErr: string | null = null;
          const adminSecret = getAdminOrdersSecret();
          if (adminSecret) {
            try {
              const bases = getAdminApiBaseCandidates();
              let loaded = false;
              outer: for (const base of bases) {
                const b = base.replace(/\/+$/, '');
                for (const ordersPath of shopOrdersPathCandidatesForBase(b)) {
                  const nodeRes = await fetch(`${b}${ordersPath}`, {
                    method: 'GET',
                    headers: { 'X-Maxbit-Admin-Orders-Secret': adminSecret },
                  });
                  const body = await nodeRes.text().catch(() => '');
                  if (!nodeRes.ok) {
                    stripeErr = `Stripe orders API (${b}${ordersPath}): ${summarizeAdminFetchError(nodeRes.status, body)}`;
                    if (nodeRes.status === 404) continue;
                    continue;
                  }
                  // Some hosts rewrite unknown routes to index.html with HTTP 200.
                  if (/^\s*</.test(body)) {
                    stripeErr = `Stripe orders API (${b}${ordersPath}): returned HTML instead of JSON`;
                    continue;
                  }
                  try {
                    const nodeData = JSON.parse(body);
                    if (Array.isArray(nodeData)) {
                      nodeOrders = nodeData;
                      loaded = true;
                      stripeErr = null;
                      break outer;
                    }
                    stripeErr = `Stripe orders API (${b}${ordersPath}): unexpected JSON payload`;
                  } catch (e) {
                    stripeErr = `Stripe orders API (${b}${ordersPath}): invalid JSON`;
                  }
                }
              }
              if (!loaded && stripeErr) console.warn('Shop orders API:', stripeErr);
            } catch (nodeErr) {
              stripeErr =
                nodeErr instanceof Error ? nodeErr.message : 'Could not reach Node server for shop orders.';
              console.error('Node shop orders fetch failed:', nodeErr);
            }
          }
          setShopOrdersStripeError(adminSecret ? stripeErr : null);

          setShopOrders(mergeAdminShopOrders(phpOrders, nodeOrders));
        } catch (e) {
          console.error("Orders Sync Failed:", e);
        }

      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      loadAllData();
    }
    const storedConfig = localStorage.getItem('maxbit_configurator_options');
    let parsed: unknown = null;
    if (storedConfig) {
      try {
        parsed = JSON.parse(storedConfig);
      } catch {
        parsed = null;
      }
    }
    setConfig(normalizeStoredConfiguratorConfig(parsed));
    setConfigDrafts({});

    try {
      const rawLb = localStorage.getItem(CONFIGURATOR_SECTION_LABELS_KEY);
      setSectionLabels(parseConfiguratorSectionLabels(rawLb ? JSON.parse(rawLb) : null));
    } catch {
      setSectionLabels({});
    }

    const storedCaseStyles = localStorage.getItem('maxbit_case_styles');
    if (storedCaseStyles) {
      try {
        const parsed = JSON.parse(storedCaseStyles) as Record<string, unknown>;
        const normalized = Object.fromEntries(
          Object.entries(parsed || {}).map(([k, v]) => [k, resolveSiteAssetUrl(String(v || ''))])
        );
        setCaseStyles({
          ...DEFAULT_CASE_STYLE_ASSETS,
          ...normalized,
        });
      } catch {
        setCaseStyles({ ...DEFAULT_CASE_STYLE_ASSETS });
      }
    } else {
      setCaseStyles({ ...DEFAULT_CASE_STYLE_ASSETS });
    }
    
    const analyticsData = getAnalytics();
    setAnalytics(analyticsData);

    window.addEventListener('maxbit-update', loadAllData);
    return () => window.removeEventListener('maxbit-update', loadAllData);
  }, []);

  const allComments = useMemo(() => {
    const list: { productId: string; productName: string; productImage: string; review: Review }[] = [];
    publishedProducts.forEach(p => {
      const rawImage = p.gallery || p.imageUrl || '';
      const displayImage: string = Array.isArray(rawImage)
        ? (rawImage[0] || '') 
        : (rawImage as string);

      p.reviews?.forEach(r => {
        list.push({ 
          productId: p.id, 
          productName: p.name, 
          productImage: displayImage, 
          review: r 
        });
      });
    });

    return list.sort((a, b) => new Date(b.review.date).getTime() - new Date(a.review.date).getTime());
  }, [publishedProducts]);

  const sendRegistrationEmail = async (userData: any) => {
    try {
      await emailjs.send(
        'service_2bhrbcn', 
        'template_vxdzhk8', 
        {
          first_name: userData.firstName,
          last_name: userData.lastName,
          user_email: userData.email,
          phone: userData.phone || 'Not provided',
          gender: userData.gender,
          birth_date: userData.birthDate,
          business_name: "MaxBit LLC",
        },
        'ewqLULf0b6_PZy8W5'
      );
      console.log("Email sent successfully");
    } catch (error) {
      console.error("Email error:", error);
      throw error;
    }
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
  
    const now = Date.now();
    const existing = publishedProducts.find(p => p.id === editingId);

    const stripePid = newProductStripePriceId.trim();
    const productData: Product = {
      id: editingId || `PUB-${now}`,
      name: newProductName,
      price: parseFloat(newProductPrice),
      ...(stripePid ? { stripePriceId: stripePid } : {}),
      category: newProductCategory,
      status: newProductStatus,
      imageUrl: newProductImage || (newProductGallery.length > 0 ? newProductGallery[0] : ''),
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
    localStorage.setItem('maxbit_published_products_v2', JSON.stringify(newList));
    
    await syncWithServer(newList);

    setIsProcessing(false);
    resetProductForm();
    notifyUpdate();
    alert("Unit Deployed Successfully to MaxBit Armory!");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsProcessing(true);
    const uploadedUrls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const url = await uploadImageToServer(files[i]);
        uploadedUrls.push(url);
      } catch (err) {
        console.error("Error uploading file", err);
      }
    }

    if (uploadedUrls.length > 0) {
      if (!newProductImage) {
        setNewProductImage(uploadedUrls[0]);
        setNewProductGallery(prev => [...prev, ...uploadedUrls.slice(1)]);
      } else {
        setNewProductGallery(prev => [...prev, ...uploadedUrls]);
      }
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
  const togglePublish = async (productId: string) => {
    const updatedList = publishedProducts.map(p => {
      if (p.id === productId) {
        return { ...p, isPublished: !p.isPublished };
      }
      return p;
    });
    
    setPublishedProducts(updatedList);
    localStorage.setItem('maxbit_published_products_v2', JSON.stringify(updatedList));

    await syncWithServer(updatedList);
    notifyUpdate();
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm("Delete this unit from inventory?")) return;
    console.log("DELETING UNIT:", productId);
    const updatedList = publishedProducts.filter(p => p.id !== productId);
    setPublishedProducts(updatedList);
    localStorage.setItem('maxbit_published_products_v2', JSON.stringify(updatedList));
    try {
      await syncWithServer(updatedList); 
      console.log("SERVER SYNC COMPLETE");
    } catch (e) {
       alert("SERVER ERROR: Unit may return after refresh.");
    }
    if (editingId === productId) resetProductForm();
    notifyUpdate();
  };

  const startEditProduct = (p: Product) => {
    setEditingId(p.id); 
    setNewProductName(p.name); 
    setNewProductPrice(p.price.toString());
    setNewProductStripePriceId(p.stripePriceId?.trim() || '');
    setNewProductImage(p.imageUrl); 
    setNewProductGallery(p.gallery || []);
    setNewProductComponents(p.components || ''); 
    setNewProductDesc(p.description);
    setNewProductCategory(p.category as any); 
    setNewProductStatus(p.status);
    setCatalogMode('products');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const response = await fetch('https://www.maxbitcore.com/api/update_status.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus })
      });

      if (response.ok) {
        setSubmissions(prev => prev.map(sub => 
          sub.id === id ? { ...sub, status: newStatus } : sub
        ));
        notifyUpdate();
      } else {
        alert("Server communication failed.");
      }
    } catch (error) {
      console.error("Status Update Error:", error);
    }
  };

  const handleDeleteSubmission = async (id: string) => {
    if (!window.confirm('PROTOCOL WARNING: Confirm permanent removal of this mission?')) return;
    try {
      const response = await fetch('https://www.maxbitcore.com/api/delete-submission.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }) 
      });
      const rawDelete = await response.text();
      if (adminBodyLooksLikeHtml(rawDelete)) {
        alert('Server returned HTML instead of JSON. Check API URL.');
        return;
      }
      let result: { status?: string };
      try {
        result = JSON.parse(rawDelete);
      } catch {
        alert('Invalid server response.');
        return;
      }
      if (result.status === 'success') {
        setSubmissions(prev => prev.filter(s => s.id !== id));
        notifyUpdate();
        alert("Mission Terminated.");
      }
    } catch (e) {
      alert("Network error.");
    }
  };

  // Asset Management Helpers
  const updateConfigList = (key: string, values: string[]) => {
    const normalizedValues = values
      .map((v) => String(v || '').trim())
      .filter(Boolean);
    const newConfig = { ...config, [key]: normalizedValues };
    setConfig(newConfig);
    localStorage.setItem('maxbit_configurator_options', JSON.stringify(newConfig));
    notifyUpdate();
  };

  const addConfigOption = (key: string) => {
    const draftValue = (configDrafts[key] || '').trim();
    if (!draftValue) return;
    const list = config[key] || [];
    if (list.includes(draftValue)) return;
    updateConfigList(key, [...list, draftValue]);
    setConfigDrafts((prev) => ({ ...prev, [key]: '' }));
  };

  const removeConfigOption = (key: string, item: string) => {
    const list = config[key] || [];
    updateConfigList(
      key,
      list.filter((v) => v !== item)
    );
  };

  const addConfiguratorSection = () => {
    const key = sanitizeNewConfiguratorSectionKey(newSectionKeyDraft);
    if (!key) {
      alert('Use camelCase: starts with a letter, then letters/numbers only (e.g. coolingTypes).');
      return;
    }
    if (BUILTIN_CONFIGURATOR_OPTION_KEY_SET.has(key)) {
      alert('That name is reserved for a built-in section.');
      return;
    }
    if (key in config) {
      alert('A section with this key already exists.');
      return;
    }
    updateConfigList(key, []);
    const title = newSectionTitleDraft.trim();
    if (title) {
      setSectionLabels((prev) => {
        const next = { ...prev, [key]: title };
        try {
          localStorage.setItem(CONFIGURATOR_SECTION_LABELS_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        notifyUpdate();
        return next;
      });
    }
    setNewSectionKeyDraft('');
    setNewSectionTitleDraft('');
  };

  const removeConfiguratorSection = (key: string) => {
    if (BUILTIN_CONFIGURATOR_OPTION_KEY_SET.has(key)) return;
    const label = resolveConfiguratorSectionTitle(key, sectionLabels);
    if (!window.confirm(`Remove chapter "${label}" and all its options?`)) return;
    const next = { ...config };
    delete next[key];
    setConfig(next);
    localStorage.setItem('maxbit_configurator_options', JSON.stringify(next));
    setConfigDrafts((prev) => {
      const d = { ...prev };
      delete d[key];
      return d;
    });
    const nextLabels = { ...sectionLabels };
    delete nextLabels[key];
    setSectionLabels(nextLabels);
    try {
      localStorage.setItem(CONFIGURATOR_SECTION_LABELS_KEY, JSON.stringify(nextLabels));
    } catch {
      /* ignore */
    }
    notifyUpdate();
  };

  const persistSectionLabel = (key: string, raw: string) => {
    const v = raw.trim();
    setSectionLabels((prev) => {
      const next = { ...prev };
      if (!v) delete next[key];
      else next[key] = v;
      try {
        localStorage.setItem(CONFIGURATOR_SECTION_LABELS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      notifyUpdate();
      return next;
    });
  };

  const configuratorSectionKeys = useMemo(() => {
    const keys = Object.keys(config);
    const builtins = BUILTIN_CONFIGURATOR_OPTION_KEYS.filter((k) => keys.includes(k));
    const extras = keys
      .filter((k) => !BUILTIN_CONFIGURATOR_OPTION_KEY_SET.has(k))
      .sort((a, b) => a.localeCompare(b));
    return [...builtins, ...extras];
  }, [config]);

  const handleAssetImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !activeAssetCategory) return;

    setIsProcessing(true);

    try {
      const file = files[0];

      if (!file) return;

      const url = resolveSiteAssetUrl(await uploadImageToServer(file as File));

      const updatedStyles = { 
        ...caseStyles, 
        [activeAssetCategory]: url 
      };

      setCaseStyles(updatedStyles);
      localStorage.setItem('maxbit_case_styles', JSON.stringify(updatedStyles));

      notifyUpdate();
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload image to server.");
    } finally {
      setIsProcessing(false);
      setActiveAssetCategory(null);
    }
  };

  const chartData = useMemo(() => {
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    return last7Days.map(date => ({
      displayDate: date.split('-').reverse().slice(0, 2).join('.'), 
      visits: (analytics?.sessions || []).filter((s: any) => s.date === date).length
    }));
  }, [analytics?.sessions]);

  const trafficBreakdown = useMemo(() => {
    const sessions = analytics?.sessions || [];
    let guests = 0;
    let admins = 0;
    let registered = 0;

    sessions.forEach((session: any) => {
      const identity = String(session?.user || '').trim().toLowerCase();
      if (!identity || identity === 'guest') {
        guests += 1;
      } else if (identity === 'admin') {
        admins += 1;
      } else {
        registered += 1;
      }
    });

    return { guests, admins, registered, total: sessions.length };
  }, [analytics?.sessions]);

  const trafficSessionsFiltered = useMemo(() => {
    const raw = (analytics?.sessions || []).slice() as VisitorSession[];
    const sessions = raw.filter((s) => {
      const id = String(s?.id || '');
      const user = String(s?.user || '').trim().toUpperCase();
      if (id.startsWith('ADMIN-') && user === 'ADMIN') return false;
      return true;
    });

    sessions.sort((a, b) => {
      const aTime = Number(a?.lastActive || a?.startTime || 0);
      const bTime = Number(b?.lastActive || b?.startTime || 0);
      return bTime - aTime;
    });

    if (trafficRange === 'month') {
      const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      return sessions.filter((s) => Number(s?.lastActive || s?.startTime || 0) >= monthAgo);
    }

    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return sessions.filter((s) => Number(s?.lastActive || s?.startTime || 0) >= weekAgo).slice(0, 120);
  }, [analytics?.sessions, trafficRange]);

  const trafficGroups = useMemo(() => {
    const map = new Map<string, VisitorSession[]>();
    for (const s of trafficSessionsFiltered) {
      const k = trafficGroupKey(s);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    for (const arr of map.values()) {
      arr.sort(
        (a, b) =>
          Number(b.lastActive || b.startTime || 0) - Number(a.lastActive || a.startTime || 0)
      );
    }
    const list = [...map.entries()].map(([key, sessions]) => ({
      key,
      sessions,
      latest: sessions[0],
      count: sessions.length,
    }));
    list.sort((a, b) => {
      const ta = Number(a.latest?.lastActive || a.latest?.startTime || 0);
      const tb = Number(b.latest?.lastActive || b.latest?.startTime || 0);
      return tb - ta;
    });
    return trafficRange === 'month' ? list.slice(0, 200) : list.slice(0, 24);
  }, [trafficSessionsFiltered, trafficRange]);

  return (
    <div className="min-h-screen bg-[#0b0f1a] pt-8 pb-24 px-6 md:px-12 animate-fade-in-up">
      <div className="max-w-7xl mx-auto space-y-12">
        {isAuthenticated && (
          <>
           <div className="flex flex-col md:flex-row justify-between items-center gap-8 border-b border-slate-800 pb-12">
              <div className="flex items-center gap-6">
                <div className="relative group cursor-pointer" onClick={() => logoUploadRef.current?.click()}>
                  <img src={currentLogo} className="w-16 h-16 object-contain group-hover:opacity-50 transition-opacity" alt="Logo" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
                  </div>
                  <input 
                    type="file" 
                    ref={logoUploadRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={async (e) => { 
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          const url = await uploadImageToServer(file);
                          setCurrentLogo(url);
                          localStorage.setItem('maxbit_logo', url);
                          window.dispatchEvent(new CustomEvent('logo-updated'));
                        } catch (error) { 
                          console.error("Logo upload failed:", error);
                          alert("Failed to upload logo to server.");
                        }
                      }
                    }} 
                  />
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
              </div>
            </div>

            {/* CATALOG TAB */}
            {activeAdminTab === 'catalog' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 animate-fade-in-up">
                  <div className="lg:col-span-3 mb-4">
                     <div className="flex flex-wrap gap-2 p-1 bg-slate-900/50 rounded-xl w-fit border border-slate-800">
                         <button type="button" onClick={() => setCatalogMode('products')} className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${catalogMode === 'products' ? 'bg-cyan-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white'}`}>Inventory</button>
                         <button type="button" onClick={() => setCatalogMode('configurator')} className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${catalogMode === 'configurator' ? 'bg-cyan-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white'}`}>Configurator</button>
                         <button type="button" onClick={() => setCatalogMode('serials')} className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${catalogMode === 'serials' ? 'bg-cyan-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white'}`}>Serial pool</button>
                     </div>
                  </div>

                  {catalogMode === 'products' && (
                    <>
                      <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl h-fit shadow-2xl">
                          <h2 className="text-xl font-black text-white italic uppercase mb-8">{editingId ? 'Modify Unit' : 'Create Unit'}</h2>
                          <form onSubmit={saveProduct} className="space-y-6">
                            <RichEditor label="Identity (Name)" value={newProductName} onChange={setNewProductName} />
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
                              <input required value={newProductPrice} onChange={e => setNewProductPrice(e.target.value)} type="number" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan-500 font-mono" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block ml-1">
                                Stripe Price id (optional)
                              </label>
                              <input
                                value={newProductStripePriceId}
                                onChange={(e) => setNewProductStripePriceId(e.target.value)}
                                type="text"
                                placeholder="price_..."
                                autoComplete="off"
                                spellCheck={false}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 font-mono text-xs"
                              />
                              <p className="text-[9px] text-slate-500 leading-relaxed">
                                From Stripe Dashboard → Product → Pricing → copy <span className="font-mono text-slate-400">price_…</span>.
                                Checkout charges this Price; site price stays for display. Put the same{' '}
                                <span className="font-mono text-slate-400">maxbit_product_id</span> in the Stripe Product metadata as your site product <span className="font-mono text-slate-400">id</span> so fulfillment stays in sync.
                                Serial numbers are not stored on the Product in Stripe — use Payment metadata when fulfilling or extend order records.
                              </p>
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
                                        <button type="button" onClick={() => setAsMain(i)} title="Set as Primary"className="w-10 h-10 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center hover:scale-110 transition-transform shadow-lg"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg></button>
                                        <button type="button" onClick={() => {const updatedGallery = newProductGallery.filter((_, idx) => idx !== i);setNewProductGallery(updatedGallery);}} className="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center hover:scale-110 transition-transform shadow-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2.5} /></svg></button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <RichEditor label="Hardware Components" value={newProductComponents} onChange={setNewProductComponents}/>
                            <RichEditor label="Intel Briefing (Description)" value={newProductDesc} onChange={setNewProductDesc}/>
                            <button type="submit" disabled={isProcessing} className="w-full py-4 maxbit-gradient text-slate-950 font-black uppercase text-sm rounded-xl shadow-lg hover:opacity-90 transition-all">{isProcessing ? 'COMMITTING...' : (editingId ? 'UPDATE RECORD' : 'SAVE TO ARMORY')}</button>
                            {editingId && <button type="button" onClick={resetProductForm} className="w-full py-4 bg-slate-800 text-slate-400 font-black uppercase text-xs rounded-xl hover:text-white transition-all">Abort</button>}
                          </form>
                      </div>
                      <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 h-fit">
                        {publishedProducts.map(p => (
                          <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex gap-6 hover:border-slate-600 transition-all group shadow-xl relative">
                            <div className="w-24 h-32 bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden flex-shrink-0"><img src={Array.isArray(p.gallery) && p.gallery.length > 0 ? p.gallery[0] : (p.imageUrl || '')} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" /></div>
                            <div className="flex-1 flex flex-col justify-between py-1">
                              <div>
                                <h3 className="font-black text-white text-sm uppercase leading-tight mb-2 italic tracking-tighter h-10 overflow-hidden line-clamp-2">{(p.name || '').replace(/<[^>]*>/g, '')}</h3>
                                <div className="text-sm font-black text-cyan-400 font-mono tracking-tighter">${p.price}</div>
                                {p.stripePriceId ? (
                                  <div className="text-[9px] font-mono text-emerald-500/90 truncate mt-0.5" title={p.stripePriceId}>
                                    {p.stripePriceId}
                                  </div>
                                ) : null}
                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">{(p as any).isPublished ? 'DEPLOYED' : 'IN ARMORY'}</div>
                              </div>
                              <div className="flex gap-4">
                                <button onClick={() => startEditProduct(p)} className="text-[10px] font-black text-slate-500 hover:text-cyan-400 uppercase tracking-widest transition-colors">Modify</button>
                                <button type="button" onClick={() => togglePublish(p.id)}className={`text-[10px] font-black uppercase tracking-widest transition-all ${(p as any).isPublished ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'text-slate-500 hover:text-white'}`}>{(p as any).isPublished ? 'Withdraw' : 'Deploy'}</button>
                                <button type="button" onClick={() => handleDeleteProduct(p.id)} className="text-[10px] font-black text-slate-500 hover:text-rose-500 uppercase tracking-widest transition-colors"> Delete</button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {catalogMode === 'configurator' && (
                    <div className="lg:col-span-3 animate-fade-in-up space-y-14">
                      <div className="space-y-8 max-w-4xl">
                        <h2 className="text-xl font-black text-white italic uppercase pl-2">Configurator chapters</h2>
                        <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl space-y-6">
                          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block ml-1">
                              New chapter — title (storefront)
                            </label>
                            <input
                              value={newSectionTitleDraft}
                              onChange={(e) => setNewSectionTitleDraft(e.target.value)}
                              placeholder="e.g. Cooling & power"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-[10px] font-bold text-white outline-none focus:border-cyan-500"
                            />
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block ml-1">
                              Internal key (camelCase — e.g. coolingTypes)
                            </label>
                            <div className="flex flex-col sm:flex-row gap-2">
                              <input
                                value={newSectionKeyDraft}
                                onChange={(e) => setNewSectionKeyDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addConfiguratorSection();
                                  }
                                }}
                                placeholder="coolingTypes"
                                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-[10px] font-mono text-white outline-none focus:border-cyan-500"
                              />
                              <button
                                type="button"
                                onClick={addConfiguratorSection}
                                className="px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 text-[9px] font-black uppercase tracking-widest hover:opacity-90 transition-all shrink-0"
                              >
                                Add chapter
                              </button>
                            </div>
                            <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest pl-1">
                              Then add choices below. Built-in chapters cannot be removed.
                            </p>
                          </div>
                          {configuratorSectionKeys.map((key) => (
                            <div key={key} className="space-y-2">
                              <div className="flex flex-col gap-2 ml-1">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    {resolveConfiguratorSectionTitle(key, sectionLabels)}
                                    <span className="text-slate-700 font-mono normal-case tracking-normal ml-2">{key}</span>
                                  </span>
                                  {!BUILTIN_CONFIGURATOR_OPTION_KEY_SET.has(key) && (
                                    <button
                                      type="button"
                                      onClick={() => removeConfiguratorSection(key)}
                                      className="text-[9px] font-black uppercase tracking-widest text-rose-500/80 hover:text-rose-400 shrink-0"
                                    >
                                      Remove chapter
                                    </button>
                                  )}
                                </div>
                                <label className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">
                                  Storefront title (optional override)
                                </label>
                                <input
                                  value={sectionLabels[key] ?? ''}
                                  onChange={(e) =>
                                    setSectionLabels((p) => ({ ...p, [key]: e.target.value }))
                                  }
                                  onBlur={(e) => persistSectionLabel(key, e.target.value)}
                                  placeholder={formatConfiguratorSectionTitle(key)}
                                  className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-[10px] text-white outline-none focus:border-cyan-500"
                                />
                              </div>
                              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-3">
                                <div className="flex flex-wrap gap-2 min-h-[34px]">
                                  {(config[key] || []).map((item) => (
                                    <span
                                      key={`${key}-${item}`}
                                      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-[9px] font-black uppercase tracking-widest text-white"
                                    >
                                      {item}
                                      <button
                                        type="button"
                                        onClick={() => removeConfigOption(key, item)}
                                        className="text-slate-400 hover:text-rose-400 transition-colors"
                                        aria-label={`Remove ${item}`}
                                      >
                                        x
                                      </button>
                                    </span>
                                  ))}
                                </div>
                                <div className="flex gap-2">
                                  <input
                                    value={configDrafts[key] || ''}
                                    onChange={(e) => setConfigDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addConfigOption(key);
                                      }
                                    }}
                                    placeholder="Add option and press Enter"
                                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-[10px] font-bold uppercase text-white outline-none focus:border-cyan-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => addConfigOption(key)}
                                    className="px-3 py-2 rounded-lg bg-cyan-500 text-slate-950 text-[9px] font-black uppercase tracking-widest hover:opacity-90 transition-all"
                                  >
                                    Add
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-8 max-w-2xl border-t border-slate-800 pt-14">
                        <h2 className="text-xl font-black text-white italic uppercase pl-2">Case visuals</h2>
                        <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl space-y-6">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1 mb-4">Map case types to visual sketches</p>
                          <div className="grid grid-cols-1 gap-4">
                            {config.caseTypes.map((type) => (
                              <div key={type} className="flex items-center gap-4 p-4 bg-slate-950 border border-slate-800 rounded-2xl group hover:border-cyan-500/30 transition-all">
                                <div className="w-16 h-20 bg-slate-900 rounded-lg overflow-hidden border border-slate-800 flex-shrink-0 relative">
                                    {caseStyles[type] ? ( 
                                       <img src={resolveSiteAssetUrl(caseStyles[type])} className="w-full h-full object-cover" alt={type} /> 
                                    ) : (
                                       <div className="flex items-center justify-center h-full text-slat-700"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                       </div>
                                    )}
                                </div>
                                <div className="flex-1">
                                  <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-2">{type}</h4>
                                  <button onClick={() => { setActiveAssetCategory(type); assetImageRef.current?.click(); }}className="text-[9px] font-black text-cyan-500 uppercase tracking-widest border border-cyan-500/20 px-3 py-1.5 rounded-lg hover:bg-cyan-500/10 transition-all"> Upload Sketch</button>
                                </div>
                              </div>
                            ))}
                            <input type="file" ref={assetImageRef} onChange={handleAssetImageUpload} multiple className="hidden" accept="image/*" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {catalogMode === 'serials' && (
                    <div className="lg:col-span-3 space-y-6 animate-fade-in-up">
                      <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 shadow-xl space-y-4">
                        <h2 className="text-xl font-black text-white italic uppercase">Serial number pool</h2>
                        <p className="text-[10px] text-slate-500 leading-relaxed max-w-3xl">
                          Free serials per site product <span className="font-mono text-slate-400">id</span> (same as in inventory JSON).
                          At Checkout one serial is reserved per cart line and printed on the Stripe invoice (
                          <span className="font-mono text-slate-400">invoice_creation</span>). Abandoned sessions release SNs after TTL or when Stripe fires{' '}
                          <span className="font-mono text-slate-400">checkout.session.expired</span>. Requires{' '}
                          <span className="font-mono text-slate-400">ADMIN_ORDERS_SECRET</span> (same as Stripe orders API).
                        </p>
                        {!getAdminOrdersSecret() ? (
                          <p className="text-xs text-amber-200/90">Save the admin orders secret in the Orders tab first.</p>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-center gap-3">
                              <button
                                type="button"
                                onClick={() => refreshSerialPool()}
                                disabled={serialPoolLoading}
                                className="px-5 py-2 rounded-xl bg-slate-800 text-[10px] font-black uppercase tracking-widest text-white border border-slate-700 hover:border-cyan-500/40 disabled:opacity-50"
                              >
                                {serialPoolLoading ? 'Loading…' : 'Refresh counts'}
                              </button>
                              {serialPoolSnapshot ? (
                                <span className="text-[10px] text-slate-500 font-mono">
                                  Reservations (pending checkout): {serialPoolSnapshot.reservations} · TTL ~{' '}
                                  {serialPoolSnapshot.ttlMinutes} min
                                </span>
                              ) : null}
                            </div>
                            {serialPoolSnapshot && Object.keys(serialPoolSnapshot.pools).length > 0 ? (
                              <div className="border border-slate-800 rounded-2xl overflow-hidden">
                                <table className="w-full text-left text-[11px]">
                                  <thead className="bg-slate-950 text-[9px] font-black uppercase tracking-widest text-slate-500">
                                    <tr>
                                      <th className="px-4 py-2">Product id</th>
                                      <th className="px-4 py-2">Available SNs</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-800">
                                    {Object.entries(serialPoolSnapshot.pools).map(([pid, count]) => (
                                      <tr key={pid} className="font-mono text-slate-300">
                                        <td className="px-4 py-2 break-all">{pid}</td>
                                        <td className="px-4 py-2 text-cyan-400">{count}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-600 font-mono">No pool data yet — import serials below or add server/data/serial-pool.json</p>
                            )}
                            <form onSubmit={submitSerialImport} className="space-y-4 pt-4 border-t border-slate-800">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">
                                Product id
                              </label>
                              <input
                                value={serialImportProductId}
                                onChange={(e) => setSerialImportProductId(e.target.value)}
                                placeholder="e.g. PUB-1739123456789"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-mono text-xs outline-none focus:border-cyan-500"
                              />
                              <label className="flex items-center gap-3 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={serialImportAsBundle}
                                  onChange={(e) => setSerialImportAsBundle(e.target.checked)}
                                  className="rounded border-slate-600 bg-slate-950 text-cyan-500 focus:ring-cyan-500"
                                />
                                <span className="text-xs text-slate-400">
                                  One PC per paste (all lines stay together for invoice)
                                </span>
                              </label>
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">
                                {serialImportAsBundle
                                  ? 'Serial numbers for one PC (one line per part)'
                                  : 'Serial numbers — one per line or comma'}
                              </label>
                              <textarea
                                value={serialImportText}
                                onChange={(e) => setSerialImportText(e.target.value)}
                                rows={6}
                                placeholder={
                                  serialImportAsBundle
                                    ? 'SN-GPU-...\nSN-CPU-...\nSN-RAM-...\n…'
                                    : 'SN-ABC123\nSN-ABC124'
                                }
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-mono text-xs outline-none focus:border-cyan-500"
                              />
                              <button
                                type="submit"
                                disabled={serialPoolLoading}
                                className="w-full py-3 rounded-xl maxbit-gradient text-slate-950 font-black uppercase text-xs disabled:opacity-50"
                              >
                                Add to pool
                              </button>
                            </form>
                          </>
                        )}
                      </div>
                    </div>
                  )}
              </div>
            )}

            {/* SUBMISSIONS TAB */}
            {activeAdminTab === 'submissions' && (
              <div className="space-y-8 animate-fade-in-up">
                <div className="flex justify-between items-center bg-slate-900/20 p-2 rounded-2xl border border-slate-800/50 w-fit">
                  {(['pending', 'completed', 'all'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        filter === f ? 'bg-cyan-500 text-slate-950' : 'text-slate-500 hover:text-white'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                <div className="space-y-6">
                  {submissions.filter(s => filter === 'all' ? true : (s.status || 'pending') === filter).length === 0 ? (
                    <div className="py-24 text-center border-2 border-dashed border-slate-800 rounded-3xl text-slate-600 font-bold uppercase tracking-widest">
                      No protocols found in this sector
                    </div>
                  ) : (
                    submissions
                      .filter(s => filter === 'all' ? true : (s.status || 'pending') === filter)
                      .sort((a, b) => b.timestamp - a.timestamp)
                      .map((sub: BuildSubmission) => (
                        <div key={sub.id} className={`bg-slate-900/40 border ${sub.status === 'completed' ? 'border-emerald-500/30' : 'border-slate-800'} p-8 rounded-3xl group relative overflow-hidden transition-all hover:bg-slate-900/60`}>
                          
                          <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${sub.status === 'completed' ? 'bg-emerald-500' : 'bg-cyan-500'} shadow-[0_0_15px_rgba(6,182,212,0.3)]`}></div>

                          <div className="flex flex-col lg:flex-row justify-between gap-8">
                            <div className="flex-1 space-y-6">
                              <div className="flex flex-wrap justify-between items-start gap-4">
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${sub.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-cyan-500/10 text-cyan-500'}`}>
                                      {sub.status === 'completed' ? 'Protocol Finished' : 'Operational Pending'}
                                    </span>
                                    <span className="text-[9px] font-mono text-slate-600">ID: {sub.id}</span>
                                  </div>
                                  <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">
                                    {sub.userName}
                                  </h3>
                                  <p className="text-sm text-cyan-400 font-mono mt-1">{sub.userEmail}</p>
                                </div>

                                <div className="text-right">
                                  <p className="text-[9px] font-black text-slate-600 uppercase mb-1">Target Budget</p>
                                  <p className="text-3xl font-black text-white italic font-mono">${sub.budget}</p>
                                </div>
                              </div>

                              {/* HARDWARE SELECTION */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-6 border-y border-white/5">
                                {/* 1. Target Purpose & Budget */}
                                <div className="space-y-1">
                                  <p className="text-[9px] text-slate-600 uppercase font-black tracking-widest">01 // Mission Profile</p>
                                  <div className="text-xs font-bold text-white uppercase italic">Purpose: {sub.purpose}</div>
                                </div> 
                                {/* 2. CPU & Graphics (GPU) */}
                                <div className="space-y-1">
                                  <p className="text-[9px] text-slate-600 uppercase font-black tracking-widest">02 // Core Hardware</p>
                                  <div className="text-xs font-bold text-white uppercase italic">CPU: {sub.cpu}</div>
                                  <div className="text-xs font-bold text-cyan-400 uppercase italic">GPU: {sub.gpu}</div>
                                  <p className="text-[10px] text-slate-500 font-mono uppercase italic">{sub.manufacturer}</p>
                                </div>
                                {/* 3. Storage & Resolution */}
                                <div className="space-y-1">
                                  <p className="text-[9px] text-slate-600 uppercase font-black tracking-widest">03 // Data & Output</p>
                                  <div className="text-xs font-bold text-white uppercase italic">Storage: {sub.ssd}</div>
                                  <div className="text-xs font-bold text-white uppercase italic">Target Res: {sub.resolution}</div>
                                </div>
                                {/* 4. Case Details & Aesthetic */}
                                <div className="space-y-1">
                                  <p className="text-[9px] text-slate-600 uppercase font-black tracking-widest">04 // Visual Design</p>
                                  <div className="text-xs font-bold text-white uppercase italic">Case: {sub.caseSize} / {sub.caseType}</div>
                                  <div className="text-[10px] text-cyan-500/80 font-black uppercase tracking-tighter italic">Style: {sub.aesthetic}</div>
                                </div>
                                {/* 5. Logistics (Deadline) */}
                                <div className="space-y-1">
                                  <p className="text-[9px] text-slate-600 uppercase font-black tracking-widest">05 // Timeline</p>
                                  <div className="text-xs font-bold text-white uppercase italic">Deadline: {sub.deadline}</div>
                                  <p className="text-[10px] text-slate-500 font-mono">{new Date(sub.timestamp).toLocaleDateString()}</p>
                                </div>
                              </div>

                              {/* Requirements */}
                              {sub.requirements && (
                                <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                                  <p className="text-[9px] text-slate-600 uppercase font-black mb-2">Operational Requirements:</p>
                                  <p className="text-xs text-slate-400 italic leading-relaxed">{sub.requirements}</p>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-row lg:flex-col justify-end gap-3 min-w-[180px]">
                              {sub.status !== 'completed' ? (
                                <button 
                                  onClick={() => handleUpdateStatus(sub.id, 'completed')}
                                  className="flex-1 bg-emerald-500 text-slate-950 font-black uppercase text-[10px] tracking-widest py-4 rounded-xl hover:bg-emerald-400 transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                                >
                                  Complete Build
                                </button>
                              ) : (
                                <button 
                                  onClick={() => handleUpdateStatus(sub.id, 'pending')}
                                  className="flex-1 bg-slate-800 text-slate-400 font-black uppercase text-[10px] tracking-widest py-4 rounded-xl hover:text-white transition-all"
                                >
                                  Re-Open
                                </button>
                              )}
                              
                              <button 
                                onClick={async () => {
                                  if(window.confirm('PROTOCOL WARNING: Delete record?')) {
                                    await handleDeleteSubmission(sub.id);
                                  }
                                }}
                                className="p-4 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl hover:bg-rose-500 hover:text-white transition-all"
                              >
                                <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}

            {/* ORDERS TAB */}
            {activeAdminTab === 'orders' && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-5 space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Stripe orders (Node)
                  </p>
                  {!getAdminOrdersSecret() ? (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-300 leading-relaxed">
                        To load paid Stripe orders (items, fulfillment status, delete actions), your frontend build must
                        include{' '}
                        <code className="text-cyan-400/90">VITE_ADMIN_ORDERS_SECRET</code> with the same value as{' '}
                        <code className="text-cyan-400/90">ADMIN_ORDERS_SECRET</code> on Node, then run{' '}
                        <code className="text-slate-400">npm run build</code>. You can also enter the secret below (saved
                        only in this browser).
                      </p>
                      <div className="flex flex-wrap gap-2 items-center">
                        <input
                          type="password"
                          autoComplete="off"
                          value={ordersSecretDraft}
                          onChange={(e) => setOrdersSecretDraft(e.target.value)}
                          placeholder="ADMIN_ORDERS_SECRET"
                          className="min-w-[200px] flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white font-mono placeholder:text-slate-600 focus:border-cyan-500/40 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const v = ordersSecretDraft.trim();
                            if (!v) return;
                            try {
                              localStorage.setItem(ADMIN_ORDERS_SECRET_LS_KEY, v);
                              setOrdersSecretDraft('');
                              notifyUpdate();
                            } catch {
                              alert('Could not save to local storage.');
                            }
                          }}
                          className="px-5 py-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-black uppercase tracking-widest hover:bg-cyan-500/25"
                        >
                          Save & reload orders
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {shopOrdersStripeError ? (
                    <p className="text-xs text-rose-400 font-mono break-all">{shopOrdersStripeError}</p>
                  ) : null}
                  {getAdminOrdersSecret() &&
                  !shopOrdersStripeError &&
                  shopOrders.length > 0 &&
                  shopOrders.every((o) => !o.managedByNode) ? (
                    <p className="text-[10px] text-amber-200/90 leading-relaxed">
                      Orders are currently coming only from PHP, while the Node Stripe list is empty. Check that after
                      payment the return URL (`payment-status`) opened,{' '}
                      <code className="text-slate-400">server/data/order.json</code> exists on the server, Stripe env
                      variables are set, and Node was restarted.
                    </p>
                  ) : null}
                </div>

                {shopOrders.length === 0 ? (
                  <div className="py-24 text-center border-2 border-dashed border-slate-800 rounded-3xl text-slate-600 font-bold uppercase tracking-widest"> No Orders Logged</div>
                ) : (
                  shopOrders.map((order) => (
                    <div
                      key={order.key}
                      className="bg-slate-900/40 border border-slate-800 p-8 rounded-3xl flex flex-col lg:flex-row lg:justify-between lg:items-start gap-6 group hover:border-emerald-500/20 transition-all shadow-xl"
                    >
                      <div className="space-y-3 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                            Transaction Detected
                          </span>
                          {order.managedByNode ? (
                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
                              Stripe / server
                            </span>
                          ) : null}
                        </div>
                        <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">
                          {order.orderNumber}
                        </h3>
                        <p className="text-xs text-slate-500 font-mono tracking-tight break-all">
                          CUSTOMER: {order.customerEmail || '—'}
                        </p>
                        {order.serialAllocations && order.serialAllocations.length > 0 ? (
                          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 space-y-1">
                            <div className="text-[9px] font-black uppercase tracking-widest text-amber-400/90">
                              Serial numbers (allocated)
                            </div>
                            <ul className="text-[10px] font-mono text-amber-100/95 space-y-0.5">
                              {order.serialAllocations.map((row, idx) => (
                                <li key={idx}>
                                  <span className="text-slate-500">{row.productId}</span> → {row.serial}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {order.lineItems && order.lineItems.length > 0 ? (
                          <ul className="text-[10px] text-slate-400 space-y-1 border-t border-slate-800/80 pt-3 mt-2">
                            {order.lineItems.map((li) => (
                              <li key={li.id} className="flex justify-between gap-4">
                                <span className="truncate">
                                  {li.quantity > 1 ? `${li.quantity}× ` : ''}
                                  {li.name}
                                  {li.productId ? (
                                    <span className="block text-[9px] font-mono text-slate-600 mt-0.5">
                                      ID {li.productId}
                                    </span>
                                  ) : null}
                                </span>
                                <span className="shrink-0 font-mono text-slate-500">
                                  ${Number(li.priceMajor * li.quantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>

                      <div className="flex flex-col sm:flex-row lg:flex-col gap-4 lg:items-end lg:text-right shrink-0">
                        <div className="space-y-3 sm:text-right">
                          <div className="text-3xl font-black text-white italic tracking-tighter">
                            ${Number(order.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div
                            className={`text-[10px] font-bold uppercase px-4 py-1.5 rounded-full inline-block border ${
                              String(order.paymentStatus).toUpperCase() === 'PAID'
                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                            }`}
                          >
                            {order.paymentStatus}
                          </div>
                          {order.fulfillmentStatus &&
                          !(order.managedByNode && getAdminOrdersSecret()) ? (
                            <div className="text-[10px] font-bold uppercase px-4 py-1.5 rounded-full inline-block border bg-slate-800/80 text-slate-300 border-slate-700">
                              {order.fulfillmentStatus}
                            </div>
                          ) : null}
                          <div className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">
                            {new Date(order.timestamp).toLocaleString()}
                          </div>
                        </div>

                        {order.managedByNode && getAdminOrdersSecret() ? (
                          <div className="flex flex-col gap-2 w-full sm:w-auto lg:w-48">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                              Fulfillment
                            </label>
                            <select
                              value={
                                FULFILLMENT_STATUSES.includes(order.fulfillmentStatus as FulfillmentStatus)
                                  ? (order.fulfillmentStatus as FulfillmentStatus)
                                  : 'Processing'
                              }
                              onChange={(e) =>
                                updateNodeOrderFulfillment(order.key, e.target.value as FulfillmentStatus)
                              }
                              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-white uppercase tracking-tight focus:border-cyan-500/50 focus:outline-none"
                            >
                              {FULFILLMENT_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm('Delete this order from the server list?')) {
                                  void deleteNodeShopOrder(order.key);
                                }
                              }}
                              className="mt-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-400 border border-rose-500/25 hover:bg-rose-500 hover:text-white transition-colors"
                            >
                              Delete order
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ANALYTICS TAB */}
            {activeAdminTab === 'analytics' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl">
                    <div className="text-[10px] font-black text-cyan-500 uppercase tracking-widest mb-2">Traffic Segments</div>
                    <div className="text-3xl font-black text-white italic">{trafficBreakdown.total}</div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-[9px] font-black uppercase tracking-widest">
                      <div className="text-emerald-400">Users: {trafficBreakdown.registered}</div>
                      <div className="text-rose-400">Admins: {trafficBreakdown.admins}</div>
                      <div className="text-amber-400">Guests: {trafficBreakdown.guests}</div>
                    </div>
                  </div>
                  <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl">
                    <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">Total Revenue</div>
                    <div className="text-3xl font-black text-white italic">${shopOrders.reduce((sum, o) => sum + (Number(o.total ?? o.amount) || 0), 0).toLocaleString()}</div>
                    <div className="text-[9px] text-slate-500 uppercase mt-1">Confirmed transactions</div>
                  </div>
                  <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl">
                    <div className="text-[10px] font-black text-purple-500 uppercase tracking-widest mb-2">Unit Views</div>
                    <div className="text-3xl font-black text-white italic"> {Object.values(analytics?.productViews || analytics?.views || {}).reduce((a: number, b: any) => a + (Number(b) || 0), 0)} </div>
                    <div className="text-[9px] text-slate-500 uppercase mt-1">Total product interactions</div>
                  </div>
                  <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl">
                    <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-2">Conversion</div>
                    <div className="text-3xl font-black text-white italic"> {analytics?.sessions?.length ? ((shopOrders.length / analytics.sessions.length) * 100).toFixed(1) : 0}%</div>
                    <div className="text-[9px] text-slate-500 uppercase mt-1">Visitor to Buyer ratio</div>
                  </div>
                </div>

               <div className="bg-slate-900/40 border border-slate-800 p-8 rounded-3xl overflow-hidden shadow-2xl">
                 <div className="flex justify-between items-center mb-8">
                   <div>
                     <h3 className="text-white font-black italic uppercase tracking-tighter text-xl">Tactical Traffic Flow</h3>
                     <p className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em]">Operational cycles: Last 7 Days</p>
                   </div>
                   <div className="flex items-center gap-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full">
                     <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse shadow-[0_0_8px_#06b6d4]"></div>
                     <span className="text-[9px] font-black text-cyan-500 uppercase italic">Live Monitoring</span>
                   </div>
                 </div>

                <div className="h-[300px] w-full min-h-[300px] min-w-0">
                  <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={240}>
                     <AreaChart data={chartData}>
                       <defs>
                         <linearGradient id="cyberCyan" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4}/>
                           <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                         </linearGradient>
                       </defs>
                       <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                       <XAxis 
                        dataKey="displayDate" 
                         axisLine={false} 
                         tickLine={false} 
                         tick={{fill: '#475569', fontSize: 10, fontWeight: 'bold'}}
                         dy={10}
                       />
                      <YAxis hide domain={['dataMin', 'dataMax + 5']} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px' }}
                        itemStyle={{ color: '#06b6d4', textTransform: 'uppercase', fontWeight: '900', fontSize: '10px' }}
                        labelStyle={{ display: 'none' }}
                        cursor={{ stroke: '#06b6d4', strokeWidth: 1, strokeDasharray: '5 5' }}
                      />

                      <Area
                        type="monotone" 
                        dataKey="visits" 
                        stroke="#06b6d4" 
                        strokeWidth={4}
                        fillOpacity={1} 
                        fill="url(#cyberCyan)" 
                        animationDuration={2500}
                        dot={{ r: 4, fill: '#0b0f1a', stroke: '#06b6d4', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: '#06b6d4', stroke: '0 0 15px #06b6d4' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Most Viewed */}
                <div className="bg-slate-900/30 border border-slate-800 rounded-3xl p-8">
                  <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 italic flex items-center gap-2">
                    <span className="text-cyan-500">●</span> Most Viewed Armory Units
                  </h3>
                  <div className="space-y-4">
                    {publishedProducts
                      .map(p => ({
                        ...p,
                        viewCount: analytics?.productViews?.[p.id] || analytics?.views?.[p.id] || 0
                      }))
                      .sort((a, b) => b.viewCount - a.viewCount)
                      .map((product, idx) => (
                        <div key={product.id} className="group flex items-center justify-between p-3 rounded-2xl bg-slate-950/40 border border-slate-800/50 hover:border-cyan-500/30 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="text-xs font-black text-slate-700 w-4">{idx + 1}</div>
                            <img src={product.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-800" />
                            <div>
                              <div className="text-[11px] font-black text-white uppercase italic truncate max-w-[150px]">
                                {String(product.name || 'Unknown Unit').replace(/<[^>]*>?/gm, '')}
                              </div>
                              <div className="text-[9px] text-slate-500 font-bold uppercase">{product.category}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-black text-cyan-400">{product.viewCount}</div>
                            <div className="text-[8px] font-black text-slate-600 uppercase">Target Views</div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* RECENT ACTIVITY */}
                <div className="bg-slate-900/30 border border-slate-800 rounded-3xl p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest italic flex items-center gap-2">
                      <span className="text-amber-500">●</span> Live Traffic Control
                    </h3>
                    <div className="flex gap-2 bg-slate-950/60 border border-slate-800 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setTrafficRange('recent')}
                        className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${
                          trafficRange === 'recent'
                            ? 'bg-cyan-500 text-slate-950'
                            : 'text-slate-500 hover:text-white'
                        }`}
                      >
                        Recent
                      </button>
                      <button
                        type="button"
                        onClick={() => setTrafficRange('month')}
                        className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${
                          trafficRange === 'month'
                            ? 'bg-cyan-500 text-slate-950'
                            : 'text-slate-500 hover:text-white'
                        }`}
                      >
                        Month
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {trafficGroups.map((group) => {
                      const session = group.latest;
                      const identity = String(session?.user || '').trim();
                      const normalized = identity.toLowerCase();
                      const isAdmin = normalized === 'admin';
                      const isGuest = !normalized || normalized === 'guest';
                      const isRegisteredToken = normalized === 'registered_user';
                      const label = isAdmin
                        ? 'Admin'
                        : isGuest
                          ? 'Guest'
                          : isRegisteredToken
                            ? 'Registered User'
                            : 'Registered User';
                      const badgeClass = isAdmin
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : isGuest
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                      const displayIdentity = isGuest || isAdmin
                        ? label
                        : identity.includes('@')
                          ? identity
                          : label;
                      const expanded = !!expandedTrafficGroups[group.key];
                      const canExpand = group.count > 1;
                      const lastMs = Number(session.lastActive || session.startTime || 0);
                      const dur = trafficSessionDurationSec(session);

                      return (
                        <div
                          key={group.key}
                          className="border-b border-slate-800/50 last:border-0 rounded-lg overflow-hidden"
                        >
                          <div className="flex items-center justify-between text-[10px] p-3 gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {canExpand ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedTrafficGroups((prev) => ({
                                      ...prev,
                                      [group.key]: !prev[group.key],
                                    }))
                                  }
                                  className="p-1 rounded-md text-slate-500 hover:text-cyan-400 hover:bg-slate-800/80 shrink-0"
                                  aria-expanded={expanded}
                                  title={expanded ? 'Collapse visits' : 'Expand all visits'}
                                >
                                  <svg
                                    className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </button>
                              ) : (
                                <span className="w-6 shrink-0" aria-hidden />
                              )}
                              <div className="p-1 bg-slate-800 rounded text-slate-400 shrink-0">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              </div>
                              <span className="font-mono text-slate-300 truncate">{displayIdentity}</span>
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest shrink-0 ${badgeClass}`}>
                                {label}
                              </span>
                              {canExpand && (
                                <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest shrink-0">
                                  {group.count} visits
                                </span>
                              )}
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 shrink-0 text-right">
                              <span className="px-2 py-0.5 bg-slate-950 text-slate-500 rounded border border-slate-800 font-black whitespace-nowrap">
                                {dur}s active
                              </span>
                              <span className="text-slate-500 font-bold text-[9px] sm:text-[10px] whitespace-nowrap">
                                {formatTrafficDateTime(lastMs)}
                              </span>
                            </div>
                          </div>
                          {canExpand && expanded && (
                            <div className="pl-10 pr-3 pb-3 pt-0 space-y-2 border-t border-slate-800/40 bg-slate-950/30">
                              {group.sessions.map((vis) => {
                                const startMs = Number(vis.startTime || 0);
                                const endMs = Number(vis.lastActive || vis.startTime || 0);
                                const d = trafficSessionDurationSec(vis);
                                const sid = String(vis.id || '').slice(0, 18);
                                return (
                                  <div
                                    key={vis.id}
                                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[9px] text-slate-500 font-mono border border-slate-800/60 rounded-lg px-2 py-1.5"
                                  >
                                    <span className="text-slate-600 truncate" title={vis.id}>
                                      {sid}
                                      {String(vis.id || '').length > 18 ? '…' : ''}
                                    </span>
                                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 justify-end text-[9px]">
                                      <span>
                                        <span className="text-slate-600 uppercase font-black">Start </span>
                                        {formatTrafficDateTime(startMs)}
                                      </span>
                                      <span>
                                        <span className="text-slate-600 uppercase font-black">Last </span>
                                        {formatTrafficDateTime(endMs)}
                                      </span>
                                      <span className="text-slate-400">{d}s</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {trafficGroups.length === 0 && (
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-600 border border-dashed border-slate-800 rounded-xl p-4 text-center">
                        No sessions in selected period
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
           )}

           {/* REVIEW MODERATION TAB */}
           {activeAdminTab === 'comments' && (
             <div className="space-y-6 animate-fade-in-up">
                <div className="flex justify-between items-center mb-8 bg-slate-900/20 p-4 rounded-2xl border border-slate-800/50">
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-[0.4em] text-slate-500 pl-2">Intel Moderation</h2>
                    <p className="text-[9px] text-slate-600 uppercase font-black mt-1 pl-2">Field feedback synchronization active</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-amber-500 italic uppercase tracking-tighter">{allComments.length}</span>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-2">Reports Logged</span>
                  </div>
                </div>

                <div className="grid gap-4">
                   {allComments.length > 0 ? (
                     allComments.map((item, idx) => (
                       <div key={`${item.productId}-${idx}`} className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row gap-6 hover:border-amber-500/30 transition-all group relative overflow-hidden">
                       {/* Background Accent */}
                       <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-[50px] pointer-events-none"></div>
                    
                       {/* Product Preview Container */}
                       <div className="w-20 h-24 bg-slate-950 rounded-xl overflow-hidden flex-shrink-0 border border-slate-800 shadow-2xl relative group-hover:border-cyan-500/50 transition-colors">
                         <img 
                           src={item.productImage} 
                           className="w-full h-full object-cover opacity-40 group-hover:opacity-80 transition-opacity duration-500" 
                           alt="" 
                         />
                         <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
                       </div>
                
                       <div className="flex-1 z-10">
                         <div className="flex justify-between items-start mb-4">
                           <div>
                             <div className="flex items-center gap-2 mb-1">
                               <span className="px-1.5 py-0.5 bg-cyan-500/10 border border-cyan-500/20 rounded text-[8px] font-black text-cyan-500 uppercase tracking-tighter">
                                 Unit ID: {item.productId.slice(-6)}
                               </span>
                               <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate max-w-[200px]">
                                 {item.productName}
                               </div>
                             </div>
                  
                             <div className="flex items-center gap-3">
                               <span className="text-sm font-black text-white italic tracking-tight">{item.review.user}</span>
                               <div className="h-1 w-1 bg-slate-700 rounded-full"></div>
                               <span className="text-[9px] font-mono font-bold text-slate-500 uppercase">
                                 {new Date(item.review.date).toLocaleDateString()}
                               </span>
                             </div>
                           </div>

                           <div className="flex gap-4">
                             <button 
                               onClick={async () => {
                                 if (window.confirm("PROTOCOL WARNING: Confirm permanent removal of this intel report?")) {
                                   const updated = publishedProducts.map(p => {
                                     if (p.id === item.productId) {
                                       return { 
                                         ...p, 
                                         reviews: (p.reviews || []).filter(r => r.date !== item.review.date || r.user !== item.review.user) 
                                       };
                                     }
                                     return p;
                                   });

                                   setPublishedProducts(updated);
                                   localStorage.setItem('maxbit_published_products_v2', JSON.stringify(updated));

                                   if (typeof syncWithServer === 'function') {
                                     await syncWithServer(updated);
                                   }

                                   notifyUpdate();
                                 }
                               }} 
                               className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/5 border border-rose-500/10 text-[9px] font-black text-rose-500/60 hover:text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/40 uppercase tracking-widest transition-all"
                             >
                               <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                               Delete Report
                             </button>
                           </div>
                         </div>

                         <div className="relative">
                           <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-amber-500/50 to-transparent"></div>
                           <p className="text-slate-300 text-xs italic leading-relaxed pl-6 py-1 group-hover:text-slate-100 transition-colors">
                             "{item.review.comment}"
                           </p>
                         </div>

                         {/* Star Rating Display */}
                         <div className="mt-4 flex gap-1 pl-6">
                           {[...Array(5)].map((_, i) => (
                             <div 
                               key={i} 
                               className={`w-1.5 h-1.5 rounded-full ${i < (item.review.rating || 5) ? 'bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.5)]' : 'bg-slate-800'}`}
                             ></div>
                           ))}
                         </div>
                       </div>
                     </div>
                   ))
                 ) : (
                   <div className="py-24 text-center border-2 border-dashed border-slate-800 rounded-3xl">
                     <div className="inline-flex p-4 rounded-full bg-slate-900 mb-4"><svg className="w-8 h-8 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg></div>
                     <div className="text-slate-500 font-black uppercase tracking-[0.3em] text-sm">No Intel Packets Found</div>
                 </div>
                 )}
               </div>  
            </div>
            )}
          </>  
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;