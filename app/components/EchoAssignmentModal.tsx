'use client';

import { useState } from 'react';
import { EchoTech, EchoRoom, EchoScheduleAssignment } from '@/lib/types';

interface EchoAssignmentModalProps {
  isOpen: boolean;
  room: EchoRoom | null;
  date: string;
  timeBlock: 'AM' | 'PM';
  echoTechs: EchoTech[];
  currentAssignments: EchoScheduleAssignment[];
  onClose: () => void;
  onSave: (techId: string, notes: string | null) => Promise<void>;
  onDelete: (assignmentId: string) => Promise<void>;
}

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  border: '#E5E7EB',
  warningRed: '#DC2626',
};

export default function EchoAssignmentModal({
  isOpen,
  room,
  date,
  timeBlock,
  echoTechs,
  currentAssignments,
  onClose,
  onSave,
  onDelete
}: EchoAssignmentModalProps) {
  const [selectedTechId, setSelectedTechId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen || !room) return null;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const handleSave = async () => {
    if (!selectedTechId) return;
    setSaving(true);
    try {
      await onSave(selectedTechId, notes || null);
      setSelectedTechId('');
      setNotes('');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (assignmentId: string) => {
    if (!confirm('Remove this assignment?')) return;
    setSaving(true);
    try {
      await onDelete(assignmentId);
    } finally {
      setSaving(false);
    }
  };

  // Filter out techs already assigned
  const assignedTechIds = new Set(currentAssignments.map(a => a.echo_tech_id));
  const availableTechs = echoTechs.filter(t => t.is_active && !assignedTechIds.has(t.id));

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-2" style={{ color: colors.primaryBlue }}>
          {room.short_name || room.name}
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          {formatDate(date)} - {timeBlock}
        </p>

        {/* Current Assignments */}
        {currentAssignments.length > 0 && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Current Assignments</label>
            <div className="space-y-2">
              {currentAssignments.map(assignment => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded"
                >
                  <div>
                    <span className="font-medium">{assignment.echo_tech?.name}</span>
                    {assignment.notes && (
                      <span className="text-sm text-gray-500 ml-2">({assignment.notes})</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(assignment.id)}
                    disabled={saving}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add New Assignment */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Add Tech</label>
          <select
            value={selectedTechId}
            onChange={(e) => setSelectedTechId(e.target.value)}
            className="w-full px-3 py-2 border rounded mb-2"
            style={{ borderColor: colors.border }}
          >
            <option value="">Select a tech...</option>
            {availableTechs.map(tech => (
              <option key={tech.id} value={tech.id}>
                {tech.name} (capacity: {tech.capacity_per_half_day})
              </option>
            ))}
            <option value="TEMP">Temp</option>
          </select>

          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="w-full px-3 py-2 border rounded"
            style={{ borderColor: colors.border }}
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded border font-medium"
            style={{ borderColor: colors.border }}
          >
            Close
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedTechId || saving}
            className="px-4 py-2 rounded text-white font-medium disabled:opacity-50"
            style={{ backgroundColor: colors.teal }}
          >
            {saving ? 'Saving...' : 'Add Assignment'}
          </button>
        </div>
      </div>
    </div>
  );
}
