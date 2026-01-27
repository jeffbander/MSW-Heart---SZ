'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAdmin } from '@/app/contexts/AdminContext';
import PasscodeModal from './PasscodeModal';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  lightGray: '#F5F5F5',
  border: '#E5E7EB',
};

interface NavItem {
  id: string;
  label: string;
  href: string;
  comingSoon?: boolean;
}

const defaultTabs: NavItem[] = [
  { id: 'schedule', label: 'Schedule', href: '/' },
  { id: 'pto', label: 'Submit PTO', href: '/pto' },
  { id: 'statistics', label: 'Statistics', href: '/statistics', comingSoon: true },
  { id: 'echo', label: 'Testing', href: '/echo' },
  { id: 'data', label: 'Data', href: '/data', comingSoon: true },
];

const secondaryTabs: NavItem[] = [
  { id: 'providers', label: 'Providers', href: '/providers' },
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard' },
  { id: 'reports', label: 'Reports', href: '/admin/reports' },
];

const adminTabs: NavItem[] = [
  { id: 'pto-approvals', label: 'PTO Approvals', href: '/admin/pto-requests' },
  { id: 'manage-providers', label: 'Manage Providers', href: '/admin/providers' },
  { id: 'manage-services', label: 'Manage Services', href: '/admin/services' },
  { id: 'templates', label: 'Templates', href: '/admin/templates' },
];

const TAB_ORDER_KEY = 'cardiology_sidebar_tab_order';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({ isCollapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const { isAdminMode, authenticate, logout } = useAdmin();
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [tabs, setTabs] = useState<NavItem[]>(defaultTabs);
  const [adminExpanded, setAdminExpanded] = useState(false);

  // Check if any admin tab is active to auto-expand
  const isAdminTabActive = adminTabs.some((tab) => pathname.startsWith(tab.href));

  // Load custom tab order from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(TAB_ORDER_KEY);
      if (stored) {
        const order = JSON.parse(stored) as string[];
        const reordered = order
          .map((id) => defaultTabs.find((t) => t.id === id))
          .filter((t): t is NavItem => t !== undefined);
        // Add any missing tabs at the end
        defaultTabs.forEach((t) => {
          if (!reordered.find((r) => r.id === t.id)) {
            reordered.push(t);
          }
        });
        setTabs(reordered);
      }
    } catch {
      setTabs(defaultTabs);
    }
  }, []);

  const handleAdminToggle = () => {
    if (isAdminMode) {
      logout();
    } else {
      setShowPasscodeModal(true);
    }
  };

  const handleAuthenticate = (passcode: string): boolean => {
    return authenticate(passcode);
  };

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  // When collapsed, sidebar is completely hidden
  if (isCollapsed) {
    return null;
  }

  return (
    <>
      <aside
        className="h-screen flex flex-col transition-all duration-200"
        style={{
          width: '240px',
          backgroundColor: colors.primaryBlue,
        }}
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-white/20">
          <div>
            <h1 className="text-lg font-bold text-white">MSW Cardiology</h1>
            <p className="text-xs text-blue-200">Scheduler</p>
          </div>
          <button
            onClick={onToggleCollapse}
            className="p-2 rounded hover:bg-white/10 transition-colors text-white"
            title="Collapse sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <div className="px-3 space-y-1">
            {tabs.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? 'bg-white/20 text-white'
                    : 'text-blue-100 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="flex-1">{item.label}</span>
                {item.comingSoon && (
                  <span className="px-1.5 py-0.5 text-xs rounded bg-white/20 text-blue-100">
                    Soon
                  </span>
                )}
              </Link>
            ))}
          </div>

          {/* Divider */}
          <div className="my-4 mx-3 border-t border-white/20" />

          {/* Secondary Navigation */}
          <div className="px-3 space-y-1">
            {secondaryTabs.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? 'bg-white/20 text-white'
                    : 'text-blue-100 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            ))}

            {/* Admin Dropdown */}
            <div>
              <button
                onClick={() => setAdminExpanded(!adminExpanded)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isAdminTabActive
                    ? 'bg-white/20 text-white'
                    : 'text-blue-100 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span>Admin</span>
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${
                    adminExpanded || isAdminTabActive ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Admin Items */}
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  adminExpanded || isAdminTabActive ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="mt-1 ml-3 space-y-1">
                  {adminTabs.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive(item.href)
                          ? 'bg-white/20 text-white'
                          : 'text-blue-100 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* Footer - Admin Toggle */}
        <div className="p-3 border-t border-white/20">
          <button
            onClick={handleAdminToggle}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isAdminMode
                ? 'bg-teal-500 text-white hover:bg-teal-600'
                : 'bg-white/10 text-blue-100 hover:bg-white/20 hover:text-white'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isAdminMode ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              )}
            </svg>
            {isAdminMode ? 'Exit Admin' : 'Admin Mode'}
          </button>
        </div>
      </aside>

      <PasscodeModal
        isOpen={showPasscodeModal}
        onClose={() => setShowPasscodeModal(false)}
        onAuthenticate={handleAuthenticate}
      />
    </>
  );
}
