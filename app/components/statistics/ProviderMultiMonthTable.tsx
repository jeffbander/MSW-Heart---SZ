'use client';

import React from 'react';

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

const METRICS: { key: MetricKey; label: string; format: (v: number) => string; isPercentage: boolean; lowerIsBetter?: boolean }[] = [
  { key: 'patientsSeenExclAncillary', label: 'Patients Seen (excl. Ancillary)', format: v => v.toLocaleString(), isPercentage: false },
  { key: 'newPatientPct', label: 'New Patient %', format: v => `${v}%`, isPercentage: true },
  { key: 'noShowRate', label: 'No Show %', format: v => `${v}%`, isPercentage: true, lowerIsBetter: true },
  { key: 'lateCancelRate', label: 'Late Cancel %', format: v => `${v}%`, isPercentage: true, lowerIsBetter: true },
  { key: 'totalOrders', label: 'Total Orders', format: v => v.toLocaleString(), isPercentage: false },
];

function getMonthLabel(monthStr: string): string {
  const d = new Date(monthStr + 'T00:00:00');
  return MONTH_SHORT[d.getMonth() + 1];
}

function ChangeIndicator({ current, prior, isPercentage, lowerIsBetter }: {
  current: number;
  prior: number;
  isPercentage?: boolean;
  lowerIsBetter?: boolean;
}) {
  if (current === 0 && prior === 0) return <span className="text-gray-300 text-xs">--</span>;
  if (prior === 0) return <span className="text-blue-500 text-xs font-medium">New</span>;

  const diff = current - prior;
  if (diff === 0) return <span className="text-gray-400 text-xs">--</span>;

  const isPositiveChange = lowerIsBetter ? diff < 0 : diff > 0;
  const arrow = isPositiveChange ? '▲' : '▼';
  const color = isPositiveChange ? 'text-green-600' : 'text-red-500';

  let text: string;
  if (isPercentage) {
    const absDiff = Math.abs(diff);
    text = `${absDiff.toFixed(1)}`;
  } else {
    const pct = ((diff / prior) * 100);
    text = `${Math.abs(pct).toFixed(0)}%`;
  }

  return (
    <span className={`text-xs font-medium ${color} whitespace-nowrap`}>
      {arrow} {text}
    </span>
  );
}

export default function ProviderMultiMonthTable({ providers, months, priorMonths, selectedProviderId }: Props) {
  const filteredProviders = selectedProviderId
    ? providers.filter(p => p.id === selectedProviderId)
    : providers;

  const numMonths = months.length;
  const showYtd = numMonths > 1;

  // Compute YTD totals for a provider
  function getYtd(provMonths: Record<string, MonthMetrics>, monthList: string[]): MonthMetrics {
    let totalSeen = 0, totalNew = 0, totalAllSeen = 0;
    let totalNoShows = 0, totalSeenForRate = 0;
    let totalLateCancels = 0, totalRateVisits = 0;
    let totalOrders = 0;

    for (const m of monthList) {
      const d = provMonths[m];
      if (!d) continue;
      totalSeen += d.patientsSeenExclAncillary;
      totalOrders += d.totalOrders;
    }

    // For percentages, we need to recalculate from raw YTD — but we only have per-month percentages.
    // Approximate by weighting by patients seen.
    let weightedNewPct = 0, weightedNoShow = 0, weightedLateCancel = 0, totalWeight = 0;
    for (const m of monthList) {
      const d = provMonths[m];
      if (!d || d.patientsSeenExclAncillary === 0) continue;
      const w = d.patientsSeenExclAncillary;
      weightedNewPct += d.newPatientPct * w;
      weightedNoShow += d.noShowRate * w;
      weightedLateCancel += d.lateCancelRate * w;
      totalWeight += w;
    }

    return {
      patientsSeenExclAncillary: totalSeen,
      newPatientPct: totalWeight > 0 ? Number((weightedNewPct / totalWeight).toFixed(1)) : 0,
      noShowRate: totalWeight > 0 ? Number((weightedNoShow / totalWeight).toFixed(1)) : 0,
      lateCancelRate: totalWeight > 0 ? Number((weightedLateCancel / totalWeight).toFixed(1)) : 0,
      totalOrders,
    };
  }

  return (
    <div className="space-y-6">
      {METRICS.map(metric => (
        <div key={metric.key} className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th
                  className="text-left text-white font-semibold px-4 py-3 sticky left-0 z-10"
                  style={{ backgroundColor: '#003D7A', minWidth: 180 }}
                  rowSpan={2}
                >
                  {metric.label}
                </th>
                {months.map(m => (
                  <th
                    key={m}
                    colSpan={2}
                    className="text-center text-white font-medium px-2 py-2"
                    style={{ backgroundColor: '#003D7A', borderLeft: '1px solid rgba(255,255,255,0.2)' }}
                  >
                    {getMonthLabel(m)}
                  </th>
                ))}
                {showYtd && (
                  <th
                    colSpan={2}
                    className="text-center text-white font-bold px-2 py-2"
                    style={{ backgroundColor: '#001f3f', borderLeft: '2px solid rgba(255,255,255,0.3)' }}
                  >
                    YTD
                  </th>
                )}
              </tr>
              <tr>
                {months.map(m => {
                  const yr = new Date(m + 'T00:00:00').getFullYear();
                  return (
                    <React.Fragment key={m}>
                      <th className="text-right text-xs font-medium text-gray-600 px-2 py-1.5 bg-gray-50" style={{ borderLeft: '1px solid #e5e7eb' }}>
                        {yr}
                      </th>
                      <th className="text-center text-xs font-medium text-gray-500 px-2 py-1.5 bg-gray-50" style={{ borderRight: '1px solid #e5e7eb' }}>
                        vs {yr - 1}
                      </th>
                    </React.Fragment>
                  );
                })}
                {showYtd && (() => {
                  const yr = new Date(months[0] + 'T00:00:00').getFullYear();
                  return (
                    <>
                      <th className="text-right text-xs font-medium text-gray-600 px-2 py-1.5 bg-gray-100" style={{ borderLeft: '2px solid #d1d5db' }}>
                        {yr}
                      </th>
                      <th className="text-center text-xs font-medium text-gray-500 px-2 py-1.5 bg-gray-100" style={{ borderRight: '1px solid #d1d5db' }}>
                        vs {yr - 1}
                      </th>
                    </>
                  );
                })()}
              </tr>
            </thead>
            <tbody>
              {filteredProviders.map((p, idx) => {
                const ytdCurrent = getYtd(p.months, months);
                const ytdPrior = getYtd(p.priorYearMonths, priorMonths);

                return (
                  <tr key={p.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                    <td
                      className={`px-4 py-2.5 font-medium text-gray-800 sticky left-0 z-10 whitespace-nowrap ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                    >
                      {p.name}
                    </td>
                    {months.map((m, mi) => {
                      const current = p.months[m]?.[metric.key] ?? 0;
                      const prior = p.priorYearMonths[priorMonths[mi]]?.[metric.key] ?? 0;
                      return (
                        <React.Fragment key={m}>
                          <td className="text-right px-2 py-2.5 tabular-nums" style={{ borderLeft: '1px solid #e5e7eb' }}>
                            {current > 0 ? metric.format(current) : <span className="text-gray-300">-</span>}
                          </td>
                          <td className="text-center px-2 py-2.5" style={{ borderRight: '1px solid #e5e7eb' }}>
                            <ChangeIndicator
                              current={current}
                              prior={prior}
                              isPercentage={metric.isPercentage}
                              lowerIsBetter={metric.lowerIsBetter}
                            />
                          </td>
                        </React.Fragment>
                      );
                    })}
                    {showYtd && (
                      <>
                        <td className="text-right px-2 py-2.5 font-semibold tabular-nums" style={{ borderLeft: '2px solid #d1d5db', backgroundColor: idx % 2 === 0 ? '#f8fafc' : '#f1f5f9' }}>
                          {ytdCurrent[metric.key] > 0 ? metric.format(ytdCurrent[metric.key]) : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="text-center px-2 py-2.5" style={{ borderRight: '1px solid #d1d5db', backgroundColor: idx % 2 === 0 ? '#f8fafc' : '#f1f5f9' }}>
                          <ChangeIndicator
                            current={ytdCurrent[metric.key]}
                            prior={ytdPrior[metric.key]}
                            isPercentage={metric.isPercentage}
                            lowerIsBetter={metric.lowerIsBetter}
                          />
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
