'use client';

import { useState, useEffect, ReactNode } from 'react';
import Sidebar from './Sidebar';

const colors = {
  primaryBlue: '#003D7A',
  lightGray: '#F5F5F5',
};

const COLLAPSED_KEY = 'cardiology_sidebar_collapsed';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Load collapsed state from localStorage and detect mobile
  useEffect(() => {
    const stored = localStorage.getItem(COLLAPSED_KEY);
    if (stored === 'true') {
      setIsCollapsed(true);
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
    localStorage.setItem(COLLAPSED_KEY, String(newState));
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: colors.lightGray }}>
      {/* Sidebar */}
      <Sidebar isCollapsed={isCollapsed} onToggleCollapse={handleToggleCollapse} />

      {/* Expand button when collapsed */}
      {isCollapsed && (
        <button
          onClick={handleToggleCollapse}
          className="fixed top-4 left-4 z-40 p-2 rounded-lg shadow-lg transition-colors hover:bg-gray-100"
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
          className="fixed inset-0 bg-black/50 z-30"
          onClick={handleToggleCollapse}
        />
      )}
    </div>
  );
}
