'use client';

import { useState } from 'react';

interface BreakdownData {
  total: number;
  seen: number;
}

interface VisitBreakdownTableProps {
  current: Record<string, BreakdownData>;
  comparison?: Record<string, BreakdownData> | null;
  ancillaryCurrent?: Record<string, BreakdownData>;
  ancillaryComparison?: Record<string, BreakdownData> | null;
}

const CATEGORIES = ['New Patient', 'Follow Up', 'Leqvio', 'Research', 'Video Visit', 'Annual Well Visit', 'Ancillary'];

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

export default function VisitBreakdownTable({ current, comparison, ancillaryCurrent, ancillaryComparison }: VisitBreakdownTableProps) {
  const [ancillaryExpanded, setAncillaryExpanded] = useState(false);
  const hasComparison = !!comparison;
  const totalSeen = CATEGORIES.reduce((sum, cat) => sum + (current[cat]?.seen || 0), 0);

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b">
        <h3 className="text-base font-semibold" style={{ color: '#003D7A' }}>Office Visit Breakdown</h3>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Visit Type</th>
            <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Patients Seen</th>
            <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">% of Total</th>
            <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Scheduled</th>
            {hasComparison && (
              <>
                <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Comparison</th>
                <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Change</th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {CATEGORIES.map((cat) => {
            const cur = current[cat] || { total: 0, seen: 0 };
            const comp = comparison?.[cat] || { total: 0, seen: 0 };
            const isAncillary = cat === 'Ancillary';

            return (
              <tr key={cat}>
                <td colSpan={hasComparison ? 6 : 4} className="p-0">
                  <table className="w-full">
                    <tbody>
                      {/* Main row */}
                      <tr
                        className={isAncillary ? 'bg-blue-50 cursor-pointer hover:bg-blue-100' : 'hover:bg-gray-50'}
                        onClick={isAncillary ? () => setAncillaryExpanded(!ancillaryExpanded) : undefined}
                      >
                        <td className="px-5 py-3 text-sm font-medium text-gray-900 w-[25%]">
                          <span className="flex items-center gap-2">
                            {isAncillary && (
                              <span className="text-xs text-gray-400">{ancillaryExpanded ? '▼' : '▶'}</span>
                            )}
                            {cat}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-700 text-right w-[15%]">
                          {cur.seen.toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-400 text-right w-[12%]">
                          {totalSeen > 0 ? `${((cur.seen / totalSeen) * 100).toFixed(1)}%` : '--'}
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-500 text-right w-[15%]">
                          {cur.total.toLocaleString()}
                        </td>
                        {hasComparison && (
                          <>
                            <td className="px-5 py-3 text-sm text-gray-500 text-right w-[15%]">
                              {comp.seen.toLocaleString()}
                            </td>
                            <td className={`px-5 py-3 text-sm text-right font-medium w-[15%] ${formatChange(cur.seen, comp.seen).color}`}>
                              {formatChange(cur.seen, comp.seen).text}
                            </td>
                          </>
                        )}
                      </tr>

                      {/* Ancillary sub-rows */}
                      {isAncillary && ancillaryExpanded && ancillaryCurrent && (
                        <>
                          {Object.entries(ancillaryCurrent).map(([sub, subCur]) => {
                            const subComp = ancillaryComparison?.[sub] || { total: 0, seen: 0 };
                            return (
                              <tr key={sub} className="bg-blue-50/50">
                                <td className="pl-12 pr-5 py-2 text-sm text-gray-600 w-[25%]">{sub}</td>
                                <td className="px-5 py-2 text-sm text-gray-600 text-right w-[15%]">
                                  {subCur.seen.toLocaleString()}
                                </td>
                                <td className="px-5 py-2 text-sm text-gray-400 text-right w-[12%]">
                                  {totalSeen > 0 ? `${((subCur.seen / totalSeen) * 100).toFixed(1)}%` : '--'}
                                </td>
                                <td className="px-5 py-2 text-sm text-gray-400 text-right w-[15%]">
                                  {subCur.total.toLocaleString()}
                                </td>
                                {hasComparison && (
                                  <>
                                    <td className="px-5 py-2 text-sm text-gray-400 text-right w-[15%]">
                                      {subComp.seen.toLocaleString()}
                                    </td>
                                    <td className={`px-5 py-2 text-sm text-right font-medium w-[15%] ${formatChange(subCur.seen, subComp.seen).color}`}>
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
  );
}
