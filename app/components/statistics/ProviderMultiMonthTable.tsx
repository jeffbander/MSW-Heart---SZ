'use client';

import React, { useState } from 'react';

const MONTH_SHORT = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface MonthMetrics {
  patientsSeenExclAncillary: number;
  newPatientPct: number;
  noShowRate: number;
  lateCancelRate: number;
  totalOrders: number;
}

interface ProviderData {
  id: string;
  name: string;
  initials: string;
  months: Record<string, MonthMetrics>;
  priorYearMonths: Record<string, MonthMetrics>;
}

interface Props {
  providers: ProviderData[];
  months: string[];
  priorMonths: string[];
  selectedProviderId?: string;
}

type MetricKey = keyof MonthMetrics;

const METRICS: { key: MetricKey; label: string; shortLabel: string; format: (v: number) => string; isPercentage: boolean; lowerIsBetter?: boolean }[] = [
  { key: 'patientsSeenExclAncillary', label: 'Patients Seen (excl. Ancillary)', shortLabel: 'Patients Seen', format: v => v.toLocaleString(), isPercentage: false },
  { key: 'newPatientPct', label: 'New Patient %', shortLabel: 'New Pt %', format: v => `${v}%`, isPercentage: true },
  { key: 'noShowRate', label: 'No Show Rate', shortLabel: 'No Show %', format: v => `${v}%`, isPercentage: true, lowerIsBetter: true },
  { key: 'lateCancelRate', label: 'Late Cancel Rate', shortLabel: 'Late Cancel %', format: v => `${v}%`, isPercentage: true, lowerIsBetter: true },
  { key: 'totalOrders', label: 'Total Orders', shortLabel: 'Orders', format: v => v.toLocaleString(), isPercentage: false },
];

function getMonthLabel(monthStr: string): string {
  const d = new Date(monthStr + 'T00:00:00');
  return MONTH_SHORT[d.getMonth() + 1];
}

function getYear(monthStr: string): number {
  return new Date(monthStr + 'T00:00:00').getFullYear();
}

function ChangeArrow({ current, prior, isPercentage, lowerIsBetter }: {
  current: number;
  prior: number;
  isPercentage?: boolean;
  lowerIsBetter?: boolean;
}) {
  if (current === 0 || prior === 0) return null; // no data in either period
  const diff = current - prior;
  if (Math.abs(diff) < 0.05) return null;

  const isPositiveChange = lowerIsBetter ? diff < 0 : diff > 0;

  let text: string;
  if (isPercentage) {
    text = `${Math.abs(diff).toFixed(1)}`;
  } else {
    const pct = ((diff / prior) * 100);
    text = `${Math.abs(pct).toFixed(0)}%`;
  }

  return (
    <span className={`text-[10px] font-semibold ml-1 ${isPositiveChange ? 'text-emerald-600' : 'text-red-500'}`}>
      {isPositiveChange ? '▲' : '▼'}{text}
    </span>
  );
}

export default function ProviderMultiMonthTable({ providers, months, priorMonths, selectedProviderId }: Props) {
  const [selectedMetric, setSelectedMetric] = useState(0);
  const metric = METRICS[selectedMetric];

  const filteredProviders = (selectedProviderId
    ? providers.filter(p => p.id === selectedProviderId)
    : providers
  ).filter(p => {
    // Hide providers with no data in any month for this metric
    return months.some(m => (p.months[m]?.[metric.key] ?? 0) > 0) ||
           priorMonths.some(m => (p.priorYearMonths[m]?.[metric.key] ?? 0) > 0);
  });

  const showYtd = months.length > 1;
  const year = getYear(months[0]);

  // Compute YTD
  function getYtdValue(provMonths: Record<string, MonthMetrics>, monthList: string[]): number {
    if (metric.isPercentage) {
      let weightedSum = 0, totalWeight = 0;
      for (const m of monthList) {
        const d = provMonths[m];
        if (!d || d.patientsSeenExclAncillary === 0) continue;
        const w = d.patientsSeenExclAncillary;
        weightedSum += d[metric.key] * w;
        totalWeight += w;
      }
      return totalWeight > 0 ? Number((weightedSum / totalWeight).toFixed(1)) : 0;
    }
    return monthList.reduce((s, m) => s + (provMonths[m]?.[metric.key] ?? 0), 0);
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Metric tabs */}
      <div className="flex items-center border-b px-1 pt-1 gap-0.5 overflow-x-auto" style={{ borderColor: '#e5e7eb' }}>
        {METRICS.map((m, i) => (
          <button
            key={m.key}
            onClick={() => setSelectedMetric(i)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap rounded-t-lg transition-colors ${
              i === selectedMetric
                ? 'text-white'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
            style={i === selectedMetric ? { backgroundColor: '#003D7A' } : undefined}
          >
            {m.shortLabel}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b" style={{ borderColor: '#d1d5db' }}>
              <th className="text-left font-semibold text-gray-700 px-4 py-2.5 sticky left-0 z-10 bg-gray-50" style={{ minWidth: 180 }}>
                Provider
              </th>
              {months.map((m, mi) => (
                <th key={m} className="text-center font-semibold text-gray-700 px-3 py-2.5" style={{ minWidth: 100, borderLeft: mi === 0 ? '2px solid #e5e7eb' : '1px solid #f3f4f6' }}>
                  <div>{getMonthLabel(m)} {year}</div>
                  <div className="text-[10px] font-normal text-gray-400">vs {year - 1}</div>
                </th>
              ))}
              {showYtd && (
                <th className="text-center font-bold text-gray-700 px-3 py-2.5" style={{ minWidth: 100, borderLeft: '2px solid #d1d5db', backgroundColor: '#f1f5f9' }}>
                  <div>YTD</div>
                  <div className="text-[10px] font-normal text-gray-400">vs {year - 1}</div>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredProviders.length === 0 ? (
              <tr>
                <td colSpan={months.length + (showYtd ? 2 : 1)} className="text-center py-8 text-gray-400">
                  No providers with data for this metric
                </td>
              </tr>
            ) : filteredProviders.map((p, idx) => {
              const ytdCurrent = getYtdValue(p.months, months);
              const ytdPrior = getYtdValue(p.priorYearMonths, priorMonths);

              return (
                <tr key={p.id} className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`} style={{ borderColor: '#f3f4f6' }}>
                  <td className={`px-4 py-2.5 font-medium text-gray-800 sticky left-0 z-10 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                    {p.name}
                  </td>
                  {months.map((m, mi) => {
                    const current = p.months[m]?.[metric.key] ?? 0;
                    const prior = p.priorYearMonths[priorMonths[mi]]?.[metric.key] ?? 0;
                    return (
                      <td key={m} className="text-center px-3 py-2.5 tabular-nums" style={{ borderLeft: mi === 0 ? '2px solid #e5e7eb' : '1px solid #f3f4f6' }}>
                        {current === 0 ? (
                          <span className="text-gray-300">-</span>
                        ) : (
                          <span className="inline-flex items-center justify-center">
                            <span className="font-medium text-gray-800">{metric.format(current)}</span>
                            <ChangeArrow current={current} prior={prior} isPercentage={metric.isPercentage} lowerIsBetter={metric.lowerIsBetter} />
                          </span>
                        )}
                      </td>
                    );
                  })}
                  {showYtd && (
                    <td className="text-center px-3 py-2.5 font-semibold tabular-nums" style={{ borderLeft: '2px solid #d1d5db', backgroundColor: idx % 2 === 0 ? '#f8fafc' : '#f1f5f9' }}>
                      {ytdCurrent === 0 && ytdPrior === 0 ? (
                        <span className="text-gray-300">-</span>
                      ) : (
                        <span className="inline-flex items-center justify-center">
                          <span className="text-gray-800">{metric.format(ytdCurrent)}</span>
                          <ChangeArrow current={ytdCurrent} prior={ytdPrior} isPercentage={metric.isPercentage} lowerIsBetter={metric.lowerIsBetter} />
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
