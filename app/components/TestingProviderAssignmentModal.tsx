'use client';

import { useState } from 'react';
import { Provider, Service, ScheduleAssignment } from '@/lib/types';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  border: '#E5E7EB',
};

interface TestingProviderAssignmentModalProps {
  isOpen: boolean;
  service: Service;
  date: string;
  timeBlock: 'AM' | 'PM';
  providers: Provider[];
  currentAssignment: ScheduleAssignment | null;
  onClose: () => void;
  onAssignmentChange: () => void;
}

export default function TestingProviderAssignmentModal({
  isOpen,
  service,
  date,
  timeBlock,
  providers,
  currentAssignment,
  onClose,
  onAssignmentChange,
}: TestingProviderAssignmentModalProps) {
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  if (!isOpen) return null;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Filter eligible providers by capability
  const eligibleProviders = providers.filter(p => {
    if (!service.required_capability) return true;
    return p.capabilities.includes(service.required_capability);
  });

  const handleAssign = async () => {
    if (!selectedProviderId) return;
    setSaving(true);
    try {
      const response = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: service.id,
          provider_id: selectedProviderId,
          date,
          time_block: timeBlock,
          room_count: 0,
          is_pto: false,
          is_covering: false,
          force_override: true,
        }),
      });

      if (response.ok) {
        onAssignmentChange();
        onClose();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to assign provider');
      }
    } catch (error) {
      console.error('Error assigning provider:', error);
      alert('Failed to assign provider');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!currentAssignment) return;
    setRemoving(true);
    try {
      const response = await fetch(`/api/assignments?id=${currentAssignment.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onAssignmentChange();
        onClose();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to remove assignment');
      }
    } catch (error) {
      console.error('Error removing assignment:', error);
      alert('Failed to remove assignment');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold" style={{ color: colors.primaryBlue }}>
              {service.name}
            </h2>
            <p className="text-sm text-gray-600">
              {formatDate(date)} | {timeBlock}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            ×
          </button>
        </div>

        {/* Current Assignment */}
        {currentAssignment && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Currently Assigned:</h3>
            <div
              className="flex items-center justify-between p-3 rounded-lg"
              style={{ backgroundColor: `${colors.lightBlue}15`, border: `1px solid ${colors.lightBlue}40` }}
            >
              <span className="font-medium" style={{ color: colors.primaryBlue }}>
                {currentAssignment.provider?.name || currentAssignment.provider?.initials || 'Unknown'}
              </span>
              <button
                onClick={handleRemove}
                disabled={removing}
                className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
              >
                {removing ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        )}

        {/* Assign Provider */}
        <div className={currentAssignment ? 'border-t pt-4' : ''} style={{ borderColor: colors.border }}>
          <h3 className="text-sm font-semibold text-gray-600 mb-2">
            {currentAssignment ? 'Replace with:' : 'Assign Provider:'}
          </h3>
          {eligibleProviders.length > 0 ? (
            <div className="space-y-3">
              <select
                value={selectedProviderId}
                onChange={(e) => setSelectedProviderId(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm"
                style={{ borderColor: colors.border }}
              >
                <option value="">Select a provider...</option>
                {eligibleProviders.map(provider => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name} ({provider.initials})
                  </option>
                ))}
              </select>
              <button
                onClick={handleAssign}
                disabled={!selectedProviderId || saving}
                className="w-full py-2 text-white rounded text-sm font-medium disabled:opacity-50 transition-colors"
                style={{ backgroundColor: colors.primaryBlue }}
              >
                {saving ? 'Assigning...' : currentAssignment ? 'Replace Assignment' : 'Assign Provider'}
              </button>
            </div>
          ) : (
            <div className="text-sm text-gray-400 italic">
              No eligible providers available
              {service.required_capability && ` (requires: ${service.required_capability})`}
            </div>
          )}
        </div>

        {/* Close */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded text-sm"
            style={{ borderColor: colors.border }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
