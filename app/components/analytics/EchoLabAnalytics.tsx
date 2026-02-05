'use client';

import { Monitor, Clock, CalendarDays, AlertCircle, CheckCircle, Users } from 'lucide-react';

interface EchoMetrics {
  studyType: string;
  scheduled: number;
  completed: number;
  avgWaitTime: number;
  efficiency: number;
  pendingReports: number;
}

const echoData: EchoMetrics[] = [
  {
    studyType: 'Transthoracic Echo',
    scheduled: 156,
    completed: 142,
    avgWaitTime: 8.5,
    efficiency: 91,
    pendingReports: 12
  },
  {
    studyType: 'Stress Echo',
    scheduled: 78,
    completed: 74,
    avgWaitTime: 12.3,
    efficiency: 95,
    pendingReports: 5
  },
  {
    studyType: 'TEE',
    scheduled: 34,
    completed: 31,
    avgWaitTime: 15.2,
    efficiency: 91,
    pendingReports: 8
  },
  {
    studyType: '3D Echo',
    scheduled: 42,
    completed: 38,
    avgWaitTime: 10.1,
    efficiency: 90,
    pendingReports: 3
  }
];

interface TimeSlot {
  time: string;
  utilization: number;
}

const utilizationData: TimeSlot[] = [
  { time: '8:00', utilization: 85 },
  { time: '9:00', utilization: 95 },
  { time: '10:00', utilization: 98 },
  { time: '11:00', utilization: 92 },
  { time: '12:00', utilization: 45 },
  { time: '13:00', utilization: 78 },
  { time: '14:00', utilization: 88 },
  { time: '15:00', utilization: 91 },
  { time: '16:00', utilization: 85 },
  { time: '17:00', utilization: 72 }
];

export default function EchoLabAnalytics() {
  const totalScheduled = echoData.reduce((sum, study) => sum + study.scheduled, 0);
  const totalCompleted = echoData.reduce((sum, study) => sum + study.completed, 0);
  const overallCompletionRate = (totalCompleted / totalScheduled * 100);
  const avgWaitTime = echoData.reduce((sum, study) => sum + study.avgWaitTime, 0) / echoData.length;
  const totalPendingReports = echoData.reduce((sum, study) => sum + study.pendingReports, 0);

  return (
    <div className="space-y-6">
      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Studies Completed</p>
              <p className="text-3xl font-bold text-[#003D7A]">{totalCompleted}</p>
              <p className="text-sm text-gray-500 mt-1">{overallCompletionRate.toFixed(1)}% completion rate</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Wait Time</p>
              <p className="text-3xl font-bold text-[#003D7A]">{avgWaitTime.toFixed(1)}</p>
              <p className="text-sm text-gray-500 mt-1">days</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <Clock className="w-6 h-6 text-[#0078C8]" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Reports</p>
              <p className="text-3xl font-bold text-[#003D7A]">{totalPendingReports}</p>
              <p className="text-sm text-orange-600 mt-1">Requires attention</p>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <AlertCircle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Lab Utilization</p>
              <p className="text-3xl font-bold text-[#003D7A]">84%</p>
              <p className="text-sm text-green-600 mt-1">Above target (80%)</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <Monitor className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Echo Study Performance */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-[#003D7A]">Echo Study Performance</h3>
          <p className="text-sm text-gray-600">Current week metrics by study type</p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {echoData.map((study, index) => (
              <div key={study.studyType} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">{study.studyType}</h4>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    study.efficiency >= 95 ? 'bg-green-100 text-green-800' :
                    study.efficiency >= 90 ? 'bg-blue-100 text-blue-800' :
                    'bg-orange-100 text-orange-800'
                  }`}>
                    {study.efficiency}% efficiency
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Scheduled</span>
                    <span className="font-medium">{study.scheduled}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Completed</span>
                    <span className="font-medium text-green-600">{study.completed}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Avg Wait</span>
                    <span className="font-medium">{study.avgWaitTime} days</span>
                  </div>

                  {study.pendingReports > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Pending Reports</span>
                      <span className="font-medium text-orange-600">{study.pendingReports}</span>
                    </div>
                  )}

                  {/* Completion progress bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Completion Rate</span>
                      <span>{((study.completed / study.scheduled) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-[#0078C8] h-2 rounded-full"
                        style={{ width: `${(study.completed / study.scheduled) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hourly Utilization Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-[#003D7A]">Hourly Lab Utilization</h3>
          <p className="text-sm text-gray-600">Average utilization by time slot</p>
        </div>

        <div className="p-6">
          <div className="space-y-3">
            {utilizationData.map((slot) => (
              <div key={slot.time} className="flex items-center space-x-4">
                <div className="w-12 text-sm text-gray-600 font-mono">{slot.time}</div>
                <div className="flex-1 bg-gray-200 rounded-full h-4 relative">
                  <div 
                    className={`h-4 rounded-full transition-all duration-1000 ${
                      slot.utilization >= 95 ? 'bg-red-500' :
                      slot.utilization >= 85 ? 'bg-green-500' :
                      slot.utilization >= 70 ? 'bg-yellow-500' :
                      'bg-gray-400'
                    }`}
                    style={{ width: `${slot.utilization}%` }}
                  ></div>
                  <div className="absolute right-2 top-0 h-4 flex items-center">
                    <span className="text-xs font-medium text-gray-700">{slot.utilization}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center space-x-4 text-xs">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-gray-400 rounded"></div>
              <span>Under-utilized (&lt;70%)</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-yellow-500 rounded"></div>
              <span>Moderate (70-84%)</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span>Optimal (85-94%)</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-red-500 rounded"></div>
              <span>Over-capacity (≥95%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}