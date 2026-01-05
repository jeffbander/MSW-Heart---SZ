'use client';

import { useState } from 'react';
import { ScheduleAssignment, Provider, Service } from '@/lib/types';

interface EditAssignmentModalProps {
  assignment: ScheduleAssignment;
  providers: Provider[];
  services: Service[];
  onSave: (updates: { id: string; provider_id?: string; room_count?: number; notes?: string; time_block?: string; is_covering?: boolean }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  ptoRed: '#DC2626',
  border: '#E5E7EB',
};

export default function EditAssignmentModal({
  assignment,
  providers,
  services,
  onSave,
  onDelete,
  onClose
}: EditAssignmentModalProps) {
  const [formData, setFormData] = useState({
    provider_id: assignment.provider_id,
    room_count: assignment.room_count,
    notes: assignment.notes || '',
    time_block: assignment.time_block,
    is_covering: assignment.is_covering || false
  });
  const [saving, setSaving] = useState(false);

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
              style={{ borderColor: colors.border }}
            >
              {eligibleProviders.map(p => (
                <option key={p.id} value={p.id}>
                  {p.initials} - {p.name}
                </option>
              ))}
            </select>
          </div>

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
