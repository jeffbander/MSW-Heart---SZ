'use client';

import { useState, useEffect } from 'react';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  border: '#E5E7EB',
};

interface Provider {
  id: string;
  name: string;
  initials: string;
  default_room_count: number;
}

type ReportType = 'general-stats' | 'provider-workload' | 'service-coverage' | 'room-utilization' | 'pto-summary' | 'rooms-open-monthly' | 'provider-availability';

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('general-stats');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProviderIds, setSelectedProviderIds] = useState<Set<string>>(new Set());
  const [filledSelections, setFilledSelections] = useState<Map<string, Set<string>>>(new Map()); // slot key -> provider ids
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1, 0);
    return date.toISOString().split('T')[0];
  });
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [copied, setCopied] = useState(false);

  const reportTypes = [
    { value: 'general-stats', label: 'General Statistics' },
    { value: 'provider-workload', label: 'Provider Workload' },
    { value: 'service-coverage', label: 'Service Coverage' },
    { value: 'room-utilization', label: 'Room Utilization' },
    { value: 'pto-summary', label: 'PTO Summary' },
    { value: 'rooms-open-monthly', label: 'Open Rooms (Monthly)' },
    { value: 'provider-availability', label: 'Provider Availability Planner' },
  ];

  // Fetch providers when provider-availability report is selected
  useEffect(() => {
    if (reportType === 'provider-availability' && providers.length === 0) {
      fetch('/api/providers')
        .then(res => res.json())
        .then(data => setProviders(data))
        .catch(err => console.error('Error fetching providers:', err));
    }
  }, [reportType, providers.length]);

  const toggleProviderSelection = (providerId: string) => {
    setSelectedProviderIds(prev => {
      const next = new Set(prev);
      if (next.has(providerId)) {
        next.delete(providerId);
      } else {
        next.add(providerId);
      }
      return next;
    });
  };

  const toggleFillSelection = (slotKey: string, providerId: string) => {
    setFilledSelections(prev => {
      const next = new Map(prev);
      const slotProviders = next.get(slotKey) || new Set();
      const newSlotProviders = new Set(slotProviders);
      if (newSlotProviders.has(providerId)) {
        newSlotProviders.delete(providerId);
      } else {
        newSlotProviders.add(providerId);
      }
      next.set(slotKey, newSlotProviders);
      return next;
    });
  };

  const generateReport = async () => {
    setLoading(true);
    setFilledSelections(new Map()); // Reset selections
    try {
      let url = `/api/reports?type=${reportType}&startDate=${startDate}&endDate=${endDate}`;
      if (reportType === 'provider-availability' && selectedProviderIds.size > 0) {
        url += `&providerIds=${Array.from(selectedProviderIds).join(',')}`;
      }
      const response = await fetch(url);
      const data = await response.json();
      setReport(data);
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderReport = () => {
    if (!report) return null;

    switch (report.type) {
      case 'general-stats':
        return (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-500">Total Assignments</div>
              <div className="text-2xl font-bold" style={{ color: colors.primaryBlue }}>
                {report.data.totalAssignments}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-500">Work Assignments</div>
              <div className="text-2xl font-bold" style={{ color: colors.teal }}>
                {report.data.workAssignments}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-500">PTO Assignments</div>
              <div className="text-2xl font-bold" style={{ color: '#DC2626' }}>
                {report.data.ptoAssignments}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-500">Total Providers</div>
              <div className="text-2xl font-bold" style={{ color: colors.lightBlue }}>
                {report.data.totalProviders}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-500">Total Services</div>
              <div className="text-2xl font-bold" style={{ color: colors.lightBlue }}>
                {report.data.totalServices}
              </div>
            </div>
          </div>
        );

      case 'provider-workload':
        return (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: colors.primaryBlue }}>
                  <th className="px-4 py-3 text-left text-white text-sm font-medium">Provider</th>
                  <th className="px-4 py-3 text-center text-white text-sm font-medium">Total Shifts</th>
                  <th className="px-4 py-3 text-left text-white text-sm font-medium">Services Breakdown</th>
                </tr>
              </thead>
              <tbody>
                {report.data.map((item: any, idx: number) => (
                  <tr key={item.provider?.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3">
                      <span className="font-bold" style={{ color: colors.primaryBlue }}>
                        {item.provider?.initials}
                      </span>
                      <span className="ml-2 text-gray-600">{item.provider?.name}</span>
                    </td>
                    <td className="px-4 py-3 text-center font-bold" style={{ color: colors.teal }}>
                      {item.totalShifts}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(item.services).slice(0, 4).map(([service, count]) => (
                          <span
                            key={service}
                            className="px-2 py-0.5 rounded text-xs"
                            style={{ backgroundColor: '#E6F2FF', color: colors.primaryBlue }}
                          >
                            {service}: {count as number}
                          </span>
                        ))}
                        {Object.keys(item.services).length > 4 && (
                          <span className="text-xs text-gray-400">
                            +{Object.keys(item.services).length - 4} more
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case 'service-coverage':
        return (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: colors.primaryBlue }}>
                  <th className="px-4 py-3 text-left text-white text-sm font-medium">Service</th>
                  <th className="px-4 py-3 text-center text-white text-sm font-medium">Assignment Count</th>
                  <th className="px-4 py-3 text-center text-white text-sm font-medium">Unique Days</th>
                </tr>
              </thead>
              <tbody>
                {report.data.map((item: any, idx: number) => (
                  <tr key={item.service?.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 font-medium" style={{ color: colors.primaryBlue }}>
                      {item.service?.name}
                    </td>
                    <td className="px-4 py-3 text-center">{item.assignmentCount}</td>
                    <td className="px-4 py-3 text-center">{item.uniqueDates}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case 'room-utilization':
        return (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: colors.primaryBlue }}>
                  <th className="px-4 py-3 text-left text-white text-sm font-medium">Date</th>
                  <th className="px-4 py-3 text-center text-white text-sm font-medium">Time Block</th>
                  <th className="px-4 py-3 text-center text-white text-sm font-medium">Rooms Used</th>
                  <th className="px-4 py-3 text-center text-white text-sm font-medium">Open Rooms</th>
                  <th className="px-4 py-3 text-left text-white text-sm font-medium">Providers</th>
                </tr>
              </thead>
              <tbody>
                {report.data.map((item: any, idx: number) => {
                  // Date-aware color logic for Wed/Thu PM extended limit
                  const dayOfWeek = new Date(item.date + 'T00:00:00').getDay();
                  const isExtendedDay = (dayOfWeek === 3 || dayOfWeek === 4) && item.timeBlock === 'PM';
                  const maxGreen = isExtendedDay ? 15 : 14;

                  const getUsedColor = () => {
                    if (item.totalRooms === 0) return '#9CA3AF'; // gray
                    if (item.totalRooms < 12) return '#D97706'; // yellow/orange - under
                    if (item.totalRooms <= maxGreen) return colors.teal; // green - optimal
                    return '#DC2626'; // red - over
                  };

                  const getOpenColor = () => {
                    if (item.unusedRooms === 0) return colors.teal; // green - fully covered
                    if (item.unusedRooms <= 2) return '#D97706'; // orange - a few open
                    return '#DC2626'; // red - many open
                  };

                  return (
                    <tr key={`${item.date}-${item.timeBlock}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3">{item.date}</td>
                      <td className="px-4 py-3 text-center">{item.timeBlock}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className="font-bold"
                          style={{ color: getUsedColor() }}
                        >
                          {item.totalRooms}/{item.maxRooms}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className="font-bold"
                          style={{ color: getOpenColor() }}
                        >
                          {item.unusedRooms}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {item.providers.map((p: any) => `${p.initials}(${p.rooms})`).join(', ')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );

      case 'pto-summary':
        return (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: colors.primaryBlue }}>
                  <th className="px-4 py-3 text-left text-white text-sm font-medium">Provider</th>
                  <th className="px-4 py-3 text-center text-white text-sm font-medium">Total PTO Days</th>
                  <th className="px-4 py-3 text-left text-white text-sm font-medium">Dates</th>
                </tr>
              </thead>
              <tbody>
                {report.data.map((item: any, idx: number) => (
                  <tr key={item.provider?.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3">
                      <span className="font-bold" style={{ color: colors.primaryBlue }}>
                        {item.provider?.initials}
                      </span>
                      <span className="ml-2 text-gray-600">{item.provider?.name}</span>
                    </td>
                    <td className="px-4 py-3 text-center font-bold" style={{ color: '#DC2626' }}>
                      {item.totalDays}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {item.ptoDays.slice(0, 5).join(', ')}
                      {item.ptoDays.length > 5 && ` +${item.ptoDays.length - 5} more`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case 'rooms-open-monthly': {
        // Generate month name from date range
        const monthDate = new Date(report.dateRange.startDate + 'T00:00:00');
        const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        // Build the plain text report
        const lines = [`These are our open rooms for ${monthName}:`, ''];
        report.data.forEach((slot: any) => {
          lines.push(`${slot.dayName} ${slot.timeBlock} - ${slot.openRooms} room${slot.openRooms > 1 ? 's' : ''}`);
        });

        if (report.data.length === 0) {
          lines.push('All rooms are fully covered!');
        }

        const reportText = lines.join('\n');

        const handleCopy = () => {
          navigator.clipboard.writeText(reportText);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        };

        return (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold" style={{ color: colors.primaryBlue }}>
                Open Rooms Report
              </h3>
              <button
                onClick={handleCopy}
                className="px-4 py-2 rounded text-white font-medium transition-colors"
                style={{ backgroundColor: copied ? colors.teal : colors.lightBlue }}
              >
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </button>
            </div>
            <pre className="bg-gray-50 p-4 rounded border text-sm font-mono whitespace-pre-wrap" style={{ borderColor: colors.border }}>
              {reportText}
            </pre>
            {report.data.length > 0 && (
              <div className="mt-4 text-sm text-gray-500">
                Total: {report.totalOpenRooms} open room{report.totalOpenRooms !== 1 ? 's' : ''} across {report.data.length} time slot{report.data.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        );
      }

      case 'provider-availability': {
        if (!report.slots || report.slots.length === 0) {
          return (
            <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
              {selectedProviderIds.size === 0
                ? 'Please select at least one provider and generate the report.'
                : 'No understaffed slots found where selected providers are available.'}
            </div>
          );
        }

        // Calculate summary stats
        let slotsReachingTarget = 0;
        let slotsStillUnder = 0;

        report.slots.forEach((slot: any) => {
          const slotKey = `${slot.date}-${slot.timeBlock}`;
          const filledProviders = filledSelections.get(slotKey) || new Set();
          const addedRooms = slot.availableProviders
            .filter((p: any) => filledProviders.has(p.id))
            .reduce((sum: number, p: any) => sum + p.roomCount, 0);
          const projected = slot.currentRooms + addedRooms;
          if (projected >= 14) {
            slotsReachingTarget++;
          } else {
            slotsStillUnder++;
          }
        });

        // Download CSV function
        const downloadCSV = () => {
          const headers = ['Date', 'Day', 'Time', 'Current Rooms', 'Target', 'Available Providers'];
          const rows = report.slots.map((slot: any) => [
            slot.date,
            slot.dayName.split(' ')[0], // Just the day name
            slot.timeBlock,
            slot.currentRooms,
            slot.target,
            `"${slot.availableProviders.map((p: any) => `${p.initials} (+${p.roomCount})`).join(', ')}"`
          ]);

          const csvContent = [
            headers.join(','),
            ...rows.map((row: any) => row.join(','))
          ].join('\n');

          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          const monthDate = new Date(report.dateRange.startDate + 'T00:00:00');
          const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).replace(' ', '-');
          link.download = `provider-availability-${monthName}.csv`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        };

        return (
          <div className="space-y-4">
            {/* Header with Download Button */}
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold" style={{ color: colors.primaryBlue }}>
                Provider Availability Report
              </h3>
              <button
                onClick={downloadCSV}
                className="px-4 py-2 rounded text-white font-medium flex items-center gap-2"
                style={{ backgroundColor: colors.lightBlue }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download CSV
              </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="text-sm text-gray-500">Understaffed Slots</div>
                <div className="text-2xl font-bold" style={{ color: '#D97706' }}>
                  {report.slots.length}
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="text-sm text-gray-500">Would Reach Target</div>
                <div className="text-2xl font-bold" style={{ color: colors.teal }}>
                  {slotsReachingTarget}
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="text-sm text-gray-500">Still Under 14</div>
                <div className="text-2xl font-bold" style={{ color: '#DC2626' }}>
                  {slotsStillUnder}
                </div>
              </div>
            </div>

            {/* Interactive Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: colors.primaryBlue }}>
                    <th className="px-4 py-3 text-left text-white text-sm font-medium">Date</th>
                    <th className="px-4 py-3 text-center text-white text-sm font-medium">Time</th>
                    <th className="px-4 py-3 text-center text-white text-sm font-medium">Current</th>
                    <th className="px-4 py-3 text-left text-white text-sm font-medium">Available Providers (click to fill)</th>
                    <th className="px-4 py-3 text-center text-white text-sm font-medium">Projected</th>
                  </tr>
                </thead>
                <tbody>
                  {report.slots.map((slot: any, idx: number) => {
                    const slotKey = `${slot.date}-${slot.timeBlock}`;
                    const filledProviders = filledSelections.get(slotKey) || new Set();
                    const addedRooms = slot.availableProviders
                      .filter((p: any) => filledProviders.has(p.id))
                      .reduce((sum: number, p: any) => sum + p.roomCount, 0);
                    const projected = slot.currentRooms + addedRooms;
                    const reachesTarget = projected >= 14;

                    return (
                      <tr key={slotKey} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-3 font-medium">{slot.dayName}</td>
                        <td className="px-4 py-3 text-center">{slot.timeBlock}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-bold" style={{ color: '#D97706' }}>
                            {slot.currentRooms}
                          </span>
                          <span className="text-gray-400 text-sm">/{slot.target}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {slot.availableProviders.map((provider: any) => {
                              const isFilled = filledProviders.has(provider.id);
                              return (
                                <button
                                  key={provider.id}
                                  onClick={() => toggleFillSelection(slotKey, provider.id)}
                                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                                    isFilled
                                      ? 'text-white'
                                      : 'border hover:bg-gray-100'
                                  }`}
                                  style={{
                                    backgroundColor: isFilled ? colors.teal : 'transparent',
                                    borderColor: isFilled ? colors.teal : colors.border,
                                    color: isFilled ? 'white' : colors.primaryBlue
                                  }}
                                >
                                  {provider.initials} (+{provider.roomCount})
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className="font-bold text-lg"
                            style={{ color: reachesTarget ? colors.teal : '#D97706' }}
                          >
                            {projected}
                          </span>
                          {addedRooms > 0 && (
                            <span className="ml-1 text-sm" style={{ color: colors.teal }}>
                              (+{addedRooms})
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      default:
        return <div className="text-gray-500">Unknown report type</div>;
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6" style={{ color: colors.primaryBlue }}>
        Reports
      </h2>

      {/* Report Controls */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Report Type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="w-full px-3 py-2 border rounded"
              style={{ borderColor: colors.border }}
            >
              {reportTypes.map(rt => (
                <option key={rt.value} value={rt.value}>{rt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              style={{ borderColor: colors.border }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              style={{ borderColor: colors.border }}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={generateReport}
              disabled={loading || (reportType === 'provider-availability' && selectedProviderIds.size === 0)}
              className="w-full px-4 py-2 rounded text-white font-medium disabled:opacity-50"
              style={{ backgroundColor: colors.primaryBlue }}
            >
              {loading ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>

        {/* Provider Selector for Provider Availability Report */}
        {reportType === 'provider-availability' && (
          <div className="mt-4 pt-4 border-t" style={{ borderColor: colors.border }}>
            <label className="block text-sm font-medium mb-2">
              Select Providers to Check Availability ({selectedProviderIds.size} selected)
            </label>
            <div className="flex flex-wrap gap-2">
              {providers.map(provider => {
                const isSelected = selectedProviderIds.has(provider.id);
                return (
                  <button
                    key={provider.id}
                    onClick={() => toggleProviderSelection(provider.id)}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      isSelected ? 'text-white' : 'border hover:bg-gray-100'
                    }`}
                    style={{
                      backgroundColor: isSelected ? colors.primaryBlue : 'transparent',
                      borderColor: isSelected ? colors.primaryBlue : colors.border,
                      color: isSelected ? 'white' : colors.primaryBlue
                    }}
                  >
                    {provider.initials}
                    <span className="ml-1 text-xs opacity-75">({provider.default_room_count || 3})</span>
                  </button>
                );
              })}
            </div>
            {providers.length === 0 && (
              <div className="text-sm text-gray-500">Loading providers...</div>
            )}
          </div>
        )}
      </div>

      {/* Report Results */}
      {report && (
        <div>
          <div className="mb-4 text-sm text-gray-500">
            Report: {reportTypes.find(rt => rt.value === report.type)?.label} |
            Date Range: {report.dateRange?.startDate} to {report.dateRange?.endDate}
          </div>
          {renderReport()}
        </div>
      )}
    </div>
  );
}
