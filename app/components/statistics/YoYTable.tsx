'use client';

import React from 'react';

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

interface RowData {
  label: string;
  isSubRow?: boolean;
  monthData: Record<number, { year1: number; year2: number }>;
}

interface YoYTableProps {
  title: string;
  accentColor: string;
  rows: RowData[];
  year1: number;
  year2: number;
  months: number[];
  tableId: string;
}

function pctChange(y1: number, y2: number): { text: string; color: string } {
  if (y1 === 0 && y2 === 0) return { text: '--', color: 'text-gray-400' };
  if (y1 === 0) return { text: 'New', color: 'text-blue-600' };
  const pct = ((y2 - y1) / y1) * 100;
  const sign = pct > 0 ? '+' : '';
  return {
    text: `${sign}${pct.toFixed(1)}%`,
    color: pct > 0 ? 'text-green-600' : pct < 0 ? 'text-red-600' : 'text-gray-400',
  };
}

export default function YoYTable({ title, accentColor, rows, year1, year2, months, tableId }: YoYTableProps) {
  const showYtd = months.length > 1;

  // Compute total row
  const totalMonthData: Record<number, { year1: number; year2: number }> = {};
  for (const m of months) {
    totalMonthData[m] = { year1: 0, year2: 0 };
    for (const row of rows) {
      if (row.isSubRow) continue;
      const d = row.monthData[m] || { year1: 0, year2: 0 };
      totalMonthData[m].year1 += d.year1;
      totalMonthData[m].year2 += d.year2;
    }
  }

  const renderDataCells = (monthData: Record<number, { year1: number; year2: number }>, bold = false) => {
    const cells = [];
    let ytdY1 = 0, ytdY2 = 0;

    for (const m of months) {
      const d = monthData[m] || { year1: 0, year2: 0 };
      ytdY1 += d.year1;
      ytdY2 += d.year2;
      const chg = pctChange(d.year1, d.year2);
      cells.push(
        <td key={`${m}-y1`} style={{ padding: '8px 12px', textAlign: 'right', borderLeft: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', fontVariantNumeric: 'tabular-nums', fontWeight: bold ? 700 : 400 }}>
          {d.year1.toLocaleString()}
        </td>,
        <td key={`${m}-y2`} style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontVariantNumeric: 'tabular-nums', fontWeight: bold ? 700 : 400 }}>
          {d.year2.toLocaleString()}
        </td>,
        <td key={`${m}-chg`} style={{ padding: '8px 12px', textAlign: 'right', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', fontVariantNumeric: 'tabular-nums', fontSize: '0.8rem', fontWeight: bold ? 600 : 500, color: chg.color === 'text-green-600' ? '#16a34a' : chg.color === 'text-red-600' ? '#dc2626' : chg.color === 'text-blue-600' ? '#2563eb' : '#9ca3af' }}>
          {chg.text}
        </td>
      );
    }

    if (showYtd) {
      const ytdChg = pctChange(ytdY1, ytdY2);
      cells.push(
        <td key="ytd-y1" style={{ padding: '8px 12px', textAlign: 'right', borderLeft: '2px solid #d1d5db', borderBottom: '1px solid #e5e7eb', fontVariantNumeric: 'tabular-nums', fontWeight: bold ? 700 : 600, backgroundColor: '#fafafa' }}>
          {ytdY1.toLocaleString()}
        </td>,
        <td key="ytd-y2" style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontVariantNumeric: 'tabular-nums', fontWeight: bold ? 700 : 600, backgroundColor: '#fafafa' }}>
          {ytdY2.toLocaleString()}
        </td>,
        <td key="ytd-chg" style={{ padding: '8px 12px', textAlign: 'right', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', fontVariantNumeric: 'tabular-nums', fontSize: '0.8rem', fontWeight: bold ? 600 : 500, backgroundColor: '#fafafa', color: ytdChg.color === 'text-green-600' ? '#16a34a' : ytdChg.color === 'text-red-600' ? '#dc2626' : ytdChg.color === 'text-blue-600' ? '#2563eb' : '#9ca3af' }}>
          {ytdChg.text}
        </td>
      );
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
                <th key={m} colSpan={3} style={{ padding: '8px 12px', textAlign: 'center', backgroundColor: '#003D7A', color: 'white', fontWeight: 600, borderLeft: '1px solid rgba(255,255,255,0.2)', borderBottom: '1px solid #e5e7eb' }}>
                  {MONTH_NAMES[m]}
                </th>
              ))}
              {showYtd && (
                <th colSpan={3} style={{ padding: '8px 12px', textAlign: 'center', backgroundColor: '#003D7A', color: 'white', fontWeight: 700, borderLeft: '2px solid rgba(255,255,255,0.4)', borderBottom: '1px solid #e5e7eb' }}>
                  YTD
                </th>
              )}
            </tr>
            {/* Year sub-header row */}
            <tr>
              {months.map(m => (
                <React.Fragment key={m}>
                  <th style={{ padding: '6px 12px', textAlign: 'right', backgroundColor: '#f3f4f6', fontWeight: 600, fontSize: '0.75rem', color: '#374151', borderLeft: '1px solid #e5e7eb', borderBottom: '1px solid #d1d5db' }}>{year1}</th>
                  <th style={{ padding: '6px 12px', textAlign: 'right', backgroundColor: '#f3f4f6', fontWeight: 600, fontSize: '0.75rem', color: '#374151', borderBottom: '1px solid #d1d5db' }}>{year2}</th>
                  <th style={{ padding: '6px 12px', textAlign: 'right', backgroundColor: '#f3f4f6', fontWeight: 600, fontSize: '0.75rem', color: '#374151', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #d1d5db' }}>% Chg</th>
                </React.Fragment>
              ))}
              {showYtd && (
                <>
                  <th style={{ padding: '6px 12px', textAlign: 'right', backgroundColor: '#e5e7eb', fontWeight: 600, fontSize: '0.75rem', color: '#374151', borderLeft: '2px solid #d1d5db', borderBottom: '1px solid #d1d5db' }}>{year1}</th>
                  <th style={{ padding: '6px 12px', textAlign: 'right', backgroundColor: '#e5e7eb', fontWeight: 600, fontSize: '0.75rem', color: '#374151', borderBottom: '1px solid #d1d5db' }}>{year2}</th>
                  <th style={{ padding: '6px 12px', textAlign: 'right', backgroundColor: '#e5e7eb', fontWeight: 600, fontSize: '0.75rem', color: '#374151', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #d1d5db' }}>% Chg</th>
                </>
              )}
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
