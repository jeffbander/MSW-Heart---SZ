'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import ProviderScorecard from '@/app/components/statistics/ProviderScorecard';
import ProviderComparisonTable from '@/app/components/statistics/ProviderComparisonTable';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  lightGray: '#F5F5F5',
};

type ComparisonMode = 'vs_prior_month' | 'vs_same_year_ago' | 'vs_ytd_prior_year';
type ViewMode = 'comparison' | 'single';

interface Provider {
  id: string;
  name: string;
  initials: string;
  role: string;
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('vs_prior_month');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const viewMode: ViewMode = selectedProvider === 'all' ? 'comparison' : 'single';

  useEffect(() => {
    Promise.all([
      fetch('/api/providers').then(r => r.json()),
      fetch('/api/statistics/months').then(r => r.json()),
    ]).then(([providerData, monthData]) => {
      const provs = Array.isArray(providerData) ? providerData : [];
      setProviders(provs);
      const months = (monthData.months || []) as string[];
      setAvailableMonths(months);
      if (months.length > 0 && !selectedMonth) {
        setSelectedMonth(months[0]);
      }
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const formatMonth = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: colors.lightGray }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/statistics"
            className="text-sm hover:underline mb-2 inline-block"
            style={{ color: colors.primaryBlue }}
          >
            &larr; Back to Practice Overview
          </Link>
          <h1 className="text-2xl font-bold" style={{ color: colors.primaryBlue }}>
            Provider Scorecard
          </h1>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm px-5 py-3 mb-6 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Provider:</label>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Providers</option>
              {providers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Month:</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {availableMonths.length === 0 && (
                <option value="">No data uploaded</option>
              )}
              {availableMonths.map(m => (
                <option key={m} value={m}>{formatMonth(m)}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Compare:</label>
            <select
              value={comparisonMode}
              onChange={(e) => setComparisonMode(e.target.value as ComparisonMode)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="vs_prior_month">vs Previous Month</option>
              <option value="vs_same_year_ago">vs Same Month Last Year</option>
              <option value="vs_ytd_prior_year">YTD vs Prior YTD</option>
            </select>
          </div>
        </div>

        {/* No data state */}
        {!loading && availableMonths.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <p className="text-gray-500 mb-4">No statistics data uploaded yet.</p>
            <Link
              href="/data"
              className="inline-block px-6 py-2 rounded-lg text-white font-medium"
              style={{ backgroundColor: colors.primaryBlue }}
            >
              Upload Data
            </Link>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
            Loading...
          </div>
        )}

        {/* Content */}
        {!loading && selectedMonth && availableMonths.length > 0 && (
          <>
            {viewMode === 'comparison' ? (
              <ProviderComparisonTable
                reportMonth={selectedMonth}
                comparisonMode={comparisonMode}
                onSelectProvider={(id) => setSelectedProvider(id)}
              />
            ) : (
              <ProviderScorecard
                providerId={selectedProvider}
                providerName={providers.find(p => p.id === selectedProvider)?.name || ''}
                reportMonth={selectedMonth}
                comparisonMode={comparisonMode}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
