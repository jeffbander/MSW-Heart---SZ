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
  officeVisits: Record<string, Record<number, { year1: number; year2: number }>>;
  testingVisits: Record<string, {
    totals: Record<number, { year1: number; year2: number }>;
    visitTypes: Record<string, Record<number, { year1: number; year2: number }>>;
  }>;
  year1: number;
  year2: number;
  months: number[];
}

function copyTableToClipboard(tableId: string, label: string): boolean {
  const table = document.getElementById(tableId);
  if (!table) return false;

  const clone = table.cloneNode(true) as HTMLElement;

  // Inline styles for PowerPoint compatibility
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
    // Fallback
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
  const [year1, setYear1] = useState<number>(0);
  const [year2, setYear2] = useState<number>(0);
  const [startMonth, setStartMonth] = useState(1);
  const [endMonth, setEndMonth] = useState(12);
  const [data, setData] = useState<YoYData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Extract available years from months
  const availableYears = [...new Set(availableMonths.map(m => new Date(m + 'T00:00:00').getFullYear()))].sort();

  // Extract max month for each year
  const maxMonthForYear = (yr: number) => {
    const yrMonths = availableMonths
      .filter(m => new Date(m + 'T00:00:00').getFullYear() === yr)
      .map(m => new Date(m + 'T00:00:00').getMonth() + 1);
    return yrMonths.length > 0 ? Math.max(...yrMonths) : 12;
  };

  useEffect(() => {
    fetch('/api/statistics/months')
      .then(r => r.json())
      .then(json => {
        const months = (json.months || []) as string[];
        setAvailableMonths(months);
        if (months.length > 0) {
          const years = [...new Set(months.map(m => new Date(m + 'T00:00:00').getFullYear()))].sort();
          if (years.length >= 2) {
            setYear1(years[years.length - 2]);
            setYear2(years[years.length - 1]);
            setEndMonth(Math.max(
              ...months
                .filter(m => new Date(m + 'T00:00:00').getFullYear() === years[years.length - 1])
                .map(m => new Date(m + 'T00:00:00').getMonth() + 1)
            ));
          } else if (years.length === 1) {
            setYear1(years[0] - 1);
            setYear2(years[0]);
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

  useEffect(() => {
    if (!year1 || !year2 || startMonth > endMonth) return;
    setLoading(true);
    setError(null);
    setExpandedDepts(new Set());

    const params = new URLSearchParams({
      year1: String(year1),
      year2: String(year2),
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
  }, [year1, year2, startMonth, endMonth]);

  const handleCopy = useCallback((tableId: string, label: string) => {
    const ok = copyTableToClipboard(tableId, label);
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

  // Build testing rows (dept totals with expandable visit types)
  const testingRows = data ? (() => {
    const depts = Object.keys(data.testingVisits).sort((a, b) => {
      const ia = DEPT_DISPLAY_ORDER.indexOf(a), ib = DEPT_DISPLAY_ORDER.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });

    const rows: Array<{ label: string; isSubRow?: boolean; monthData: Record<number, { year1: number; year2: number }> }> = [];
    for (const dept of depts) {
      const deptData = data.testingVisits[dept];
      rows.push({ label: dept, monthData: deptData.totals });

      if (expandedDepts.has(dept)) {
        const vtEntries = Object.entries(deptData.visitTypes).sort(([, a], [, b]) => {
          const sumA = Object.values(a).reduce((s, v) => s + v.year1 + v.year2, 0);
          const sumB = Object.values(b).reduce((s, v) => s + v.year1 + v.year2, 0);
          return sumB - sumA;
        });
        for (const [vt, vtMonthData] of vtEntries) {
          rows.push({ label: vt, isSubRow: true, monthData: vtMonthData });
        }
      }
    }
    return rows;
  })() : [];

  // Year options: include year1-1 through latest available year + 1
  const yearOptions = (() => {
    if (availableYears.length === 0) return [];
    const min = Math.min(...availableYears) - 1;
    const max = Math.max(...availableYears);
    const opts = [];
    for (let y = min; y <= max; y++) opts.push(y);
    return opts;
  })();

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
              <label className="text-sm font-medium text-gray-600">Year 1:</label>
              <select
                value={year1}
                onChange={e => setYear1(Number(e.target.value))}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">Year 2:</label>
              <select
                value={year2}
                onChange={e => setYear2(Number(e.target.value))}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">From:</label>
              <select
                value={startMonth}
                onChange={e => {
                  const v = Number(e.target.value);
                  setStartMonth(v);
                  if (v > endMonth) setEndMonth(v);
                }}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                Copy Office Table
              </button>
              <button
                onClick={() => handleCopy('yoy-testing-table', 'Testing table')}
                className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                disabled={!data}
              >
                Copy Testing Table
              </button>
            </div>
          </div>

          {/* No data */}
          {!loading && availableMonths.length === 0 && (
            <div className="bg-white rounded-xl shadow-md p-12 text-center">
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
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-48"></div>
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-3 bg-gray-200 rounded w-full"></div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 rounded-xl shadow-sm p-6 text-center text-red-600 text-sm">
              {error}
            </div>
          )}

          {data && !loading && (
            <div className="space-y-8">
              {/* Office Visits Table */}
              <div className="bg-white rounded-xl shadow-md p-6">
                <YoYTable
                  title="Office Visits by Visit Type"
                  accentColor="#00A3AD"
                  rows={officeRows}
                  year1={data.year1}
                  year2={data.year2}
                  months={data.months}
                  tableId="yoy-office-table"
                />
              </div>

              {/* Testing Visits Table */}
              <div className="bg-white rounded-xl shadow-md p-6">
                <div style={{ marginBottom: '0.5rem' }}>
                  <p className="text-xs text-gray-400">Click a department row to expand visit types</p>
                </div>
                <YoYTable
                  title="Testing Volume by Department"
                  accentColor="#0078C8"
                  rows={testingRows}
                  year1={data.year1}
                  year2={data.year2}
                  months={data.months}
                  tableId="yoy-testing-table"
                />
                {/* Clickable department names */}
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.keys(data.testingVisits)
                    .sort((a, b) => {
                      const ia = DEPT_DISPLAY_ORDER.indexOf(a), ib = DEPT_DISPLAY_ORDER.indexOf(b);
                      if (ia !== -1 && ib !== -1) return ia - ib;
                      if (ia !== -1) return -1;
                      if (ib !== -1) return 1;
                      return a.localeCompare(b);
                    })
                    .map(dept => (
                      <button
                        key={dept}
                        onClick={() => toggleDept(dept)}
                        className={`text-xs px-2 py-1 rounded border transition-colors ${
                          expandedDepts.has(dept)
                            ? 'bg-blue-50 border-blue-300 text-blue-700'
                            : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'
                        }`}
                      >
                        {expandedDepts.has(dept) ? '- ' : '+ '}{dept}
                      </button>
                    ))
                  }
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
