'use client';

import { useState, useEffect } from 'react';
import KPICard from './KPICard';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
};

interface BreakdownData { total: number; seen: number }

interface ProviderData {
  current: {
    patientsSeen: number;
    patientsSeenExclAncillary: number;
    newPatients: number;
    newPatientPct: number;
    noShowRate: number;
    lateCancelRate: number;
    totalScheduled: number;
    sessionsCount: number;
    avgPatientsPerSession: number;
    visitBreakdown: Record<string, BreakdownData>;
    ancillarySubcategories: Record<string, BreakdownData>;
  };
  comparison: {
    patientsSeen: number;
    patientsSeenExclAncillary: number;
    newPatients: number;
    newPatientPct: number;
    noShowRate: number;
    lateCancelRate: number;
    totalScheduled: number;
    sessionsCount: number;
    avgPatientsPerSession: number;
    visitBreakdown: Record<string, BreakdownData>;
    ancillarySubcategories: Record<string, BreakdownData>;
  } | null;
  reportMonth: string;
  comparisonMonth: string | null;
  comparisonMode: string;
  comparisonLabel?: string;
}

interface OrderCategory {
  category: string;
  count: number;
  orders: { description: string; count: number }[];
}

interface OrdersData {
  categories: OrderCategory[];
  comparisonCategories: OrderCategory[] | null;
}

interface ReferralDept {
  department: string;
  providerReferrals: number;
  totalStudies: number;
  percentage: number;
}

interface ReferralsData {
  departments: ReferralDept[];
  comparisonDepartments: ReferralDept[] | null;
}

interface Props {
  providerId: string;
  providerName: string;
  reportMonth: string;
  comparisonMode: string;
}

const VISIT_CATEGORIES = ['New Patient', 'Follow Up', 'Leqvio', 'Research', 'Video Visit', 'Annual Well Visit', 'Ancillary'];
const ANCILLARY_SUBCATEGORIES = ['Device Check', 'EKG', 'Blood Draw', 'Event Monitor'];

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

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

export default function ProviderScorecard({ providerId, providerName, reportMonth, comparisonMode }: Props) {
  const [data, setData] = useState<ProviderData | null>(null);
  const [orders, setOrders] = useState<OrdersData | null>(null);
  const [referrals, setReferrals] = useState<ReferralsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [ancillaryExpanded, setAncillaryExpanded] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setExpandedOrders(new Set());
    setAncillaryExpanded(false);

    const params = new URLSearchParams({ reportMonth, comparisonMode });

    Promise.all([
      fetch(`/api/statistics/provider/${providerId}?${params}`).then(r => r.json()),
      fetch(`/api/statistics/provider/${providerId}/orders?${params}`).then(r => r.json()),
      fetch(`/api/statistics/provider/${providerId}/referrals?${params}`).then(r => r.json()),
    ]).then(([providerJson, ordersJson, referralsJson]) => {
      if (providerJson.error) throw new Error(providerJson.error);
      setData(providerJson);
      setOrders(ordersJson.error ? null : ordersJson);
      setReferrals(referralsJson.error ? null : referralsJson);
    }).catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [providerId, reportMonth, comparisonMode]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-md p-5 flex items-center gap-4">
          <div className="animate-pulse flex items-center gap-4 w-full">
            <div className="w-12 h-12 rounded-full bg-gray-200"></div>
            <div className="space-y-2">
              <div className="h-5 bg-gray-200 rounded w-48"></div>
              <div className="h-3 bg-gray-200 rounded w-32"></div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-5 min-h-[120px]">
              <div className="animate-pulse">
                <div className="h-3 bg-gray-200 rounded w-20 mb-3"></div>
                <div className="h-7 bg-gray-200 rounded w-14"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 rounded-xl shadow-sm p-6 text-center text-red-600 text-sm">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const { current, comparison } = data;
  const hasComparison = !!comparison;

  const formatMonth = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  const totalSeen = VISIT_CATEGORIES.reduce((sum, cat) => sum + (current.visitBreakdown[cat]?.seen || 0), 0);
  const initials = providerName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const toggleOrderExpand = (cat: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <div className="space-y-8">
      {/* Provider Header Card */}
      <div className="bg-white rounded-xl shadow-md p-5 flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
          style={{ backgroundColor: colors.primaryBlue }}
        >
          {initials}
        </div>
        <div>
          <h2 className="text-xl font-bold" style={{ color: colors.primaryBlue }}>
            {providerName}
          </h2>
          <p className="text-sm text-gray-500">
            {data.comparisonLabel || (comparisonMode === 'vs_ytd_prior_year'
              ? `YTD through ${formatMonth(reportMonth)}`
              : formatMonth(reportMonth))}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard
          title="Patients Seen"
          value={current.patientsSeenExclAncillary}
          comparison={hasComparison ? current.patientsSeenExclAncillary - comparison.patientsSeenExclAncillary : null}
          accentColor="#003D7A"
        />
        <KPICard
          title="New Patient %"
          value={`${current.newPatientPct}%`}
          comparison={hasComparison ? current.newPatientPct - comparison.newPatientPct : null}
          isPercentage
          accentColor="#0078C8"
        />
        <KPICard
          title="No Show Rate"
          value={`${current.noShowRate}%`}
          comparison={hasComparison ? comparison.noShowRate - current.noShowRate : null}
          isPercentage
          accentColor="#DC2626"
        />
        <KPICard
          title="Late Cancel Rate"
          value={`${current.lateCancelRate}%`}
          comparison={hasComparison ? comparison.lateCancelRate - current.lateCancelRate : null}
          isPercentage
          accentColor="#D97706"
        />
        <KPICard
          title="Sessions"
          value={current.sessionsCount}
          comparison={hasComparison ? current.sessionsCount - comparison.sessionsCount : null}
          accentColor="#00A3AD"
        />
        <KPICard
          title="Pts / Session"
          value={current.avgPatientsPerSession}
          comparison={hasComparison ? Number((current.avgPatientsPerSession - comparison.avgPatientsPerSession).toFixed(1)) : null}
          accentColor="#059669"
        />
      </div>

      {/* Visit Breakdown */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h3
            className="text-base font-semibold pl-4"
            style={{ color: colors.primaryBlue, borderLeft: '4px solid #003D7A' }}
          >
            Office Visit Breakdown
          </h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Visit Type</th>
              <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Patients Seen</th>
              <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">% of Total</th>
              {hasComparison && (
                <>
                  <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Comparison</th>
                  <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Change</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {VISIT_CATEGORIES.map((cat, catIdx) => {
              const cur = current.visitBreakdown[cat] || { total: 0, seen: 0 };
              const comp = comparison?.visitBreakdown[cat] || { total: 0, seen: 0 };
              const isAncillary = cat === 'Ancillary';

              return (
                <tr key={cat}>
                  <td colSpan={hasComparison ? 5 : 3} className="p-0">
                    <table className="w-full">
                      <tbody>
                        <tr
                          className={`transition-colors duration-150 ${
                            isAncillary
                              ? 'bg-blue-50 cursor-pointer hover:bg-blue-100'
                              : `hover:bg-gray-50 ${catIdx % 2 === 1 ? 'bg-gray-50/50' : ''}`
                          }`}
                          onClick={isAncillary ? () => setAncillaryExpanded(!ancillaryExpanded) : undefined}
                        >
                          <td className="px-5 py-3 text-sm font-medium text-gray-900 w-[30%]">
                            <span className="flex items-center gap-2">
                              {isAncillary && <ChevronIcon expanded={ancillaryExpanded} />}
                              {cat}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-sm text-gray-700 text-right w-[20%]">
                            {cur.seen.toLocaleString()}
                          </td>
                          <td className="px-5 py-3 text-sm text-gray-400 text-right w-[15%]">
                            {totalSeen > 0 ? `${((cur.seen / totalSeen) * 100).toFixed(1)}%` : '--'}
                          </td>
                          {hasComparison && (
                            <>
                              <td className="px-5 py-3 text-sm text-gray-500 text-right w-[17%]">
                                {comp.seen.toLocaleString()}
                              </td>
                              <td className={`px-5 py-3 text-sm text-right font-medium w-[18%] ${formatChange(cur.seen, comp.seen).color}`}>
                                {formatChange(cur.seen, comp.seen).text}
                              </td>
                            </>
                          )}
                        </tr>

                        {isAncillary && ancillaryExpanded && current.ancillarySubcategories && (
                          <>
                            {ANCILLARY_SUBCATEGORIES.map(sub => {
                              const subCur = current.ancillarySubcategories[sub] || { total: 0, seen: 0 };
                              const subComp = comparison?.ancillarySubcategories[sub] || { total: 0, seen: 0 };
                              return (
                                <tr key={sub} className="bg-blue-50/50 border-l-2 border-[#003D7A]/20">
                                  <td className="pl-12 pr-5 py-2 text-sm text-gray-600 w-[30%]">{sub}</td>
                                  <td className="px-5 py-2 text-sm text-gray-600 text-right w-[20%]">
                                    {subCur.seen.toLocaleString()}
                                  </td>
                                  <td className="px-5 py-2 text-sm text-gray-400 text-right w-[15%]">
                                    {totalSeen > 0 ? `${((subCur.seen / totalSeen) * 100).toFixed(1)}%` : '--'}
                                  </td>
                                  {hasComparison && (
                                    <>
                                      <td className="px-5 py-2 text-sm text-gray-400 text-right w-[17%]">
                                        {subComp.seen.toLocaleString()}
                                      </td>
                                      <td className={`px-5 py-2 text-sm text-right font-medium w-[18%] ${formatChange(subCur.seen, subComp.seen).color}`}>
                                        {formatChange(subCur.seen, subComp.seen).text}
                                      </td>
                                    </>
                                  )}
                                </tr>
                              );
                            })}
                          </>
                        )}
                      </tbody>
                    </table>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Orders by Category */}
      {orders && orders.categories && orders.categories.length > 0 && (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h3
              className="text-base font-semibold pl-4"
              style={{ color: colors.primaryBlue, borderLeft: '4px solid #0078C8' }}
            >
              Orders by Category
            </h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Count</th>
                {orders.comparisonCategories && (
                  <>
                    <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Comparison</th>
                    <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Change</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.categories.map((cat, catIdx) => {
                const compCat = orders.comparisonCategories?.find(c => c.category === cat.category);
                const isExpanded = expandedOrders.has(cat.category);
                return (
                  <tr key={cat.category}>
                    <td colSpan={orders.comparisonCategories ? 4 : 2} className="p-0">
                      <table className="w-full">
                        <tbody>
                          <tr
                            className={`cursor-pointer hover:bg-gray-50 transition-colors duration-150 ${catIdx % 2 === 1 ? 'bg-gray-50/50' : ''}`}
                            onClick={() => toggleOrderExpand(cat.category)}
                          >
                            <td className="px-5 py-3 text-sm font-medium text-gray-900 w-[40%]">
                              <span className="flex items-center gap-2">
                                <ChevronIcon expanded={isExpanded} />
                                {cat.category}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-sm text-gray-700 text-right w-[20%]">
                              {cat.count.toLocaleString()}
                            </td>
                            {orders.comparisonCategories && (
                              <>
                                <td className="px-5 py-3 text-sm text-gray-500 text-right w-[20%]">
                                  {(compCat?.count || 0).toLocaleString()}
                                </td>
                                <td className={`px-5 py-3 text-sm text-right font-medium w-[20%] ${formatChange(cat.count, compCat?.count || 0).color}`}>
                                  {formatChange(cat.count, compCat?.count || 0).text}
                                </td>
                              </>
                            )}
                          </tr>

                          {isExpanded && cat.orders.map(order => (
                            <tr key={order.description} className="bg-gray-50/50 border-l-2 border-[#0078C8]/20">
                              <td className="pl-14 pr-5 py-2 text-sm text-gray-600 w-[40%]">{order.description}</td>
                              <td className="px-5 py-2 text-sm text-gray-500 text-right w-[20%]">{order.count.toLocaleString()}</td>
                              {orders.comparisonCategories && (
                                <>
                                  <td className="px-5 py-2 text-sm text-gray-400 text-right w-[20%]"></td>
                                  <td className="px-5 py-2 text-sm text-right w-[20%]"></td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Referrals on Completed Studies */}
      {referrals && referrals.departments && referrals.departments.length > 0 && (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h3
              className="text-base font-semibold pl-4"
              style={{ color: colors.primaryBlue, borderLeft: '4px solid #7C3AED' }}
            >
              Referrals on Completed Studies
            </h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Provider Referrals</th>
                <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Studies</th>
                <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">% of Dept</th>
                {referrals.comparisonDepartments && (
                  <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Change</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {referrals.departments.map((dept, idx) => {
                const compDept = referrals.comparisonDepartments?.find(d => d.department === dept.department);
                return (
                  <tr key={dept.department} className={`hover:bg-gray-50 transition-colors duration-150 ${idx % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                    <td className="px-5 py-3 text-sm font-medium text-gray-900">{dept.department}</td>
                    <td className="px-5 py-3 text-sm text-gray-700 text-right">{dept.providerReferrals.toLocaleString()}</td>
                    <td className="px-5 py-3 text-sm text-gray-500 text-right">{dept.totalStudies.toLocaleString()}</td>
                    <td className="px-5 py-3 text-sm text-right" style={{ color: colors.teal }}>
                      {dept.percentage}%
                    </td>
                    {referrals.comparisonDepartments && (
                      <td className={`px-5 py-3 text-sm text-right font-medium ${formatChange(dept.providerReferrals, compDept?.providerReferrals || 0).color}`}>
                        {formatChange(dept.providerReferrals, compDept?.providerReferrals || 0).text}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
