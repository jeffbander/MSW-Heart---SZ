'use client';

import { TrendingUp, TrendingDown, Clock, Calendar, Activity } from 'lucide-react';

interface ProviderData {
  name: string;
  initials: string;
  patientsThisWeek: number;
  avgSessionTime: number;
  efficiency: number;
  rvuGenerated: number;
  trend: 'up' | 'down' | 'stable';
}

const mockProviderData: ProviderData[] = [
  {
    name: 'Dr. Jeffrey Bander',
    initials: 'JB',
    patientsThisWeek: 47,
    avgSessionTime: 22,
    efficiency: 94,
    rvuGenerated: 156.7,
    trend: 'up'
  },
  {
    name: 'Dr. Sarah Chen',
    initials: 'SC',
    patientsThisWeek: 42,
    avgSessionTime: 25,
    efficiency: 89,
    rvuGenerated: 142.3,
    trend: 'up'
  },
  {
    name: 'Dr. Michael Rodriguez',
    initials: 'MR',
    patientsThisWeek: 38,
    avgSessionTime: 28,
    efficiency: 85,
    rvuGenerated: 128.9,
    trend: 'stable'
  },
  {
    name: 'Dr. Emily Watson',
    initials: 'EW',
    patientsThisWeek: 35,
    avgSessionTime: 24,
    efficiency: 87,
    rvuGenerated: 118.4,
    trend: 'down'
  },
  {
    name: 'Dr. David Kim',
    initials: 'DK',
    patientsThisWeek: 41,
    avgSessionTime: 26,
    efficiency: 91,
    rvuGenerated: 139.2,
    trend: 'up'
  }
];

export default function ProviderMetrics() {
  const totalPatients = mockProviderData.reduce((sum, provider) => sum + provider.patientsThisWeek, 0);
  const avgEfficiency = mockProviderData.reduce((sum, provider) => sum + provider.efficiency, 0) / mockProviderData.length;
  const totalRVU = mockProviderData.reduce((sum, provider) => sum + provider.rvuGenerated, 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Patients</p>
              <p className="text-3xl font-bold text-[#003D7A]">{totalPatients}</p>
              <p className="text-sm text-green-600 mt-1">
                <TrendingUp className="inline w-3 h-3 mr-1" />
                +12% vs last week
              </p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <Activity className="w-6 h-6 text-[#0078C8]" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Efficiency</p>
              <p className="text-3xl font-bold text-[#003D7A]">{avgEfficiency.toFixed(1)}%</p>
              <p className="text-sm text-green-600 mt-1">
                <TrendingUp className="inline w-3 h-3 mr-1" />
                +3.2% vs last week
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total RVUs</p>
              <p className="text-3xl font-bold text-[#003D7A]">{totalRVU.toFixed(1)}</p>
              <p className="text-sm text-green-600 mt-1">
                <TrendingUp className="inline w-3 h-3 mr-1" />
                +8.1% vs last week
              </p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Provider Performance Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-[#003D7A]">Provider Performance</h3>
          <p className="text-sm text-gray-600">Current week performance metrics</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patients</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Efficiency</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RVUs</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trend</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {mockProviderData.map((provider, index) => (
                <tr key={provider.initials} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-[#003D7A] rounded-full flex items-center justify-center text-white font-medium text-sm mr-3">
                        {provider.initials}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{provider.name}</div>
                        <div className="text-sm text-gray-500">{provider.initials}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {provider.patientsThisWeek}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 text-gray-400 mr-1" />
                      {provider.avgSessionTime} min
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center">
                      <div className={`w-2 h-2 rounded-full mr-2 ${
                        provider.efficiency >= 90 ? 'bg-green-500' :
                        provider.efficiency >= 85 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}></div>
                      {provider.efficiency}%
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    {provider.rvuGenerated.toFixed(1)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {provider.trend === 'up' && (
                      <TrendingUp className="w-4 h-4 text-green-500" />
                    )}
                    {provider.trend === 'down' && (
                      <TrendingDown className="w-4 h-4 text-red-500" />
                    )}
                    {provider.trend === 'stable' && (
                      <div className="w-4 h-4 bg-gray-400 rounded-full"></div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}