export interface AuthResponse {
  token: string;
  role: 'admin' | 'user';
  user?: {
    username: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  error?: string;
  message?: string;
  success?: boolean;
  requiresAdminCode?: boolean;
}

const API_URL = "https://maxbitcore.com/api";

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
  }
  return data;
};

export const loginUser = async (username: string, password: string, adminCode?: string): Promise<AuthResponse> => {
  const response = await fetch(`https://maxbitcore.com/api/login.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username, password: password, adminCode: adminCode }),
  });

  const data = await handleResponse(response);

  if (data.requiresAdminCode) return data;

  if (data.token) {
    localStorage.setItem('maxbit_token', data.token);
    localStorage.setItem('maxbit_role', data.role);
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
};

export const getStoredAuth = () => {
  return {
    token: localStorage.getItem('maxbit_token'),
    role: localStorage.getItem('maxbit_role') as 'admin' | 'user' | null
  };
};