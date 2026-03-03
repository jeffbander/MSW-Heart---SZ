'use client';

import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Label } from 'recharts';

const COLORS = ['#003D7A', '#0078C8', '#00A3AD', '#059669', '#D97706', '#DC2626', '#7C3AED', '#DB2777', '#4B5563', '#92400E', '#065F46', '#1E40AF'];

interface PayerMixChartProps {
  month: string;
  comparisonMode?: string;
}

const VISIT_TYPES = ['All Visit Types', 'New Patient', 'Follow Up', 'Leqvio', 'Research', 'Video Visit', 'Annual Well Visit', 'Ancillary'];
const DEPARTMENTS = ['All Departments', 'CVI Echo', 'Echo Lab (4th Floor)', 'Vascular', 'Nuclear', 'EP', 'CT', 'Cardio Vein'];

export default function PayerMixChart({ month, comparisonMode }: PayerMixChartProps) {
  const [data, setData] = useState<{ name: string; value: number; pct: number }[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'practice' | 'department' | 'visitType'>('practice');
  const [visitType, setVisitType] = useState('All Visit Types');
  const [department, setDepartment] = useState('All Departments');
  const [timeRange, setTimeRange] = useState<'month' | 'ytd'>('month');

  useEffect(() => {
    if (!month) return;
    setLoading(true);

    const params = new URLSearchParams({ reportMonth: month, timeRange });
    if (filterType === 'visitType' && visitType !== 'All Visit Types') {
      params.set('visitType', visitType);
    }
    if (filterType === 'department' && department !== 'All Departments') {
      params.set('department', department);
    }

    fetch(`/api/statistics/payer-mix?${params}`)
      .then(r => r.json())
      .then(json => {
        const dist = json.distribution || {};
        const pcts = json.percentages || {};
        const items = Object.entries(dist)
          .map(([name, value]) => ({ name, value: value as number, pct: (pcts[name] as number) || 0 }))
          .sort((a, b) => b.value - a.value);
        setData(items);
        setTotal(json.total || 0);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [month, filterType, visitType, department, timeRange]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-base font-semibold mb-4 pl-4" style={{ color: '#003D7A', borderLeft: '4px solid #059669' }}>Payer Mix</h3>
        <div className="h-64 flex items-center justify-center">
          <div className="animate-pulse space-y-3 w-full">
            <div className="h-48 bg-gray-200 rounded-full w-48 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-base font-semibold pl-4" style={{ color: '#003D7A', borderLeft: '4px solid #059669' }}>Payer Mix</h3>
        <span className="text-xs text-gray-400">{total.toLocaleString()} visits</span>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value as 'practice' | 'department' | 'visitType'); setVisitType('All Visit Types'); setDepartment('All Departments'); }}
          className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white"
        >
          <option value="practice">Whole Practice</option>
          <option value="department">By Department</option>
          <option value="visitType">By Visit Type</option>
        </select>

        {filterType === 'visitType' && (
          <select
            value={visitType}
            onChange={(e) => setVisitType(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white"
          >
            {VISIT_TYPES.map(vt => <option key={vt} value={vt}>{vt}</option>)}
          </select>
        )}

        {filterType === 'department' && (
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white"
          >
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}

        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as 'month' | 'ytd')}
          className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white ml-auto"
        >
          <option value="month">Selected Month</option>
          <option value="ytd">Year to Date</option>
        </select>
      </div>

      {data.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No data available</div>
      ) : (
        <div className="flex gap-6">
          <div className="w-1/2 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.slice(0, 10)}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  nameKey="name"
                  paddingAngle={1}
                >
                  {data.slice(0, 10).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                  <Label
                    value={total.toLocaleString()}
                    position="center"
                    className="text-lg font-bold"
                    style={{ fontSize: '18px', fontWeight: 'bold', fill: '#003D7A' }}
                  />
                </Pie>
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={((value: any, name: any) => [`${(Number(value) || 0).toLocaleString()} (${data.find(d => d.name === name)?.pct || 0}%)`, name]) as any}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="w-1/2 overflow-y-auto max-h-72">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1.5 font-semibold text-gray-500">Payer</th>
                  <th className="text-right py-1.5 font-semibold text-gray-500">Count</th>
                  <th className="text-right py-1.5 font-semibold text-gray-500">%</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, i) => (
                  <tr key={item.name} className={`border-b border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                    <td className="py-1.5 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="truncate">{item.name}</span>
                    </td>
                    <td className="text-right py-1.5 text-gray-600">{item.value.toLocaleString()}</td>
                    <td className="text-right py-1.5 text-gray-500">{item.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
