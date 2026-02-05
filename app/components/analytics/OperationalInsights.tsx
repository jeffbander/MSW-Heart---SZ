'use client';

import { Target, Zap, Clock, TrendingUp, AlertCircle, CheckCircle, Lightbulb } from 'lucide-react';

interface OptimizationOpportunity {
  category: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  potentialSavings: string;
  timeline: string;
  icon: React.ReactNode;
}

interface PerformanceMetric {
  metric: string;
  current: number;
  target: number;
  benchmark: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
}

const optimizationOpportunities: OptimizationOpportunity[] = [
  {
    category: 'Scheduling',
    title: 'TEE Scheduling Optimization',
    description: 'Implement AI-powered scheduling to reduce TEE wait times from 15.2 to 8 days. Stagger appointment slots and optimize provider allocation.',
    impact: 'high',
    effort: 'medium',
    potentialSavings: '$85K/year',
    timeline: '4-6 weeks',
    icon: <Clock className="w-5 h-5" />
  },
  {
    category: 'Revenue',
    title: 'CPT Code Documentation Enhancement',
    description: 'Improve documentation for high-value procedures. Focus on 93350 (Stress Echo) and 93312 (TEE) to capture full reimbursement potential.',
    impact: 'high',
    effort: 'low',
    potentialSavings: '$120K/year',
    timeline: '2-3 weeks',
    icon: <TrendingUp className="w-5 h-5" />
  },
  {
    category: 'Efficiency',
    title: 'Echo Report Automation',
    description: 'Deploy AI-assisted preliminary reporting to reduce 28-report backlog. Template-based reporting for routine studies.',
    impact: 'medium',
    effort: 'medium',
    potentialSavings: '$45K/year',
    timeline: '6-8 weeks',
    icon: <Zap className="w-5 h-5" />
  },
  {
    category: 'Staffing',
    title: 'Cross-Training Initiative',
    description: 'Cross-train technicians across echo modalities to improve coverage flexibility and reduce PTO impact costs.',
    impact: 'medium',
    effort: 'high',
    potentialSavings: '$60K/year',
    timeline: '12-16 weeks',
    icon: <Target className="w-5 h-5" />
  },
  {
    category: 'Technology',
    title: 'Remote Reading Capabilities',
    description: 'Implement secure remote reading platform for off-hours coverage, reducing locum costs and improving report turnaround.',
    impact: 'high',
    effort: 'high',
    potentialSavings: '$95K/year',
    timeline: '8-12 weeks',
    icon: <CheckCircle className="w-5 h-5" />
  }
];

const performanceMetrics: PerformanceMetric[] = [
  {
    metric: 'Echo Completion Rate',
    current: 91,
    target: 95,
    benchmark: 93,
    unit: '%',
    trend: 'up'
  },
  {
    metric: 'Avg Scheduling Wait (TEE)',
    current: 15.2,
    target: 10.0,
    benchmark: 12.5,
    unit: 'days',
    trend: 'stable'
  },
  {
    metric: 'Provider Productivity',
    current: 89.2,
    target: 92.0,
    benchmark: 90.5,
    unit: '%',
    trend: 'up'
  },
  {
    metric: 'Revenue per RVU',
    current: 279,
    target: 295,
    benchmark: 285,
    unit: '$',
    trend: 'up'
  },
  {
    metric: 'PTO Coverage Cost',
    current: 700,
    target: 450,
    benchmark: 550,
    unit: '$/day',
    trend: 'down'
  },
  {
    metric: 'Report Turnaround',
    current: 2.3,
    target: 1.5,
    benchmark: 1.8,
    unit: 'days',
    trend: 'stable'
  }
];

export default function OperationalInsights() {
  const totalPotentialSavings = optimizationOpportunities.reduce((sum, opp) => {
    const savings = parseInt(opp.potentialSavings.replace(/[^0-9]/g, ''));
    return sum + savings;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Optimization Opportunities</p>
              <p className="text-3xl font-bold text-[#003D7A]">{optimizationOpportunities.length}</p>
              <p className="text-sm text-blue-600 mt-1">High-impact initiatives</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <Lightbulb className="w-6 h-6 text-[#0078C8]" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Potential Annual Savings</p>
              <p className="text-3xl font-bold text-[#003D7A]">${totalPotentialSavings}K</p>
              <p className="text-sm text-green-600 mt-1">ROI implementation cost</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Quick Wins Available</p>
              <p className="text-3xl font-bold text-[#003D7A]">2</p>
              <p className="text-sm text-orange-600 mt-1">Low effort, high impact</p>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <Target className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Optimization Opportunities */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-[#003D7A]">Optimization Opportunities</h3>
          <p className="text-sm text-gray-600">Prioritized initiatives for department improvement</p>
        </div>

        <div className="p-6 space-y-4">
          {optimizationOpportunities.map((opportunity, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className={`p-2 rounded-lg ${
                    opportunity.impact === 'high' ? 'bg-red-50 text-red-600' :
                    opportunity.impact === 'medium' ? 'bg-orange-50 text-orange-600' :
                    'bg-blue-50 text-blue-600'
                  }`}>
                    {opportunity.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-medium text-gray-900">{opportunity.title}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        opportunity.impact === 'high' ? 'bg-red-100 text-red-800' :
                        opportunity.impact === 'medium' ? 'bg-orange-100 text-orange-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {opportunity.impact.toUpperCase()} IMPACT
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{opportunity.description}</p>
                    
                    <div className="flex items-center space-x-6 text-xs text-gray-500">
                      <div className="flex items-center space-x-1">
                        <span className="font-medium">Category:</span>
                        <span>{opportunity.category}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="font-medium">Effort:</span>
                        <span className={
                          opportunity.effort === 'low' ? 'text-green-600' :
                          opportunity.effort === 'medium' ? 'text-orange-600' :
                          'text-red-600'
                        }>{opportunity.effort}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="font-medium">Timeline:</span>
                        <span>{opportunity.timeline}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="text-lg font-bold text-green-600">{opportunity.potentialSavings}</p>
                  <p className="text-xs text-gray-500">potential savings</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Benchmarking */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-[#003D7A]">Performance Benchmarking</h3>
          <p className="text-sm text-gray-600">Current performance vs targets and industry benchmarks</p>
        </div>

        <div className="p-6">
          <div className="space-y-6">
            {performanceMetrics.map((metric, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">{metric.metric}</span>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-600">
                      Current: <span className="font-medium">{metric.current}{metric.unit}</span>
                    </span>
                    <span className="text-sm text-gray-600">
                      Target: <span className="font-medium">{metric.target}{metric.unit}</span>
                    </span>
                    <span className="text-sm text-gray-600">
                      Benchmark: <span className="font-medium">{metric.benchmark}{metric.unit}</span>
                    </span>
                  </div>
                </div>

                <div className="relative">
                  {/* Background scale */}
                  <div className="w-full bg-gray-200 rounded-full h-3"></div>
                  
                  {/* Performance indicators */}
                  <div className="absolute top-0 w-full h-3">
                    {/* Current performance */}
                    <div 
                      className={`absolute h-3 w-3 rounded-full border-2 border-white ${
                        metric.current >= metric.target ? 'bg-green-500' :
                        metric.current >= metric.benchmark ? 'bg-orange-500' :
                        'bg-red-500'
                      }`}
                      style={{ 
                        left: `${Math.min(100, (metric.current / Math.max(metric.target, metric.benchmark, metric.current)) * 100)}%`,
                        transform: 'translateX(-50%)'
                      }}
                    ></div>
                    
                    {/* Target line */}
                    <div 
                      className="absolute h-3 w-1 bg-blue-600"
                      style={{ 
                        left: `${Math.min(100, (metric.target / Math.max(metric.target, metric.benchmark, metric.current)) * 100)}%`,
                        transform: 'translateX(-50%)'
                      }}
                    ></div>
                    
                    {/* Benchmark line */}
                    <div 
                      className="absolute h-3 w-1 bg-gray-600"
                      style={{ 
                        left: `${Math.min(100, (metric.benchmark / Math.max(metric.target, metric.benchmark, metric.current)) * 100)}%`,
                        transform: 'translateX(-50%)'
                      }}
                    ></div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span>Current</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-1 h-3 bg-blue-600"></div>
                      <span>Target</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-1 h-3 bg-gray-600"></div>
                      <span>Benchmark</span>
                    </div>
                  </div>
                  
                  <div className={`flex items-center space-x-1 ${
                    metric.trend === 'up' ? 'text-green-600' :
                    metric.trend === 'down' ? 'text-red-600' :
                    'text-gray-600'
                  }`}>
                    {metric.trend === 'up' && <TrendingUp className="w-3 h-3" />}
                    {metric.trend === 'down' && <TrendingUp className="w-3 h-3 rotate-180" />}
                    {metric.trend === 'stable' && <div className="w-3 h-1 bg-current rounded"></div>}
                    <span className="capitalize">{metric.trend}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Implementation Roadmap */}
      <div className="bg-gradient-to-r from-[#003D7A] to-[#0078C8] rounded-xl p-6 text-white">
        <h3 className="text-lg font-semibold mb-4">🚀 Recommended Implementation Roadmap</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/10 rounded-lg p-4">
            <h4 className="font-medium mb-2">Phase 1: Quick Wins (0-4 weeks)</h4>
            <ul className="text-sm space-y-1 opacity-90">
              <li>• Enhanced CPT documentation protocols</li>
              <li>• TEE scheduling optimization</li>
              <li>• Report template standardization</li>
            </ul>
            <p className="text-sm font-medium mt-2">Expected savings: $205K/year</p>
          </div>
          
          <div className="bg-white/10 rounded-lg p-4">
            <h4 className="font-medium mb-2">Phase 2: Technology (4-12 weeks)</h4>
            <ul className="text-sm space-y-1 opacity-90">
              <li>• AI-assisted reporting system</li>
              <li>• Remote reading platform</li>
              <li>• Workflow automation tools</li>
            </ul>
            <p className="text-sm font-medium mt-2">Expected savings: $140K/year</p>
          </div>
          
          <div className="bg-white/10 rounded-lg p-4">
            <h4 className="font-medium mb-2">Phase 3: Strategic (12+ weeks)</h4>
            <ul className="text-sm space-y-1 opacity-90">
              <li>• Cross-training program</li>
              <li>• Advanced scheduling AI</li>
              <li>• Predictive analytics deployment</li>
            </ul>
            <p className="text-sm font-medium mt-2">Expected savings: $60K/year</p>
          </div>
        </div>
      </div>
    </div>
  );
}