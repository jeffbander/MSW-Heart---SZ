'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAdmin } from '@/app/contexts/AuthContext';
import PasscodeModal from '@/app/components/layout/PasscodeModal';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  lightGray: '#F5F5F5',
  border: '#E5E7EB',
};

const navItems = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/providers', label: 'Providers' },
  { href: '/admin/services', label: 'Services' },
  { href: '/admin/templates', label: 'Templates' },
  { href: '/admin/pto-requests', label: 'PTO Requests' },
  { href: '/admin/reports', label: 'Reports' },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { isAdminMode, authenticate, logout } = useAdmin();
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.lightGray }}>
      {/* Admin Header */}
      <header className="py-4 px-4 shadow-sm" style={{ backgroundColor: colors.primaryBlue }}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
            <p className="text-blue-100 text-sm">MSW Heart Cardiology Scheduler</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => isAdminMode ? logout() : setShowPasscodeModal(true)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                isAdminMode
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              {isAdminMode ? 'Exit Admin' : 'Enter Admin Mode'}
            </button>
            <Link
              href="/"
              className="px-4 py-2 rounded text-sm font-medium text-white hover:bg-white/10 transition-colors"
            >
              Back to Calendar
            </Link>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b" style={{ borderColor: colors.border }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  pathname === item.href
                    ? 'border-current'
                    : 'border-transparent hover:bg-gray-50'
                }`}
                style={{
                  color: pathname === item.href ? colors.primaryBlue : '#6B7280',
                  borderColor: pathname === item.href ? colors.primaryBlue : 'transparent'
                }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>

      {/* Passcode Modal */}
      <PasscodeModal
        isOpen={showPasscodeModal}
        onClose={() => setShowPasscodeModal(false)}
        onAuthenticate={authenticate}
      />
    </div>
  );
}
