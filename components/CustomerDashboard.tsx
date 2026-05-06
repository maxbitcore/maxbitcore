import React, { useState, useEffect, useMemo } from 'react';
import { sanitizeHtml } from '../services/sanitizeHtml';
import { getAnalytics } from '../services/analyticsService';
import { CoverImage } from './CoverImage';

function formatOrderMoney(amount: number, currency = 'usd'): string {
  const cur = (currency || 'usd').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(amount);
  } catch {
    return `$${Number(amount).toFixed(2)}`;
  }
}

function mergePurchaseRow(prev: UserPurchaseLog, next: UserPurchaseLog): UserPurchaseLog {
  const imgById = new Map(prev.items.map((i) => [i.id, i.imageUrl]));
  const baseItems = next.items.length ? next.items : prev.items;
  const items = baseItems.map((it) => ({
    ...it,
    imageUrl: it.imageUrl || imgById.get(it.id),
  }));
  return {
    ...next,
    items,
    subtotal: next.subtotal ?? prev.subtotal,
    tax: next.tax ?? prev.tax,
    currency: next.currency || prev.currency,
    total: Number.isFinite(next.total) && next.total > 0 ? next.total : prev.total,
    timestamp: Math.max(next.timestamp || 0, prev.timestamp || 0),
  };
}

interface UserPurchaseLog {
  id: string;
  orderNumber?: string;
  total: number;
  subtotal?: number;
  tax?: number;
  currency?: string;
  timestamp: number;
  status: string;
  items: { id: string; name: string; price: number; imageUrl?: string }[];
  source: 'local' | 'api';
}

interface CustomerDashboardProps {
  currentUser: any;
  onLogout: () => void;
  allProducts: any[];
  onSelectProduct: (product: any) => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({ currentUser, onLogout, allProducts, onSelectProduct }) => {
  const isAdmin = currentUser?.role === 'admin';
  const [userSubmissions, setUserSubmissions] = useState<any[]>([]);
  const [userPurchases, setUserPurchases] = useState<UserPurchaseLog[]>([]);
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

  //  SUBMISSIONS + PURCHASES (operational log)
  useEffect(() => {
    const email = currentUser?.email;
    if (!email) {
      setUserSubmissions([]);
      setUserPurchases([]);
      setIsLoading(false);
      return;
    }

    const loadSubmissions = () => {
      try {
        const localData = localStorage.getItem('maxbit_submissions');
        const allSubmissions = localData ? JSON.parse(localData) : [];
        const filtered = allSubmissions.filter((sub: any) => sub.userEmail === email);
        setUserSubmissions(filtered);
      } catch (error) {
        console.error("CRITICAL ERROR: Failed to parse submissions log", error);
      }
    };

    const loadPurchases = async () => {
      const em = email.toLowerCase().trim();
      const byId = new Map<string, UserPurchaseLog>();

      try {
        const data = getAnalytics();
        for (const o of data.orders || []) {
          const mail = String(o.customer?.email || '').toLowerCase();
          if (mail !== em) continue;
          const id = String(o.id || '').trim() || `local-${o.timestamp}`;
          const key = id.toLowerCase();
          const row: UserPurchaseLog = {
            id,
            orderNumber: id,
            total: Number(o.total) || 0,
            subtotal: typeof o.subtotal === 'number' ? o.subtotal : undefined,
            tax: typeof o.tax === 'number' ? o.tax : undefined,
            currency: typeof o.currency === 'string' ? o.currency : undefined,
            timestamp: Number(o.timestamp) || 0,
            status: String(o.status || 'Processing'),
            items: Array.isArray(o.items)
              ? o.items.map((item: any) => ({
                  id: String(item.id || 'n/a'),
                  name: String(item.name || 'Item'),
                  price: Number(item.price) || 0,
                  imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : undefined,
                }))
              : [],
            source: 'local',
          };
          byId.set(key, row);
        }
      } catch {
        /* ignore */
      }

      try {
        const res = await fetch('https://www.maxbitcore.com/api/get-orders.php');
        if (res.ok) {
          const arr = await res.json();
          if (Array.isArray(arr)) {
            for (const ord of arr) {
              const mail = String(
                ord.customerEmail || ord.customer_email || ord.customer?.email || ''
              ).toLowerCase();
              if (mail !== em) continue;
              const id = String(ord.id || ord.orderNumber || '').trim() || `api-${ord.timestamp}`;
              const key = id.toLowerCase();
              const amount = Number(ord.amount ?? ord.total ?? 0) || 0;
              const ts = Number(ord.timestamp) || 0;
              const items = Array.isArray(ord.items)
                ? ord.items.map((item: any) => ({
                    id: String(item.id || 'n/a'),
                    name: String(item.name || 'Item'),
                    price: Number(item.price) || 0,
                    imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : undefined,
                  }))
                : [];
              const apiRow: UserPurchaseLog = {
                id,
                orderNumber: ord.orderNumber || id,
                total: amount,
                subtotal: ord.subtotal != null ? Number(ord.subtotal) : undefined,
                tax:
                  ord.tax != null
                    ? Number(ord.tax)
                    : ord.amountTax != null
                      ? Number(ord.amountTax) / 100
                      : undefined,
                currency: typeof ord.currency === 'string' ? ord.currency : undefined,
                timestamp: ts,
                status: String(ord.status || 'PAID'),
                items,
                source: 'api',
              };
              const prev = byId.get(key);
              byId.set(key, prev ? mergePurchaseRow(prev, apiRow) : apiRow);
            }
          }
        }
      } catch {
        /* ignore */
      }

      setUserPurchases(Array.from(byId.values()).sort((a, b) => b.timestamp - a.timestamp));
    };

    const loadAll = async () => {
      setIsLoading(true);
      loadSubmissions();
      await loadPurchases();
      setIsLoading(false);
    };

    void loadAll();

    const refreshLog = () => {
      loadSubmissions();
      void loadPurchases();
    };

    window.addEventListener('maxbit-submissions-updated', refreshLog);
    window.addEventListener('maxbit-update', refreshLog);
    return () => {
      window.removeEventListener('maxbit-submissions-updated', refreshLog);
      window.removeEventListener('maxbit-update', refreshLog);
    };
  }, [currentUser?.email]);

  const operationalLogItems = useMemo(() => {
    type Row =
      | { kind: 'purchase'; ts: number; key: string; purchase: UserPurchaseLog }
      | { kind: 'build'; ts: number; key: string; sub: any };
    const rows: Row[] = [
      ...userPurchases.map((p) => ({
        kind: 'purchase' as const,
        ts: p.timestamp || 0,
        key: `purchase-${p.id}-${p.source}`,
        purchase: p,
      })),
      ...userSubmissions.map((sub) => ({
        kind: 'build' as const,
        ts: sub.timestamp || 0,
        key: `build-${sub.id}`,
        sub,
      })),
    ];
    rows.sort((a, b) => b.ts - a.ts);
    return rows;
  }, [userPurchases, userSubmissions]);

  const handleDeleteSubmission = async (submissionId: string) => {
    if (!window.confirm('Are you sure you want to terminate this build protocol?')) return;

    setUserSubmissions(prev => prev.filter(sub => sub.id !== submissionId));

    const localData = localStorage.getItem('maxbit_submissions');
    if (localData) {
      const submissions = JSON.parse(localData);
      const updated = submissions.filter((sub: any) => sub.id !== submissionId);
      localStorage.setItem('maxbit_submissions', JSON.stringify(updated));
    }
    window.dispatchEvent(new Event('maxbit-submissions-updated'));

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
    <div className="min-h-screen bg-[#050505] text-white p-4 pt-4 md:p-10 md:pt-8 font-sans">
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

        {/* DASHBOARD GRID — admins only see Operational Log (console) */}
        <div className={`grid grid-cols-1 gap-8 ${isAdmin ? '' : 'lg:grid-cols-3'}`}>
          {!isAdmin && (
            <div className="flex flex-col gap-8">
              {/* PROFILE CARD */}
              <div className="bg-slate-900/40 border border-white/5 p-8 rounded-3xl backdrop-blur-sm">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-6">User Parameters</h3>
                <div className="space-y-6">
                  {/* FULL NAME */}
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
                      {currentUser?.joined
                        ? new Date(currentUser.joined).toLocaleDateString()
                        : '—'}
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
                      <div className="w-16 h-16 bg-slate-900 rounded-xl overflow-hidden border border-white/10 shrink-0 shadow-lg">
                        <CoverImage
                          src={item.imageUrl || 'https://via.placeholder.com/150'}
                          alt="Unit preview"
                          className="w-full h-full group-hover:scale-110 transition-transform duration-500"
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
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.name || 'Unknown Unit') }}
                        />

                        <p className="text-xs font-black text-cyan-500 font-mono mt-1">
                          ${item.price || '0.00'}
                        </p>
                      </div>

                      {/* DELETE */}
                      <button
                        type="button"
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
          )}

          {/* OPERATIONAL LOG */}
          <div className={isAdmin ? '' : 'lg:col-span-2'}>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-6">Operational Log</h3>
            <div className="space-y-4">
              {!isLoading && operationalLogItems.length === 0 && (
                <div className="py-16 text-center border-2 border-dashed border-slate-800 rounded-3xl text-slate-600 font-bold uppercase tracking-widest text-[10px]">
                  No build requests or purchases linked to this account yet
                </div>
              )}
              {operationalLogItems.map((row) =>
                row.kind === 'purchase' ? (
                  <div
                    key={row.key}
                    className="bg-slate-900/40 border border-white/5 p-8 rounded-3xl backdrop-blur-sm relative overflow-hidden group"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500/30 group-hover:bg-emerald-500 transition-colors" />
                    <div className="flex flex-col md:flex-row justify-between gap-8">
                      <div className="flex-1 space-y-6">
                        <div className="flex flex-wrap items-start gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="text-[9px] font-black uppercase text-emerald-500 tracking-widest mb-1">
                              Store purchase
                            </p>
                            <h3 className="text-white font-black uppercase text-2xl italic leading-none break-all">
                              Order {row.purchase.orderNumber || row.purchase.id}
                            </h3>
                            <p className="text-slate-500 text-[10px] font-mono mt-3 uppercase tracking-widest">
                              Purchase time:{' '}
                              {row.purchase.timestamp
                                ? new Date(row.purchase.timestamp).toLocaleString()
                                : '—'}
                            </p>
                          </div>
                          <div className="h-10 w-px bg-white/5 hidden md:block self-stretch" />
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left sm:text-right">
                            <div>
                              <p className="text-[9px] text-slate-500 uppercase font-black mb-1">Items</p>
                              <p className="text-sm font-mono font-black text-white">
                                {formatOrderMoney(
                                  row.purchase.subtotal ??
                                    row.purchase.items.reduce((s, i) => s + Number(i.price), 0),
                                  row.purchase.currency
                                )}
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] text-slate-500 uppercase font-black mb-1">Tax (Stripe)</p>
                              <p className="text-sm font-mono font-black text-slate-300">
                                {row.purchase.tax != null
                                  ? formatOrderMoney(row.purchase.tax, row.purchase.currency)
                                  : '—'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] text-slate-500 uppercase font-black mb-1">Total paid</p>
                              <p className="text-xl font-mono font-black text-emerald-400">
                                {formatOrderMoney(row.purchase.total, row.purchase.currency)}
                              </p>
                            </div>
                          </div>
                          <div className="sm:ml-auto">
                            <p className="text-[9px] text-slate-500 uppercase font-black mb-1">Status</p>
                            <p className="text-sm font-black text-white uppercase tracking-tight">
                              {row.purchase.status}
                            </p>
                          </div>
                        </div>
                        {row.purchase.items.length > 0 && (
                          <div className="mt-2 py-6 border-y border-white/5">
                            <p className="text-[9px] text-slate-600 uppercase font-black tracking-widest mb-4">
                              Line items
                            </p>
                            <ul className="space-y-4">
                              {row.purchase.items.map((line) => (
                                <li
                                  key={`${row.key}-${line.id}-${line.name}`}
                                  className="flex items-center gap-4 text-xs font-bold text-white"
                                >
                                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 bg-slate-950 shrink-0">
                                    {line.imageUrl ? (
                                      <CoverImage
                                        src={line.imageUrl}
                                        alt=""
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-slate-600">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14"
                                          />
                                        </svg>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0 flex justify-between gap-4">
                                    <span
                                      className="uppercase italic line-clamp-2 min-w-0"
                                      dangerouslySetInnerHTML={{
                                        __html: sanitizeHtml(line.name || 'Item'),
                                      }}
                                    />
                                    <span className="font-mono text-emerald-400 shrink-0">
                                      {formatOrderMoney(Number(line.price), row.purchase.currency)}
                                    </span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    key={row.key}
                    className="bg-slate-900/40 border border-white/5 p-8 rounded-3xl backdrop-blur-sm relative overflow-hidden group"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500/30 group-hover:bg-cyan-500 transition-colors" />
                    <div className="flex flex-col md:flex-row justify-between gap-8">
                      <div className="flex-1 space-y-6">
                        <div className="flex flex-wrap items-center gap-4">
                          <div>
                            <p className="text-[9px] font-black uppercase text-cyan-500 tracking-widest mb-1">
                              Status: Active Protocol
                            </p>
                            <h3 className="text-white font-black uppercase text-2xl italic leading-none">
                              {row.sub.purpose} SYSTEM
                            </h3>
                            <p className="text-slate-500 text-[10px] font-mono mt-2 uppercase tracking-tighter">
                              ID: {row.sub.id}
                            </p>
                          </div>

                          <div className="h-10 w-px bg-white/5 hidden md:block" />

                          <div>
                            <p className="text-[9px] text-slate-500 uppercase font-black mb-1">Target Budget</p>
                            <p className="text-xl font-mono font-black text-cyan-400">${row.sub.budget}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-6 py-6 border-y border-white/5 mt-6">
                          <div className="space-y-1">
                            <p className="text-[9px] text-slate-600 uppercase font-black tracking-widest">Profile</p>
                            <div className="text-xs font-bold text-white uppercase italic">
                              Purpose: {row.sub.purpose}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <p className="text-[9px] text-slate-600 uppercase font-black tracking-widest">Core</p>
                            <div className="text-xs font-bold text-white uppercase italic">CPU: {row.sub.cpu}</div>
                            <div className="text-xs font-bold text-cyan-400 uppercase italic">GPU: {row.sub.gpu}</div>
                            <p className="text-[10px] text-slate-500 font-mono uppercase italic">
                              {row.sub.manufacturer}
                            </p>
                          </div>

                          <div className="space-y-1">
                            <p className="text-[9px] text-slate-600 uppercase font-black tracking-widest">Specs</p>
                            <div className="text-xs font-bold text-white uppercase italic">
                              Storage: {row.sub.ssd}
                            </div>
                            <div className="text-xs font-bold text-white uppercase italic">
                              Resolution: {row.sub.resolution}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <p className="text-[9px] text-slate-600 uppercase font-black tracking-widest">Aesthetic</p>
                            <div className="text-xs font-bold text-white uppercase italic">
                              {row.sub.caseSize} / {row.sub.caseType}
                            </div>
                            <div className="text-[10px] text-cyan-500/80 font-black uppercase tracking-tighter italic">
                              Style: {row.sub.aesthetic}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <p className="text-[9px] text-slate-600 uppercase font-black tracking-widest">Timeline</p>
                            <div className="text-xs font-bold text-white uppercase italic">
                              Priority: {row.sub.deadline}
                            </div>
                            <p className="text-[10px] text-slate-500 font-mono uppercase">
                              {row.sub.status === 'completed' ? 'Deployed' : 'In Progress'}
                            </p>
                          </div>
                        </div>

                        {row.sub.requirements && (
                          <div className="mt-6 p-4 bg-slate-950/50 rounded-2xl border border-white/5">
                            <p className="text-[9px] text-slate-600 uppercase font-black mb-2 tracking-widest">
                              Special Instructions:
                            </p>
                            <p className="text-xs text-slate-400 italic leading-relaxed">{row.sub.requirements}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col justify-between items-end border-l border-white/5 pl-8">
                        <div className="text-right">
                          <p className="text-[9px] text-slate-600 uppercase font-black mb-1">Logged At</p>
                          <p className="text-[10px] text-white font-mono">
                            {row.sub.timestamp ? new Date(row.sub.timestamp).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>

                        <button
                          onClick={() => handleDeleteSubmission(row.sub.id)}
                          className="mt-4 text-rose-500 text-[10px] font-black uppercase border border-rose-500/20 px-6 py-3 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-lg hover:shadow-rose-500/20"
                        >
                          Terminate Protocol
                        </button>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};