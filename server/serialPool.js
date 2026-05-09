/**
 * Free serial numbers per site product id, with checkout reservations and return-to-pool on expiry.
 * File: server/data/serial-pool.json
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const POOL_FILE = path.join(__dirname, 'data', 'serial-pool.json');
const POOL_TTL_MS = Math.max(
  5 * 60 * 1000,
  Number(process.env.SERIAL_RESERVATION_TTL_MS || 90 * 60 * 1000)
);
const MAX_CF = 4;
const MAX_NAME = 40;
const MAX_VAL = 140;

const isEnabled = () =>
  String(process.env.SERIAL_POOL_ENABLED || 'true')
    .trim()
    .toLowerCase() !== 'false';

let chain = Promise.resolve();

const withLock = (fn) => {
  const run = chain.then(() => fn());
  chain = run.catch(() => {}).then(() => {});
  return run;
};

const cleanPid = (id) => String(id || '').trim().slice(0, 120);
const cleanText = (s) => String(s || '').replace(/<[^>]*>?/gm, '').trim();

const loadState = () => {
  const dir = path.dirname(POOL_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(POOL_FILE)) {
    return { pools: {}, reservations: {} };
  }
  try {
    const raw = fs.readFileSync(POOL_FILE, 'utf8');
    const j = JSON.parse(raw);
    return {
      pools: typeof j.pools === 'object' && j.pools ? j.pools : {},
      reservations: typeof j.reservations === 'object' && j.reservations ? j.reservations : {},
    };
  } catch {
    return { pools: {}, reservations: {} };
  }
};

const saveState = (state) => {
  fs.mkdirSync(path.dirname(POOL_FILE), { recursive: true });
  fs.writeFileSync(POOL_FILE, JSON.stringify(state, null, 2));
};

const releaseReservationSync = (state, reservationId) => {
  const r = state.reservations[reservationId];
  if (!r) return;
  for (const line of r.items || []) {
    const pid = cleanPid(line.productId);
    const sn = String(line.serial || '').trim();
    if (!pid || !sn) continue;
    if (!state.pools[pid]) state.pools[pid] = [];
    state.pools[pid].push(sn);
  }
  delete state.reservations[reservationId];
};

const expireStaleSync = (state) => {
  const now = Date.now();
  const ids = Object.keys(state.reservations || {}).filter((id) => {
    const r = state.reservations[id];
    const ex = new Date(r.expiresAt || 0).getTime();
    return !Number.isFinite(ex) || ex < now;
  });
  for (const id of ids) releaseReservationSync(state, id);
};

/** Chunk serial list into Stripe Invoice custom_fields (max 4 × 140 chars). */
const linesToInvoiceCustomFields = (lines) => {
  if (!lines.length) return [];
  const full = lines.map((l) => `${cleanPid(l.productId)}:${String(l.serial).trim()}`).join('; ');
  const out = [];
  for (let i = 0; i < full.length && out.length < MAX_CF; i += MAX_VAL) {
    const slice = full.slice(i, i + MAX_VAL);
    out.push({
      name: `Serial #${out.length + 1}`.slice(0, MAX_NAME),
      value: slice.slice(0, MAX_VAL),
    });
  }
  return out;
};

/**
 * @returns {Promise<{ reservationId: string|null, lines: {productId:string,serial:string}[], customFields: {name:string,value:string}[] }>}
 */
const reserveForCheckout = ({ orderId, items, strict }) =>
  withLock(() => {
    if (!isEnabled()) {
      return { reservationId: null, lines: [], customFields: [] };
    }
    const state = loadState();
    expireStaleSync(state);

    const oid = cleanText(orderId);
    for (const [rid, r] of Object.entries(state.reservations)) {
      if (cleanText(r.orderId) === oid) releaseReservationSync(state, rid);
    }
    const pendingRollback = [];

    const lines = [];
    for (const item of items || []) {
      const pid = cleanPid(item.id);
      if (!pid) continue;
      const pool = state.pools[pid];
      if (!pool || pool.length === 0) {
        if (strict) {
          for (const rb of pendingRollback.reverse()) {
            if (!state.pools[rb.pid]) state.pools[rb.pid] = [];
            state.pools[rb.pid].unshift(rb.serial);
          }
          throw new Error(`Serial pool empty for product "${pid}". Add serials in Admin or serial-pool.json.`);
        }
        continue;
      }
      const serial = String(pool.shift()).trim();
      pendingRollback.push({ pid, serial });
      lines.push({ productId: pid, serial });
    }

    if (lines.length === 0) {
      saveState(state);
      return { reservationId: null, lines: [], customFields: [] };
    }

    const reservationId = crypto.randomUUID();
    state.reservations[reservationId] = {
      orderId: oid,
      stripeSessionId: null,
      items: lines,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + POOL_TTL_MS).toISOString(),
    };
    saveState(state);

    return {
      reservationId,
      lines,
      customFields: linesToInvoiceCustomFields(lines),
    };
  });

const bindSession = (reservationId, stripeSessionId) =>
  withLock(() => {
    if (!reservationId || !stripeSessionId) return;
    const state = loadState();
    const r = state.reservations[reservationId];
    if (!r) return;
    r.stripeSessionId = stripeSessionId;
    saveState(state);
  });

/** Remove reservation without returning serials (paid). */
const commitReservation = (reservationId) =>
  withLock(() => {
    if (!reservationId) return;
    const state = loadState();
    delete state.reservations[reservationId];
    saveState(state);
  });

/** Return serials to pools (abandoned checkout / expiry). */
const releaseReservation = (reservationId) =>
  withLock(() => {
    if (!reservationId) return;
    const state = loadState();
    releaseReservationSync(state, reservationId);
    saveState(state);
  });

const expireStaleReservations = () =>
  withLock(() => {
    const state = loadState();
    expireStaleSync(state);
    saveState(state);
  });

/** Read items before commit (sync). */
const peekReservation = (reservationId) => {
  const state = loadState();
  const r = state.reservations[reservationId];
  if (!r) return null;
  return { items: Array.isArray(r.items) ? r.items : [], orderId: r.orderId || null };
};

/** Admin: counts only + reservation count (no serial values). */
const getAdminSnapshot = () => {
  const state = loadState();
  const pools = {};
  for (const [pid, arr] of Object.entries(state.pools || {})) {
    pools[pid] = Array.isArray(arr) ? arr.length : 0;
  }
  return {
    pools,
    reservations: Object.keys(state.reservations || {}).length,
    ttlMinutes: Math.round(POOL_TTL_MS / 60000),
  };
};

/** Admin: append serial strings to a product pool (dedupe within file). */
const pushSerials = (productId, serials) =>
  withLock(() => {
    const pid = cleanPid(productId);
    if (!pid) throw new Error('Missing productId.');
    const list = Array.isArray(serials) ? serials : [];
    const cleaned = [];
    const seen = new Set();
    for (const s of list) {
      const v = String(s || '').trim();
      if (!v || v.length > 80) continue;
      if (seen.has(v.toLowerCase())) continue;
      seen.add(v.toLowerCase());
      cleaned.push(v);
    }
    if (!cleaned.length) throw new Error('No valid serial strings.');
    const state = loadState();
    if (!state.pools[pid]) state.pools[pid] = [];
    const existing = new Set(state.pools[pid].map((x) => String(x).toLowerCase()));
    let added = 0;
    for (const c of cleaned) {
      if (existing.has(c.toLowerCase())) continue;
      state.pools[pid].push(c);
      existing.add(c.toLowerCase());
      added += 1;
    }
    saveState(state);
    return { added, totalInPool: state.pools[pid].length };
  });

module.exports = {
  isSerialPoolEnabled: isEnabled,
  reserveForCheckout,
  bindSession,
  commitReservation,
  releaseReservation,
  expireStaleReservations,
  peekReservation,
  getAdminSnapshot,
  pushSerials,
  linesToInvoiceCustomFields,
};
