'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import StatisticsNav from '@/app/components/statistics/StatisticsNav';
import YoYTable from '@/app/components/statistics/YoYTable';

const colors = {
  primaryBlue: '#003D7A',
  lightGray: '#F5F5F5',
};

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const DEPT_DISPLAY_ORDER = ['CVI Echo', 'Echo Lab (4th Floor)', 'Vascular', 'Nuclear', 'EP', 'CT', 'Cardio Vein'];

interface YoYData {
  officeVisits: Record<string, Record<number, Record<number, number>>>;
  testingVisits: Record<string, {
    totals: Record<number, Record<number, number>>;
    visitTypes: Record<string, Record<number, Record<number, number>>>;
  }>;
  years: number[];
  months: number[];
}

function copyTableToClipboard(tableId: string): boolean {
  const table = document.getElementById(tableId);
  if (!table) return false;

  const clone = table.cloneNode(true) as HTMLElement;

  clone.querySelectorAll('th, td').forEach(cell => {
    const el = cell as HTMLElement;
    const computed = window.getComputedStyle(el);
    el.style.border = '1px solid #d1d5db';
    el.style.padding = computed.padding || '8px 12px';
    el.style.fontSize = computed.fontSize || '14px';
    el.style.textAlign = computed.textAlign || 'left';
    el.style.backgroundColor = computed.backgroundColor || 'white';
    el.style.fontWeight = computed.fontWeight || 'normal';
    el.style.color = computed.color || '#111827';
    el.style.fontVariantNumeric = 'tabular-nums';
  });

  const htmlContent = clone.outerHTML;
  const plainText = table.innerText;

  try {
    const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
    const textBlob = new Blob([plainText], { type: 'text/plain' });
    navigator.clipboard.write([
      new ClipboardItem({
        'text/html': htmlBlob,
        'text/plain': textBlob,
      }),
    ]);
    return true;
  } catch {
    const range = document.createRange();
    range.selectNode(table);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    document.execCommand('copy');
    sel?.removeAllRanges();
    return true;
  }
}

export default function YearOverYearPage() {
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [numYears, setNumYears] = useState(2);
  const [startMonth, setStartMonth] = useState(1);
  const [endMonth, setEndMonth] = useState(12);
  const [data, setData] = useState<YoYData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'monthly' | 'totals'>('monthly');

  const availableYears = [...new Set(availableMonths.map(m => new Date(m + 'T00:00:00').getFullYear()))].sort();

  const yearOptions = (() => {
    if (availableYears.length === 0) return [];
    const min = Math.min(...availableYears) - 1;
    const max = Math.max(...availableYears);
    const opts = [];
    for (let y = min; y <= max; y++) opts.push(y);
    return opts;
  })();

  useEffect(() => {
    fetch('/api/statistics/months')
      .then(r => r.json())
      .then(json => {
        const months = (json.months || []) as string[];
        setAvailableMonths(months);
        if (months.length > 0) {
          const years = [...new Set(months.map(m => new Date(m + 'T00:00:00').getFullYear()))].sort();
          if (years.length >= 2) {
            setSelectedYears([years[years.length - 2], years[years.length - 1]]);
            setEndMonth(Math.max(
              ...months
                .filter(m => new Date(m + 'T00:00:00').getFullYear() === years[years.length - 1])
                .map(m => new Date(m + 'T00:00:00').getMonth() + 1)
            ));
          } else if (years.length === 1) {
            setSelectedYears([years[0] - 1, years[0]]);
            setEndMonth(Math.max(
              ...months
                .filter(m => new Date(m + 'T00:00:00').getFullYear() === years[0])
                .map(m => new Date(m + 'T00:00:00').getMonth() + 1)
            ));
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // When numYears changes, adjust selectedYears
  useEffect(() => {
    if (selectedYears.length === 0) return;
    if (numYears > selectedYears.length) {
      // Add older years
      const oldest = Math.min(...selectedYears);
      const newYears = [...selectedYears];
      while (newYears.length < numYears) {
        newYears.unshift(oldest - (newYears.length - selectedYears.length + 1));
      }
      setSelectedYears(newYears.sort());
    } else if (numYears < selectedYears.length) {
      // Keep the most recent N years
      setSelectedYears(selectedYears.slice(-numYears));
    }
  }, [numYears]);

  useEffect(() => {
    if (selectedYears.length < 2 || startMonth > endMonth) return;
    setLoading(true);
    setError(null);
    setExpandedDepts(new Set());

    const params = new URLSearchParams({
      years: selectedYears.join(','),
      startMonth: String(startMonth),
      endMonth: String(endMonth),
    });

    fetch(`/api/statistics/year-over-year?${params}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch(err => {
        setError(err.message);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [selectedYears, startMonth, endMonth]);

  const handleCopy = useCallback((tableId: string, label: string) => {
    const ok = copyTableToClipboard(tableId);
    if (ok) {
      setCopyFeedback(`${label} copied!`);
      setTimeout(() => setCopyFeedback(null), 2000);
    }
  }, []);

  const toggleDept = (dept: string) => {
    setExpandedDepts(prev => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept); else next.add(dept);
      return next;
    });
  };

  const updateYear = (index: number, value: number) => {
    const next = [...selectedYears];
    next[index] = value;
    setSelectedYears(next.sort());
  };

  // Build office visit rows
  const officeRows = data ? (() => {
    const categories = Object.keys(data.officeVisits).sort((a, b) => {
      const order = ['New Patient', 'Follow Up', 'Leqvio', 'Research', 'Video Visit', 'Annual Well Visit', 'Ancillary'];
      const ia = order.indexOf(a), ib = order.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
    return categories.map(cat => ({
      label: cat,
      monthData: data.officeVisits[cat] || {},
    }));
  })() : [];

  // Build testing rows
  const testingRows = data ? (() => {
    const depts = Object.keys(data.testingVisits).sort((a, b) => {
      const ia = DEPT_DISPLAY_ORDER.indexOf(a), ib = DEPT_DISPLAY_ORDER.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });

    const rows: Array<{ label: string; isSubRow?: boolean; monthData: Record<number, Record<number, number>> }> = [];
    for (const dept of depts) {
      const deptData = data.testingVisits[dept];
      rows.push({ label: dept, monthData: deptData.totals });

      if (expandedDepts.has(dept)) {
        const vtEntries = Object.entries(deptData.visitTypes).sort(([, a], [, b]) => {
          const sumA = Object.values(a).reduce((s, v) => s + Object.values(v).reduce((ss, vv) => ss + vv, 0), 0);
          const sumB = Object.values(b).reduce((s, v) => s + Object.values(v).reduce((ss, vv) => ss + vv, 0), 0);
          return sumB - sumA;
        });
        for (const [vt, vtMonthData] of vtEntries) {
          rows.push({ label: vt, isSubRow: true, monthData: vtMonthData });
        }
      }
    }
    return rows;
  })() : [];

  const activeYears = data?.years || selectedYears;

  return (
    <>
      <style jsx global>{`
        @media print {
          nav, .no-print { display: none !important; }
          .print-full-width { width: 100% !important; max-width: 100% !important; padding: 0 !important; }
          table { font-size: 10px !important; }
        }
      `}</style>
      <div className="min-h-screen p-6" style={{ backgroundColor: colors.lightGray }}>
        <div className="max-w-7xl mx-auto print-full-width">
          {/* Header */}
          <div className="mb-6 no-print">
            <Link
              href="/dashboard"
              className="text-sm hover:underline mb-2 inline-block"
              style={{ color: colors.primaryBlue }}
            >
              &larr; Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold" style={{ color: colors.primaryBlue }}>
              Year-over-Year Comparison
            </h1>
            <StatisticsNav />
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm px-5 py-3 mb-6 flex items-center gap-4 flex-wrap no-print">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">Years:</label>
              <select
                value={numYears}
                onChange={e => setNumYears(Number(e.target.value))}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-blue-500"
              >
                <option value={2}>2 years</option>
                <option value={3}>3 years</option>
                <option value={4}>4 years</option>
              </select>
            </div>

            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('monthly')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === 'monthly' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setViewMode('totals')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === 'totals' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}
              >
                Totals Only
              </button>
            </div>

            {selectedYears.map((yr, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <label className="text-xs font-medium text-gray-500">Y{idx + 1}:</label>
                <select
                  value={yr}
                  onChange={e => updateYear(idx, Number(e.target.value))}
                  className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-blue-500"
                >
                  {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            ))}

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">From:</label>
              <select
                value={startMonth}
                onChange={e => {
                  const v = Number(e.target.value);
                  setStartMonth(v);
                  if (v > endMonth) setEndMonth(v);
                }}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{MONTH_NAMES[m]}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">Through:</label>
              <select
                value={endMonth}
                onChange={e => setEndMonth(Number(e.target.value))}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: 12 - startMonth + 1 }, (_, i) => i + startMonth).map(m => (
                  <option key={m} value={m}>{MONTH_NAMES[m]}</option>
                ))}
              </select>
            </div>

            <div className="ml-auto flex items-center gap-2">
              {copyFeedback && (
                <span className="text-sm text-green-600 font-medium">{copyFeedback}</span>
              )}
              <button
                onClick={() => handleCopy('yoy-office-table', 'Office table')}
                className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                disabled={!data}
              >
                Copy Office
              </button>
              <button
                onClick={() => handleCopy('yoy-testing-table', 'Testing table')}
                className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                disabled={!data}
              >
                Copy Testing
              </button>
              <button
                onClick={() => window.print()}
                className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Print
              </button>
            </div>
          </div>

          {/* Content */}
          {loading && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-48"></div>
                {[...Array(5)].map((_, i) => <div key={i} className="h-3 bg-gray-200 rounded w-full"></div>)}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 rounded-xl shadow-sm p-6 text-center text-red-600 text-sm">{error}</div>
          )}

          {data && !loading && (
            <div className="space-y-8">
              {/* Office Visits */}
              <div className="bg-white rounded-xl shadow-md p-6 overflow-hidden">
                <YoYTable
                  title="Office Visits (Completed)"
                  accentColor="#0078C8"
                  rows={officeRows}
                  years={activeYears}
                  months={data.months}
                  tableId="yoy-office-table"
                  totalsOnly={viewMode === 'totals'}
                />
              </div>

              {/* Testing Visits */}
              <div className="bg-white rounded-xl shadow-md p-6 overflow-hidden">
                <div className="mb-2 text-xs text-gray-400">
                  Click a department row to expand visit types
                </div>
                <div onClick={(e) => {
                  const tr = (e.target as HTMLElement).closest('tr');
                  if (!tr) return;
                  const label = tr.querySelector('td')?.textContent?.trim();
                  if (label && data.testingVisits[label]) toggleDept(label);
                }}>
                  <YoYTable
                    title="Testing Visits (Completed)"
                    accentColor="#00A3AD"
                    rows={testingRows}
                    years={activeYears}
                    months={data.months}
                    tableId="yoy-testing-table"
                    totalsOnly={viewMode === 'totals'}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
