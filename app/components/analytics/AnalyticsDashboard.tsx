'use client';

import { useState } from 'react';
import ProviderMetrics from './ProviderMetrics';
import EchoLabAnalytics from './EchoLabAnalytics';
import RevenueIntelligence from './RevenueIntelligence';
import PTOAnalytics from './PTOAnalytics';
import OperationalInsights from './OperationalInsights';
import { BarChart3, Heart, DollarSign, Calendar, TrendingUp, Users, Monitor, AlertTriangle, Lightbulb } from 'lucide-react';

type TabType = 'overview' | 'providers' | 'echo' | 'revenue' | 'pto' | 'insights';

interface KPICard {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'stable';
  icon: React.ReactNode;
}

const kpiData: KPICard[] = [
  {
    title: 'Monthly Revenue',
    value: '$742K',
    change: '+5.9% vs last month',
    trend: 'up',
    icon: <DollarSign className="w-6 h-6" />
  },
  {
    title: 'Patient Volume',
    value: '203',
    change: '+12% vs last week',
    trend: 'up',
    icon: <Heart className="w-6 h-6" />
  },
  {
    title: 'Echo Completion',
    value: '91%',
    change: '+3.2% efficiency gain',
    trend: 'up',
    icon: <Monitor className="w-6 h-6" />
  },
  {
    title: 'Provider Efficiency',
    value: '89.2%',
    change: 'Stable performance',
    trend: 'stable',
    icon: <Users className="w-6 h-6" />
  }
];

export default function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const tabs = [
    { id: 'overview' as TabType, name: 'Overview', icon: BarChart3 },
    { id: 'providers' as TabType, name: 'Providers', icon: Users },
    { id: 'echo' as TabType, name: 'Echo Lab', icon: Monitor },
    { id: 'revenue' as TabType, name: 'Revenue', icon: DollarSign },
    { id: 'pto' as TabType, name: 'PTO Impact', icon: Calendar },
    { id: 'insights' as TabType, name: 'Optimization', icon: Lightbulb }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#003D7A] mb-2">
            Department Analytics
          </h1>
          <p className="text-gray-600">
            Mount Sinai West - Cardiology Department Intelligence Dashboard
          </p>
        </div>

        {/* KPI Overview Cards */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {kpiData.map((kpi, index) => (
              <div key={index} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{kpi.title}</p>
                    <p className="text-3xl font-bold text-[#003D7A] mt-2">{kpi.value}</p>
                    <p className={`text-sm mt-1 flex items-center ${
                      kpi.trend === 'up' ? 'text-green-600' : 
                      kpi.trend === 'down' ? 'text-red-600' : 
                      'text-gray-600'
                    }`}>
                      {kpi.trend === 'up' && <TrendingUp className="w-3 h-3 mr-1" />}
                      {kpi.trend === 'down' && <TrendingUp className="w-3 h-3 mr-1 rotate-180" />}
                      {kpi.change}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg ${
                    kpi.trend === 'up' ? 'bg-green-50 text-green-600' :
                    kpi.trend === 'down' ? 'bg-red-50 text-red-600' :
                    'bg-gray-50 text-gray-600'
                  }`}>
                    {kpi.icon}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-[#0078C8] text-[#0078C8]'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Quick Insights */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-[#003D7A] mb-4">
                  Executive Summary
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">🎯 Key Performance Highlights</h4>
                    <ul className="space-y-2 text-sm text-gray-700">
                      <li className="flex items-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                        Revenue exceeded target by 7.4% ($48K above goal)
                      </li>
                      <li className="flex items-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                        Echo lab utilization at 84% (above 80% target)
                      </li>
                      <li className="flex items-center">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                        Dr. Bander leads department with 94% efficiency rating
                      </li>
                      <li className="flex items-center">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
                        TEE average wait time at 15.2 days (optimization opportunity)
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">⚠️ Areas Requiring Attention</h4>
                    <ul className="space-y-2 text-sm text-gray-700">
                      <li className="flex items-center">
                        <AlertTriangle className="w-4 h-4 text-orange-500 mr-2" />
                        2 PTO requests pending approval (critical impact periods)
                      </li>
                      <li className="flex items-center">
                        <AlertTriangle className="w-4 h-4 text-orange-500 mr-2" />
                        28 pending echo reports require physician review
                      </li>
                      <li className="flex items-center">
                        <AlertTriangle className="w-4 h-4 text-red-500 mr-2" />
                        March coverage gaps identified (Dr. Bander + Dr. Chen overlap)
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Quick Action Items */}
              <div className="bg-gradient-to-r from-[#003D7A] to-[#0078C8] rounded-xl p-6 text-white">
                <h3 className="text-lg font-semibold mb-4">🚀 Recommended Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white/10 rounded-lg p-4">
                    <h4 className="font-medium mb-2">Schedule Optimization</h4>
                    <p className="text-sm opacity-90">
                      Implement staggered echo appointments to reduce 15-day TEE wait time
                    </p>
                  </div>
                  <div className="bg-white/10 rounded-lg p-4">
                    <h4 className="font-medium mb-2">PTO Planning</h4>
                    <p className="text-sm opacity-90">
                      Arrange coverage for March critical periods before approval
                    </p>
                  </div>
                  <div className="bg-white/10 rounded-lg p-4">
                    <h4 className="font-medium mb-2">Report Workflow</h4>
                    <p className="text-sm opacity-90">
                      Deploy AI-assisted preliminary reporting to reduce 28-report backlog
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'providers' && <ProviderMetrics />}
          {activeTab === 'echo' && <EchoLabAnalytics />}
          {activeTab === 'revenue' && <RevenueIntelligence />}
          {activeTab === 'pto' && <PTOAnalytics />}
          {activeTab === 'insights' && <OperationalInsights />}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Data updated in real-time • Last refresh: {new Date().toLocaleTimeString()}</p>
          <p className="mt-1">Mount Sinai West Cardiology Department • Powered by Clinical Analytics Engine</p>
        </div>
      </div>
    </div>
  );
}