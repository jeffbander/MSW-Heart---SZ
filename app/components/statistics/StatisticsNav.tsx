'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { label: 'Practice Overview', href: '/statistics' },
  { label: 'Provider Scorecard', href: '/statistics/providers' },
  { label: 'Testing Analytics', href: '/statistics/testing' },
];

export default function StatisticsNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/statistics') return pathname === '/statistics';
    return pathname.startsWith(href);
  };

  return (
    <nav className="flex items-center border-b border-gray-200 mt-1">
      <div className="flex gap-0">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              isActive(tab.href)
                ? 'border-[#003D7A] text-[#003D7A] font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      <div className="ml-auto">
        <Link
          href="/data"
          className="text-sm text-gray-400 hover:text-[#003D7A] flex items-center gap-1 transition-colors"
        >
          Manage Uploads
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </Link>
      </div>
    </nav>
  );
}
