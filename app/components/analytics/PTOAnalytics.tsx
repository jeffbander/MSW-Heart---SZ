'use client';

import { Calendar, Users, DollarSign, AlertTriangle, Clock, TrendingDown } from 'lucide-react';

interface PTORequest {
  id: string;
  provider: string;
  startDate: string;
  endDate: string;
  days: number;
  type: 'vacation' | 'sick' | 'personal' | 'conference';
  status: 'approved' | 'pending' | 'denied';
  impactLevel: 'low' | 'medium' | 'high' | 'critical';
  coverageArranged: boolean;
}

interface CoverageMetrics {
  month: string;
  scheduledPTO: number;
  coverageCost: number;
  patientsRescheduled: number;
  revenueImpact: number;
}

const ptoRequests: PTORequest[] = [
  {
    id: '1',
    provider: 'Dr. Emily Watson',
    startDate: '2026-02-10',
    endDate: '2026-02-14',
    days: 5,
    type: 'vacation',
    status: 'approved',
    impactLevel: 'medium',
    coverageArranged: true
  },
  {
    id: '2',
    provider: 'Dr. Michael Rodriguez',
    startDate: '2026-02-17',
    endDate: '2026-02-17',
    days: 1,
    type: 'sick',
    status: 'approved',
    impactLevel: 'low',
    coverageArranged: true
  },
  {
    id: '3',
    provider: 'Dr. Sarah Chen',
    startDate: '2026-03-03',
    endDate: '2026-03-07',
    days: 5,
    type: 'conference',
    status: 'pending',
    impactLevel: 'high',
    coverageArranged: false
  },
  {
    id: '4',
    provider: 'Dr. Jeffrey Bander',
    startDate: '2026-03-15',
    endDate: '2026-03-22',
    days: 8,
    type: 'vacation',
    status: 'pending',
    impactLevel: 'critical',
    coverageArranged: false
  },
  {
    id: '5',
    provider: 'Dr. David Kim',
    startDate: '2026-02-28',
    endDate: '2026-03-01',
    days: 2,
    type: 'personal',
    status: 'approved',
    impactLevel: 'low',
    coverageArranged: true
  }
];

const coverageData: CoverageMetrics[] = [
  {
    month: 'Nov',
    scheduledPTO: 12,
    coverageCost: 8400,
    patientsRescheduled: 23,
    revenueImpact: 15600
  },
  {
    month: 'Dec',
    scheduledPTO: 18,
    coverageCost: 12600,
    patientsRescheduled: 34,
    revenueImpact: 22800
  },
  {
    month: 'Jan',
    scheduledPTO: 8,
    coverageCost: 5600,
    patientsRescheduled: 15,
    revenueImpact: 10200
  },
  {
    month: 'Feb',
    scheduledPTO: 14,
    coverageCost: 9800,
    patientsRescheduled: 28,
    revenueImpact: 18900
  }
];

export default function PTOAnalytics() {
  const totalPTODays = ptoRequests.reduce((sum, request) => sum + request.days, 0);
  const pendingRequests = ptoRequests.filter(req => req.status === 'pending').length;
  const criticalImpact = ptoRequests.filter(req => req.impactLevel === 'critical').length;
  const uncoveredPTO = ptoRequests.filter(req => !req.coverageArranged && req.status !== 'denied').length;

  const currentMonth = coverageData[coverageData.length - 1];
  const avgCostPerDay = currentMonth.coverageCost / currentMonth.scheduledPTO;

  return (
    <div className="space-y-6">
      {/* PTO Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">PTO Days (Next 30)</p>
              <p className="text-3xl font-bold text-[#003D7A]">{totalPTODays}</p>
              <p className="text-sm text-gray-500 mt-1">Across 5 providers</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <Calendar className="w-6 h-6 text-[#0078C8]" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Requests</p>
              <p className="text-3xl font-bold text-[#003D7A]">{pendingRequests}</p>
              <p className="text-sm text-orange-600 mt-1">Require review</p>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Coverage Cost</p>
              <p className="text-3xl font-bold text-[#003D7A]">
                ${(currentMonth.coverageCost / 1000).toFixed(1)}K
              </p>
              <p className="text-sm text-gray-500 mt-1">${avgCostPerDay.toFixed(0)}/day avg</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Critical Impact</p>
              <p className="text-3xl font-bold text-[#003D7A]">{criticalImpact}</p>
              <p className="text-sm text-red-600 mt-1">High-risk periods</p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* PTO Requests Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-[#003D7A]">Upcoming PTO Requests</h3>
          <p className="text-sm text-gray-600">Schedule impact and coverage planning</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dates</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Impact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Coverage</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {ptoRequests.map((request) => (
                <tr key={request.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{request.provider}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(request.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {request.startDate !== request.endDate && 
                      ` - ${new Date(request.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    {request.days}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                    {request.type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      request.status === 'approved' ? 'bg-green-100 text-green-800' :
                      request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {request.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      request.impactLevel === 'low' ? 'bg-gray-100 text-gray-800' :
                      request.impactLevel === 'medium' ? 'bg-blue-100 text-blue-800' :
                      request.impactLevel === 'high' ? 'bg-orange-100 text-orange-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {request.impactLevel}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {request.coverageArranged ? (
                      <div className="flex items-center text-green-600">
                        <Users className="w-4 h-4 mr-1" />
                        <span className="text-sm">Covered</span>
                      </div>
                    ) : (
                      <div className="flex items-center text-red-600">
                        <AlertTriangle className="w-4 h-4 mr-1" />
                        <span className="text-sm">Need coverage</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Coverage Cost Analysis */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-[#003D7A]">PTO Impact Analysis</h3>
          <p className="text-sm text-gray-600">Financial and operational impact by month</p>
        </div>

        <div className="p-6">
          <div className="space-y-6">
            {coverageData.map((month, index) => (
              <div key={month.month} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-medium text-gray-900">{month.month} 2026</h4>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Net Impact</p>
                    <p className="text-lg font-bold text-red-600">
                      -${((month.coverageCost + month.revenueImpact) / 1000).toFixed(1)}K
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">PTO Days</p>
                    <p className="text-xl font-bold text-gray-900">{month.scheduledPTO}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-600">Coverage Cost</p>
                    <p className="text-xl font-bold text-orange-600">
                      ${(month.coverageCost / 1000).toFixed(1)}K
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-600">Rescheduled</p>
                    <p className="text-xl font-bold text-blue-600">{month.patientsRescheduled}</p>
                    <p className="text-xs text-gray-500">patients</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-600">Revenue Lost</p>
                    <p className="text-xl font-bold text-red-600">
                      ${(month.revenueImpact / 1000).toFixed(1)}K
                    </p>
                  </div>
                </div>

                {/* Cost breakdown bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Cost Breakdown</span>
                    <span>Total: ${((month.coverageCost + month.revenueImpact) / 1000).toFixed(1)}K</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 flex overflow-hidden">
                    <div 
                      className="bg-orange-500 h-3"
                      style={{ width: `${(month.coverageCost / (month.coverageCost + month.revenueImpact)) * 100}%` }}
                    ></div>
                    <div 
                      className="bg-red-500 h-3"
                      style={{ width: `${(month.revenueImpact / (month.coverageCost + month.revenueImpact)) * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600 mt-1">
                    <span>Coverage costs</span>
                    <span>Lost revenue</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Cost optimization insights */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start space-x-3">
              <TrendingDown className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-blue-900">Cost Optimization Opportunity</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Cross-training staff and implementing flexible scheduling could reduce coverage costs by 20-30%. 
                  Current annual PTO impact: ~$245K (coverage + lost revenue).
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  <strong>Recommendation:</strong> Develop internal coverage protocols to reduce external locum costs from ${avgCostPerDay.toFixed(0)}/day to ~$450/day.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}