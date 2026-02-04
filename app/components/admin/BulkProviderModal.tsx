'use client';

import { useState, useEffect } from 'react';
import { Provider, Service } from '@/lib/types';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  ptoRed: '#DC2626',
  warningAmber: '#F59E0B',
  border: '#E5E7EB',
};

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface PreviewResult {
  preview: boolean;
  affectedCount: number;
  skippedCount?: number;
  assignments: Array<{
    date: string;
    time_block: string;
    service_name?: string;
    provider_name?: string;
  }>;
}

interface BulkProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActionComplete: () => void;
}

export default function BulkProviderModal({
  isOpen,
  onClose,
  onActionComplete,
}: BulkProviderModalProps) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [action, setAction] = useState<'add' | 'remove'>('remove');
  const [patternType, setPatternType] = useState<'all' | 'recurring'>('recurring');
  const [dayOfWeek, setDayOfWeek] = useState<number>(1); // Monday
  const [timeBlock, setTimeBlock] = useState<'AM' | 'PM' | ''>('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [roomCount, setRoomCount] = useState(0);

  // Preview state
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchData();
      // Set default dates
      const today = new Date();
      const threeMonthsLater = new Date(today);
      threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

      setStartDate(formatDateForInput(today));
      setEndDate(formatDateForInput(threeMonthsLater));
    }
  }, [isOpen]);

  const formatDateForInput = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [providersRes, servicesRes] = await Promise.all([
        fetch('/api/providers'),
        fetch('/api/services?all=true'),
      ]);

      const providersData = await providersRes.json();
      const servicesData = await servicesRes.json();

      setProviders(Array.isArray(providersData) ? providersData : []);
      setServices(Array.isArray(servicesData) ? servicesData : []);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    if (!selectedProviderId || !startDate || !endDate) {
      setError('Please select a provider and date range');
      return;
    }

    if (action === 'add' && !selectedServiceId) {
      setError('Please select a service for add operation');
      return;
    }

    setActionInProgress(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/bulk-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: selectedProviderId,
          action,
          pattern: {
            type: patternType,
            dayOfWeek: patternType === 'recurring' ? dayOfWeek : undefined,
            timeBlock: timeBlock || undefined,
            serviceId: selectedServiceId || undefined,
          },
          startDate,
          endDate,
          preview: true,
          roomCount,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to generate preview');
        return;
      }

      setPreviewResult(result);
      setShowPreview(true);
    } catch (err) {
      console.error('Error generating preview:', err);
      setError('Failed to generate preview');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleApply = async () => {
    if (!selectedProviderId || !startDate || !endDate) return;

    setActionInProgress(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/bulk-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: selectedProviderId,
          action,
          pattern: {
            type: patternType,
            dayOfWeek: patternType === 'recurring' ? dayOfWeek : undefined,
            timeBlock: timeBlock || undefined,
            serviceId: selectedServiceId || undefined,
          },
          startDate,
          endDate,
          preview: false,
          roomCount,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to apply changes');
        return;
      }

      setSuccessMessage(result.message);
      setShowPreview(false);
      setPreviewResult(null);

      // Clear form
      setSelectedProviderId('');
      setSelectedServiceId('');

      onActionComplete();
    } catch (err) {
      console.error('Error applying changes:', err);
      setError('Failed to apply changes');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleClose = () => {
    setSelectedProviderId('');
    setSelectedServiceId('');
    setError(null);
    setSuccessMessage(null);
    setShowPreview(false);
    setPreviewResult(null);
    onClose();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold" style={{ color: colors.primaryBlue }}>
            Bulk Provider Operations
          </h3>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Success message */}
        {successMessage && (
          <div className="mb-4 p-3 rounded" style={{ backgroundColor: `${colors.teal}15`, color: colors.teal }}>
            {successMessage}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 rounded text-sm" style={{ backgroundColor: `${colors.ptoRed}10`, color: colors.ptoRed }}>
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {/* Preview results */}
          {showPreview && previewResult ? (
            <div>
              <div className="mb-4 p-4 rounded-lg border" style={{ borderColor: colors.border }}>
                <h4 className="font-semibold mb-2" style={{ color: colors.primaryBlue }}>
                  Preview Results
                </h4>
                <p className="text-gray-600 mb-2">
                  {action === 'remove'
                    ? `Will remove ${previewResult.affectedCount} assignments`
                    : `Will add ${previewResult.affectedCount} assignments`}
                  {previewResult.skippedCount && previewResult.skippedCount > 0 && (
                    <span className="text-gray-500"> ({previewResult.skippedCount} skipped - already exist)</span>
                  )}
                </p>

                {previewResult.assignments.length > 0 && (
                  <div className="max-h-60 overflow-y-auto mt-3 space-y-1">
                    {previewResult.assignments.slice(0, 20).map((a, index) => (
                      <div key={index} className="text-sm p-2 rounded bg-gray-50">
                        <span className="font-medium">{formatDate(a.date)}</span>
                        <span className="text-gray-500 ml-2">{a.time_block}</span>
                        {a.service_name && (
                          <span className="text-gray-400 ml-2">- {a.service_name}</span>
                        )}
                      </div>
                    ))}
                    {previewResult.assignments.length > 20 && (
                      <div className="text-sm text-gray-500 italic p-2">
                        ...and {previewResult.assignments.length - 20} more
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowPreview(false);
                    setPreviewResult(null);
                  }}
                  className="flex-1 px-4 py-2 rounded border"
                  style={{ borderColor: colors.border }}
                >
                  Back
                </button>
                <button
                  onClick={handleApply}
                  disabled={actionInProgress || previewResult.affectedCount === 0}
                  className="flex-1 px-4 py-2 rounded text-white font-medium disabled:opacity-50"
                  style={{
                    backgroundColor: action === 'remove' ? colors.ptoRed : colors.teal,
                  }}
                >
                  {actionInProgress
                    ? 'Applying...'
                    : action === 'remove'
                    ? `Remove ${previewResult.affectedCount} Assignments`
                    : `Add ${previewResult.affectedCount} Assignments`}
                </button>
              </div>
            </div>
          ) : (
            // Form
            <div className="space-y-4">
              {/* Provider selection */}
              <div>
                <label className="block text-sm font-medium mb-1">Provider</label>
                <select
                  value={selectedProviderId}
                  onChange={(e) => setSelectedProviderId(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  style={{ borderColor: colors.border }}
                  disabled={loading}
                >
                  <option value="">Select provider...</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.initials})
                    </option>
                  ))}
                </select>
              </div>

              {/* Action selection */}
              <div>
                <label className="block text-sm font-medium mb-2">Action</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="action"
                      checked={action === 'remove'}
                      onChange={() => setAction('remove')}
                      style={{ accentColor: colors.primaryBlue }}
                    />
                    <span>Remove from schedule</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="action"
                      checked={action === 'add'}
                      onChange={() => setAction('add')}
                      style={{ accentColor: colors.primaryBlue }}
                    />
                    <span>Add to schedule</span>
                  </label>
                </div>
              </div>

              {/* Pattern selection */}
              <div>
                <label className="block text-sm font-medium mb-2">Pattern</label>
                <div className="flex gap-4 mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="pattern"
                      checked={patternType === 'recurring'}
                      onChange={() => setPatternType('recurring')}
                      style={{ accentColor: colors.primaryBlue }}
                    />
                    <span>Specific recurring pattern</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="pattern"
                      checked={patternType === 'all'}
                      onChange={() => setPatternType('all')}
                      style={{ accentColor: colors.primaryBlue }}
                    />
                    <span>All assignments in date range</span>
                  </label>
                </div>

                {patternType === 'recurring' && (
                  <div className="grid grid-cols-2 gap-3 p-3 rounded bg-gray-50">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Day of Week</label>
                      <select
                        value={dayOfWeek}
                        onChange={(e) => setDayOfWeek(parseInt(e.target.value))}
                        className="w-full px-3 py-2 border rounded"
                        style={{ borderColor: colors.border }}
                      >
                        {DAYS_OF_WEEK.map((day, index) => (
                          <option key={index} value={index}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Time Block</label>
                      <select
                        value={timeBlock}
                        onChange={(e) => setTimeBlock(e.target.value as 'AM' | 'PM' | '')}
                        className="w-full px-3 py-2 border rounded"
                        style={{ borderColor: colors.border }}
                      >
                        <option value="">Both AM & PM</option>
                        <option value="AM">AM Only</option>
                        <option value="PM">PM Only</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Service selection (required for add, optional for remove) */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Service {action === 'add' ? '(required)' : '(optional filter)'}
                </label>
                <select
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  style={{ borderColor: colors.border }}
                  disabled={loading}
                >
                  <option value="">
                    {action === 'add' ? 'Select service...' : 'All services'}
                  </option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.time_block})
                    </option>
                  ))}
                </select>
              </div>

              {/* Room count (only for add) */}
              {action === 'add' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Room Count</label>
                  <input
                    type="number"
                    value={roomCount}
                    onChange={(e) => setRoomCount(parseInt(e.target.value) || 0)}
                    min={0}
                    className="w-full px-3 py-2 border rounded"
                    style={{ borderColor: colors.border }}
                  />
                </div>
              )}

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
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
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handlePreview}
                  disabled={
                    !selectedProviderId ||
                    !startDate ||
                    !endDate ||
                    (action === 'add' && !selectedServiceId) ||
                    actionInProgress
                  }
                  className="flex-1 px-4 py-2 rounded text-white font-medium disabled:opacity-50"
                  style={{ backgroundColor: colors.lightBlue }}
                >
                  {actionInProgress ? 'Loading...' : 'Preview Changes'}
                </button>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 rounded border"
                  style={{ borderColor: colors.border }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
