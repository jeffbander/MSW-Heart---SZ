'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { UserRole } from '@/lib/types';

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
  roles?: UserRole[]; // if set, only these roles can see it
}

// Section 1 - Main (everyone)
const mainTabs: NavItem[] = [
  { id: 'schedule', label: 'Schedule', href: '/' },
  { id: 'echo', label: 'Testing', href: '/echo' },
  { id: 'pto', label: 'Submit PTO', href: '/pto' },
  { id: 'statistics', label: 'Statistics', href: '/statistics', comingSoon: true },
  { id: 'data', label: 'Data', href: '/data', comingSoon: true },
  { id: 'providers', label: 'Providers', href: '/providers' },
];

// Section 2 - Everyone
const secondaryTabs: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard' },
  { id: 'reports', label: 'Reports', href: '/admin/reports' },
];

// Section 3 - Admin dropdown (super_admin only, except PTO Approvals visible to scheduler_full)
const adminTabs: NavItem[] = [
  { id: 'pto-approvals', label: 'PTO Approvals', href: '/admin/pto-requests', roles: ['super_admin'] },
  { id: 'manage-providers', label: 'Manage Providers', href: '/admin/providers', roles: ['super_admin'] },
  { id: 'manage-services', label: 'Manage Services', href: '/admin/services', roles: ['super_admin'] },
  { id: 'templates', label: 'Templates', href: '/admin/templates', roles: ['super_admin'] },
  { id: 'manage-users', label: 'Manage Users', href: '/admin/users', roles: ['super_admin'] },
];

const TAB_ORDER_KEY = 'cardiology_sidebar_tab_order';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onNavigate?: () => void;
}

export default function Sidebar({ isCollapsed, onToggleCollapse, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout, isSuperAdmin, requestLogin } = useAuth();
  const [tabs, setTabs] = useState<NavItem[]>(mainTabs);
  const [adminExpanded, setAdminExpanded] = useState(false);

  const userRole = user?.role;

  // Check if user can see admin section
  const canSeeAdmin = userRole === 'super_admin';

  // Filter admin tabs by role
  const visibleAdminTabs = adminTabs.filter((tab) => {
    if (!tab.roles) return true;
    return userRole ? tab.roles.includes(userRole) : false;
  });

  // Check if any admin tab is active to auto-expand
  const isAdminTabActive = visibleAdminTabs.some((tab) => pathname.startsWith(tab.href));

  // Load custom tab order from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(TAB_ORDER_KEY);
      if (stored) {
        const order = JSON.parse(stored) as string[];
        const reordered = order
          .map((id) => mainTabs.find((t) => t.id === id))
          .filter((t): t is NavItem => t !== undefined);
        // Add any missing tabs at the end
        mainTabs.forEach((t) => {
          if (!reordered.find((r) => r.id === t.id)) {
            reordered.push(t);
          }
        });
        setTabs(reordered);
      }
    } catch {
      setTabs(mainTabs);
    }
  }, []);

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
        {/* Section 1 - Main */}
        <div className="px-3 space-y-1">
          {tabs.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              onClick={onNavigate}
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

        {/* Section 2 - Secondary */}
        <div className="px-3 space-y-1">
          {secondaryTabs.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? 'bg-white/20 text-white'
                  : 'text-blue-100 hover:bg-white/10 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          ))}

          {/* Admin Dropdown - only for super_admin */}
          {canSeeAdmin && visibleAdminTabs.length > 0 && (
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
                  adminExpanded || isAdminTabActive ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="mt-1 ml-3 space-y-1">
                  {visibleAdminTabs.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={onNavigate}
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
          )}
        </div>
      </nav>

      {/* Footer - User info + Sign Out, or Sign In button */}
      <div className="p-3 border-t border-white/20">
        {user ? (
          <>
            <div className="flex items-center gap-2 px-3 py-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-bold">
                {user.display_name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">
                  {user.display_name || 'User'}
                </div>
                <div className="text-xs text-blue-200 truncate">
                  {user.role?.replace(/_/g, ' ') || ''}
                </div>
              </div>
            </div>
            <button
              onClick={() => logout()}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-white/10 text-blue-100 hover:bg-white/20 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </>
        ) : (
          <button
            onClick={requestLogin}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-white/10 text-blue-100 hover:bg-white/20 hover:text-white"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign In
          </button>
        )}
      </div>
    </aside>
  );
}
