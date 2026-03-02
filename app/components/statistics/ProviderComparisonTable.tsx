'use client';

import { useState, useEffect } from 'react';

const colors = {
  primaryBlue: '#003D7A',
  teal: '#00A3AD',
};

interface ProviderMetrics {
  id: string;
  name: string;
  initials: string;
  patientsSeenExclAncillary: number;
  newPatientPct: number;
  noShowRate: number;
  lateCancelRate: number;
  sessionsCount: number;
  avgPatientsPerSession: number;
  totalOrders: number;
  totalReferrals: number;
}

interface AverageMetrics {
  patientsSeenExclAncillary: number;
  newPatientPct: number;
  noShowRate: number;
  lateCancelRate: number;
  sessionsCount: number;
  avgPatientsPerSession: number;
  totalOrders: number;
  totalReferrals: number;
}

interface ComparisonData {
  providers: ProviderMetrics[];
  averages: AverageMetrics;
  comparison: ProviderMetrics[] | null;
  comparisonAverages: AverageMetrics | null;
  reportMonth: string;
  comparisonMonth: string | null;
  comparisonMode: string;
  comparisonLabel?: string;
}

interface Props {
  reportMonth: string;
  comparisonMode: string;
  onSelectProvider: (id: string) => void;
}

type SortKey = 'name' | 'patientsSeenExclAncillary' | 'newPatientPct' | 'noShowRate' | 'lateCancelRate' | 'sessionsCount' | 'avgPatientsPerSession' | 'totalOrders' | 'totalReferrals';
type SortDir = 'asc' | 'desc';

const COLUMNS: { key: SortKey; label: string; isPercentage?: boolean; lowerIsBetter?: boolean }[] = [
  { key: 'name', label: 'Provider' },
  { key: 'patientsSeenExclAncillary', label: 'Patients Seen' },
  { key: 'newPatientPct', label: 'New Pt %', isPercentage: true },
  { key: 'noShowRate', label: 'No Show %', isPercentage: true, lowerIsBetter: true },
  { key: 'lateCancelRate', label: 'Late Cancel %', isPercentage: true, lowerIsBetter: true },
  { key: 'sessionsCount', label: 'Sessions' },
  { key: 'avgPatientsPerSession', label: 'Pts/Session' },
  { key: 'totalOrders', label: 'Orders' },
  { key: 'totalReferrals', label: 'Referrals' },
];

function getCellColor(value: number, avg: number, lowerIsBetter?: boolean): string {
  if (avg === 0) return '';
  const ratio = value / avg;
  if (lowerIsBetter) {
    if (ratio <= 0.8) return 'bg-green-50 text-green-700';
    if (ratio >= 1.2) return 'bg-red-50 text-red-700';
  } else {
    if (ratio >= 1.2) return 'bg-green-50 text-green-700';
    if (ratio <= 0.8) return 'bg-red-50 text-red-700';
  }
  return '';
}

function formatChange(current: number, comparison: number): { text: string; color: string } {
  const diff = current - comparison;
  if (diff === 0) return { text: '--', color: 'text-gray-400' };
  const sign = diff > 0 ? '+' : '';
  return {
    text: `${sign}${diff % 1 === 0 ? diff.toLocaleString() : diff.toFixed(1)}`,
    color: diff > 0 ? 'text-green-600' : 'text-red-600',
  };
}

export default function ProviderComparisonTable({ reportMonth, comparisonMode, onSelectProvider }: Props) {
  const [data, setData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('patientsSeenExclAncillary');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [hideEmpty, setHideEmpty] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ reportMonth, comparisonMode });
    fetch(`/api/statistics/providers/comparison?${params}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [reportMonth, comparisonMode]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
        Loading provider comparison...
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

  if (!data || data.providers.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
        No provider data available for this period.
      </div>
    );
  }

  let rows = [...data.providers];

  if (hideEmpty) {
    rows = rows.filter(p => p.patientsSeenExclAncillary > 0 || p.totalOrders > 0 || p.sessionsCount > 0);
  }

  rows.sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    const diff = (aVal as number) - (bVal as number);
    return sortDir === 'asc' ? diff : -diff;
  });

  const hasComparison = !!data.comparison;
  const compMap = new Map(data.comparison?.map(p => [p.id, p]) || []);
  const avg = data.averages;

  const formatMonth = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: colors.primaryBlue }}>
          {comparisonMode === 'vs_ytd_prior_year' && data.comparisonLabel
            ? data.comparisonLabel
            : formatMonth(reportMonth)}
        </h2>
        <label className="flex items-center gap-2 text-sm text-gray-500">
          <input
            type="checkbox"
            checked={hideEmpty}
            onChange={(e) => setHideEmpty(e.target.checked)}
            className="rounded border-gray-300"
          />
          Hide providers with no data
        </label>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
                    style={{ textAlign: col.key === 'name' ? 'left' : 'right' }}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key && (
                        <span className="text-gray-400">{sortDir === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(provider => {
                const comp = compMap.get(provider.id);
                return (
                  <tr key={provider.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium whitespace-nowrap">
                      <button
                        onClick={() => onSelectProvider(provider.id)}
                        className="hover:underline text-left"
                        style={{ color: colors.primaryBlue }}
                      >
                        {provider.name}
                      </button>
                    </td>
                    {COLUMNS.slice(1).map(col => {
                      const value = provider[col.key] as number;
                      const avgVal = avg[col.key as keyof AverageMetrics] as number;
                      const cellColor = getCellColor(value, avgVal, col.lowerIsBetter);
                      const compValue = comp ? comp[col.key as keyof ProviderMetrics] as number : null;
                      const change = hasComparison && compValue !== null
                        ? formatChange(value, compValue)
                        : null;

                      return (
                        <td
                          key={col.key}
                          className={`px-4 py-3 text-sm text-right whitespace-nowrap ${cellColor}`}
                        >
                          <div>
                            {col.isPercentage ? `${value}%` : value.toLocaleString()}
                          </div>
                          {change && change.text !== '--' && (
                            <div className={`text-xs ${change.color}`}>{change.text}</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              {/* Averages row */}
              <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                <td className="px-4 py-3 text-sm text-gray-700">Average</td>
                {COLUMNS.slice(1).map(col => {
                  const value = avg[col.key as keyof AverageMetrics] as number;
                  const compAvg = data.comparisonAverages;
                  const compValue = compAvg ? compAvg[col.key as keyof AverageMetrics] as number : null;
                  const change = hasComparison && compValue !== null
                    ? formatChange(value, compValue)
                    : null;

                  return (
                    <td key={col.key} className="px-4 py-3 text-sm text-right text-gray-700 whitespace-nowrap">
                      <div>{col.isPercentage ? `${value}%` : value.toLocaleString()}</div>
                      {change && change.text !== '--' && (
                        <div className={`text-xs font-medium ${change.color}`}>{change.text}</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Click a provider name to view their detailed scorecard. Green = 20%+ above average, Red = 20%+ below average.
      </p>
    </div>
  );
}
