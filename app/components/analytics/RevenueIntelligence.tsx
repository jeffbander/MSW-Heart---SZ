'use client';

import { DollarSign, TrendingUp, FileText, Calendar, Target, AlertTriangle } from 'lucide-react';

interface RevenueData {
  month: string;
  rvuGenerated: number;
  revenue: number;
  collections: number;
  target: number;
}

interface CPTMetrics {
  code: string;
  description: string;
  volume: number;
  avgReimbursement: number;
  totalRevenue: number;
  trend: 'up' | 'down' | 'stable';
  percentage: number;
}

const revenueData: RevenueData[] = [
  { month: 'Oct', rvuGenerated: 2340, revenue: 654000, collections: 598000, target: 620000 },
  { month: 'Nov', rvuGenerated: 2520, revenue: 701000, collections: 642000, target: 630000 },
  { month: 'Dec', rvuGenerated: 2480, revenue: 689000, collections: 665000, target: 640000 },
  { month: 'Jan', rvuGenerated: 2650, revenue: 742000, collections: 698000, target: 650000 }
];

const cptMetrics: CPTMetrics[] = [
  {
    code: '93306',
    description: 'Echo complete',
    volume: 156,
    avgReimbursement: 285,
    totalRevenue: 44460,
    trend: 'up',
    percentage: 28.5
  },
  {
    code: '93350',
    description: 'Stress Echo',
    volume: 78,
    avgReimbursement: 420,
    totalRevenue: 32760,
    trend: 'up',
    percentage: 21.0
  },
  {
    code: '99214',
    description: 'Office Visit Level 4',
    volume: 124,
    avgReimbursement: 245,
    totalRevenue: 30380,
    trend: 'stable',
    percentage: 19.5
  },
  {
    code: '93312',
    description: 'TEE',
    volume: 34,
    avgReimbursement: 680,
    totalRevenue: 23120,
    trend: 'up',
    percentage: 14.8
  },
  {
    code: '93325',
    description: 'Doppler Echo',
    volume: 89,
    avgReimbursement: 195,
    totalRevenue: 17355,
    trend: 'down',
    percentage: 11.1
  },
  {
    code: '99213',
    description: 'Office Visit Level 3',
    volume: 67,
    avgReimbursement: 125,
    totalRevenue: 8375,
    trend: 'stable',
    percentage: 5.4
  }
];

export default function RevenueIntelligence() {
  const currentMonth = revenueData[revenueData.length - 1];
  const previousMonth = revenueData[revenueData.length - 2];
  const collectionRate = (currentMonth.collections / currentMonth.revenue * 100);
  const targetVariance = ((currentMonth.collections - currentMonth.target) / currentMonth.target * 100);
  const monthlyGrowth = ((currentMonth.revenue - previousMonth.revenue) / previousMonth.revenue * 100);

  const totalCPTRevenue = cptMetrics.reduce((sum, cpt) => sum + cpt.totalRevenue, 0);

  return (
    <div className="space-y-6">
      {/* Revenue Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Monthly Revenue</p>
              <p className="text-3xl font-bold text-[#003D7A]">
                ${(currentMonth.revenue / 1000).toFixed(0)}K
              </p>
              <p className={`text-sm mt-1 ${monthlyGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                <TrendingUp className="inline w-3 h-3 mr-1" />
                {monthlyGrowth >= 0 ? '+' : ''}{monthlyGrowth.toFixed(1)}% vs last month
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Collections</p>
              <p className="text-3xl font-bold text-[#003D7A]">
                ${(currentMonth.collections / 1000).toFixed(0)}K
              </p>
              <p className="text-sm text-blue-600 mt-1">
                {collectionRate.toFixed(1)}% collection rate
              </p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <FileText className="w-6 h-6 text-[#0078C8]" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">RVUs Generated</p>
              <p className="text-3xl font-bold text-[#003D7A]">
                {currentMonth.rvuGenerated.toLocaleString()}
              </p>
              <p className="text-sm text-green-600 mt-1">
                +{currentMonth.rvuGenerated - previousMonth.rvuGenerated} vs last month
              </p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <Target className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">vs Target</p>
              <p className={`text-3xl font-bold ${targetVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {targetVariance >= 0 ? '+' : ''}{targetVariance.toFixed(1)}%
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Target: ${(currentMonth.target / 1000).toFixed(0)}K
              </p>
            </div>
            <div className={`p-3 ${targetVariance >= 0 ? 'bg-green-50' : 'bg-red-50'} rounded-lg`}>
              {targetVariance >= 0 ? 
                <TrendingUp className="w-6 h-6 text-green-600" /> :
                <AlertTriangle className="w-6 h-6 text-red-600" />
              }
            </div>
          </div>
        </div>
      </div>

      {/* CPT Code Performance */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-[#003D7A]">CPT Code Performance</h3>
          <p className="text-sm text-gray-600">Current month revenue by procedure</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPT Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Volume</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Reimbursement</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Revenue</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">% of Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trend</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {cptMetrics.map((cpt) => (
                <tr key={cpt.code} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-mono text-sm font-medium text-gray-900">{cpt.code}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{cpt.description}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    {cpt.volume}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${cpt.avgReimbursement}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    ${cpt.totalRevenue.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center">
                      <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                        <div 
                          className="bg-[#0078C8] h-2 rounded-full"
                          style={{ width: `${(cpt.percentage / 30) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-gray-900">{cpt.percentage.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {cpt.trend === 'up' && (
                      <div className="flex items-center text-green-600">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                    )}
                    {cpt.trend === 'down' && (
                      <div className="flex items-center text-red-600">
                        <TrendingUp className="w-4 h-4 rotate-180" />
                      </div>
                    )}
                    {cpt.trend === 'stable' && (
                      <div className="w-4 h-4 bg-gray-400 rounded-full"></div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Revenue Trend */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-[#003D7A]">Revenue Trend</h3>
          <p className="text-sm text-gray-600">Monthly performance vs targets</p>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            {revenueData.map((month, index) => {
              const variance = ((month.collections - month.target) / month.target * 100);
              return (
                <div key={month.month} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{month.month} 2026</span>
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-600">
                        Collections: ${(month.collections / 1000).toFixed(0)}K
                      </span>
                      <span className={`text-sm font-medium ${
                        variance >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {variance >= 0 ? '+' : ''}{variance.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      {/* Target line */}
                      <div 
                        className="absolute h-3 w-1 bg-gray-600 rounded"
                        style={{ left: `${(month.target / Math.max(...revenueData.map(d => d.revenue))) * 100}%` }}
                      ></div>
                      {/* Collections bar */}
                      <div 
                        className={`h-3 rounded-full ${
                          month.collections >= month.target ? 'bg-green-500' : 'bg-orange-500'
                        }`}
                        style={{ width: `${(month.collections / Math.max(...revenueData.map(d => d.revenue))) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-center space-x-6 text-xs text-gray-600">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span>Above Target</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-orange-500 rounded"></div>
              <span>Below Target</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-1 h-3 bg-gray-600"></div>
              <span>Target Line</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}