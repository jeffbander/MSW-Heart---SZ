'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface SeriesConfig {
  key: string;
  label: string;
  color: string;
}

interface TrendData {
  trends: Record<string, unknown>[];
  series: SeriesConfig[];
  isPercentage: boolean;
}

const METRIC_OPTIONS = [
  { value: 'total_patients_seen', label: 'Total Patients Seen' },
  { value: 'by_visit_type', label: 'By Visit Type' },
  { value: 'by_testing_department', label: 'By Testing Department' },
  { value: 'no_show_rate', label: 'No Show Rate' },
  { value: 'late_cancel_rate', label: 'Late Cancel Rate' },
  { value: 'new_patient_pct', label: 'New Patient %' },
];

export default function TrendChart() {
  const [metric, setMetric] = useState('total_patients_seen');
  const [data, setData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/statistics/trends?months=12&metric=${metric}`)
      .then(r => r.json())
      .then((json: TrendData) => {
        // Add display labels to each trend point
        const trends = (json.trends || []).map((t) => ({
          ...t,
          label: new Date((t.month as string) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        }));
        setData({ ...json, trends });
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [metric]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-base font-semibold mb-4" style={{ color: '#003D7A' }}>Monthly Trends</h3>
        <div className="h-72 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (!data || data.trends.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-base font-semibold mb-4" style={{ color: '#003D7A' }}>Monthly Trends</h3>
        <div className="h-72 flex items-center justify-center text-gray-400 text-sm">
          No trend data available. Upload multiple months of data to see trends.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold" style={{ color: '#003D7A' }}>Monthly Trends</h3>
        <select
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
          className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white"
        >
          {METRIC_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.trends} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B7280' }} />
            <YAxis
              tick={{ fontSize: 11, fill: '#6B7280' }}
              tickFormatter={(v: number) => data.isPercentage ? `${v}%` : v.toLocaleString()}
            />
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={((value: any, name: any) => {
                const series = data.series.find(s => s.key === name);
                const label = series?.label || name;
                const formatted = data.isPercentage ? `${Number(value).toFixed(1)}%` : Number(value).toLocaleString();
                return [formatted, label];
              }) as any}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              labelFormatter={((label: any) => String(label)) as any}
            />
            <Legend
              formatter={(value: string) => {
                const series = data.series.find(s => s.key === value);
                return series?.label || value;
              }}
            />
            {data.series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
