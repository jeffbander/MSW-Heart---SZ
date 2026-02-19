'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Provider, PTORequest, PTOValidationWarning, LeaveType, PTOTimeBlock } from '@/lib/types';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  lightGray: '#F5F5F5',
  border: '#E5E7EB',
  warning: '#F59E0B',
  error: '#DC2626',
  success: '#059669',
};

const leaveTypes: { value: LeaveType; label: string }[] = [
  { value: 'vacation', label: 'Vacation' },
  { value: 'personal', label: 'Personal' },
  { value: 'medical', label: 'Medical' },
  { value: 'conference', label: 'Conference' },
  { value: 'maternity', label: 'Maternity/Paternity' },
  { value: 'other', label: 'Other' },
];

const timeBlocks: { value: PTOTimeBlock; label: string }[] = [
  { value: 'FULL', label: 'Full Day' },
  { value: 'AM', label: 'AM Only' },
  { value: 'PM', label: 'PM Only' },
];

type TabType = 'pending' | 'approved' | 'denied';

export default function PTORequestsPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [requests, setRequests] = useState<PTORequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('pending');

  // Form state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveType, setLeaveType] = useState<LeaveType>('vacation');
  const [timeBlock, setTimeBlock] = useState<PTOTimeBlock>('FULL');
  const [reason, setReason] = useState('');

  // Validation state
  const [calculatedDays, setCalculatedDays] = useState<number | null>(null);
  const [warnings, setWarnings] = useState<PTOValidationWarning[]>([]);
  const [validating, setValidating] = useState(false);

  // Fetch providers
  useEffect(() => {
    async function fetchProviders() {
      const res = await fetch('/api/providers');
      const data = await res.json();
      setProviders(data || []);
      setLoading(false);
    }
    fetchProviders();
  }, []);

  // Fetch requests when provider changes
  useEffect(() => {
    if (selectedProviderId) {
      fetchRequests();
    }
  }, [selectedProviderId]);

  async function fetchRequests() {
    if (!selectedProviderId) return;
    const res = await fetch(`/api/pto-requests?providerId=${selectedProviderId}`);
    const data = await res.json();
    setRequests(data || []);
  }

  // Validate when dates change
  useEffect(() => {
    if (selectedProviderId && startDate && endDate && timeBlock) {
      validateRequest();
    } else {
      setCalculatedDays(null);
      setWarnings([]);
    }
  }, [selectedProviderId, startDate, endDate, timeBlock]);

  async function validateRequest() {
    setValidating(true);
    try {
      const res = await fetch('/api/pto-requests/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_id: selectedProviderId,
          start_date: startDate,
          end_date: endDate,
          time_block: timeBlock,
        }),
      });
      const data = await res.json();
      setCalculatedDays(data.calculated_days);
      setWarnings(data.warnings || []);
    } catch (error) {
      console.error('Validation error:', error);
    } finally {
      setValidating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProviderId || !startDate || !endDate) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/pto-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_id: selectedProviderId,
          start_date: startDate,
          end_date: endDate,
          leave_type: leaveType,
          time_block: timeBlock,
          reason: reason || null,
          requested_by: 'provider',
        }),
      });

      if (res.ok) {
        // Reset form
        setStartDate('');
        setEndDate('');
        setLeaveType('vacation');
        setTimeBlock('FULL');
        setReason('');
        setCalculatedDays(null);
        setWarnings([]);
        // Refresh requests
        fetchRequests();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to submit request');
      }
    } catch (error) {
      console.error('Submit error:', error);
      alert('Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelRequest(id: string) {
    if (!confirm('Are you sure you want to cancel this request?')) return;

    try {
      const res = await fetch(`/api/pto-requests/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchRequests();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to cancel request');
      }
    } catch (error) {
      console.error('Cancel error:', error);
      alert('Failed to cancel request');
    }
  }

  const filteredRequests = requests.filter((r) => r.status === activeTab);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return colors.success;
      case 'denied':
        return colors.error;
      default:
        return colors.warning;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="py-6 px-4 shadow-sm" style={{ backgroundColor: colors.primaryBlue }}>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-white">PTO Request</h1>
          <p className="text-blue-100 mt-1">Request time off for approval</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 md:px-4 py-6 md:py-8">
        {/* Provider Selection */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <label className="block text-sm font-medium mb-2" style={{ color: colors.primaryBlue }}>
            Select Provider
          </label>
          <select
            value={selectedProviderId}
            onChange={(e) => setSelectedProviderId(e.target.value)}
            className="w-full md:w-64 px-3 py-2 border rounded-lg"
            style={{ borderColor: colors.border }}
          >
            <option value="">-- Select Provider --</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.initials} - {p.name}
              </option>
            ))}
          </select>
        </div>

        {selectedProviderId && (
          <>
            {/* Request Form */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4" style={{ color: colors.primaryBlue }}>
                New PTO Request
              </h2>

              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                      className="w-full px-3 py-3 md:py-2 border rounded text-base md:text-sm"
                      style={{ borderColor: colors.border }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                      min={startDate}
                      className="w-full px-3 py-3 md:py-2 border rounded text-base md:text-sm"
                      style={{ borderColor: colors.border }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Leave Type</label>
                    <select
                      value={leaveType}
                      onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                      className="w-full px-3 py-3 md:py-2 border rounded text-base md:text-sm"
                      style={{ borderColor: colors.border }}
                    >
                      {leaveTypes.map((lt) => (
                        <option key={lt.value} value={lt.value}>
                          {lt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Time Block</label>
                    <select
                      value={timeBlock}
                      onChange={(e) => setTimeBlock(e.target.value as PTOTimeBlock)}
                      className="w-full px-3 py-3 md:py-2 border rounded text-base md:text-sm"
                      style={{ borderColor: colors.border }}
                    >
                      {timeBlocks.map((tb) => (
                        <option key={tb.value} value={tb.value}>
                          {tb.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Reason (optional)</label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-3 md:py-2 border rounded text-base md:text-sm"
                    style={{ borderColor: colors.border }}
                    placeholder="Additional notes..."
                  />
                </div>

                {/* Calculated Days */}
                {calculatedDays !== null && (
                  <div
                    className="mb-4 p-3 rounded"
                    style={{ backgroundColor: `${colors.teal}15` }}
                  >
                    <span className="font-medium" style={{ color: colors.teal }}>
                      Calculated PTO: {calculatedDays} day{calculatedDays !== 1 ? 's' : ''}
                    </span>
                    <span className="text-sm text-gray-500 ml-2">
                      (excludes weekends and holidays)
                    </span>
                  </div>
                )}

                {/* Warnings */}
                {warnings.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {warnings.map((warning, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded border-l-4"
                        style={{
                          backgroundColor:
                            warning.type === 'holiday_proximity'
                              ? '#FEF3C7'
                              : '#FEF3C7',
                          borderColor: colors.warning,
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-lg">
                            {warning.type === 'holiday_proximity' ? '⚠️' : '👥'}
                          </span>
                          <div>
                            <p className="text-sm font-medium" style={{ color: '#92400E' }}>
                              {warning.type === 'holiday_proximity'
                                ? 'Holiday Proximity Warning'
                                : 'Scheduling Conflict'}
                            </p>
                            <p className="text-sm" style={{ color: '#92400E' }}>
                              {warning.message}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !startDate || !endDate}
                  className="w-full md:w-auto px-6 py-3 md:py-2 rounded text-white font-medium text-base md:text-sm disabled:opacity-50"
                  style={{ backgroundColor: colors.primaryBlue }}
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </form>
            </div>

            {/* Request History */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b" style={{ borderColor: colors.border }}>
                <h2 className="text-lg font-semibold" style={{ color: colors.primaryBlue }}>
                  My Requests
                </h2>
              </div>

              {/* Tabs */}
              <div className="flex border-b overflow-x-auto" style={{ borderColor: colors.border }}>
                {(['pending', 'approved', 'denied'] as TabType[]).map((tab) => {
                  const count = requests.filter((r) => r.status === tab).length;
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 md:flex-initial whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === tab
                          ? 'border-current'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                      style={{
                        color: activeTab === tab ? getStatusColor(tab) : undefined,
                      }}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Request List */}
              <div className="divide-y" style={{ borderColor: colors.border }}>
                {filteredRequests.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    No {activeTab} requests
                  </div>
                ) : (
                  filteredRequests.map((req) => (
                    <div key={req.id} className="p-4">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span
                              className="px-2 py-0.5 rounded text-xs font-medium text-white"
                              style={{ backgroundColor: getStatusColor(req.status) }}
                            >
                              {req.status.toUpperCase()}
                            </span>
                            <span className="text-sm text-gray-500">
                              {leaveTypes.find((lt) => lt.value === req.leave_type)?.label}
                            </span>
                            <span className="text-sm text-gray-400">
                              ({req.time_block === 'FULL' ? 'Full Day' : req.time_block})
                            </span>
                          </div>
                          <p className="font-medium" style={{ color: colors.primaryBlue }}>
                            {req.start_date === req.end_date
                              ? req.start_date
                              : `${req.start_date} to ${req.end_date}`}
                          </p>
                          {req.reason && (
                            <p className="text-sm text-gray-600 mt-1">{req.reason}</p>
                          )}
                          {req.admin_comment && (
                            <p className="text-sm mt-2 p-2 rounded" style={{ backgroundColor: colors.lightGray }}>
                              <span className="font-medium">Admin: </span>
                              {req.admin_comment}
                            </p>
                          )}
                        </div>
                        {req.status === 'pending' && (
                          <button
                            onClick={() => handleCancelRequest(req.id)}
                            className="text-sm px-4 md:px-3 py-2 md:py-1 rounded border hover:bg-gray-50"
                            style={{ borderColor: colors.border, color: colors.error }}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="py-4 px-4 border-t border-gray-200 mt-8">
        <div className="max-w-4xl mx-auto text-center text-sm text-gray-500">
          <Link href="/" className="hover:underline" style={{ color: colors.lightBlue }}>
            ← Back to Main Calendar
          </Link>
        </div>
      </footer>
    </div>
  );
}
