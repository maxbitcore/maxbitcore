
export interface AuthResponse {
  token: string;
  role: 'admin' | 'user';
  error?: string;
  requiresAdminCode?: boolean;
}

// Simulation for preview environment
const simulateBackend = async (endpoint: string, body: any): Promise<AuthResponse> => {
  await new Promise(resolve => setTimeout(resolve, 600)); // Slight delay for realism

  if (endpoint === '/register') {
    const existingUsers = JSON.parse(localStorage.getItem('mock_users_db') || '[]');
    if (existingUsers.find((u: any) => u.email === body.email)) {
      throw new Error('Email already occupied');
    }
    
    // Default to user role since we removed admin code from registration
    const role = 'user';
    
    const newUser = { email: body.email, password: body.password, role }; 
    localStorage.setItem('mock_users_db', JSON.stringify([...existingUsers, newUser]));
    return { token: 'mock-jwt-token', role };
  }

  if (endpoint === '/login') {
    // 1. PRIORITY CHECK: Special Hardcoded Admin Access Flow
    // This must come BEFORE checking localStorage.
    if (body.email === 'max@maxbitcore.com' && body.password === 'DgjHfetuYr195%905!') {
        // Check if secondary admin code is provided
        if (!body.adminCode) {
            // Signal to UI that code is required
            return { token: '', role: 'user', requiresAdminCode: true }; 
        }
        
        // Verify the code
        if (body.adminCode === '7496143678234589') {
            return { token: 'mock-max-admin-token', role: 'admin' };
        } else {
            throw new Error('SECURITY ALERT: Invalid Admin Code');
        }
    }

    // 3. Regular User DB Check
    const existingUsers = JSON.parse(localStorage.getItem('mock_users_db') || '[]');
    const user = existingUsers.find((u: any) => u.email === body.email && u.password === body.password);

    if (user) {
      return { token: 'mock-jwt-token', role: user.role };
    }
    
    throw new Error('Invalid credentials');
  }

  throw new Error('Unknown endpoint');
};

export const registerUser = async (email: string, password: string, secretCode?: string): Promise<AuthResponse> => {
  // Direct simulation to prevent network hangs in demo environment
  return simulateBackend('/register', { email, password, secretCode });
};

export const loginUser = async (email: string, password: string, adminCode?: string): Promise<AuthResponse> => {
  // Direct simulation to prevent network hangs in demo environment
  return simulateBackend('/login', { email, password, adminCode });
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