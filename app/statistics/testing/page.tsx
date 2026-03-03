'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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

interface OverviewData {
  departments: Record<string, DeptStats>;
  comparison: Record<string, DeptStats> | null;
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

export default function TestingAnalyticsPage() {
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('vs_prior_month');
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [ordersData, setOrdersData] = useState<OrdersData | null>(null);
  const [referralsData, setReferralsData] = useState<ReferralsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDeptVisitTypes, setExpandedDeptVisitTypes] = useState<Set<string>>(new Set());
  const [expandedOrdersOutside, setExpandedOrdersOutside] = useState<Set<string>>(new Set());
  const [expandedReferralsOutside, setExpandedReferralsOutside] = useState<Set<string>>(new Set());

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
  }, [selectedMonth, comparisonMode]);

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
  const totalCompleted = sortedDepts.reduce((s, d) => s + (overview?.departments[d]?.completed || 0), 0);

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
            Testing Analytics
          </h1>
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
          </div>

          <span className="text-xs text-gray-400 ml-auto">
            {overview?.comparisonLabel || ''}
          </span>
        </div>

        {/* No data */}
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

        {loading && (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
            Loading testing analytics...
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
            <h2 className="text-lg font-semibold" style={{ color: colors.primaryBlue }}>
              {overview.comparisonLabel
                ? overview.comparisonLabel
                : comparisonMode === 'vs_ytd_prior_year'
                  ? `YTD through ${formatMonth(selectedMonth)}`
                  : formatMonth(selectedMonth)}
            </h2>

            {/* Department KPIs Overview Table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b">
                <h3 className="text-base font-semibold" style={{ color: colors.primaryBlue }}>Testing Volume by Department</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Department</th>
                    <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Completed</th>
                    <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">% of Total</th>
                    <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">No Show %</th>
                    <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Late Cancel %</th>
                    {hasComparison && (
                      <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Change</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedDepts.map(dept => {
                    const stats = overview.departments[dept];
                    const compStats = overview.comparison?.[dept];
                    const isExpanded = expandedDeptVisitTypes.has(dept);
                    const visitTypeEntries = Object.entries(stats.visitTypes).sort(([, a], [, b]) => b - a);

                    return (
                      <tr key={dept}>
                        <td colSpan={hasComparison ? 6 : 5} className="p-0">
                          <table className="w-full">
                            <tbody>
                              <tr
                                className="cursor-pointer hover:bg-gray-50"
                                onClick={() => toggleDeptExpand(dept)}
                              >
                                <td className="px-5 py-3 text-sm font-medium text-gray-900 w-[25%]">
                                  <span className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400">{isExpanded ? '▼' : '▶'}</span>
                                    {dept}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-sm text-gray-700 text-right w-[15%]">
                                  {stats.completed.toLocaleString()}
                                </td>
                                <td className="px-5 py-3 text-sm text-gray-400 text-right w-[12%]">
                                  {totalCompleted > 0 ? `${((stats.completed / totalCompleted) * 100).toFixed(1)}%` : '--'}
                                </td>
                                <td className="px-5 py-3 text-sm text-gray-500 text-right w-[14%]">
                                  {stats.noShowRate}%
                                </td>
                                <td className="px-5 py-3 text-sm text-gray-500 text-right w-[14%]">
                                  {stats.lateCancelRate}%
                                </td>
                                {hasComparison && (
                                  <td className={`px-5 py-3 text-sm text-right font-medium w-[15%] ${formatChange(stats.completed, compStats?.completed || 0).color}`}>
                                    {formatChange(stats.completed, compStats?.completed || 0).text}
                                  </td>
                                )}
                              </tr>
                              {isExpanded && visitTypeEntries.map(([vt, count]) => (
                                <tr key={vt} className="bg-gray-50/50">
                                  <td className="pl-12 pr-5 py-2 text-sm text-gray-600 w-[25%]">{vt}</td>
                                  <td className="px-5 py-2 text-sm text-gray-500 text-right w-[15%]">{count.toLocaleString()}</td>
                                  <td className="px-5 py-2 text-sm text-gray-400 text-right w-[12%]">
                                    {stats.completed > 0 ? `${((count / stats.completed) * 100).toFixed(1)}%` : '--'}
                                  </td>
                                  <td className="px-5 py-2 w-[14%]"></td>
                                  <td className="px-5 py-2 w-[14%]"></td>
                                  {hasComparison && <td className="px-5 py-2 w-[15%]"></td>}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Totals row */}
                  <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                    <td className="px-5 py-3 text-sm text-gray-700">Total</td>
                    <td className="px-5 py-3 text-sm text-gray-700 text-right">{totalCompleted.toLocaleString()}</td>
                    <td className="px-5 py-3 text-sm text-gray-400 text-right">100%</td>
                    <td className="px-5 py-3"></td>
                    <td className="px-5 py-3"></td>
                    {hasComparison && (() => {
                      const compTotal = sortedDepts.reduce((s, d) => s + (overview.comparison?.[d]?.completed || 0), 0);
                      return (
                        <td className={`px-5 py-3 text-sm text-right font-medium ${formatChange(totalCompleted, compTotal).color}`}>
                          {formatChange(totalCompleted, compTotal).text}
                        </td>
                      );
                    })()}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Orders Into Department */}
            {ordersData && ordersData.departments && ordersData.departments.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b">
                  <h3 className="text-base font-semibold" style={{ color: colors.primaryBlue }}>Orders Into Department</h3>
                  <p className="text-xs text-gray-400 mt-1">Which providers ordered tests going to each testing department</p>
                </div>
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
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="pb-2 text-left text-xs font-semibold text-gray-500 uppercase">Provider</th>
                              <th className="pb-2 text-right text-xs font-semibold text-gray-500 uppercase">Orders</th>
                              <th className="pb-2 text-right text-xs font-semibold text-gray-500 uppercase">% of Dept</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {dept.internalProviders.map(p => (
                              <tr key={p.name} className="hover:bg-gray-50">
                                <td className="py-2 text-sm text-gray-900">{p.name}</td>
                                <td className="py-2 text-sm text-gray-700 text-right">{p.count.toLocaleString()}</td>
                                <td className="py-2 text-sm text-gray-400 text-right">
                                  {dept.totalOrders > 0 ? `${((p.count / dept.totalOrders) * 100).toFixed(1)}%` : '--'}
                                </td>
                              </tr>
                            ))}
                            {dept.outsideTotal > 0 && (
                              <>
                                <tr
                                  className="cursor-pointer hover:bg-gray-50 bg-amber-50/50"
                                  onClick={() => toggleOrdersOutside(dept.department)}
                                >
                                  <td className="py-2 text-sm font-medium text-gray-700">
                                    <span className="flex items-center gap-2">
                                      <span className="text-xs text-gray-400">{outsideExpanded ? '▼' : '▶'}</span>
                                      Outside Providers
                                    </span>
                                  </td>
                                  <td className="py-2 text-sm text-gray-700 text-right font-medium">{dept.outsideTotal.toLocaleString()}</td>
                                  <td className="py-2 text-sm text-gray-400 text-right">
                                    {dept.totalOrders > 0 ? `${((dept.outsideTotal / dept.totalOrders) * 100).toFixed(1)}%` : '--'}
                                  </td>
                                </tr>
                                {outsideExpanded && dept.outsideProviders.map(p => (
                                  <tr key={p.name} className="bg-amber-50/30">
                                    <td className="pl-8 py-1.5 text-sm text-gray-600">{p.name}</td>
                                    <td className="py-1.5 text-sm text-gray-500 text-right">{p.count.toLocaleString()}</td>
                                    <td className="py-1.5 text-sm text-gray-400 text-right">
                                      {dept.totalOrders > 0 ? `${((p.count / dept.totalOrders) * 100).toFixed(1)}%` : '--'}
                                    </td>
                                  </tr>
                                ))}
                              </>
                            )}
                          </tbody>
                        </table>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Referrals on Completed Studies */}
            {referralsData && referralsData.departments && referralsData.departments.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b">
                  <h3 className="text-base font-semibold" style={{ color: colors.primaryBlue }}>Referrals on Completed Studies</h3>
                  <p className="text-xs text-gray-400 mt-1">Of all completed tests in each department, who was the referring provider?</p>
                </div>
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
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="pb-2 text-left text-xs font-semibold text-gray-500 uppercase">Referring Provider</th>
                              <th className="pb-2 text-right text-xs font-semibold text-gray-500 uppercase">Referrals</th>
                              <th className="pb-2 text-right text-xs font-semibold text-gray-500 uppercase">% of Dept</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {dept.internalProviders.map(p => (
                              <tr key={p.name} className="hover:bg-gray-50">
                                <td className="py-2 text-sm text-gray-900">{p.name}</td>
                                <td className="py-2 text-sm text-gray-700 text-right">
                                  {p.count.toLocaleString()} of {dept.totalStudies.toLocaleString()}
                                </td>
                                <td className="py-2 text-sm text-right" style={{ color: colors.teal }}>
                                  {p.percentage}%
                                </td>
                              </tr>
                            ))}
                            {dept.outsideTotal > 0 && (
                              <>
                                <tr
                                  className="cursor-pointer hover:bg-gray-50 bg-amber-50/50"
                                  onClick={() => toggleReferralsOutside(dept.department)}
                                >
                                  <td className="py-2 text-sm font-medium text-gray-700">
                                    <span className="flex items-center gap-2">
                                      <span className="text-xs text-gray-400">{outsideExpanded ? '▼' : '▶'}</span>
                                      Outside Providers
                                    </span>
                                  </td>
                                  <td className="py-2 text-sm text-gray-700 text-right font-medium">
                                    {dept.outsideTotal.toLocaleString()} of {dept.totalStudies.toLocaleString()}
                                  </td>
                                  <td className="py-2 text-sm text-right" style={{ color: colors.teal }}>
                                    {dept.outsidePercentage}%
                                  </td>
                                </tr>
                                {outsideExpanded && dept.outsideProviders.map(p => (
                                  <tr key={p.name} className="bg-amber-50/30">
                                    <td className="pl-8 py-1.5 text-sm text-gray-600">{p.name}</td>
                                    <td className="py-1.5 text-sm text-gray-500 text-right">
                                      {p.count.toLocaleString()} of {dept.totalStudies.toLocaleString()}
                                    </td>
                                    <td className="py-1.5 text-sm text-gray-400 text-right">
                                      {p.percentage}%
                                    </td>
                                  </tr>
                                ))}
                              </>
                            )}
                          </tbody>
                        </table>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
