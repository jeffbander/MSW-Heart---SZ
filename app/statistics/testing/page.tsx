'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import StatisticsNav from '@/app/components/statistics/StatisticsNav';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  lightGray: '#F5F5F5',
};

type ComparisonMode = 'vs_prior_month' | 'vs_same_year_ago' | 'vs_ytd_prior_year';

interface DeptStats {
  completed: number;
  noShows: number;
  lateCancels: number;
  totalScheduled: number;
  noShowRate: number;
  lateCancelRate: number;
  visitTypes: Record<string, number>;
}

interface YearComparison {
  year: number;
  data: Record<string, DeptStats>;
}

interface OverviewData {
  departments: Record<string, DeptStats>;
  comparison: Record<string, DeptStats> | null;
  comparisons?: YearComparison[];
  comparisonLabel?: string;
}

interface ProviderOrderCount {
  name: string;
  count: number;
  isInternal: boolean;
}

interface DeptOrders {
  department: string;
  totalOrders: number;
  internalProviders: ProviderOrderCount[];
  outsideProviders: ProviderOrderCount[];
  outsideTotal: number;
}

interface ProviderReferralCount {
  name: string;
  count: number;
  isInternal: boolean;
  percentage: number;
}

interface DeptReferrals {
  department: string;
  totalStudies: number;
  internalProviders: ProviderReferralCount[];
  outsideProviders: ProviderReferralCount[];
  outsideTotal: number;
  outsidePercentage: number;
}

interface OrdersData {
  departments: DeptOrders[];
  comparison: DeptOrders[] | null;
}

interface ReferralsData {
  departments: DeptReferrals[];
  comparison: DeptReferrals[] | null;
}

function formatChange(current: number, comparison: number): { text: string; color: string } {
  const diff = current - comparison;
  if (diff === 0) return { text: '--', color: 'text-gray-400' };
  const pct = comparison > 0 ? ((diff / comparison) * 100).toFixed(1) : '--';
  const sign = diff > 0 ? '+' : '';
  const pctStr = pct !== '--' ? ` (${sign}${pct}%)` : '';
  return {
    text: `${sign}${diff.toLocaleString()}${pctStr}`,
    color: diff > 0 ? 'text-green-600' : 'text-red-600',
  };
}

const DEPT_DISPLAY_ORDER = ['CVI Echo', 'Echo Lab (4th Floor)', 'Vascular', 'Nuclear', 'EP', 'CT', 'Cardio Vein'];

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

export default function TestingAnalyticsPage() {
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('vs_prior_month');
  const [ytdYears, setYtdYears] = useState(2);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [ordersData, setOrdersData] = useState<OrdersData | null>(null);
  const [referralsData, setReferralsData] = useState<ReferralsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDeptVisitTypes, setExpandedDeptVisitTypes] = useState<Set<string>>(new Set());
  const [expandedOrdersOutside, setExpandedOrdersOutside] = useState<Set<string>>(new Set());
  const [expandedReferralsOutside, setExpandedReferralsOutside] = useState<Set<string>>(new Set());

  // Collapsible section state
  const [sectionsExpanded, setSectionsExpanded] = useState({
    volume: true,
    orders: false,
    referrals: false,
  });

  const toggleSection = (section: 'volume' | 'orders' | 'referrals') => {
    setSectionsExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  };

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

  useEffect(() => {
    if (!selectedMonth) return;
    setLoading(true);
    setError(null);
    setExpandedDeptVisitTypes(new Set());
    setExpandedOrdersOutside(new Set());
    setExpandedReferralsOutside(new Set());

    const params = new URLSearchParams({ reportMonth: selectedMonth, comparisonMode });
    if (comparisonMode === 'vs_ytd_prior_year') params.set('ytdYears', String(ytdYears));

    Promise.all([
      fetch(`/api/statistics/testing/overview?${params}`).then(r => r.json()),
      fetch(`/api/statistics/testing/orders-by-department?${params}`).then(r => r.json()),
      fetch(`/api/statistics/testing/referrals-by-department?${params}`).then(r => r.json()),
    ]).then(([overviewJson, ordersJson, referralsJson]) => {
      if (overviewJson.error) throw new Error(overviewJson.error);
      setOverview(overviewJson);
      setOrdersData(ordersJson.error ? null : ordersJson);
      setReferralsData(referralsJson.error ? null : referralsJson);
    }).catch(err => {
      setError(err.message);
      setOverview(null);
    }).finally(() => setLoading(false));
  }, [selectedMonth, comparisonMode, ytdYears]);

  const formatMonth = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  const toggleDeptExpand = (dept: string) => {
    setExpandedDeptVisitTypes(prev => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept); else next.add(dept);
      return next;
    });
  };

  const toggleOrdersOutside = (dept: string) => {
    setExpandedOrdersOutside(prev => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept); else next.add(dept);
      return next;
    });
  };

  const toggleReferralsOutside = (dept: string) => {
    setExpandedReferralsOutside(prev => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept); else next.add(dept);
      return next;
    });
  };

  // Sort departments in preferred order
  const sortedDepts = overview
    ? Object.keys(overview.departments)
        .filter(d => d !== 'Other')
        .sort((a, b) => {
          const idxA = DEPT_DISPLAY_ORDER.indexOf(a);
          const idxB = DEPT_DISPLAY_ORDER.indexOf(b);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.localeCompare(b);
        })
    : [];

  const hasComparison = !!overview?.comparison;
  const comparisons: YearComparison[] = overview?.comparisons || (overview?.comparison ? [{ year: 0, data: overview.comparison }] : []);
  const numComparisons = comparisons.length;
  const totalCompleted = sortedDepts.reduce((s, d) => s + (overview?.departments[d]?.completed || 0), 0);

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
          <h1 className="text-2xl font-bold" style={{ color: colors.primaryBlue }}>
            Testing Analytics
          </h1>
          <StatisticsNav />
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
              {availableMonths.length === 0 && <option value="">No data uploaded</option>}
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
            {comparisonMode === 'vs_ytd_prior_year' && (
              <select
                value={ytdYears}
                onChange={(e) => setYtdYears(parseInt(e.target.value))}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-blue-500"
              >
                <option value={2}>2 years</option>
                <option value={3}>3 years</option>
                <option value={4}>4 years</option>
              </select>
            )}
          </div>

          <span className="text-xs text-gray-400 ml-auto">
            {overview?.comparisonLabel || ''}
          </span>
        </div>

        {/* No data */}
        {!loading && availableMonths.length === 0 && (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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

        {loading && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-48"></div>
                {[...Array(7)].map((_, i) => (
                  <div key={i} className="h-3 bg-gray-200 rounded w-full"></div>
                ))}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 rounded-xl shadow-sm p-6 text-center text-red-600 text-sm">
            {error}
          </div>
        )}

        {overview && !loading && (
          <div className="space-y-6">
            {/* Period heading */}
            <h2 className="text-base font-medium text-gray-600">
              {overview.comparisonLabel
                ? overview.comparisonLabel
                : comparisonMode === 'vs_ytd_prior_year'
                  ? `YTD through ${formatMonth(selectedMonth)}`
                  : formatMonth(selectedMonth)}
            </h2>

            {/* Department Summary KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {sortedDepts.map(dept => {
                const stats = overview.departments[dept];
                const compStats = overview.comparison?.[dept];
                const change = compStats ? formatChange(stats.completed, compStats.completed) : null;
                return (
                  <div
                    key={dept}
                    className="bg-white rounded-xl shadow-sm p-3"
                    style={{ borderTop: '3px solid #00A3AD' }}
                  >
                    <p className="text-xs text-gray-500 font-medium truncate">{dept}</p>
                    <p className="text-xl font-bold mt-1" style={{ color: colors.primaryBlue }}>
                      {stats.completed.toLocaleString()}
                    </p>
                    {change && change.text !== '--' && (
                      <p className={`text-xs font-medium ${change.color}`}>{change.text}</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Section 1: Testing Volume by Department — Collapsible */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <button
                onClick={() => toggleSection('volume')}
                className="w-full px-5 py-4 border-b flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <h3
                  className="text-base font-semibold pl-4"
                  style={{ color: colors.primaryBlue, borderLeft: '4px solid #00A3AD' }}
                >
                  Testing Volume by Department
                </h3>
                <div className="flex items-center gap-3">
                  {!sectionsExpanded.volume && (
                    <span className="text-sm text-gray-400">
                      {sortedDepts.length} departments &middot; {totalCompleted.toLocaleString()} completed
                    </span>
                  )}
                  <ChevronIcon expanded={sectionsExpanded.volume} />
                </div>
              </button>
              {sectionsExpanded.volume && (
                <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', fontSize: '0.875rem', border: '1px solid #d1d5db' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '10px 12px', textAlign: 'left', backgroundColor: '#003D7A', color: 'white', fontWeight: 600, borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>Department</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', backgroundColor: '#003D7A', color: 'white', fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.2)', borderBottom: '1px solid #e5e7eb' }}>Completed</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', backgroundColor: '#003D7A', color: 'white', fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.2)', borderBottom: '1px solid #e5e7eb' }}>% of Total</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', backgroundColor: '#003D7A', color: 'white', fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.2)', borderBottom: '1px solid #e5e7eb' }}>No Show %</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', backgroundColor: '#003D7A', color: 'white', fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.2)', borderBottom: '1px solid #e5e7eb' }}>Late Cancel %</th>
                      {hasComparison && comparisons.map((c, i) => (
                        <th key={i} style={{ padding: '10px 12px', textAlign: 'right', backgroundColor: '#003D7A', color: 'white', fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.2)', borderBottom: '1px solid #e5e7eb' }}>
                          {c.year ? `vs ${c.year}` : 'Change'}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedDepts.map((dept, deptIdx) => {
                      const stats = overview.departments[dept];
                      const isExpanded = expandedDeptVisitTypes.has(dept);
                      const visitTypeEntries = Object.entries(stats.visitTypes).sort(([, a], [, b]) => b - a);
                      const rowBg = deptIdx % 2 === 1 ? '#fafafa' : 'white';
                      const cellBase: React.CSSProperties = { padding: '8px 12px', borderBottom: '1px solid #e5e7eb', fontVariantNumeric: 'tabular-nums', fontSize: '0.875rem' };

                      return (
                        <React.Fragment key={dept}>
                          <tr style={{ backgroundColor: rowBg, cursor: 'pointer' }} onClick={() => toggleDeptExpand(dept)}>
                            <td style={{ ...cellBase, fontWeight: 500, color: '#111827', borderRight: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                              <span className="flex items-center gap-2">
                                <ChevronIcon expanded={isExpanded} />
                                {dept}
                              </span>
                            </td>
                            <td style={{ ...cellBase, textAlign: 'right', color: '#374151' }}>{stats.completed.toLocaleString()}</td>
                            <td style={{ ...cellBase, textAlign: 'right', color: '#6b7280' }}>
                              {totalCompleted > 0 ? `${((stats.completed / totalCompleted) * 100).toFixed(1)}%` : '--'}
                            </td>
                            <td style={{ ...cellBase, textAlign: 'right', color: '#6b7280' }}>{stats.noShowRate}%</td>
                            <td style={{ ...cellBase, textAlign: 'right', color: '#6b7280' }}>{stats.lateCancelRate}%</td>
                            {hasComparison && comparisons.map((c, ci) => {
                              const cs = c.data[dept];
                              const chg = formatChange(stats.completed, cs?.completed || 0);
                              const color = chg.color === 'text-green-600' ? '#16a34a' : chg.color === 'text-red-600' ? '#dc2626' : '#9ca3af';
                              return (
                                <td key={ci} style={{ ...cellBase, textAlign: 'right', fontWeight: 500, color }}>
                                  {chg.text}
                                </td>
                              );
                            })}
                          </tr>
                          {isExpanded && visitTypeEntries.map(vt => (
                            <tr key={vt[0]} style={{ backgroundColor: '#f9fafb' }}>
                              <td style={{ padding: '6px 12px 6px 44px', fontWeight: 400, color: '#6b7280', fontSize: '0.8rem', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                                {vt[0]}
                              </td>
                              <td style={{ ...cellBase, textAlign: 'right', color: '#6b7280', fontSize: '0.8rem' }}>{vt[1].toLocaleString()}</td>
                              <td style={{ ...cellBase, textAlign: 'right', color: '#9ca3af', fontSize: '0.8rem' }}>
                                {stats.completed > 0 ? `${((vt[1] / stats.completed) * 100).toFixed(1)}%` : '--'}
                              </td>
                              <td style={{ ...cellBase }}></td>
                              <td style={{ ...cellBase }}></td>
                              {hasComparison && comparisons.map((_, ci) => <td key={ci} style={{ ...cellBase }}></td>)}
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                    <tr style={{ backgroundColor: '#f3f4f6', borderTop: '2px solid #9ca3af' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#111827', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #d1d5db' }}>TOTAL</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #d1d5db' }}>{totalCompleted.toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#6b7280', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #d1d5db' }}>100%</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #d1d5db' }}></td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #d1d5db' }}></td>
                      {hasComparison && comparisons.map((c, ci) => {
                        const compTotal = sortedDepts.reduce((s, d) => s + (c.data[d]?.completed || 0), 0);
                        const chg = formatChange(totalCompleted, compTotal);
                        const color = chg.color === 'text-green-600' ? '#16a34a' : chg.color === 'text-red-600' ? '#dc2626' : '#9ca3af';
                        return (
                          <td key={ci} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #d1d5db' }}>
                            {chg.text}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            {/* Section 2: Orders Into Department — Collapsible */}
            {ordersData && ordersData.departments && ordersData.departments.length > 0 && (
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <button
                  onClick={() => toggleSection('orders')}
                  className="w-full px-5 py-4 border-b flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <h3
                      className="text-base font-semibold pl-4"
                      style={{ color: colors.primaryBlue, borderLeft: '4px solid #0078C8' }}
                    >
                      Orders Into Department
                    </h3>
                    <p className="text-xs text-gray-400 mt-1 pl-4 ml-1">Which providers ordered tests going to each testing department</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {!sectionsExpanded.orders && (
                      <span className="text-sm text-gray-400">
                        {ordersData.departments.length} departments
                      </span>
                    )}
                    <ChevronIcon expanded={sectionsExpanded.orders} />
                  </div>
                </button>
                {sectionsExpanded.orders && (
                  <div className="divide-y divide-gray-200">
                    {ordersData.departments.map(dept => {
                      const compDept = ordersData.comparison?.find(d => d.department === dept.department);
                      const outsideExpanded = expandedOrdersOutside.has(dept.department);

                      return (
                        <div key={dept.department} className="px-5 py-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold" style={{ color: colors.lightBlue }}>
                              {dept.department}
                            </h4>
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-gray-500">
                                {dept.totalOrders.toLocaleString()} total orders
                              </span>
                              {hasComparison && compDept && (
                                <span className={`text-xs font-medium ${formatChange(dept.totalOrders, compDept.totalOrders).color}`}>
                                  {formatChange(dept.totalOrders, compDept.totalOrders).text}
                                </span>
                              )}
                            </div>
                          </div>
                          {dept.totalOrders === 0 ? (
                            <p className="text-sm text-gray-400 italic">No orders data for this period</p>
                          ) : (
                          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', fontSize: '0.875rem', border: '1px solid #d1d5db' }}>
                            <thead>
                              <tr>
                                <th style={{ padding: '8px 12px', textAlign: 'left', backgroundColor: '#003D7A', color: 'white', fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.2)', borderBottom: '1px solid #e5e7eb' }}>Provider</th>
                                <th style={{ padding: '8px 12px', textAlign: 'right', backgroundColor: '#003D7A', color: 'white', fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.2)', borderBottom: '1px solid #e5e7eb' }}>Orders</th>
                                <th style={{ padding: '8px 12px', textAlign: 'right', backgroundColor: '#003D7A', color: 'white', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>% of Dept</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dept.internalProviders.map((p, i) => (
                                <tr key={p.name} style={{ backgroundColor: i % 2 === 1 ? '#fafafa' : 'white' }}>
                                  <td style={{ padding: '6px 12px', color: '#111827', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>{p.name}</td>
                                  <td style={{ padding: '6px 12px', textAlign: 'right', color: '#374151', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #e5e7eb' }}>{p.count.toLocaleString()}</td>
                                  <td style={{ padding: '6px 12px', textAlign: 'right', color: '#6b7280', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #e5e7eb' }}>
                                    {dept.totalOrders > 0 ? `${((p.count / dept.totalOrders) * 100).toFixed(1)}%` : '--'}
                                  </td>
                                </tr>
                              ))}
                              {dept.outsideTotal > 0 && (
                                <React.Fragment>
                                  <tr style={{ backgroundColor: '#fffbeb', cursor: 'pointer' }} onClick={() => toggleOrdersOutside(dept.department)}>
                                    <td style={{ padding: '6px 12px', fontWeight: 500, color: '#374151', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
                                      <span className="flex items-center gap-2">
                                        <ChevronIcon expanded={outsideExpanded} />
                                        Outside Providers
                                      </span>
                                    </td>
                                    <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 500, color: '#374151', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #e5e7eb' }}>{dept.outsideTotal.toLocaleString()}</td>
                                    <td style={{ padding: '6px 12px', textAlign: 'right', color: '#6b7280', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #e5e7eb' }}>
                                      {dept.totalOrders > 0 ? `${((dept.outsideTotal / dept.totalOrders) * 100).toFixed(1)}%` : '--'}
                                    </td>
                                  </tr>
                                  {outsideExpanded && dept.outsideProviders.map(p => (
                                    <tr key={p.name} style={{ backgroundColor: '#fef3c7' }}>
                                      <td style={{ padding: '4px 12px 4px 32px', fontSize: '0.8rem', color: '#6b7280', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>{p.name}</td>
                                      <td style={{ padding: '4px 12px', textAlign: 'right', fontSize: '0.8rem', color: '#6b7280', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #e5e7eb' }}>{p.count.toLocaleString()}</td>
                                      <td style={{ padding: '4px 12px', textAlign: 'right', fontSize: '0.8rem', color: '#9ca3af', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #e5e7eb' }}>
                                        {dept.totalOrders > 0 ? `${((p.count / dept.totalOrders) * 100).toFixed(1)}%` : '--'}
                                      </td>
                                    </tr>
                                  ))}
                                </React.Fragment>
                              )}
                            </tbody>
                          </table>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Section 3: Referrals on Completed Studies — Collapsible */}
            {referralsData && referralsData.departments && referralsData.departments.length > 0 && (
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <button
                  onClick={() => toggleSection('referrals')}
                  className="w-full px-5 py-4 border-b flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <h3
                      className="text-base font-semibold pl-4"
                      style={{ color: colors.primaryBlue, borderLeft: '4px solid #7C3AED' }}
                    >
                      Referrals on Completed Studies
                    </h3>
                    <p className="text-xs text-gray-400 mt-1 pl-4 ml-1">Of all completed tests, who was the referring provider?</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {!sectionsExpanded.referrals && (
                      <span className="text-sm text-gray-400">
                        {referralsData.departments.length} departments
                      </span>
                    )}
                    <ChevronIcon expanded={sectionsExpanded.referrals} />
                  </div>
                </button>
                {sectionsExpanded.referrals && (
                  <div className="divide-y divide-gray-200">
                    {referralsData.departments.map(dept => {
                      const outsideExpanded = expandedReferralsOutside.has(dept.department);

                      return (
                        <div key={dept.department} className="px-5 py-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold" style={{ color: colors.lightBlue }}>
                              {dept.department}
                            </h4>
                            <span className="text-sm text-gray-500">
                              {dept.totalStudies.toLocaleString()} completed studies
                            </span>
                          </div>
                          {dept.internalProviders.length === 0 && dept.outsideTotal === 0 ? (
                            <p className="text-sm text-gray-400 italic">No referral data for this period</p>
                          ) : (
                          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', fontSize: '0.875rem', border: '1px solid #d1d5db' }}>
                            <thead>
                              <tr>
                                <th style={{ padding: '8px 12px', textAlign: 'left', backgroundColor: '#003D7A', color: 'white', fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.2)', borderBottom: '1px solid #e5e7eb' }}>Referring Provider</th>
                                <th style={{ padding: '8px 12px', textAlign: 'right', backgroundColor: '#003D7A', color: 'white', fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.2)', borderBottom: '1px solid #e5e7eb' }}>Referrals</th>
                                <th style={{ padding: '8px 12px', textAlign: 'right', backgroundColor: '#003D7A', color: 'white', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>% of Dept</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dept.internalProviders.map((p, i) => (
                                <tr key={p.name} style={{ backgroundColor: i % 2 === 1 ? '#fafafa' : 'white' }}>
                                  <td style={{ padding: '6px 12px', color: '#111827', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>{p.name}</td>
                                  <td style={{ padding: '6px 12px', textAlign: 'right', color: '#374151', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #e5e7eb' }}>
                                    {p.count.toLocaleString()} of {dept.totalStudies.toLocaleString()}
                                  </td>
                                  <td style={{ padding: '6px 12px', textAlign: 'right', color: colors.teal, fontVariantNumeric: 'tabular-nums', fontWeight: 500, borderBottom: '1px solid #e5e7eb' }}>
                                    {p.percentage}%
                                  </td>
                                </tr>
                              ))}
                              {dept.outsideTotal > 0 && (
                                <React.Fragment>
                                  <tr style={{ backgroundColor: '#fffbeb', cursor: 'pointer' }} onClick={() => toggleReferralsOutside(dept.department)}>
                                    <td style={{ padding: '6px 12px', fontWeight: 500, color: '#374151', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
                                      <span className="flex items-center gap-2">
                                        <ChevronIcon expanded={outsideExpanded} />
                                        Outside Providers
                                      </span>
                                    </td>
                                    <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 500, color: '#374151', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #e5e7eb' }}>
                                      {dept.outsideTotal.toLocaleString()} of {dept.totalStudies.toLocaleString()}
                                    </td>
                                    <td style={{ padding: '6px 12px', textAlign: 'right', color: colors.teal, fontVariantNumeric: 'tabular-nums', fontWeight: 500, borderBottom: '1px solid #e5e7eb' }}>
                                      {dept.outsidePercentage}%
                                    </td>
                                  </tr>
                                  {outsideExpanded && dept.outsideProviders.map(p => (
                                    <tr key={p.name} style={{ backgroundColor: '#fef3c7' }}>
                                      <td style={{ padding: '4px 12px 4px 32px', fontSize: '0.8rem', color: '#6b7280', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>{p.name}</td>
                                      <td style={{ padding: '4px 12px', textAlign: 'right', fontSize: '0.8rem', color: '#6b7280', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #e5e7eb' }}>
                                        {p.count.toLocaleString()} of {dept.totalStudies.toLocaleString()}
                                      </td>
                                      <td style={{ padding: '4px 12px', textAlign: 'right', fontSize: '0.8rem', color: '#9ca3af', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #e5e7eb' }}>
                                        {p.percentage}%
                                      </td>
                                    </tr>
                                  ))}
                                </React.Fragment>
                              )}
                            </tbody>
                          </table>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
