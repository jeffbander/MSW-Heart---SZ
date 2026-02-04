'use client';

import { useState } from 'react';
import { Provider, Service, ScheduleAssignment } from '@/lib/types';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  border: '#E5E7EB',
  ptoRed: '#DC2626',
};

interface ProviderAssignmentModalProps {
  provider: Provider;
  date: string;
  timeBlock: 'AM' | 'PM';
  assignments: ScheduleAssignment[];
  services: Service[];
  onClose: () => void;
  onAssignmentChange: () => void;
}

export default function ProviderAssignmentModal({
  provider,
  date,
  timeBlock,
  assignments,
  services,
  onClose,
  onAssignmentChange
}: ProviderAssignmentModalProps) {
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [isCovering, setIsCovering] = useState(false);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Filter services that can be added
  // - Match time block (AM/PM/BOTH)
  // - Not already assigned
  // - Provider has required capability (if any)
  const availableServices = services.filter(s => {
    // Check time block compatibility
    if (s.time_block !== 'BOTH' && s.time_block !== timeBlock) return false;

    // Check if already assigned
    const alreadyAssigned = assignments.some(a => a.service_id === s.id);
    if (alreadyAssigned) return false;

    // Check capability requirement
    if (s.required_capability && !provider.capabilities.includes(s.required_capability)) {
      return false;
    }

    return true;
  });

  const handleAddAssignment = async () => {
    if (!selectedServiceId) {
      alert('Please select a service');
      return;
    }

    const service = services.find(s => s.id === selectedServiceId);
    if (!service) return;

    setAdding(true);
    try {
      const response = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: selectedServiceId,
          provider_id: provider.id,
          date: date,
          time_block: timeBlock,
          room_count: service.requires_rooms ? provider.default_room_count : 0,
          is_pto: service.name === 'PTO',
          is_covering: isCovering
        })
      });

      if (response.ok) {
        onAssignmentChange();
        setSelectedServiceId('');
        setIsCovering(false);
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error adding assignment:', error);
      alert('Failed to add assignment');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    setRemoving(assignmentId);
    try {
      const response = await fetch(`/api/assignments?id=${assignmentId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        onAssignmentChange();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error removing assignment:', error);
      alert('Failed to remove assignment');
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold" style={{ color: colors.primaryBlue }}>
              {provider.name}
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

        {/* Current Assignments */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Current Assignments:</h3>
          {assignments.length > 0 ? (
            <div className="space-y-2">
              {assignments.map(assignment => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{
                    backgroundColor: assignment.is_pto ? '#FEF2F2' : `${colors.lightBlue}15`,
                    border: `1px solid ${assignment.is_pto ? colors.ptoRed : colors.lightBlue}40`
                  }}
                >
                  <div>
                    <span
                      className="font-medium"
                      style={{ color: assignment.is_pto ? colors.ptoRed : colors.primaryBlue }}
                    >
                      {assignment.service?.name || 'Unknown Service'}
                    </span>
                    {assignment.room_count > 0 && (
                      <span className="text-sm ml-2" style={{ color: colors.teal }}>
                        ({assignment.room_count} rooms)
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveAssignment(assignment.id)}
                    disabled={removing === assignment.id}
                    className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                  >
                    {removing === assignment.id ? 'Removing...' : 'Remove'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-400 italic p-3 bg-gray-50 rounded">
              No assignments for this time slot
            </div>
          )}
        </div>

        {/* Add Service */}
        <div className="border-t pt-4" style={{ borderColor: colors.border }}>
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Add Service:</h3>
          {availableServices.length > 0 ? (
            <div className="space-y-3">
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm"
                style={{ borderColor: colors.border }}
              >
                <option value="">Select a service...</option>
                {availableServices.map(service => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                    {service.required_capability && ` (${service.required_capability})`}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={isCovering}
                  onChange={(e) => setIsCovering(e.target.checked)}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: '#059669' }}
                />
                <span style={{ color: isCovering ? '#059669' : undefined }}>
                  Covering for someone
                </span>
              </label>
              <button
                onClick={handleAddAssignment}
                disabled={!selectedServiceId || adding}
                className="w-full py-2 text-white rounded text-sm font-medium disabled:opacity-50 transition-colors"
                style={{ backgroundColor: colors.primaryBlue }}
              >
                {adding ? 'Adding...' : 'Add Assignment'}
              </button>
            </div>
          ) : (
            <div className="text-sm text-gray-400 italic">
              No more services available for this time slot
            </div>
          )}
        </div>

        {/* Close Button */}
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
