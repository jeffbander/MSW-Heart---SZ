'use client';

import { useState, useEffect, ReactNode } from 'react';
import Sidebar from './Sidebar';
import LoginModal from './LoginModal';
import { useAuth } from '@/app/contexts/AuthContext';

const colors = {
  primaryBlue: '#003D7A',
  lightGray: '#F5F5F5',
};

const COLLAPSED_KEY = 'cardiology_sidebar_collapsed';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { loading, showLoginModal, setShowLoginModal } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Load collapsed state from localStorage and detect mobile
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(COLLAPSED_KEY);
      if (stored === 'true') {
        setIsCollapsed(true);
      }
    } catch (e) {
      console.error('Error accessing localStorage:', e);
    }

    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setIsCollapsed(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleToggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    try {
      localStorage.setItem(COLLAPSED_KEY, String(newState));
    } catch (e) {
      console.error('Error setting localStorage:', e);
    }
  };

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.lightGray }}>
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: colors.lightGray }}>
      {/* Sidebar */}
      <div className={isMobile && !isCollapsed ? 'fixed inset-y-0 left-0 z-50' : ''}>
        <Sidebar isCollapsed={isCollapsed} onToggleCollapse={handleToggleCollapse} onNavigate={isMobile ? () => setIsCollapsed(true) : undefined} />
      </div>

      {/* Expand button when collapsed */}
      {isCollapsed && (
        <button
          onClick={handleToggleCollapse}
          className="fixed top-4 left-4 z-50 p-3 rounded-lg shadow-lg transition-colors hover:bg-gray-100"
          style={{ backgroundColor: 'white' }}
          title="Expand sidebar"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke={colors.primaryBlue}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      )}

      {/* Main Content */}
      <main className="flex-1 min-h-screen overflow-auto">
        {children}
      </main>

      {/* Mobile overlay when sidebar is open */}
      {isMobile && !isCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={handleToggleCollapse}
        />
      )}

      {/* Login modal overlay */}
      {showLoginModal && (
        <LoginModal onClose={() => setShowLoginModal(false)} />
      )}
    </div>
  );
}
