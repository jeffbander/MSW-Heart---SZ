'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Provider, LeaveType, PTOTimeBlock, PTOValidationWarning, PTORequest } from '@/lib/types';
import PTOCalendar from '../components/admin/PTOCalendar';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  lightGray: '#F5F5F5',
  border: '#E5E7EB',
  success: '#059669',
  error: '#DC2626',
  warning: '#F59E0B',
  warningBg: '#FFFBEB',
  infoBg: '#EFF6FF',
  info: '#3B82F6',
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

export default function PTOSubmissionPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [allRequests, setAllRequests] = useState<PTORequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveType, setLeaveType] = useState<LeaveType>('vacation');
  const [timeBlock, setTimeBlock] = useState<PTOTimeBlock>('FULL');
  const [reason, setReason] = useState('');

  // Validation state
  const [warnings, setWarnings] = useState<PTOValidationWarning[]>([]);
  const [validating, setValidating] = useState(false);
  const [calculatedDays, setCalculatedDays] = useState<number | null>(null);

  // PTO Balance state
  interface PTOBalance {
    annual_allowance: number;
    carryover_days: number;
    total_available: number;
    days_used: number;
    days_remaining: number;
    pending_days: number;
    warning: {
      level: 'none' | 'approaching' | 'exceeded';
      message: string | null;
    };
  }
  const [ptoBalance, setPtoBalance] = useState<PTOBalance | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  useEffect(() => {
    fetchProviders();
    fetchCalendarData();
  }, []);

  async function fetchCalendarData() {
    try {
      const res = await fetch('/api/pto-requests');
      if (res.ok) {
        setAllRequests(await res.json());
      }
    } catch (err) {
      console.error('Error fetching PTO requests for calendar:', err);
    }
  }

  // Fetch PTO balance when provider changes
  useEffect(() => {
    if (selectedProviderId) {
      fetchPTOBalance(selectedProviderId);
    } else {
      setPtoBalance(null);
    }
  }, [selectedProviderId]);

  async function fetchPTOBalance(providerId: string) {
    setLoadingBalance(true);
    try {
      const res = await fetch(`/api/providers/${providerId}/pto-balance`);
      if (res.ok) {
        const data = await res.json();
        setPtoBalance(data);
      } else {
        setPtoBalance(null);
      }
    } catch (err) {
      console.error('Error fetching PTO balance:', err);
      setPtoBalance(null);
    } finally {
      setLoadingBalance(false);
    }
  }

  // Validate PTO when inputs change
  const validatePTO = useCallback(async () => {
    if (!selectedProviderId || !startDate || !endDate) {
      setWarnings([]);
      setCalculatedDays(null);
      return;
    }

    // Validate dates
    if (new Date(endDate + 'T00:00:00') < new Date(startDate + 'T00:00:00')) {
      setWarnings([]);
      setCalculatedDays(null);
      return;
    }

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

      if (res.ok) {
        const data = await res.json();
        setWarnings(data.warnings || []);
        setCalculatedDays(data.calculated_days);
      } else {
        setWarnings([]);
        setCalculatedDays(null);
      }
    } catch (err) {
      console.error('Error validating PTO:', err);
      setWarnings([]);
    } finally {
      setValidating(false);
    }
  }, [selectedProviderId, startDate, endDate, timeBlock]);

  // Debounce validation
  useEffect(() => {
    const timer = setTimeout(() => {
      validatePTO();
    }, 300);
    return () => clearTimeout(timer);
  }, [validatePTO]);

  async function fetchProviders() {
    try {
      const res = await fetch('/api/providers');
      const data = await res.json();
      setProviders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching providers:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!selectedProviderId || !startDate || !endDate) {
      setError('Please fill in all required fields');
      return;
    }

    if (new Date(endDate + 'T00:00:00') < new Date(startDate + 'T00:00:00')) {
      setError('End date cannot be before start date');
      return;
    }

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
        setSuccess(true);
        // Reset form
        setSelectedProviderId('');
        setStartDate('');
        setEndDate('');
        setLeaveType('vacation');
        setTimeBlock('FULL');
        setReason('');

        // TODO: Trigger email notification to admin
        try {
          await fetch('/api/pto-requests/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider_id: selectedProviderId,
              start_date: startDate,
              end_date: endDate,
              leave_type: leaveType,
            }),
          });
        } catch (emailErr) {
          console.error('Failed to send notification email:', emailErr);
        }

        // Refresh calendar to show new request
        fetchCalendarData();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to submit PTO request');
      }
    } catch (err) {
      console.error('Error submitting PTO:', err);
      setError('An error occurred while submitting your request');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedProvider = providers.find((p) => p.id === selectedProviderId);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.lightGray }}>
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-3 md:p-6" style={{ backgroundColor: colors.lightGray }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm hover:underline mb-2 inline-block"
            style={{ color: colors.primaryBlue }}
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-xl md:text-2xl font-bold" style={{ color: colors.primaryBlue }}>
            Submit PTO Request
          </h1>
          <p className="text-gray-600 mt-1">
            Submit a paid time off request for approval by the admin.
          </p>
        </div>

        {/* Success Message */}
        {success && (
          <div
            className="mb-6 p-4 rounded-lg border"
            style={{ backgroundColor: '#ECFDF5', borderColor: colors.success }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-lg"
                style={{ backgroundColor: colors.success }}
              >
                ✓
              </div>
              <div>
                <p className="font-medium" style={{ color: colors.success }}>
                  Request Submitted Successfully
                </p>
                <p className="text-sm text-gray-600">
                  Your PTO request has been submitted and is pending approval.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div
            className="mb-6 p-4 rounded-lg border"
            style={{ backgroundColor: '#FEF2F2', borderColor: colors.error }}
          >
            <p style={{ color: colors.error }}>{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-4 md:p-6 mb-6">
          {/* Provider Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2" style={{ color: colors.primaryBlue }}>
              Select Your Name *
            </label>
            <select
              value={selectedProviderId}
              onChange={(e) => setSelectedProviderId(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg border text-base"
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

          {/* PTO Balance Display */}
          {loadingBalance && (
            <div className="mb-6 p-4 rounded-lg bg-gray-50 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
              <div className="h-6 bg-gray-200 rounded w-1/2"></div>
            </div>
          )}

          {ptoBalance && !loadingBalance && (
            <div
              className="mb-6 p-4 rounded-lg border"
              style={{
                backgroundColor: ptoBalance.warning.level === 'exceeded' ? '#FEF2F2' :
                  ptoBalance.warning.level === 'approaching' ? colors.warningBg : '#F0FDF4',
                borderColor: ptoBalance.warning.level === 'exceeded' ? colors.error :
                  ptoBalance.warning.level === 'approaching' ? colors.warning : colors.success
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium" style={{ color: colors.primaryBlue }}>
                  PTO Balance ({new Date().getFullYear()})
                </span>
                {ptoBalance.pending_days > 0 && (
                  <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">
                    {ptoBalance.pending_days} day{ptoBalance.pending_days !== 1 ? 's' : ''} pending
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1 md:gap-2 flex-wrap">
                <span
                  className="text-2xl font-bold"
                  style={{
                    color: ptoBalance.warning.level === 'exceeded' ? colors.error :
                      ptoBalance.warning.level === 'approaching' ? colors.warning : colors.success
                  }}
                >
                  {ptoBalance.days_remaining}
                </span>
                <span className="text-sm text-gray-600">
                  day{ptoBalance.days_remaining !== 1 ? 's' : ''} remaining
                </span>
                <span className="text-xs text-gray-400">
                  ({ptoBalance.days_used} of {ptoBalance.total_available} used)
                </span>
              </div>
              {ptoBalance.carryover_days > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  Includes {ptoBalance.carryover_days} carryover day{ptoBalance.carryover_days !== 1 ? 's' : ''}
                </div>
              )}
              {ptoBalance.warning.level !== 'none' && ptoBalance.warning.message && (
                <div
                  className="mt-2 text-sm flex items-center gap-2"
                  style={{
                    color: ptoBalance.warning.level === 'exceeded' ? colors.error : colors.warning
                  }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {ptoBalance.warning.message}
                </div>
              )}
            </div>
          )}

          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: colors.primaryBlue }}>
                Start Date *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg border"
                style={{ borderColor: colors.border }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: colors.primaryBlue }}>
                End Date *
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                min={startDate}
                className="w-full px-4 py-3 rounded-lg border"
                style={{ borderColor: colors.border }}
              />
            </div>
          </div>

          {/* Calculated Days Display */}
          {calculatedDays !== null && (
            <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: colors.infoBg }}>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke={colors.info} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm" style={{ color: colors.info }}>
                  This request equals <strong>{calculatedDays}</strong> PTO day{calculatedDays !== 1 ? 's' : ''} (excluding weekends and holidays)
                </span>
              </div>
            </div>
          )}

          {/* Validation loading */}
          {validating && (
            <div className="mb-4 text-sm text-gray-500">
              Checking for conflicts...
            </div>
          )}

          {/* PTO Warnings */}
          {warnings.length > 0 && (
            <div className="mb-6 space-y-3">
              {warnings.map((warning, index) => (
                <div
                  key={index}
                  className="p-3 rounded-lg border flex items-start gap-3"
                  style={{
                    backgroundColor: warning.severity === 'warning' ? colors.warningBg : colors.infoBg,
                    borderColor: warning.severity === 'warning' ? colors.warning : colors.info,
                  }}
                >
                  <svg
                    className="w-5 h-5 flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke={warning.severity === 'warning' ? colors.warning : colors.info}
                    viewBox="0 0 24 24"
                  >
                    {warning.severity === 'warning' ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    )}
                  </svg>
                  <div className="flex-1">
                    <p
                      className="text-sm font-medium"
                      style={{ color: warning.severity === 'warning' ? colors.warning : colors.info }}
                    >
                      {warning.type === 'other_providers_off' && 'Other Providers Off'}
                      {warning.type === 'holiday_proximity' && 'Holiday Proximity'}
                      {warning.type === 'assignment_conflict' && 'Schedule Conflict'}
                      {warning.type === 'balance_warning' && 'PTO Balance'}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {warning.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Leave Type and Time Block */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: colors.primaryBlue }}>
                Leave Type
              </label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                className="w-full px-4 py-3 rounded-lg border"
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
              <label className="block text-sm font-medium mb-2" style={{ color: colors.primaryBlue }}>
                Time Block
              </label>
              <select
                value={timeBlock}
                onChange={(e) => setTimeBlock(e.target.value as PTOTimeBlock)}
                className="w-full px-4 py-3 rounded-lg border"
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

          {/* Reason */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2" style={{ color: colors.primaryBlue }}>
              Reason (Optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-lg border resize-none"
              style={{ borderColor: colors.border }}
              placeholder="Add any additional notes..."
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting || !selectedProviderId || !startDate || !endDate}
            className="w-full py-3 rounded-lg text-white font-medium transition-colors disabled:opacity-50"
            style={{ backgroundColor: colors.teal }}
          >
            {submitting ? 'Submitting...' : 'Submit PTO Request'}
          </button>
        </form>

        {/* Provider Info */}
        {selectedProvider && (
          <div className="mt-6 p-4 bg-white rounded-lg shadow-sm">
            <p className="text-sm text-gray-500">
              Submitting request for:{' '}
              <span className="font-medium" style={{ color: colors.primaryBlue }}>
                {selectedProvider.name}
              </span>
            </p>
            <p className="text-sm text-gray-500 mt-1">
              View your PTO history in the{' '}
              <Link
                href={`/providers/${selectedProvider.id}`}
                className="underline"
                style={{ color: colors.lightBlue }}
              >
                Provider Directory
              </Link>
            </p>
          </div>
        )}

        {/* PTO Calendar */}
        <div className="bg-white rounded-xl shadow-sm p-3 md:p-6 mt-6">
          <h2 className="text-lg font-semibold mb-4" style={{ color: colors.primaryBlue }}>
            Team PTO Calendar
          </h2>
          <PTOCalendar
            requests={allRequests}
            providers={providers}
            onApprove={() => {}}
            onDeny={() => {}}
          />
        </div>
      </div>
    </div>
  );
}
