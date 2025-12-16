'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Provider } from '@/lib/types';

// Mount Sinai Colors
const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  lightGray: '#F5F5F5',
  border: '#E5E7EB',
};

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProviders() {
      const { data, error } = await supabase
        .from('providers')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching providers:', error);
      } else {
        setProviders(data || []);
      }
      setLoading(false);
    }

    fetchProviders();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading providers...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header
        className="py-6 px-4 shadow-sm"
        style={{ backgroundColor: colors.primaryBlue }}
      >
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            MSW Heart Cardiology Provider Directory
          </h1>
          <p className="text-blue-100 mt-1">
            Mount Sinai West - Fuster Heart Hospital
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Bar */}
        <div className="mb-6 flex items-center gap-4">
          <span
            className="px-3 py-1 rounded-full text-sm font-medium text-white"
            style={{ backgroundColor: colors.teal }}
          >
            {providers.length} Providers
          </span>
          <span className="text-gray-500 text-sm">
            Click on a provider to view their schedule
          </span>
        </div>

        {/* Provider Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {providers.map((provider) => (
            <Link
              key={provider.id}
              href={`/providers/${provider.initials}`}
              className="block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              style={{
                borderColor: colors.border,
              }}
            >
              {/* Card Header with Initials */}
              <div
                className="px-4 py-3 flex items-center justify-between"
                style={{ backgroundColor: colors.lightBlue }}
              >
                <span className="text-white font-bold text-xl">
                  {provider.initials}
                </span>
                <span
                  className="px-2 py-0.5 rounded text-xs font-medium text-white"
                  style={{ backgroundColor: colors.teal }}
                >
                  {provider.role === 'fellow' ? 'Fellow' : 'MD'}
                </span>
              </div>

              {/* Card Body */}
              <div className="px-4 py-3">
                <h2
                  className="font-semibold text-lg mb-2"
                  style={{ color: colors.primaryBlue }}
                >
                  {provider.name}
                </h2>

                {/* Room Count */}
                {provider.default_room_count > 0 && (
                  <div className="text-sm text-gray-600 mb-2">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        backgroundColor: `${colors.teal}15`,
                        color: colors.teal
                      }}
                    >
                      {provider.default_room_count} room{provider.default_room_count > 1 ? 's' : ''}
                    </span>
                  </div>
                )}

                {/* Capabilities Preview */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {provider.capabilities.slice(0, 3).map((cap) => (
                    <span
                      key={cap}
                      className="px-2 py-0.5 rounded-full text-xs"
                      style={{
                        backgroundColor: '#E6F2FF',
                        color: colors.primaryBlue
                      }}
                    >
                      {cap}
                    </span>
                  ))}
                  {provider.capabilities.length > 3 && (
                    <span className="px-2 py-0.5 text-xs text-gray-400">
                      +{provider.capabilities.length - 3} more
                    </span>
                  )}
                </div>
              </div>

              {/* Card Footer */}
              <div
                className="px-4 py-2 text-xs text-right"
                style={{
                  backgroundColor: colors.lightGray,
                  color: colors.lightBlue
                }}
              >
                View Schedule →
              </div>
            </Link>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 px-4 border-t border-gray-200 mt-8">
        <div className="max-w-7xl mx-auto text-center text-sm text-gray-500">
          <Link href="/" className="hover:underline" style={{ color: colors.lightBlue }}>
            ← Back to Main Calendar
          </Link>
        </div>
      </footer>
    </div>
  );
}
