'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ProviderScorecard from '@/app/components/statistics/ProviderScorecard';
import ProviderComparisonTable from '@/app/components/statistics/ProviderComparisonTable';
import ProviderMultiMonthTable from '@/app/components/statistics/ProviderMultiMonthTable';
import StatisticsNav from '@/app/components/statistics/StatisticsNav';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  lightGray: '#F5F5F5',
};

type ComparisonMode = 'vs_prior_month' | 'vs_same_year_ago' | 'vs_ytd_prior_year';
type TabMode = 'single-month' | 'multi-month';

interface Provider {
  id: string;
  name: string;
  initials: string;
  role: string;
}

interface MultiMonthData {
  providers: any[];
  months: string[];
  priorMonths: string[];
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('vs_prior_month');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [tabMode, setTabMode] = useState<TabMode>('single-month');

  // Multi-month state
  const [multiStartMonth, setMultiStartMonth] = useState('');
  const [multiEndMonth, setMultiEndMonth] = useState('');
  const [multiData, setMultiData] = useState<MultiMonthData | null>(null);
  const [multiLoading, setMultiLoading] = useState(false);

  const viewMode = selectedProvider === 'all' ? 'comparison' : 'single';

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
        // Default multi-month to Jan through latest month of the latest year
        const latestMonth = months[0];
        const latestYear = new Date(latestMonth + 'T00:00:00').getFullYear();
        const janOfYear = `${latestYear}-01-01`;
        setMultiStartMonth(months.includes(janOfYear) ? janOfYear : months[months.length - 1]);
        setMultiEndMonth(latestMonth);
      }
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Fetch multi-month data
  useEffect(() => {
    if (tabMode !== 'multi-month' || !multiStartMonth || !multiEndMonth) return;
    setMultiLoading(true);
    const params = new URLSearchParams({ startMonth: multiStartMonth, endMonth: multiEndMonth });
    fetch(`/api/statistics/providers/multi-month?${params}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) throw new Error(json.error);
        setMultiData(json);
      })
      .catch(err => console.error(err))
      .finally(() => setMultiLoading(false));
  }, [tabMode, multiStartMonth, multiEndMonth]);

  const formatMonth = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  const formatMonthShort = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.lightGray }}>
      {/* Sticky Header + Filters */}
      <div className="sticky top-0 z-20 px-6 pt-6 pb-0" style={{ backgroundColor: colors.lightGray }}>
        <div className="max-w-7xl mx-auto">
          <div className="mb-3">
            <Link
              href="/dashboard"
              className="text-sm hover:underline mb-2 inline-block"
              style={{ color: colors.primaryBlue }}
            >
              &larr; Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold" style={{ color: colors.primaryBlue }}>
              Provider Scorecard
            </h1>
            <StatisticsNav />
          </div>

          {/* Tab toggle + Filters */}
          <div className="bg-white rounded-xl shadow-sm px-5 py-3 mb-4 flex items-center gap-4 flex-wrap">
            {/* View toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setTabMode('single-month')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${tabMode === 'single-month' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}
              >
                Single Month
              </button>
              <button
                onClick={() => setTabMode('multi-month')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${tabMode === 'multi-month' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}
              >
                Multi-Month
              </button>
            </div>

            {tabMode === 'single-month' ? (
              <>
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
              </>
            ) : (
              <>
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
                  <label className="text-sm font-medium text-gray-600">From:</label>
                  <select
                    value={multiStartMonth}
                    onChange={(e) => {
                      setMultiStartMonth(e.target.value);
                      if (e.target.value > multiEndMonth) setMultiEndMonth(e.target.value);
                    }}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {[...availableMonths].reverse().map(m => (
                      <option key={m} value={m}>{formatMonthShort(m)}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-600">Through:</label>
                  <select
                    value={multiEndMonth}
                    onChange={(e) => setMultiEndMonth(e.target.value)}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {availableMonths.filter(m => m >= multiStartMonth).map(m => (
                      <option key={m} value={m}>{formatMonthShort(m)}</option>
                    ))}
                  </select>
                </div>

                <span className="text-xs text-gray-400 ml-auto">
                  Each month compared to same month prior year
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6">

        {/* No data state */}
        {!loading && availableMonths.length === 0 && (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
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
        {(loading || (tabMode === 'multi-month' && multiLoading)) && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-48"></div>
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-3 bg-gray-200 rounded w-full"></div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Single Month Content */}
        {tabMode === 'single-month' && !loading && selectedMonth && availableMonths.length > 0 && (
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

        {/* Multi-Month Content */}
        {tabMode === 'multi-month' && !multiLoading && multiData && (
          <ProviderMultiMonthTable
            providers={multiData.providers}
            months={multiData.months}
            priorMonths={multiData.priorMonths}
            selectedProviderId={selectedProvider !== 'all' ? selectedProvider : undefined}
          />
        )}
      </div>
    </div>
  );
}
