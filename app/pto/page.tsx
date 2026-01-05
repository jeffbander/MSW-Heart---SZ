'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Provider, LeaveType, PTOTimeBlock } from '@/lib/types';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  lightGray: '#F5F5F5',
  border: '#E5E7EB',
  success: '#059669',
  error: '#DC2626',
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

  useEffect(() => {
    fetchProviders();
  }, []);

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

    if (new Date(endDate) < new Date(startDate)) {
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
    <div className="min-h-screen p-6" style={{ backgroundColor: colors.lightGray }}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm hover:underline mb-2 inline-block"
            style={{ color: colors.primaryBlue }}
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold" style={{ color: colors.primaryBlue }}>
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
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6">
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
      </div>
    </div>
  );
}
