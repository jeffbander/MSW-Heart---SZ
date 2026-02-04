'use client';

import Link from 'next/link';

const colors = {
  primaryBlue: '#003D7A',
  green: '#059669',
  lightGray: '#F5F5F5',
};

export default function DataPage() {
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
            Data
          </h1>
        </div>

        {/* Coming Soon Card */}
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <div
            className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
            style={{ backgroundColor: `${colors.green}15` }}
          >
            <svg
              className="w-10 h-10"
              fill="none"
              stroke={colors.green}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
              />
            </svg>
          </div>

          <h2 className="text-2xl font-bold mb-3" style={{ color: colors.primaryBlue }}>
            Coming Soon
          </h2>

          <p className="text-gray-600 max-w-md mx-auto">
            The Data page will provide tools for exporting scheduling data,
            generating reports, and managing data imports.
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
