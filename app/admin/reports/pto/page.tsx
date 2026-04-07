'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  lightGray: '#F5F5F5',
  border: '#E5E7EB',
  completed: '#10B981',
  planned: '#3B82F6',
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_KEYS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const QUARTERS = [
  { label: 'Q1', months: ['01', '02', '03'] },
  { label: 'Q2', months: ['04', '05', '06'] },
  { label: 'Q3', months: ['07', '08', '09'] },
  { label: 'Q4', months: ['10', '11', '12'] },
];

interface DayDetail { date: string; value: number; completed: boolean; leaveType: string; timeBlock: string; }
interface MonthData { completed: number; planned: number; days: DayDetail[]; }
interface ProviderPTO { id: string; name: string; initials: string; months: Record<string, MonthData>; }
interface ReportData { year: number; today: string; providers: ProviderPTO[]; }

// View mode removed - grouped only

// --- Day detail popover ---
function DayDetailPopover({
  days,
  providerName,
  monthLabel,
  onClose,
  anchorRect,
}: {
  days: DayDetail[];
  providerName: string;
  monthLabel: string;
  onClose: () => void;
  anchorRect: { top: number; left: number; bottom: number; right: number };
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    // Delay listener so the opening click doesn't immediately close it
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClick), 10);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handleClick); };
  }, [onClose]);

  // Position above or below the cell depending on available space
  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const showAbove = spaceBelow < 280;
  const style: React.CSSProperties = {
    position: 'fixed',
    zIndex: 100,
    left: Math.min(Math.max(8, anchorRect.left - 60), window.innerWidth - 296),
    ...(showAbove
      ? { bottom: window.innerHeight - anchorRect.top + 4 }
      : { top: anchorRect.bottom + 4 }),
  };

  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));

  const formatDate = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const leaveLabel = (lt: string) => {
    const map: Record<string, string> = {
      vacation: 'Vacation', medical: 'Medical', personal: 'Personal',
      conference: 'Conference', maternity: 'Maternity', other: 'Other',
    };
    return map[lt] || lt;
  };

  return (
    <div ref={ref} style={style} className="bg-white border rounded-xl shadow-xl w-[280px] max-h-[320px] flex flex-col" onClick={e => e.stopPropagation()}>
      <div className="px-3 py-2 border-b font-semibold text-sm" style={{ color: colors.primaryBlue, borderColor: colors.border }}>
        {providerName} &mdash; {monthLabel}
      </div>
      <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
        {sorted.length === 0 ? (
          <div className="px-3 py-4 text-center text-gray-400 text-sm">No PTO days</div>
        ) : (
          sorted.map((d, i) => (
            <div key={i} className="px-3 py-1.5 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: d.completed ? colors.completed : colors.planned }}
                />
                <span className="text-gray-800">{formatDate(d.date)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                {d.timeBlock !== 'FULL' && (
                  <span className="px-1.5 py-0.5 bg-gray-100 rounded">{d.timeBlock}</span>
                )}
                <span>{leaveLabel(d.leaveType)}</span>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="px-3 py-1.5 border-t text-xs flex justify-between" style={{ borderColor: colors.border }}>
        <div className="flex gap-3 text-gray-400">
          {sorted.filter(d => d.completed).length > 0 && (
            <span style={{ color: colors.completed }}>{sorted.filter(d => d.completed).reduce((s, d) => s + d.value, 0)} completed</span>
          )}
          {sorted.filter(d => !d.completed).length > 0 && (
            <span style={{ color: colors.planned }}>{sorted.filter(d => !d.completed).reduce((s, d) => s + d.value, 0)} planned</span>
          )}
        </div>
        <span className="font-semibold text-gray-600">{sorted.reduce((s, d) => s + d.value, 0)} total</span>
      </div>
    </div>
  );
}

function formatVal(val: number): string {
  if (val === 0) return '';
  return val % 1 === 0 ? val.toString() : val.toFixed(1);
}

function getQuarterTotals(months: Record<string, MonthData>, quarterMonths: string[]) {
  let completed = 0, planned = 0;
  for (const m of quarterMonths) {
    completed += months[m]?.completed || 0;
    planned += months[m]?.planned || 0;
  }
  return { completed, planned };
}

function getYearTotal(months: Record<string, MonthData>) {
  let completed = 0, planned = 0;
  for (const m of MONTH_KEYS) {
    completed += months[m]?.completed || 0;
    planned += months[m]?.planned || 0;
  }
  return { completed, planned };
}


// --- Multi-select provider dropdown ---
function ProviderMultiSelect({
  providers,
  selected,
  onChange,
}: {
  providers: ProviderPTO[];
  selected: Set<string>;
  onChange: (s: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = providers.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const allSelected = selected.size === 0; // empty = all
  const label = allSelected
    ? 'All Providers'
    : selected.size === 1
      ? providers.find(p => p.id === [...selected][0])?.name || '1 selected'
      : `${selected.size} providers selected`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="border rounded-lg px-3 py-1.5 text-sm min-w-[220px] text-left flex items-center justify-between gap-2"
        style={{ borderColor: colors.border }}
      >
        <span className="truncate">{label}</span>
        <svg className="w-4 h-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-50 w-[280px] max-h-[320px] flex flex-col" style={{ borderColor: colors.border }}>
          <div className="p-2 border-b" style={{ borderColor: colors.border }}>
            <input
              type="text"
              placeholder="Search providers..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
              style={{ borderColor: colors.border }}
              autoFocus
            />
          </div>
          <div className="p-1 border-b flex gap-1" style={{ borderColor: colors.border }}>
            <button
              onClick={() => { onChange(new Set()); }}
              className="text-xs px-2 py-1 rounded hover:bg-gray-100"
              style={{ color: colors.lightBlue }}
            >
              Select All
            </button>
            <button
              onClick={() => { onChange(new Set(['__none__'])); }}
              className="text-xs px-2 py-1 rounded hover:bg-gray-100"
              style={{ color: colors.lightBlue }}
            >
              Deselect All
            </button>
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.map(p => {
              const checked = allSelected || selected.has(p.id);
              return (
                <label key={p.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const next = new Set(selected);
                      if (allSelected) {
                        // Switching from all to specific: select all except this one
                        const allIds = new Set(providers.map(pr => pr.id));
                        allIds.delete(p.id);
                        onChange(allIds);
                      } else if (next.has(p.id)) {
                        next.delete(p.id);
                        if (next.size === 0) next.add('__none__');
                        onChange(next);
                      } else {
                        next.delete('__none__');
                        next.add(p.id);
                        // If all are now selected, go back to empty (= all)
                        if (next.size === providers.length) {
                          onChange(new Set());
                        } else {
                          onChange(next);
                        }
                      }
                    }}
                    className="rounded"
                    style={{ accentColor: colors.primaryBlue }}
                  />
                  <span>{p.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Cell components ---
function GroupedCell({ completed, planned, monthStatus }: { completed: number; planned: number; monthStatus?: 'past' | 'current' | 'future' }) {
  // For past months only show completed, for future only planned, for current/summary show both
  const showCompleted = monthStatus === 'future' ? false : completed > 0;
  const showPlanned = monthStatus === 'past' ? false : planned > 0;

  if (!showCompleted && !showPlanned) return <span className="text-gray-300 text-xs">-</span>;
  return (
    <div className="flex items-center justify-center gap-1">
      {showCompleted && (
        <span
          className="inline-block px-1.5 py-0.5 rounded text-xs font-semibold text-white"
          style={{ backgroundColor: colors.completed }}
        >
          {formatVal(completed)}
        </span>
      )}
      {showPlanned && (
        <span
          className="inline-block px-1.5 py-0.5 rounded text-xs font-semibold text-white"
          style={{ backgroundColor: colors.planned }}
        >
          {formatVal(planned)}
        </span>
      )}
    </div>
  );
}


// --- CSV ---
// Determine if a month is past, current, or future
function getMonthStatus(monthKey: string, year: number): 'past' | 'current' | 'future' {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed
  const m = parseInt(monthKey);
  if (year < currentYear || (year === currentYear && m < currentMonth)) return 'past';
  if (year === currentYear && m === currentMonth) return 'current';
  return 'future';
}

type DownloadMode = 'full' | 'completed_only' | 'quarters_only' | 'ytd_completed';

function buildCSV(providers: ProviderPTO[], year: number, mode: DownloadMode): string {
  const headers = ['Provider'];

  if (mode === 'ytd_completed') {
    // Just provider + YTD completed total
    headers.push('YTD Completed');
    const rows = [headers.join(',')];
    for (const p of providers) {
      const yt = getYearTotal(p.months);
      rows.push(`"${p.name}",${yt.completed || ''}`);
    }
    return rows.join('\n');
  }

  if (mode === 'quarters_only') {
    for (const q of QUARTERS) headers.push(q.label);
    headers.push('Total');
    const rows = [headers.join(',')];
    for (const p of providers) {
      const row: (string | number)[] = [`"${p.name}"`];
      for (const q of QUARTERS) {
        const qt = getQuarterTotals(p.months, q.months);
        row.push(qt.completed + qt.planned || '');
      }
      const yt = getYearTotal(p.months);
      row.push(yt.completed + yt.planned || '');
      rows.push(row.join(','));
    }
    return rows.join('\n');
  }

  if (mode === 'completed_only') {
    // Only past months with completed values
    for (let qi = 0; qi < 4; qi++) {
      let hasAnyPast = false;
      for (let mi = 0; mi < 3; mi++) {
        const monthKey = MONTH_KEYS[qi * 3 + mi];
        const status = getMonthStatus(monthKey, year);
        if (status === 'past' || status === 'current') {
          headers.push(MONTH_LABELS[qi * 3 + mi]);
          hasAnyPast = true;
        }
      }
      if (hasAnyPast) headers.push(QUARTERS[qi].label);
    }
    headers.push('Total Completed');
    const rows = [headers.join(',')];
    for (const p of providers) {
      const row: (string | number)[] = [`"${p.name}"`];
      for (const q of QUARTERS) {
        let qTotal = 0;
        let hasAnyPast = false;
        for (const m of q.months) {
          const status = getMonthStatus(m, year);
          if (status === 'past' || status === 'current') {
            const d = p.months[m] || { completed: 0, planned: 0 };
            row.push(d.completed || '');
            qTotal += d.completed;
            hasAnyPast = true;
          }
        }
        if (hasAnyPast) row.push(qTotal || '');
      }
      const yt = getYearTotal(p.months);
      row.push(yt.completed || '');
      rows.push(row.join(','));
    }
    return rows.join('\n');
  }

  // Full report
  for (let qi = 0; qi < 4; qi++) {
    for (let mi = 0; mi < 3; mi++) {
      const monthKey = MONTH_KEYS[qi * 3 + mi];
      const ml = MONTH_LABELS[qi * 3 + mi];
      const status = getMonthStatus(monthKey, year);
      if (status === 'past') {
        headers.push(ml);
      } else if (status === 'future') {
        headers.push(`${ml} (Planned)`);
      } else {
        headers.push(`${ml} (Completed)`, `${ml} (Planned)`);
      }
    }
    headers.push(QUARTERS[qi].label);
  }
  headers.push('Total');

  const rows = [headers.join(',')];
  for (const p of providers) {
    const row: (string | number)[] = [`"${p.name}"`];
    for (const q of QUARTERS) {
      let qTotal = 0;
      for (const m of q.months) {
        const d = p.months[m] || { completed: 0, planned: 0 };
        const status = getMonthStatus(m, year);
        if (status === 'past') {
          row.push(d.completed || '');
          qTotal += d.completed;
        } else if (status === 'future') {
          row.push(d.planned || '');
          qTotal += d.planned;
        } else {
          row.push(d.completed || '', d.planned || '');
          qTotal += d.completed + d.planned;
        }
      }
      row.push(qTotal || '');
    }
    const yt = getYearTotal(p.months);
    row.push(yt.completed + yt.planned || '');
    rows.push(row.join(','));
  }
  return rows.join('\n');
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// --- Quarter column bg ---
const qColBg = '#f1f5f9';
const qColBgAlt = '#e8ecf0';
const totalColBg = '#e2e8f0';
const totalColBgAlt = '#dbe1e8';

export default function PTOReportPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProviders, setSelectedProviders] = useState<Set<string>>(new Set()); // empty = all
  const [downloadOpen, setDownloadOpen] = useState(false);
  const downloadRef = useRef<HTMLDivElement>(null);
  const [popover, setPopover] = useState<{
    providerId: string;
    providerName: string;
    monthKey: string;
    monthLabel: string;
    days: DayDetail[];
    rect: { top: number; left: number; bottom: number; right: number };
  } | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/pto?year=${year}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [year]);

  const allSelected = selectedProviders.size === 0;
  const filteredProviders = data?.providers.filter(p => {
    if (allSelected) return true;
    return selectedProviders.has(p.id);
  }) || [];

  const handleDownload = (mode: DownloadMode) => {
    if (!filteredProviders.length) return;
    const nameCount = filteredProviders.length;
    const label = allSelected
      ? 'All_Providers'
      : nameCount === 1
        ? filteredProviders[0].name.replace(/[^a-zA-Z0-9]/g, '_')
        : `${nameCount}_Providers`;
    const modeLabel = { full: '', completed_only: '_Completed', quarters_only: '_Quarters', ytd_completed: '_YTD' }[mode];
    downloadCSV(buildCSV(filteredProviders, year, mode), `PTO_Report_${label}_${year}${modeLabel}.csv`);
    setDownloadOpen(false);
  };

  // Close download dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (downloadRef.current && !downloadRef.current.contains(e.target as Node)) setDownloadOpen(false);
    }
    if (downloadOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [downloadOpen]);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: colors.lightGray }}>
      <div className="max-w-[1500px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href="/admin/reports" className="text-sm hover:underline mb-2 inline-block" style={{ color: colors.lightBlue }}>
            &larr; Back to Reports
          </Link>
          <h1 className="text-2xl font-bold" style={{ color: colors.primaryBlue }}>PTO Report</h1>
          <p className="text-gray-600 text-sm mt-1">
            Provider PTO by month &amp; quarter &mdash; work days only (excludes weekends &amp; holidays)
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Year</label>
            <select
              value={year}
              onChange={e => setYear(parseInt(e.target.value))}
              className="border rounded-lg px-3 py-1.5 text-sm"
              style={{ borderColor: colors.border }}
            >
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Providers</label>
            {data && (
              <ProviderMultiSelect
                providers={data.providers}
                selected={selectedProviders}
                onChange={setSelectedProviders}
              />
            )}
          </div>

          <div ref={downloadRef} className="ml-auto relative">
            <button
              onClick={() => setDownloadOpen(!downloadOpen)}
              disabled={!data}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
              style={{ backgroundColor: colors.primaryBlue }}
            >
              Download CSV
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {downloadOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-50 w-[220px] py-1" style={{ borderColor: colors.border }}>
                <button onClick={() => handleDownload('full')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-700">
                  Full Report
                </button>
                <button onClick={() => handleDownload('completed_only')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-700">
                  Completed Days Only
                </button>
                <button onClick={() => handleDownload('quarters_only')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-700">
                  Quarter Totals Only
                </button>
                <button onClick={() => handleDownload('ytd_completed')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-700">
                  YTD Completed Total
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 mb-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="inline-block px-1.5 py-0.5 rounded text-xs font-semibold text-white" style={{ backgroundColor: colors.completed }}>3</span>
            <span className="text-gray-600">Completed (past)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block px-1.5 py-0.5 rounded text-xs font-semibold text-white" style={{ backgroundColor: colors.planned }}>2</span>
            <span className="text-gray-600">Planned (upcoming)</span>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-500">Loading...</div>
        ) : filteredProviders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">No providers selected</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th
                    className="text-left text-white font-medium px-4 py-3 sticky left-0 z-10"
                    style={{ backgroundColor: colors.primaryBlue, minWidth: 180 }}
                  >
                    Provider
                  </th>
                  {QUARTERS.map((q, qi) => (
                    <>
                      {MONTH_LABELS.slice(qi * 3, qi * 3 + 3).map((ml, mi) => {
                        const monthKey = MONTH_KEYS[qi * 3 + mi];
                        const ms = getMonthStatus(monthKey, year);
                        return (
                          <th
                            key={ml}
                            className="text-center text-white font-medium px-1 py-3"
                            style={{
                              backgroundColor: ms === 'future' ? '#1a4d8a' : colors.primaryBlue,
                              minWidth: 56,
                              opacity: ms === 'future' ? 0.85 : 1,
                            }}
                          >
                            {ml}
                            {ms === 'future' && <span className="block text-[9px] font-normal opacity-70">planned</span>}
                          </th>
                        );
                      })}
                      <th
                        key={q.label}
                        className="text-center text-white font-bold px-1 py-3"
                        style={{ backgroundColor: '#001f3f', minWidth: 56, borderLeft: '2px solid rgba(255,255,255,0.2)', borderRight: qi < 3 ? '2px solid rgba(255,255,255,0.3)' : undefined }}
                      >
                        {q.label}
                      </th>
                    </>
                  ))}
                  <th
                    className="text-center text-white font-bold px-2 py-3"
                    style={{ backgroundColor: '#001227', minWidth: 64, borderLeft: '2px solid rgba(255,255,255,0.2)' }}
                  >
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredProviders.map((p, idx) => {
                  const yearTotals = getYearTotal(p.months);
                  const grandTotal = yearTotals.completed + yearTotals.planned;
                  const rowBg = idx % 2 === 0 ? '#ffffff' : '#fafbfc';
                  return (
                    <tr key={p.id} style={{ backgroundColor: rowBg }} className="border-b border-gray-100">
                      <td
                        className="px-4 py-2.5 font-medium text-gray-800 sticky left-0 z-10 whitespace-nowrap"
                        style={{ backgroundColor: rowBg }}
                      >
                        {p.name}
                      </td>
                      {QUARTERS.map((q, qi) => (
                        <>
                          {q.months.map((m, mi) => {
                            const d = p.months[m] || { completed: 0, planned: 0, days: [] };
                            const ms = getMonthStatus(m, year);
                            const hasDays = d.days && d.days.length > 0;
                            const monthIdx = QUARTERS.indexOf(q) * 3 + mi;
                            return (
                              <td
                                key={m}
                                className={`text-center px-1 py-2 ${hasDays ? 'cursor-pointer hover:bg-blue-50 transition-colors' : ''}`}
                                onClick={(e) => {
                                  if (!hasDays) return;
                                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                  setPopover({
                                    providerId: p.id,
                                    providerName: p.name,
                                    monthKey: m,
                                    monthLabel: MONTH_LABELS[monthIdx],
                                    days: d.days,
                                    rect: { top: rect.top, left: rect.left, bottom: rect.bottom, right: rect.right },
                                  });
                                }}
                              >
                                <GroupedCell completed={d.completed} planned={d.planned} monthStatus={ms} />
                              </td>
                            );
                          })}
                          {/* Quarter total */}
                          {(() => {
                            const qt = getQuarterTotals(p.months, q.months);
                            return (
                              <td
                                key={q.label}
                                className="text-center px-1 py-2 font-semibold"
                                style={{
                                  backgroundColor: idx % 2 === 0 ? qColBg : qColBgAlt,
                                  borderLeft: '2px solid #e2e8f0',
                                  borderRight: qi < 3 ? '2px solid #e2e8f0' : undefined,
                                }}
                              >
                                <GroupedCell completed={qt.completed} planned={qt.planned} />
                              </td>
                            );
                          })()}
                        </>
                      ))}
                      {/* Year total */}
                      <td
                        className="text-center px-2 py-2 font-bold"
                        style={{
                          backgroundColor: idx % 2 === 0 ? totalColBg : totalColBgAlt,
                          borderLeft: '2px solid #cbd5e1',
                        }}
                      >
                        {grandTotal === 0 ? (
                          <span className="text-gray-300 text-xs">-</span>
                        ) : (
                          <GroupedCell completed={yearTotals.completed} planned={yearTotals.planned} />
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* Summary row */}
                {filteredProviders.length > 1 && (
                  <tr className="border-t-2" style={{ borderColor: colors.primaryBlue, backgroundColor: '#f8fafc' }}>
                    <td className="px-4 py-3 font-bold sticky left-0 z-10" style={{ color: colors.primaryBlue, backgroundColor: '#f8fafc' }}>
                      Total ({filteredProviders.length} providers)
                    </td>
                    {QUARTERS.map((q, qi) => (
                      <>
                        {q.months.map(m => {
                          let tc = 0, tp = 0;
                          const ms = getMonthStatus(m, year);
                          for (const p of filteredProviders) { tc += p.months[m]?.completed || 0; tp += p.months[m]?.planned || 0; }
                          return (
                            <td key={m} className="text-center px-1 py-3 font-semibold">
                              <GroupedCell completed={tc} planned={tp} monthStatus={ms} />
                            </td>
                          );
                        })}
                        {(() => {
                          let tc = 0, tp = 0;
                          for (const p of filteredProviders) { const qt = getQuarterTotals(p.months, q.months); tc += qt.completed; tp += qt.planned; }
                          return (
                            <td
                              key={q.label}
                              className="text-center px-1 py-3 font-bold"
                              style={{ backgroundColor: qColBg, borderLeft: '2px solid #e2e8f0', borderRight: qi < 3 ? '2px solid #e2e8f0' : undefined }}
                            >
                              <GroupedCell completed={tc} planned={tp} />
                            </td>
                          );
                        })()}
                      </>
                    ))}
                    {(() => {
                      let tc = 0, tp = 0;
                      for (const p of filteredProviders) { const yt = getYearTotal(p.months); tc += yt.completed; tp += yt.planned; }
                      return (
                        <td className="text-center px-2 py-3 font-bold" style={{ backgroundColor: totalColBg, borderLeft: '2px solid #cbd5e1' }}>
                          <GroupedCell completed={tc} planned={tp} />
                        </td>
                      );
                    })()}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Day detail popover */}
        {popover && (
          <DayDetailPopover
            days={popover.days}
            providerName={popover.providerName}
            monthLabel={popover.monthLabel}
            anchorRect={popover.rect}
            onClose={() => setPopover(null)}
          />
        )}
      </div>
    </div>
  );
}
