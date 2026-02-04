'use client';

import { useState, useMemo } from 'react';
import { Provider, Service } from '@/lib/types';

// Helper to format date in local timezone (avoids UTC conversion issues)
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface BulkAssignmentModalProps {
  providers: Provider[];
  services: Service[];
  onSubmit: (assignments: BulkAssignmentData[]) => Promise<void>;
  onClose: () => void;
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
};

export default function BulkAssignmentModal({
  providers,
  services,
  onSubmit,
  onClose
}: BulkAssignmentModalProps) {
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [selectedService, setSelectedService] = useState<string>('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [timeBlock, setTimeBlock] = useState<string>('AM');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [submitting, setSubmitting] = useState(false);

  const dayOptions = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
  ];

  const generateDatesInRange = useMemo(() => {
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

  const previewCount = generateDatesInRange.length * selectedProviders.length;

  const toggleProvider = (id: string) => {
    setSelectedProviders(prev =>
      prev.includes(id)
        ? prev.filter(p => p !== id)
        : [...prev, id]
    );
  };

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const handleSubmit = async () => {
    if (!selectedService || selectedProviders.length === 0 || generateDatesInRange.length === 0) {
      alert('Please select a service, at least one provider, and a valid date range.');
      return;
    }

    const service = services.find(s => s.id === selectedService);
    const assignments: BulkAssignmentData[] = [];

    selectedProviders.forEach(providerId => {
      const provider = providers.find(p => p.id === providerId);
      generateDatesInRange.forEach(date => {
        assignments.push({
          provider_id: providerId,
          service_id: selectedService,
          date,
          time_block: timeBlock,
          room_count: service?.requires_rooms ? (provider?.default_room_count || 0) : 0,
          is_pto: service?.name === 'PTO'
        });
      });
    });

    setSubmitting(true);
    try {
      await onSubmit(assignments);
      onClose();
    } catch (error) {
      console.error('Error creating bulk assignments:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedServiceData = services.find(s => s.id === selectedService);
  const eligibleProviders = selectedServiceData?.required_capability
    ? providers.filter(p => p.capabilities.includes(selectedServiceData.required_capability!))
    : providers;

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
          Bulk Assignment Creator
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column - Service & Dates */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Service</label>
              <select
                value={selectedService}
                onChange={(e) => {
                  setSelectedService(e.target.value);
                  setSelectedProviders([]);
                }}
                className="w-full px-3 py-2 border rounded"
                style={{ borderColor: colors.border }}
              >
                <option value="">Select a service...</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

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
          </div>

          {/* Right Column - Providers */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Select Providers ({selectedProviders.length} selected)
            </label>
            <div
              className="border rounded p-2 max-h-64 overflow-auto"
              style={{ borderColor: colors.border }}
            >
              {eligibleProviders.map(provider => (
                <label
                  key={provider.id}
                  className="flex items-center p-2 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedProviders.includes(provider.id)}
                    onChange={() => toggleProvider(provider.id)}
                    className="mr-3"
                  />
                  <span className="font-medium" style={{ color: colors.primaryBlue }}>
                    {provider.initials}
                  </span>
                  <span className="ml-2 text-gray-600">{provider.name}</span>
                </label>
              ))}
              {eligibleProviders.length === 0 && (
                <div className="text-center py-4 text-gray-500">
                  {selectedService ? 'No providers with required capability' : 'Select a service first'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="mt-6 p-4 rounded" style={{ backgroundColor: '#F3F4F6' }}>
          <div className="text-sm font-medium mb-1">Preview</div>
          <div className="text-sm text-gray-600">
            {previewCount > 0 ? (
              <>
                This will create <strong>{previewCount}</strong> assignments
                ({selectedProviders.length} provider{selectedProviders.length !== 1 ? 's' : ''} x {generateDatesInRange.length} date{generateDatesInRange.length !== 1 ? 's' : ''})
              </>
            ) : (
              'Select options above to see preview'
            )}
          </div>
        </div>

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
            disabled={submitting || previewCount === 0}
            className="px-6 py-2 rounded text-white font-medium disabled:opacity-50"
            style={{ backgroundColor: colors.primaryBlue }}
          >
            {submitting ? 'Creating...' : `Create ${previewCount} Assignments`}
          </button>
        </div>
      </div>
    </div>
  );
}
