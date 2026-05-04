export interface AuthResponse {
  token: string;
  role: 'admin' | 'user';
  user?: {
    username?: string;
    email: string;
    firstName?: string;
    lastName?: string;
    id?: string | number;
    joined?: string;
    created_at?: string;
  };
  error?: string;
  message?: string;
  success?: boolean;
  requiresAdminCode?: boolean;
  email: string | null;
  joined?: string;
  created_at?: string;
  createdAt?: string;
  id?: string | number;
  user_id?: string | number;
}

const API_URL = "https://www.maxbitcore.com/api";

/** Normalize registration / account creation time from API payloads (PHP field names vary). */
export function pickJoinedFromAuthPayload(data: any): string | undefined {
  if (!data || typeof data !== 'object') return undefined;

  const tryDate = (v: unknown): string | undefined => {
    if (v == null || v === '') return undefined;
    if (typeof v === 'number') {
      const ms = v < 1e12 ? v * 1000 : v;
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
    }
    if (typeof v === 'string') {
      const s = v.trim();
      if (!s) return undefined;
      if (/^\d+$/.test(s)) {
        const n = Number(s);
        const ms = n < 1e12 ? n * 1000 : n;
        const d = new Date(ms);
        return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
      }
      const t = Date.parse(s);
      if (!Number.isNaN(t)) return new Date(t).toISOString();
    }
    return undefined;
  };

  const keys = [
    'joined',
    'created_at',
    'createdAt',
    'registration_date',
    'registrationDate',
    'date_joined',
    'signup_date',
    'account_created',
    'registered_at',
  ];

  const buckets = [data, data.user];
  for (const bucket of buckets) {
    if (!bucket || typeof bucket !== 'object') continue;
    for (const k of keys) {
      const parsed = tryDate((bucket as any)[k]);
      if (parsed) return parsed;
    }
  }
  return undefined;
}

/**
 * Prefer API date; if missing, keep previously stored joined for the same account
 * (match by email and/or login username — PHP login often returns flat JSON without `user`).
 */
export function mergeResolvedJoined(
  email: string | undefined,
  fromApi: string | undefined,
  loginUsername?: string,
): string | undefined {
  if (fromApi) return fromApi;
  try {
    const raw = localStorage.getItem('maxbit_currentUser');
    if (!raw) return undefined;
    const prev = JSON.parse(raw);
    if (!prev?.joined) return undefined;
    const em = email?.trim();
    if (em && prev.email === em) return prev.joined;
    const lu = loginUsername?.trim();
    if (lu && (prev.username === lu || prev.email === lu)) return prev.joined;
  } catch {
    /* ignore */
  }
  return undefined;
}

const handleResponse = async (response: Response) => {
  const data = await response.json();
  if (!response.ok || data.success === false) {
    throw new Error(data.message || 'Server error');
  }
  return data;
};

export const registerUser = async (username: string, email: string, password: string, adminCode?: string): Promise<AuthResponse> => {
  const response = await fetch(`${API_URL}/register.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username, email: email, password: password, adminCode: adminCode }),
  });
  
  const data = await handleResponse(response);

  if (data.token) {
    localStorage.setItem('maxbit_token', data.token);
    localStorage.setItem('maxbit_role', data.role);
    const emailVal = data.user?.email || data.email || email;
    const joined = mergeResolvedJoined(
      emailVal || undefined,
      pickJoinedFromAuthPayload(data),
      data.user?.username || data.username || username,
    );
    const userToSave = {
      id: data.user?.id ?? data.id ?? data.user_id,
      email: emailVal,
      firstName:
        data.user?.firstName ||
        (data.user as any)?.first_name ||
        data.firstName ||
        (data as any).first_name ||
        '',
      lastName:
        data.user?.lastName ||
        (data.user as any)?.last_name ||
        (data.user as any)?.surname ||
        data.lastName ||
        (data as any).last_name ||
        (data as any).surname ||
        '',
      username: data.user?.username,
      role: data.role,
      ...(joined ? { joined } : {}),
    };
    localStorage.setItem('maxbit_currentUser', JSON.stringify(userToSave));
  }
  return data;
};

export const loginUser = async (username: string, password: string, adminCode?: string): Promise<AuthResponse> => {
  console.log("DEBUG LOGIN:", { username, password });
  const response = await fetch(`https://www.maxbitcore.com/api/login.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username, password: password, adminCode: adminCode }),
  });

  const data = await handleResponse(response);

  if (data.requiresAdminCode) return data;

  if (data.token) {
    localStorage.setItem('maxbit_token', data.token);
    localStorage.setItem('maxbit_role', data.role);
    const emailVal = data.user?.email || data.email || '';
    if (emailVal) localStorage.setItem('maxbit_email', emailVal);
    const joined = mergeResolvedJoined(
      emailVal || undefined,
      pickJoinedFromAuthPayload(data),
      username,
    );
    const userToSave = {
      id: data.user?.id ?? data.id ?? data.user_id,
      email: emailVal,
      firstName:
        data.user?.firstName ||
        (data.user as any)?.first_name ||
        data.firstName ||
        (data as any).first_name ||
        '',
      lastName:
        data.user?.lastName ||
        (data.user as any)?.last_name ||
        (data.user as any)?.surname ||
        data.lastName ||
        (data as any).last_name ||
        (data as any).surname ||
        '',
      username: data.user?.username || data.username || username,
      role: data.role,
      ...(joined ? { joined } : {}),
    };
    localStorage.setItem('maxbit_currentUser', JSON.stringify(userToSave));
  }
  return data;
};

export const forgotPassword = async (email: string) => {
  const response = await fetch(`${API_URL}/forgot_password.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return await handleResponse(response);
};

export const resetPassword = async (token: string, newPassword: string) => {
  const response = await fetch(`${API_URL}/reset_password.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  });
  return await handleResponse(response);
};

export const logoutUser = () => {
  localStorage.removeItem('maxbit_token');
  localStorage.removeItem('maxbit_role');
  localStorage.removeItem('maxbit_email');
  localStorage.removeItem('maxbit_currentUser');
};

export const getStoredAuth = () => {
  const token = localStorage.getItem('maxbit_token');
  const role = localStorage.getItem('maxbit_role') as 'admin' | 'user' | null;
  const userJson = localStorage.getItem('maxbit_currentUser');
  
  let email = '';
  let firstName = '';

  if (userJson) {
    try {
      const userObj = JSON.parse(userJson);
      email = userObj.email || '';
      firstName = userObj.firstName || '';
    } catch (e) {
      console.error("Error parsing user data", e);
    }
  }

  return {
    token,
    role,
    email,
    firstName
  };
};