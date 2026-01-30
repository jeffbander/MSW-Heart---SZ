'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { UserRole, AppUser } from '@/lib/types';

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  // Login modal state
  showLoginModal: boolean;
  setShowLoginModal: (show: boolean) => void;
  requestLogin: () => void;
  // Permission helpers
  isSuperAdmin: boolean;
  canEditSchedule: boolean;
  canEditService: (serviceId: string) => boolean;
  canApproveRejectPTO: boolean;
  canManageProviders: boolean;
  canManageServices: boolean;
  canManageTemplates: boolean;
  canCreateReports: boolean;
  canViewReports: boolean;
  canManageUsers: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const requestLogin = useCallback(() => {
    setShowLoginModal(true);
  }, []);

  // Check session on mount
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        setUser(data.user);
        setShowLoginModal(false);
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Login failed' };
      }
    } catch {
      return { success: false, error: 'Network error. Please try again.' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore errors, clear state anyway
    }
    setUser(null);
  }, []);

  // Permission helpers
  const role = user?.role;
  const isSuperAdmin = role === 'super_admin';
  const canEditSchedule = role === 'super_admin' || role === 'scheduler_full' || role === 'scheduler_limited';
  const canApproveRejectPTO = role === 'super_admin';
  const canManageProviders = role === 'super_admin';
  const canManageServices = role === 'super_admin';
  const canManageTemplates = role === 'super_admin';
  const canCreateReports = role === 'super_admin';
  const canViewReports = true; // everyone
  const canManageUsers = role === 'super_admin';

  const canEditService = useCallback((serviceId: string): boolean => {
    if (!user) return false;
    if (user.role === 'super_admin' || user.role === 'scheduler_full') return true;
    if (user.role === 'scheduler_limited') {
      return (user.allowed_service_ids || []).includes(serviceId);
    }
    return false;
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        showLoginModal,
        setShowLoginModal,
        requestLogin,
        isSuperAdmin,
        canEditSchedule,
        canEditService,
        canApproveRejectPTO,
        canManageProviders,
        canManageServices,
        canManageTemplates,
        canCreateReports,
        canViewReports,
        canManageUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Backward-compatible shim for existing useAdmin() callers.
 * Maps old AdminContext interface to new AuthContext.
 */
export function useAdmin() {
  const auth = useAuth();
  return {
    isAdminMode: auth.canEditSchedule,
    isAuthenticated: !!auth.user,
    setAdminMode: () => {},
    authenticate: () => false,
    logout: auth.logout,
  };
}
