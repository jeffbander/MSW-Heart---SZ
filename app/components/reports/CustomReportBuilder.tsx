'use client';

import { useState } from 'react';
import { ReportDataSource } from '@/lib/types';
import {
  columnDefinitions,
  dataSourceLabels,
  defaultSelectedColumns,
  dayOfWeekLabels,
} from './reportColumns';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  border: '#E5E7EB',
};

// Helper to format date in local timezone
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to get nested value from object
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Helper to format cell value for display
function formatCellValue(value: any, columnKey: string): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (columnKey === 'day_of_week') return dayOfWeekLabels[value] || String(value);
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

interface CustomReportBuilderProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

export default function CustomReportBuilder({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: CustomReportBuilderProps) {
  const [dataSource, setDataSource] = useState<ReportDataSource>('schedule_assignments');
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    new Set(defaultSelectedColumns.schedule_assignments)
  );
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any[] | null>(null);
  const [totalRows, setTotalRows] = useState(0);

  const availableColumns = columnDefinitions[dataSource];

  const handleDataSourceChange = (newSource: ReportDataSource) => {
    setDataSource(newSource);
    setSelectedColumns(new Set(defaultSelectedColumns[newSource]));
    setReportData(null);
  };

  const toggleColumn = (columnKey: string) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnKey)) {
        next.delete(columnKey);
      } else {
        next.add(columnKey);
      }
      return next;
    });
  };

  const selectAllColumns = () => {
    setSelectedColumns(new Set(availableColumns.map((c) => c.key)));
  };

  const clearAllColumns = () => {
    setSelectedColumns(new Set());
  };

  const generateReport = async () => {
    if (selectedColumns.size === 0) {
      alert('Please select at least one column');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/reports/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataSource,
          selectedColumns: Array.from(selectedColumns),
          filters: [],
          startDate,
          endDate,
        }),
      });

      const data = await response.json();
      if (data.error) {
        alert('Error generating report: ' + data.error);
        return;
      }

      setReportData(data.data);
      setTotalRows(data.totalRows);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!reportData || reportData.length === 0) return;

    const orderedColumns = availableColumns.filter((c) => selectedColumns.has(c.key));
    const headers = orderedColumns.map((c) => c.label);
    const rows = reportData.map((row) =>
      orderedColumns.map((col) => {
        const value = getNestedValue(row, col.key);
        const formatted = formatCellValue(value, col.key);
        // Escape quotes and wrap in quotes if contains comma
        if (formatted.includes(',') || formatted.includes('"')) {
          return `"${formatted.replace(/"/g, '""')}"`;
        }
        return formatted;
      })
    );

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `custom-report-${dataSource}-${formatLocalDate(new Date())}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const orderedSelectedColumns = availableColumns.filter((c) => selectedColumns.has(c.key));

  return (
    <div className="space-y-6">
      {/* Builder Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4" style={{ color: colors.primaryBlue }}>
          Custom Report Builder
        </h3>

        {/* Data Source Selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Data Source</label>
          <select
            value={dataSource}
            onChange={(e) => handleDataSourceChange(e.target.value as ReportDataSource)}
            className="w-full max-w-md px-3 py-2 border rounded"
            style={{ borderColor: colors.border }}
          >
            {Object.entries(dataSourceLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Column Selector */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium">
              Columns ({selectedColumns.size} selected)
            </label>
            <div className="space-x-2">
              <button
                onClick={selectAllColumns}
                className="text-sm px-2 py-1 rounded border hover:bg-gray-50"
                style={{ borderColor: colors.border, color: colors.lightBlue }}
              >
                Select All
              </button>
              <button
                onClick={clearAllColumns}
                className="text-sm px-2 py-1 rounded border hover:bg-gray-50"
                style={{ borderColor: colors.border, color: colors.lightBlue }}
              >
                Clear All
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableColumns.map((col) => {
              const isSelected = selectedColumns.has(col.key);
              return (
                <button
                  key={col.key}
                  onClick={() => toggleColumn(col.key)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    isSelected ? 'text-white' : 'border hover:bg-gray-100'
                  }`}
                  style={{
                    backgroundColor: isSelected ? colors.primaryBlue : 'transparent',
                    borderColor: isSelected ? colors.primaryBlue : colors.border,
                    color: isSelected ? 'white' : colors.primaryBlue,
                  }}
                >
                  {col.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Date Range (for applicable data sources) */}
        {(dataSource === 'schedule_assignments' || dataSource === 'provider_leaves') && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Date Range</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                className="px-3 py-2 border rounded"
                style={{ borderColor: colors.border }}
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                className="px-3 py-2 border rounded"
                style={{ borderColor: colors.border }}
              />
            </div>
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={generateReport}
          disabled={loading || selectedColumns.size === 0}
          className="px-6 py-2 rounded text-white font-medium disabled:opacity-50"
          style={{ backgroundColor: colors.primaryBlue }}
        >
          {loading ? 'Generating...' : 'Generate Report'}
        </button>
      </div>

      {/* Results */}
      {reportData && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b" style={{ borderColor: colors.border }}>
            <div className="text-sm text-gray-600">
              Showing {reportData.length} row{reportData.length !== 1 ? 's' : ''}
            </div>
            <button
              onClick={exportCSV}
              disabled={reportData.length === 0}
              className="px-4 py-2 rounded text-white font-medium flex items-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: colors.lightBlue }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Export CSV
            </button>
          </div>

          {reportData.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No data found for the selected criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: colors.primaryBlue }}>
                    {orderedSelectedColumns.map((col) => (
                      <th
                        key={col.key}
                        className="px-4 py-3 text-left text-white text-sm font-medium whitespace-nowrap"
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((row, idx) => (
                    <tr key={row.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      {orderedSelectedColumns.map((col) => {
                        const value = getNestedValue(row, col.key);
                        return (
                          <td key={col.key} className="px-4 py-3 text-sm whitespace-nowrap">
                            {formatCellValue(value, col.key)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
