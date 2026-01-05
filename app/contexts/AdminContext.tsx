'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AdminContextType {
  isAdminMode: boolean;
  setAdminMode: (enabled: boolean) => void;
  isAuthenticated: boolean;
  authenticate: (passcode: string) => boolean;
  logout: () => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

const ADMIN_PASSCODE = process.env.NEXT_PUBLIC_ADMIN_PASSCODE || '123456';
const STORAGE_KEY = 'cardiology_admin_authenticated';

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check session storage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (stored === 'true') {
          setIsAuthenticated(true);
          setIsAdminMode(true);
        }
      } catch (e) {
        console.error('Error accessing sessionStorage:', e);
      }
    }
  }, []);

  const authenticate = (passcode: string): boolean => {
    if (passcode === ADMIN_PASSCODE) {
      setIsAuthenticated(true);
      setIsAdminMode(true);
      try {
        sessionStorage.setItem(STORAGE_KEY, 'true');
      } catch (e) {
        console.error('Error setting sessionStorage:', e);
      }
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    setIsAdminMode(false);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Error removing sessionStorage:', e);
    }
  };

  const setAdminMode = (enabled: boolean) => {
    if (enabled && !isAuthenticated) {
      // Can't enable admin mode without authentication
      return;
    }
    setIsAdminMode(enabled);
    if (!enabled) {
      // Optionally logout when disabling admin mode
      logout();
    }
  };

  return (
    <AdminContext.Provider
      value={{
        isAdminMode,
        setAdminMode,
        isAuthenticated,
        authenticate,
        logout,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}
