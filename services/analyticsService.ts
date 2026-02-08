import { Product } from '../types';

export interface OrderRecord {
  id: string;
  items: { id: string, name: string, price: number }[];
  total: number;
  timestamp: number;
  status: 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';
  customer: {
    name: string;
    email: string;
    address: string;
  };
}

export interface SessionAction {
  timestamp: number;
  type: 'VIEW' | 'CLICK' | 'SEARCH' | 'CART' | 'ORDER';
  details: string;
}

export interface VisitorSession {
  id: string;
  user: string; // "Guest" or User Email
  startTime: number;
  lastActive: number;
  date: string; // YYYY-MM-DD
  device: string;
  platform: string;
  actions: SessionAction[];
}

export interface AnalyticsData {
  visits: number;
  productViews: Record<string, number>;
  cartAdditions: Record<string, number>;
  orders: OrderRecord[];
  sessions: VisitorSession[];
}

const STORAGE_KEY = 'maxbit_analytics';
const SESSION_KEY = 'maxbit_current_session_id';

const getInitialData = (): AnalyticsData => ({
  visits: 0,
  productViews: {},
  cartAdditions: {},
  orders: [],
  sessions: []
});

export const getAnalytics = (): AnalyticsData => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : getInitialData();
  } catch (e) {
    return getInitialData();
  }
};

export const saveAnalytics = (data: AnalyticsData) => {
  try {
    if (data.sessions.length > 200) {
        data.sessions = data.sessions.slice(-200);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {}
};

const getDeviceInfo = () => {
  const ua = navigator.userAgent;
  if (/Mobi|Android/i.test(ua)) return 'Mobile';
  if (/iPad|Tablet/i.test(ua)) return 'Tablet';
  return 'Desktop';
};

const getCurrentUserIdentity = (): string => {
    const role = localStorage.getItem('maxbit_role');
    const token = localStorage.getItem('maxbit_token');
    
    // If it's an admin, we might want to return a special flag or handle it in logAction
    if (role === 'admin') return 'ADMIN';
    
    // In this simulation, if we have a token but no explicit email stored in a separate 'current_user' key,
    // we'd normally decode the JWT. For now, let's look at the users DB if possible or just return a placeholder
    // If you have a specific way you store the logged in user's email, use it here.
    // For now, we'll try to find an email associated with a session or just return "Guest"
    return "Guest"; 
};

const getCurrentSession = (data: AnalyticsData): VisitorSession | null => {
  const role = localStorage.getItem('maxbit_role');
  if (role === 'admin') return null; // DO NOT track admin

  let sessionId = sessionStorage.getItem(SESSION_KEY);
  let session = data.sessions.find(s => s.id === sessionId);

  if (!sessionId || !session) {
    sessionId = `SES-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    sessionStorage.setItem(SESSION_KEY, sessionId);
    
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    session = {
      id: sessionId,
      user: getCurrentUserIdentity(),
      startTime: Date.now(),
      lastActive: Date.now(),
      date: dateStr,
      device: getDeviceInfo(),
      platform: navigator.platform || 'Unknown',
      actions: []
    };
    data.sessions.push(session);
  } else {
      // Update identity if they logged in during the session
      const currentId = getCurrentUserIdentity();
      if (session.user === 'Guest' && currentId !== 'Guest') {
          session.user = currentId;
      }
  }

  return session;
};

export const logAction = (type: SessionAction['type'], details: string) => {
  const data = getAnalytics();
  const session = getCurrentSession(data);
  
  if (!session) return; // Skip logging if admin or error
  
  session.lastActive = Date.now();
  session.actions.push({
    timestamp: Date.now(),
    type,
    details
  });

  saveAnalytics(data);
};

export const trackVisit = () => {
  const data = getAnalytics();
  const role = localStorage.getItem('maxbit_role');
  if (role === 'admin') return;

  if (!sessionStorage.getItem(SESSION_KEY)) {
      data.visits += 1;
      // logAction will initialize the session
      logAction('VIEW', 'Entry point: Landing Page'); 
  } else {
      getCurrentSession(data); 
      saveAnalytics(data);
  }
};

export const trackPageNav = (pageName: string) => {
  logAction('VIEW', `Navigated to ${pageName}`);
};

export const trackSearch = (query: string) => {
  logAction('SEARCH', `Queried: "${query}"`);
};

export const trackProductView = (productId: string, productName?: string) => {
  const data = getAnalytics();
  const role = localStorage.getItem('maxbit_role');
  if (role !== 'admin') {
    data.productViews[productId] = (data.productViews[productId] || 0) + 1;
    saveAnalytics(data);
    logAction('VIEW', `Inspected Product: ${productName || productId}`);
  }
};

export const trackCartAddition = (productId: string, productName?: string) => {
  const data = getAnalytics();
  const role = localStorage.getItem('maxbit_role');
  if (role !== 'admin') {
    data.cartAdditions[productId] = (data.cartAdditions[productId] || 0) + 1;
    saveAnalytics(data);
    logAction('CART', `Added to Cart: ${productName || productId}`);
  }
};

export const trackOrder = (
  orderId: string, 
  items: Product[], 
  total: number, 
  customerData: { name: string, email: string, address: string }
) => {
  const data = getAnalytics();
  const record: OrderRecord = {
    id: orderId,
    total,
    timestamp: Date.now(),
    items: items.map(i => ({ id: i.id, name: i.name, price: i.price })),
    status: 'Processing',
    customer: customerData
  };
  data.orders.push(record);
  
  // Tag current session with the user's email since we now know who they are
  const session = getCurrentSession(data);
  if (session) {
      session.user = customerData.email;
  }

  saveAnalytics(data);
  logAction('ORDER', `Order Placed: ${orderId} ($${total})`);
};