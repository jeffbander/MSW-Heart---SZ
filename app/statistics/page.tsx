'use client';

import Link from 'next/link';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  lightGray: '#F5F5F5',
};

export default function StatisticsPage() {
  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: colors.lightGray }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm hover:underline mb-2 inline-block"
            style={{ color: colors.primaryBlue }}
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold" style={{ color: colors.primaryBlue }}>
            Statistics
          </h1>
        </div>

        {/* Coming Soon Card */}
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <div
            className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
            style={{ backgroundColor: `${colors.lightBlue}15` }}
          >
            <svg
              className="w-10 h-10"
              fill="none"
              stroke={colors.lightBlue}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>

          <h2 className="text-2xl font-bold mb-3" style={{ color: colors.primaryBlue }}>
            Coming Soon
          </h2>

          <p className="text-gray-600 max-w-md mx-auto">
            The Statistics dashboard will provide insights into scheduling patterns,
            provider workload distribution, PTO trends, and more.
          </p>

          <div className="mt-8">
            <Link
              href="/"
              className="inline-block px-6 py-2 rounded-lg text-white font-medium transition-colors hover:opacity-90"
              style={{ backgroundColor: colors.primaryBlue }}
            >
              Go to Schedule
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
