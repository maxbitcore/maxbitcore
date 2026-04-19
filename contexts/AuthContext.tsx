import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('maxbit_currentUser');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("LocalStorage ERROR", e);
      }
    }
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, setCurrentUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export const TACTICAL_PALETTE = [
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
