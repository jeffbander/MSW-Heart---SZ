'use client';

import { useState, useEffect, useMemo } from 'react';
import { ScheduleAssignment, Provider, Service } from '@/lib/types';

interface EditAssignmentModalProps {
  assignment: ScheduleAssignment;
  providers: Provider[];
  services: Service[];
  onSave: (updates: { id: string; provider_id?: string; room_count?: number; notes?: string; time_block?: string; is_covering?: boolean }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
  // Optional: function to get provider PTO for a date
  getProviderPTOForDate?: (providerId: string, date: string) => string[];
}

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  ptoRed: '#DC2626',
  border: '#E5E7EB',
  warning: '#F59E0B',
  warningBg: '#FFFBEB',
};

export default function EditAssignmentModal({
  assignment,
  providers,
  services,
  onSave,
  onDelete,
  onClose,
  getProviderPTOForDate
}: EditAssignmentModalProps) {
  const [formData, setFormData] = useState({
    provider_id: assignment.provider_id,
    room_count: assignment.room_count,
    notes: assignment.notes || '',
    time_block: assignment.time_block,
    is_covering: assignment.is_covering || false
  });
  const [saving, setSaving] = useState(false);

  // Check PTO for selected provider
  const selectedProviderPTO = useMemo(() => {
    if (!getProviderPTOForDate || !formData.provider_id) return [];
    return getProviderPTOForDate(formData.provider_id, assignment.date);
  }, [getProviderPTOForDate, formData.provider_id, assignment.date]);

  // Check if PTO conflicts with the assignment time block
  const hasPTOConflict = useMemo(() => {
    if (selectedProviderPTO.length === 0) return false;
    if (selectedProviderPTO.includes('BOTH')) return true;
    if (formData.time_block === 'BOTH') return selectedProviderPTO.length > 0;
    return selectedProviderPTO.includes(formData.time_block);
  }, [selectedProviderPTO, formData.time_block]);

  const ptoWarningMessage = useMemo(() => {
    if (!hasPTOConflict) return null;
    const provider = providers.find(p => p.id === formData.provider_id);
    if (!provider) return null;

    const ptoType = selectedProviderPTO.includes('BOTH') ? 'Full Day' :
      selectedProviderPTO.map(tb => tb === 'AM' ? 'Morning' : 'Afternoon').join(' & ');

    return `${provider.initials} has ${ptoType} PTO on this date`;
  }, [hasPTOConflict, selectedProviderPTO, formData.provider_id, providers]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        id: assignment.id,
        ...formData
      });
      onClose();
    } catch (error) {
      console.error('Error saving assignment:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this assignment?')) return;

    try {
      await onDelete(assignment.id);
      onClose();
    } catch (error) {
      console.error('Error deleting assignment:', error);
    }
  };

  const service = services.find(s => s.id === assignment.service_id);
  const eligibleProviders = service?.required_capability
    ? providers.filter(p => p.capabilities.includes(service.required_capability!))
    : providers;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold mb-4" style={{ color: colors.primaryBlue }}>
          Edit Assignment
        </h3>

        <div className="mb-4 p-3 rounded" style={{ backgroundColor: '#F3F4F6' }}>
          <div className="text-sm text-gray-500">Service</div>
          <div className="font-semibold" style={{ color: colors.primaryBlue }}>
            {service?.name || 'Unknown Service'}
          </div>
          <div className="text-sm text-gray-500 mt-1">Date: {assignment.date}</div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Provider</label>
            <select
              value={formData.provider_id}
              onChange={(e) => setFormData(prev => ({ ...prev, provider_id: e.target.value }))}
              className="w-full px-3 py-2 border rounded"
              style={{
                borderColor: hasPTOConflict ? colors.warning : colors.border
              }}
            >
              {eligibleProviders.map(p => {
                const providerPTO = getProviderPTOForDate ? getProviderPTOForDate(p.id, assignment.date) : [];
                const hasPTO = providerPTO.length > 0;
                return (
                  <option key={p.id} value={p.id}>
                    {p.initials} - {p.name}{hasPTO ? ' (On PTO)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* PTO Warning */}
          {hasPTOConflict && ptoWarningMessage && (
            <div
              className="p-3 rounded-lg border flex items-start gap-2"
              style={{
                backgroundColor: colors.warningBg,
                borderColor: colors.warning
              }}
            >
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke={colors.warning} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <div className="text-sm font-medium" style={{ color: colors.warning }}>
                  PTO Conflict
                </div>
                <div className="text-sm text-gray-600">
                  {ptoWarningMessage}. Assigning this provider will override their PTO.
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Time Block</label>
            <select
              value={formData.time_block}
              onChange={(e) => setFormData(prev => ({ ...prev, time_block: e.target.value }))}
              className="w-full px-3 py-2 border rounded"
              style={{ borderColor: colors.border }}
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
              <option value="BOTH">All Day</option>
            </select>
          </div>

          {service?.requires_rooms && (
            <div>
              <label className="block text-sm font-medium mb-1">Room Count</label>
              <input
                type="number"
                min="0"
                max="10"
                value={formData.room_count}
                onChange={(e) => setFormData(prev => ({ ...prev, room_count: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border rounded"
                style={{ borderColor: colors.border }}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full px-3 py-2 border rounded"
              style={{ borderColor: colors.border }}
              rows={3}
              placeholder="Optional notes..."
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_covering"
              checked={formData.is_covering}
              onChange={(e) => setFormData(prev => ({ ...prev, is_covering: e.target.checked }))}
              className="w-4 h-4"
            />
            <label htmlFor="is_covering" className="text-sm font-medium" style={{ color: formData.is_covering ? '#059669' : undefined }}>
              Covering for someone
            </label>
          </div>
        </div>

        <div className="flex justify-between mt-6">
          <button
            onClick={handleDelete}
            className="px-4 py-2 rounded text-white font-medium"
            style={{ backgroundColor: colors.ptoRed }}
          >
            Delete
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded border font-medium"
              style={{ borderColor: colors.border }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded text-white font-medium disabled:opacity-50"
              style={{ backgroundColor: colors.primaryBlue }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
