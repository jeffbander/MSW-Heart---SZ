'use client';

import { useState, useEffect } from 'react';
import CustomReportBuilder from '@/app/components/reports/CustomReportBuilder';
import { dayOfWeekLabels } from '@/app/components/reports/reportColumns';

// Helper to format date in local timezone (avoids UTC conversion issues)
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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

interface Service {
  id: string;
  name: string;
  time_block: string;
}

type ReportType = 'general-stats' | 'provider-workload' | 'service-coverage' | 'room-utilization' | 'pto-summary' | 'rooms-open-monthly' | 'provider-availability' | 'provider-rules' | 'custom-builder';

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('general-stats');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedProviderIds, setSelectedProviderIds] = useState<Set<string>>(new Set());
  const [filledSelections, setFilledSelections] = useState<Map<string, Set<string>>>(new Map()); // slot key -> provider ids
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success: number; errors: number } | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return formatLocalDate(date);
  });
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1, 0);
    return formatLocalDate(date);
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
    { value: 'provider-rules', label: 'Provider Rules' },
    { value: 'custom-builder', label: 'Custom Report Builder' },
  ];

  // Fetch providers and services when provider-availability report is selected
  useEffect(() => {
    if (reportType === 'provider-availability') {
      if (providers.length === 0) {
        fetch('/api/providers')
          .then(res => res.json())
          .then(data => setProviders(data))
          .catch(err => console.error('Error fetching providers:', err));
      }
      if (services.length === 0) {
        fetch('/api/services')
          .then(res => res.json())
          .then(data => setServices(data))
          .catch(err => console.error('Error fetching services:', err));
      }
    }
  }, [reportType, providers.length, services.length]);

  // Save filled selections to calendar
  const saveToCalendar = async () => {
    if (!report?.slots || filledSelections.size === 0) return;

    setSaving(true);
    setSaveResult(null);
    let successCount = 0;
    let errorCount = 0;

    // Get Rooms AM and PM service IDs
    const roomsAM = services.find(s => s.name === 'Rooms AM');
    const roomsPM = services.find(s => s.name === 'Rooms PM');

    if (!roomsAM || !roomsPM) {
      alert('Could not find Rooms services. Please try again.');
      setSaving(false);
      return;
    }

    // Loop through all slots and their filled providers
    for (const slot of report.slots) {
      const slotKey = `${slot.date}-${slot.timeBlock}`;
      const filledProviderIds = filledSelections.get(slotKey);

      if (!filledProviderIds || filledProviderIds.size === 0) continue;

      const serviceId = slot.timeBlock === 'AM' ? roomsAM.id : roomsPM.id;

      for (const providerId of filledProviderIds) {
        const provider = slot.availableProviders.find((p: any) => p.id === providerId);
        if (!provider) continue;

        try {
          const response = await fetch('/api/assignments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date: slot.date,
              service_id: serviceId,
              provider_id: providerId,
              time_block: slot.timeBlock,
              room_count: provider.roomCount,
              is_pto: false,
              is_covering: false
            })
          });

          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch {
          errorCount++;
        }
      }
    }

    setSaveResult({ success: successCount, errors: errorCount });
    setSaving(false);

    // Refresh the report to show updated data
    if (successCount > 0) {
      setTimeout(() => {
        generateReport();
      }, 1000);
    }
  };

  // Count total filled selections
  const getTotalFilledCount = () => {
    let count = 0;
    filledSelections.forEach(providers => {
      count += providers.size;
    });
    return count;
  };

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
                    if (item.totalRooms < 13) return '#D97706'; // yellow/orange - under
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

        const filledCount = getTotalFilledCount();

        return (
          <div className="space-y-4">
            {/* Header with Action Buttons */}
            <div className="flex justify-between items-center flex-wrap gap-2">
              <h3 className="text-lg font-semibold" style={{ color: colors.primaryBlue }}>
                Provider Availability Report
              </h3>
              <div className="flex gap-2 items-center">
                {/* Save Result Feedback */}
                {saveResult && (
                  <span className={`text-sm ${saveResult.errors > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    {saveResult.success} saved{saveResult.errors > 0 ? `, ${saveResult.errors} failed` : ''}
                  </span>
                )}
                {/* Save to Calendar Button */}
                {filledCount > 0 && (
                  <button
                    onClick={saveToCalendar}
                    disabled={saving}
                    className="px-4 py-2 rounded text-white font-medium flex items-center gap-2 disabled:opacity-50"
                    style={{ backgroundColor: colors.teal }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {saving ? 'Saving...' : `Save to Calendar (${filledCount})`}
                  </button>
                )}
                {/* Download CSV Button */}
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

      case 'provider-rules': {
        const { availabilityRules, leaves, stats } = report.data || {};

        return (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="text-sm text-gray-500">Total Rules</div>
                <div className="text-2xl font-bold" style={{ color: colors.primaryBlue }}>
                  {stats?.totalRules || 0}
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="text-sm text-gray-500">Allow Rules</div>
                <div className="text-2xl font-bold" style={{ color: colors.teal }}>
                  {stats?.totalAllowRules || 0}
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="text-sm text-gray-500">Block Rules</div>
                <div className="text-2xl font-bold" style={{ color: '#DC2626' }}>
                  {stats?.totalBlockRules || 0}
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="text-sm text-gray-500">Providers with Rules</div>
                <div className="text-2xl font-bold" style={{ color: colors.lightBlue }}>
                  {stats?.providersWithRules || 0}
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="text-sm text-gray-500">Active Leaves</div>
                <div className="text-2xl font-bold" style={{ color: '#D97706' }}>
                  {stats?.activeLeaves || 0}
                </div>
              </div>
            </div>

            {/* Availability Rules Section */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 border-b" style={{ backgroundColor: colors.primaryBlue, borderColor: colors.border }}>
                <h3 className="text-lg font-semibold text-white">Availability Rules</h3>
              </div>
              {availabilityRules && availabilityRules.length > 0 ? (
                <div className="divide-y" style={{ borderColor: colors.border }}>
                  {availabilityRules.map((providerGroup: any, idx: number) => (
                    <div key={providerGroup.provider?.id || idx} className="p-4">
                      <h4 className="font-semibold mb-3" style={{ color: colors.primaryBlue }}>
                        {providerGroup.provider?.name} ({providerGroup.provider?.initials})
                      </h4>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Service</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Day</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Time Block</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Type</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Enforcement</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {providerGroup.rules.map((rule: any, ruleIdx: number) => (
                            <tr key={rule.id || ruleIdx} className={ruleIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-3 py-2">{rule.service?.name || 'All Services'}</td>
                              <td className="px-3 py-2">{dayOfWeekLabels[rule.day_of_week] || rule.day_of_week}</td>
                              <td className="px-3 py-2">{rule.time_block}</td>
                              <td className="px-3 py-2">
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    rule.rule_type === 'allow'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {rule.rule_type?.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    rule.enforcement === 'hard'
                                      ? 'bg-orange-100 text-orange-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}
                                >
                                  {rule.enforcement}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-gray-600">{rule.reason || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  No availability rules configured.
                </div>
              )}
            </div>

            {/* Provider Leaves Section */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 border-b" style={{ backgroundColor: colors.primaryBlue, borderColor: colors.border }}>
                <h3 className="text-lg font-semibold text-white">Active/Upcoming Leaves</h3>
              </div>
              {leaves && leaves.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Provider</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Start Date</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">End Date</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Type</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaves.map((leave: any, idx: number) => (
                      <tr key={leave.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-3">
                          <span className="font-bold" style={{ color: colors.primaryBlue }}>
                            {leave.provider?.initials}
                          </span>
                          <span className="ml-2 text-gray-600">{leave.provider?.name}</span>
                        </td>
                        <td className="px-4 py-3">{leave.start_date}</td>
                        <td className="px-4 py-3">{leave.end_date}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            {leave.leave_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{leave.reason || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  No active or upcoming leaves.
                </div>
              )}
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

      {/* Report Type Selector - Always Visible */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className={reportType === 'custom-builder' ? 'md:col-span-4' : ''}>
            <label className="block text-sm font-medium mb-1">Report Type</label>
            <select
              value={reportType}
              onChange={(e) => {
                setReportType(e.target.value as ReportType);
                setReport(null); // Clear previous report when switching types
              }}
              className="w-full max-w-md px-3 py-2 border rounded"
              style={{ borderColor: colors.border }}
            >
              {reportTypes.map(rt => (
                <option key={rt.value} value={rt.value}>{rt.label}</option>
              ))}
            </select>
          </div>
          {reportType !== 'custom-builder' && (
            <>
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
            </>
          )}
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

      {/* Custom Report Builder */}
      {reportType === 'custom-builder' && (
        <CustomReportBuilder
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />
      )}

      {/* Standard Report Results */}
      {reportType !== 'custom-builder' && report && (
        <div>
          <div className="mb-4 text-sm text-gray-500">
            Report: {reportTypes.find(rt => rt.value === report.type)?.label}
            {report.dateRange && ` | Date Range: ${report.dateRange.startDate} to ${report.dateRange.endDate}`}
          </div>
          {renderReport()}
        </div>
      )}
    </div>
  );
}
