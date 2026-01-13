'use client';

import Link from 'next/link';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  lightGray: '#F5F5F5',
  border: '#E5E7EB',
};

interface NavCard {
  id: string;
  title: string;
  description: string;
  href: string;
  color: string;
  comingSoon?: boolean;
}

const navCards: NavCard[] = [
  {
    id: 'schedule',
    title: 'Schedule',
    description: 'View the main calendar with provider and service schedules',
    href: '/',
    color: colors.primaryBlue,
  },
  {
    id: 'pto',
    title: 'Submit PTO',
    description: 'Submit a paid time off request for approval',
    href: '/pto',
    color: colors.teal,
  },
  {
    id: 'statistics',
    title: 'Statistics',
    description: 'View scheduling statistics and analytics',
    href: '/statistics',
    color: colors.lightBlue,
    comingSoon: true,
  },
  {
    id: 'echo',
    title: 'Echo Schedule',
    description: 'View the Echo lab schedule',
    href: '/echo',
    color: '#7C3AED',
  },
  {
    id: 'data',
    title: 'Data',
    description: 'Access scheduling data and exports',
    href: '/data',
    color: '#059669',
    comingSoon: true,
  },
];

export default function DashboardPage() {
  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: colors.lightGray }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold" style={{ color: colors.primaryBlue }}>
            MSW Cardiology Scheduler
          </h1>
          <p className="text-gray-600 mt-2">
            Welcome to the scheduling dashboard. Select an option below to get started.
          </p>
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {navCards.map((card) => (
            <Link
              key={card.id}
              href={card.comingSoon ? '#' : card.href}
              className={`relative bg-white rounded-xl shadow-sm p-6 transition-all ${
                card.comingSoon
                  ? 'cursor-not-allowed opacity-75'
                  : 'hover:shadow-lg hover:-translate-y-1'
              }`}
              onClick={(e) => card.comingSoon && e.preventDefault()}
            >
              {/* Coming Soon Badge */}
              {card.comingSoon && (
                <span
                  className="absolute top-4 right-4 px-2 py-1 text-xs font-medium rounded-full text-white"
                  style={{ backgroundColor: colors.lightBlue }}
                >
                  Coming Soon
                </span>
              )}

              {/* Card Content */}
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
                style={{ backgroundColor: `${card.color}15` }}
              >
                <div
                  className="w-6 h-6 rounded"
                  style={{ backgroundColor: card.color }}
                />
              </div>

              <h2
                className="text-xl font-semibold mb-2"
                style={{ color: card.color }}
              >
                {card.title}
              </h2>

              <p className="text-gray-600 text-sm">
                {card.description}
              </p>

              {/* Arrow indicator */}
              {!card.comingSoon && (
                <div
                  className="absolute bottom-4 right-4 text-lg"
                  style={{ color: card.color }}
                >
                  →
                </div>
              )}
            </Link>
          ))}
        </div>

        {/* Quick Links */}
        <div className="mt-8 p-6 bg-white rounded-xl shadow-sm">
          <h3 className="text-lg font-semibold mb-4" style={{ color: colors.primaryBlue }}>
            Quick Links
          </h3>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/providers"
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-gray-100"
              style={{ color: colors.primaryBlue, border: `1px solid ${colors.border}` }}
            >
              Provider Directory
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
