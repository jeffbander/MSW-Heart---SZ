'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import KPICard from '@/app/components/statistics/KPICard';
import StatisticsNav from '@/app/components/statistics/StatisticsNav';
import VisitBreakdownTable from '@/app/components/statistics/VisitBreakdownTable';
import TestingVolumeSummary from '@/app/components/statistics/TestingVolumeSummary';
import PayerMixChart from '@/app/components/statistics/PayerMixChart';
import TrendChart from '@/app/components/statistics/TrendChart';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  lightGray: '#F5F5F5',
};

type ComparisonMode = 'vs_prior_month' | 'vs_same_year_ago' | 'vs_ytd_prior_year';

interface BreakdownData { total: number; seen: number }
interface DeptStats { total: number; completed: number; arrived: number; noShows: number; lateCancels: number }

interface OverviewData {
  current: {
    totalScheduled: number;
    patientsSeen: number;
    patientsSeenExclAncillary: number;
    noShows: number;
    noShowRate: number;
    lateCancelRate: number;
    newPatients: number;
    newPatientPct: number;
    visitBreakdown: Record<string, BreakdownData>;
    ancillarySubcategories: Record<string, BreakdownData>;
    testing: Record<string, DeptStats>;
    orders: Record<string, number>;
  };
  comparison: {
    totalScheduled: number;
    patientsSeen: number;
    patientsSeenExclAncillary: number;
    noShows: number;
    noShowRate: number;
    lateCancelRate: number;
    newPatients: number;
    newPatientPct: number;
    visitBreakdown: Record<string, BreakdownData>;
    ancillarySubcategories: Record<string, BreakdownData>;
    testing: Record<string, DeptStats>;
    orders: Record<string, number>;
  } | null;
  reportMonth: string;
  comparisonMonth: string | null;
  comparisonMode: string;
  comparisonLabel?: string;
}

export default function StatisticsPage() {
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('vs_prior_month');
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch available months from actual data
  useEffect(() => {
    fetch('/api/statistics/months')
      .then(r => r.json())
      .then(json => {
        const months = (json.months || []) as string[];
        setAvailableMonths(months);
        if (months.length > 0 && !selectedMonth) {
          setSelectedMonth(months[0]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fetchOverview = useCallback(async () => {
    if (!selectedMonth) return;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        reportMonth: selectedMonth,
        comparisonMode,
      });
      const res = await fetch(`/api/statistics/overview?${params}`);
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || 'Failed to fetch overview');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, comparisonMode]);

  useEffect(() => {
    if (selectedMonth) fetchOverview();
  }, [fetchOverview, selectedMonth]);

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
            href="/dashboard"
            className="text-sm hover:underline mb-2 inline-block"
            style={{ color: colors.primaryBlue }}
          >
            &larr; Back to Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold" style={{ color: colors.primaryBlue }}>
              Practice Overview
            </h1>
          </div>
          <div className="mt-4">
            <StatisticsNav />
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm px-5 py-3 mb-6 flex items-center gap-4 flex-wrap">
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

          <span className="text-xs text-gray-400 ml-auto">
            {data?.comparisonLabel
              ? data.comparisonLabel
              : data?.comparisonMonth
                ? `Comparing to ${formatMonth(data.comparisonMonth)}`
                : ''}
          </span>
        </div>

        {/* No data state */}
        {!loading && availableMonths.length === 0 && (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
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

        {/* Loading state */}
        {loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm p-5 min-h-[120px]">
                  <div className="animate-pulse">
                    <div className="h-3 bg-gray-200 rounded w-24 mb-3"></div>
                    <div className="h-8 bg-gray-200 rounded w-16"></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-48"></div>
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-3 bg-gray-200 rounded w-full"></div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-red-50 rounded-xl shadow-sm p-6 text-center text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Dashboard content */}
        {data && !loading && (
          <div className="space-y-6">
            {/* Month display */}
            {selectedMonth && (
              <h2 className="text-base font-medium text-gray-600">
                {comparisonMode === 'vs_ytd_prior_year'
                  ? `YTD through ${formatMonth(selectedMonth)}`
                  : formatMonth(selectedMonth)}
              </h2>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <KPICard
                title="Total Patients Seen"
                value={data.current.patientsSeenExclAncillary}
                comparison={data.comparison
                  ? data.current.patientsSeenExclAncillary - data.comparison.patientsSeenExclAncillary
                  : null}
                accentColor="#003D7A"
              />
              <KPICard
                title="New Patient %"
                value={`${data.current.newPatientPct}%`}
                comparison={data.comparison
                  ? data.current.newPatientPct - data.comparison.newPatientPct
                  : null}
                isPercentage
                accentColor="#0078C8"
              />
              <KPICard
                title="No Show Rate"
                value={`${data.current.noShowRate}%`}
                comparison={data.comparison ? data.comparison.noShowRate - data.current.noShowRate : null}
                isPercentage
                accentColor="#DC2626"
              />
              <KPICard
                title="Late Cancel Rate"
                value={`${data.current.lateCancelRate}%`}
                comparison={data.comparison ? data.comparison.lateCancelRate - data.current.lateCancelRate : null}
                isPercentage
                accentColor="#D97706"
              />
              <KPICard
                title="Total Scheduled"
                value={data.current.totalScheduled}
                comparison={data.comparison ? data.current.totalScheduled - data.comparison.totalScheduled : null}
                accentColor="#00A3AD"
              />
            </div>

            {/* Visit Breakdown Table */}
            <VisitBreakdownTable
              current={data.current.visitBreakdown}
              comparison={data.comparison?.visitBreakdown}
              ancillaryCurrent={data.current.ancillarySubcategories}
              ancillaryComparison={data.comparison?.ancillarySubcategories}
            />

            {/* Testing Volume */}
            <TestingVolumeSummary
              current={data.current.testing}
              comparison={data.comparison?.testing}
            />

            {/* Orders Summary */}
            {Object.keys(data.current.orders).length > 0 && (
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="px-5 py-4 border-b pl-4" style={{ borderLeft: '4px solid #0078C8' }}>
                  <h3 className="text-base font-semibold" style={{ color: colors.primaryBlue }}>Orders by Category</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-px bg-gray-100">
                  {Object.entries(data.current.orders)
                    .sort(([, a], [, b]) => b - a)
                    .map(([category, count]) => {
                      const compCount = data.comparison?.orders?.[category] || 0;
                      const diff = data.comparison ? count - compCount : null;
                      return (
                        <div key={category} className="bg-white p-4">
                          <p className="text-xs text-gray-500 mb-1">{category}</p>
                          <p className="text-lg font-bold" style={{ color: colors.primaryBlue }}>{count.toLocaleString()}</p>
                          {diff !== null && diff !== 0 && (
                            <p className={`text-xs font-medium ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {diff > 0 ? '+' : ''}{diff.toLocaleString()}
                            </p>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Payer Mix + Trend Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PayerMixChart month={selectedMonth} comparisonMode={comparisonMode} />
              <TrendChart />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
