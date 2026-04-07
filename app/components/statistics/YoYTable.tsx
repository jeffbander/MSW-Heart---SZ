'use client';

import React from 'react';

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// Colors for year columns: each year gets a subtle tint
const YEAR_COLORS = ['#003D7A', '#0078C8', '#00A3AD', '#7C3AED'];
const YEAR_BG_LIGHT = ['#f0f4f8', '#eef6ff', '#edfcfa', '#f5f3ff'];

interface RowData {
  label: string;
  isSubRow?: boolean;
  monthData: Record<number, Record<number, number>>;
}

interface YoYTableProps {
  title: string;
  accentColor: string;
  rows: RowData[];
  years: number[];
  months: number[];
  tableId: string;
}

function pctChange(base: number, current: number): { text: string; color: string } {
  if (base === 0 && current === 0) return { text: '--', color: '#9ca3af' };
  if (base === 0) return { text: 'New', color: '#2563eb' };
  const pct = ((current - base) / base) * 100;
  const sign = pct > 0 ? '+' : '';
  return {
    text: `${sign}${pct.toFixed(1)}%`,
    color: pct > 0 ? '#16a34a' : pct < 0 ? '#dc2626' : '#9ca3af',
  };
}

export default function YoYTable({ title, accentColor, rows, years, months, tableId }: YoYTableProps) {
  const showYtd = months.length > 1;
  const numYears = years.length;
  // Columns per month group: one column per year + % change column (comparing each to previous year)
  const colsPerMonth = numYears + (numYears > 1 ? 1 : 0); // years + 1 change column (latest vs first)

  // Compute total row
  const totalMonthData: Record<number, Record<number, number>> = {};
  for (const m of months) {
    totalMonthData[m] = {};
    for (const yr of years) totalMonthData[m][yr] = 0;
    for (const row of rows) {
      if (row.isSubRow) continue;
      for (const yr of years) {
        totalMonthData[m][yr] += row.monthData[m]?.[yr] || 0;
      }
    }
  }

  const renderDataCells = (monthData: Record<number, Record<number, number>>, bold = false) => {
    const cells: React.ReactNode[] = [];
    const ytdByYear: Record<number, number> = {};
    for (const yr of years) ytdByYear[yr] = 0;

    for (const m of months) {
      for (const yr of years) {
        const val = monthData[m]?.[yr] || 0;
        ytdByYear[yr] += val;
        cells.push(
          <td key={`${m}-${yr}`} style={{
            padding: '8px 10px', textAlign: 'right',
            borderLeft: yr === years[0] ? '1px solid #e5e7eb' : undefined,
            borderBottom: '1px solid #e5e7eb',
            fontVariantNumeric: 'tabular-nums',
            fontWeight: bold ? 700 : 400,
            fontSize: '0.85rem',
          }}>
            {val > 0 ? val.toLocaleString() : <span style={{ color: '#d1d5db' }}>-</span>}
          </td>
        );
      }
      // % change: latest year vs first year
      if (numYears > 1) {
        const first = monthData[m]?.[years[0]] || 0;
        const last = monthData[m]?.[years[numYears - 1]] || 0;
        const chg = pctChange(first, last);
        cells.push(
          <td key={`${m}-chg`} style={{
            padding: '8px 8px', textAlign: 'right',
            borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb',
            fontVariantNumeric: 'tabular-nums', fontSize: '0.78rem',
            fontWeight: bold ? 600 : 500, color: chg.color,
          }}>
            {chg.text}
          </td>
        );
      }
    }

    if (showYtd) {
      for (const yr of years) {
        cells.push(
          <td key={`ytd-${yr}`} style={{
            padding: '8px 10px', textAlign: 'right',
            borderLeft: yr === years[0] ? '2px solid #d1d5db' : undefined,
            borderBottom: '1px solid #e5e7eb',
            fontVariantNumeric: 'tabular-nums',
            fontWeight: bold ? 700 : 600,
            backgroundColor: '#fafafa',
            fontSize: '0.85rem',
          }}>
            {ytdByYear[yr] > 0 ? ytdByYear[yr].toLocaleString() : <span style={{ color: '#d1d5db' }}>-</span>}
          </td>
        );
      }
      if (numYears > 1) {
        const ytdChg = pctChange(ytdByYear[years[0]], ytdByYear[years[numYears - 1]]);
        cells.push(
          <td key="ytd-chg" style={{
            padding: '8px 8px', textAlign: 'right',
            borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb',
            fontVariantNumeric: 'tabular-nums', fontSize: '0.78rem',
            fontWeight: bold ? 600 : 500, backgroundColor: '#fafafa', color: ytdChg.color,
          }}>
            {ytdChg.text}
          </td>
        );
      }
    }

    return cells;
  };

  return (
    <div>
      <h3 style={{ color: '#003D7A', fontWeight: 600, fontSize: '1rem', marginBottom: '0.75rem', borderLeft: `4px solid ${accentColor}`, paddingLeft: '12px' }}>
        {title}
      </h3>
      <div style={{ overflowX: 'auto' }}>
        <table id={tableId} style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', fontSize: '0.875rem', border: '1px solid #d1d5db' }}>
          <thead>
            {/* Month span row */}
            <tr>
              <th rowSpan={2} style={{ padding: '10px 12px', textAlign: 'left', backgroundColor: '#003D7A', color: 'white', fontWeight: 600, borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', minWidth: 180 }}>
                Category
              </th>
              {months.map(m => (
                <th key={m} colSpan={colsPerMonth} style={{ padding: '8px 10px', textAlign: 'center', backgroundColor: '#003D7A', color: 'white', fontWeight: 600, borderLeft: '1px solid rgba(255,255,255,0.2)', borderBottom: '1px solid #e5e7eb' }}>
                  {MONTH_NAMES[m]}
                </th>
              ))}
              {showYtd && (
                <th colSpan={colsPerMonth} style={{ padding: '8px 10px', textAlign: 'center', backgroundColor: '#003D7A', color: 'white', fontWeight: 700, borderLeft: '2px solid rgba(255,255,255,0.4)', borderBottom: '1px solid #e5e7eb' }}>
                  YTD
                </th>
              )}
            </tr>
            {/* Year sub-header row */}
            <tr>
              {[...months, ...(showYtd ? [-1] : [])].map((m, mi) => {
                const isYtd = m === -1;
                return (
                  <React.Fragment key={mi}>
                    {years.map((yr, yi) => (
                      <th key={`${m}-${yr}`} style={{
                        padding: '6px 10px', textAlign: 'right',
                        backgroundColor: isYtd ? '#e5e7eb' : '#f3f4f6',
                        fontWeight: 600, fontSize: '0.75rem', color: YEAR_COLORS[yi] || '#374151',
                        borderLeft: yi === 0 ? (isYtd ? '2px solid #d1d5db' : '1px solid #e5e7eb') : undefined,
                        borderBottom: '1px solid #d1d5db',
                      }}>
                        {yr}
                      </th>
                    ))}
                    {numYears > 1 && (
                      <th style={{
                        padding: '6px 8px', textAlign: 'right',
                        backgroundColor: isYtd ? '#e5e7eb' : '#f3f4f6',
                        fontWeight: 600, fontSize: '0.75rem', color: '#374151',
                        borderRight: '1px solid #e5e7eb',
                        borderBottom: '1px solid #d1d5db',
                      }}>
                        % Chg
                      </th>
                    )}
                  </React.Fragment>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ backgroundColor: i % 2 === 1 && !row.isSubRow ? '#fafafa' : 'white' }}>
                <td style={{
                  padding: row.isSubRow ? '6px 12px 6px 32px' : '8px 12px',
                  fontWeight: row.isSubRow ? 400 : 500,
                  color: row.isSubRow ? '#6b7280' : '#111827',
                  fontSize: row.isSubRow ? '0.8rem' : '0.875rem',
                  borderRight: '1px solid #e5e7eb',
                  borderBottom: '1px solid #e5e7eb',
                  whiteSpace: 'nowrap',
                }}>
                  {row.label}
                </td>
                {renderDataCells(row.monthData)}
              </tr>
            ))}
            {/* Total row */}
            <tr style={{ backgroundColor: '#f3f4f6', borderTop: '2px solid #9ca3af' }}>
              <td style={{ padding: '8px 12px', fontWeight: 700, color: '#111827', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #d1d5db' }}>
                TOTAL
              </td>
              {renderDataCells(totalMonthData, true)}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
