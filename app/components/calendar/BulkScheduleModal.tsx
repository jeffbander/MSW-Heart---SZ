'use client';

import { useState, useMemo, useEffect } from 'react';
import { Provider, Service, ScheduleAssignment } from '@/lib/types';

// Helper to format date in local timezone (avoids UTC conversion issues)
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface BulkScheduleModalProps {
  providers: Provider[];
  services: Service[];
  onClose: () => void;
  onSuccess: () => void;
}

interface BulkAssignmentData {
  provider_id: string;
  service_id: string;
  date: string;
  time_block: string;
  room_count: number;
  is_pto: boolean;
}

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  border: '#E5E7EB',
  red: '#DC2626',
};

export default function BulkScheduleModal({
  providers,
  services,
  onClose,
  onSuccess
}: BulkScheduleModalProps) {
  // Action type
  const [action, setAction] = useState<'ADD' | 'REMOVE'>('ADD');

  // Provider selection (single, with search)
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [providerSearch, setProviderSearch] = useState<string>('');
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);

  // Service selection
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');

  // Days of week
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);

  // Time block
  const [timeBlock, setTimeBlock] = useState<string>('AM');

  // Date range
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // State for REMOVE action
  const [matchingAssignments, setMatchingAssignments] = useState<ScheduleAssignment[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dayOptions = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
  ];

  // Filter providers by search query
  const filteredProviders = useMemo(() => {
    if (!providerSearch) return providers;
    const query = providerSearch.toLowerCase();
    return providers.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.initials.toLowerCase().includes(query)
    );
  }, [providers, providerSearch]);

  // Get selected provider object
  const selectedProvider = useMemo(() =>
    providers.find(p => p.id === selectedProviderId),
    [providers, selectedProviderId]
  );

  // Get selected service object
  const selectedService = useMemo(() =>
    services.find(s => s.id === selectedServiceId),
    [services, selectedServiceId]
  );

  // Check if provider has capability for selected service
  const hasCapability = useMemo(() => {
    if (!selectedService?.required_capability || !selectedProvider) return true;
    return selectedProvider.capabilities.includes(selectedService.required_capability);
  }, [selectedService, selectedProvider]);

  // Generate dates in range matching selected days
  const generatedDates = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return [];

    const dates: string[] = [];
    const start = new Date(dateRange.start + 'T00:00:00');
    const end = new Date(dateRange.end + 'T00:00:00');

    const current = new Date(start);
    while (current <= end) {
      if (selectedDays.includes(current.getDay())) {
        dates.push(formatLocalDate(current));
      }
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }, [dateRange, selectedDays]);

  // Fetch matching assignments when REMOVE is selected and criteria change
  useEffect(() => {
    if (action !== 'REMOVE') {
      setMatchingAssignments([]);
      return;
    }

    if (!selectedProviderId || !selectedServiceId || !dateRange.start || !dateRange.end) {
      setMatchingAssignments([]);
      return;
    }

    const fetchMatches = async () => {
      setLoadingMatches(true);
      try {
        const response = await fetch(
          `/api/assignments?startDate=${dateRange.start}&endDate=${dateRange.end}`
        );
        if (!response.ok) throw new Error('Failed to fetch assignments');

        const allAssignments: ScheduleAssignment[] = await response.json();

        // Filter to matching criteria
        const matching = allAssignments.filter(a => {
          if (a.provider_id !== selectedProviderId) return false;
          if (a.service_id !== selectedServiceId) return false;

          const date = new Date(a.date + 'T00:00:00');
          if (!selectedDays.includes(date.getDay())) return false;

          if (timeBlock !== 'BOTH' && a.time_block !== timeBlock) return false;

          return true;
        });

        setMatchingAssignments(matching);
      } catch (err) {
        console.error('Error fetching assignments:', err);
        setMatchingAssignments([]);
      } finally {
        setLoadingMatches(false);
      }
    };

    fetchMatches();
  }, [action, selectedProviderId, selectedServiceId, dateRange, selectedDays, timeBlock]);

  // Preview count
  const previewCount = action === 'ADD'
    ? generatedDates.length
    : matchingAssignments.length;

  // Toggle day selection
  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  // Validation
  const isValid = () => {
    if (!selectedProviderId) return false;
    if (!selectedServiceId) return false;
    if (selectedDays.length === 0) return false;
    if (!dateRange.start || !dateRange.end) return false;
    if (dateRange.end < dateRange.start) return false;
    if (action === 'ADD' && generatedDates.length === 0) return false;
    if (action === 'REMOVE' && matchingAssignments.length === 0) return false;
    return true;
  };

  // Handle ADD submission
  const handleAddSubmit = async () => {
    if (!selectedService || !selectedProvider) return;

    const assignments: BulkAssignmentData[] = generatedDates.map(date => ({
      provider_id: selectedProviderId,
      service_id: selectedServiceId,
      date,
      time_block: timeBlock,
      room_count: selectedService.requires_rooms ? (selectedProvider.default_room_count || 0) : 0,
      is_pto: selectedService.name === 'PTO'
    }));

    const response = await fetch('/api/assignments/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignments })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to create assignments');
    }

    return response.json();
  };

  // Handle REMOVE submission
  const handleRemoveSubmit = async () => {
    if (matchingAssignments.length === 0) {
      throw new Error('No assignments found to remove');
    }

    const ids = matchingAssignments.map(a => a.id);

    const response = await fetch('/api/assignments/bulk', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to delete assignments');
    }

    return response.json();
  };

  // Main submit handler
  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      if (action === 'ADD') {
        await handleAddSubmit();
      } else {
        await handleRemoveSubmit();
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const dayName = dayOptions[date.getDay()].label;
    return `${dayName} ${dateStr}`;
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold mb-4" style={{ color: colors.primaryBlue }}>
          Bulk Schedule Manager
        </h3>

        {/* Action Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setAction('ADD')}
            className={`px-4 py-2 rounded font-medium ${
              action === 'ADD' ? 'text-white' : ''
            }`}
            style={{
              backgroundColor: action === 'ADD' ? colors.teal : 'white',
              border: `1px solid ${colors.teal}`,
              color: action === 'ADD' ? 'white' : colors.teal
            }}
          >
            Add to Schedule
          </button>
          <button
            type="button"
            onClick={() => setAction('REMOVE')}
            className={`px-4 py-2 rounded font-medium ${
              action === 'REMOVE' ? 'text-white' : ''
            }`}
            style={{
              backgroundColor: action === 'REMOVE' ? colors.red : 'white',
              border: `1px solid ${colors.red}`,
              color: action === 'REMOVE' ? 'white' : colors.red
            }}
          >
            Remove from Schedule
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column - Selection Criteria */}
          <div className="space-y-4">
            {/* Provider Search Dropdown */}
            <div className="relative">
              <label className="block text-sm font-medium mb-1">Provider</label>
              <input
                type="text"
                value={selectedProvider ? `${selectedProvider.initials} - ${selectedProvider.name}` : providerSearch}
                onChange={(e) => {
                  setProviderSearch(e.target.value);
                  setSelectedProviderId('');
                  setShowProviderDropdown(true);
                }}
                onFocus={() => setShowProviderDropdown(true)}
                placeholder="Search by name or initials..."
                className="w-full px-3 py-2 border rounded"
                style={{ borderColor: colors.border }}
              />
              {showProviderDropdown && !selectedProviderId && (
                <div
                  className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-48 overflow-auto"
                  style={{ borderColor: colors.border }}
                >
                  {filteredProviders.map(provider => (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => {
                        setSelectedProviderId(provider.id);
                        setProviderSearch('');
                        setShowProviderDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-100"
                    >
                      <span className="font-medium" style={{ color: colors.primaryBlue }}>
                        {provider.initials}
                      </span>
                      <span className="ml-2 text-gray-600">{provider.name}</span>
                    </button>
                  ))}
                  {filteredProviders.length === 0 && (
                    <div className="px-3 py-2 text-gray-500">No providers found</div>
                  )}
                </div>
              )}
              {selectedProvider && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProviderId('');
                    setProviderSearch('');
                  }}
                  className="absolute right-2 top-8 text-gray-400 hover:text-gray-600"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Service Dropdown */}
            <div>
              <label className="block text-sm font-medium mb-1">Service</label>
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                style={{ borderColor: colors.border }}
              >
                <option value="">Select a service...</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {selectedService?.required_capability && selectedProvider && !hasCapability && (
                <div className="mt-1 text-sm text-amber-600">
                  Warning: {selectedProvider.initials} does not have the &quot;{selectedService.required_capability}&quot; capability
                </div>
              )}
            </div>

            {/* Days of Week */}
            <div>
              <label className="block text-sm font-medium mb-2">Days of Week</label>
              <div className="flex flex-wrap gap-2">
                {dayOptions.map(day => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={`px-3 py-1 rounded border text-sm ${
                      selectedDays.includes(day.value) ? 'text-white' : ''
                    }`}
                    style={{
                      backgroundColor: selectedDays.includes(day.value) ? colors.lightBlue : 'white',
                      borderColor: colors.lightBlue
                    }}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Block */}
            <div>
              <label className="block text-sm font-medium mb-1">Time Block</label>
              <select
                value={timeBlock}
                onChange={(e) => setTimeBlock(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                style={{ borderColor: colors.border }}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
                <option value="BOTH">All Day</option>
              </select>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Start Date</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                  style={{ borderColor: colors.border }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End Date</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                  style={{ borderColor: colors.border }}
                />
              </div>
            </div>
          </div>

          {/* Right Column - Preview */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Preview {loadingMatches && <span className="text-gray-400">(loading...)</span>}
            </label>
            <div
              className="border rounded p-3 max-h-72 overflow-auto"
              style={{ borderColor: colors.border, backgroundColor: '#F9FAFB' }}
            >
              {action === 'ADD' ? (
                <>
                  {generatedDates.length > 0 ? (
                    <>
                      <div className="text-sm font-medium mb-2" style={{ color: colors.teal }}>
                        Will create {generatedDates.length} assignment{generatedDates.length !== 1 ? 's' : ''}
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        {generatedDates.slice(0, 10).map(date => (
                          <div key={date}>{formatDate(date)} - {timeBlock}</div>
                        ))}
                        {generatedDates.length > 10 && (
                          <div className="text-gray-400">...and {generatedDates.length - 10} more</div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-gray-500">
                      Select options to preview assignments
                    </div>
                  )}
                </>
              ) : (
                <>
                  {matchingAssignments.length > 0 ? (
                    <>
                      <div className="text-sm font-medium mb-2" style={{ color: colors.red }}>
                        Found {matchingAssignments.length} assignment{matchingAssignments.length !== 1 ? 's' : ''} to remove
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        {matchingAssignments.slice(0, 10).map(a => (
                          <div key={a.id}>{formatDate(a.date)} - {a.time_block}</div>
                        ))}
                        {matchingAssignments.length > 10 && (
                          <div className="text-gray-400">...and {matchingAssignments.length - 10} more</div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-gray-500">
                      {loadingMatches
                        ? 'Searching for assignments...'
                        : selectedProviderId && selectedServiceId && dateRange.start && dateRange.end
                          ? 'No matching assignments found'
                          : 'Select options to find assignments'}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-3 rounded bg-red-50 text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Footer Buttons */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded border font-medium"
            style={{ borderColor: colors.border }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !isValid()}
            className="px-6 py-2 rounded text-white font-medium disabled:opacity-50"
            style={{
              backgroundColor: action === 'ADD' ? colors.teal : colors.red
            }}
          >
            {submitting
              ? (action === 'ADD' ? 'Creating...' : 'Removing...')
              : action === 'ADD'
                ? `Add ${previewCount} Assignment${previewCount !== 1 ? 's' : ''}`
                : `Remove ${previewCount} Assignment${previewCount !== 1 ? 's' : ''}`
            }
          </button>
        </div>
      </div>
    </div>
  );
}
