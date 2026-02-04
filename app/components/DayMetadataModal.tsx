'use client';

import { useState, useEffect } from 'react';
import { DayMetadata } from '@/lib/types';

interface DayMetadataModalProps {
  date: string;
  timeBlock: 'AM' | 'PM';
  existingMetadata?: DayMetadata | null;
  onSave: (metadata: Partial<DayMetadata>) => Promise<void>;
  onClose: () => void;
}

const colors = {
  primaryBlue: '#003D7A',
  border: '#E5E7EB',
  chpAmber: '#F59E0B',
  extraPurple: '#8B5CF6',
  noteBlue: '#3B82F6',
};

export default function DayMetadataModal({
  date,
  timeBlock,
  existingMetadata,
  onSave,
  onClose,
}: DayMetadataModalProps) {
  const [formData, setFormData] = useState({
    chp_room_in_use: existingMetadata?.chp_room_in_use || false,
    chp_room_note: existingMetadata?.chp_room_note || '',
    extra_room_available: existingMetadata?.extra_room_available || false,
    extra_room_note: existingMetadata?.extra_room_note || '',
    day_note: existingMetadata?.day_note || '',
  });
  const [saving, setSaving] = useState(false);

  // Format date for display
  const formatDisplayDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        date,
        time_block: timeBlock,
        ...formData,
      });
      onClose();
    } catch (error) {
      console.error('Error saving metadata:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold mb-1" style={{ color: colors.primaryBlue }}>
          Room & Notes
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          {formatDisplayDate(date)} - {timeBlock}
        </p>

        <div className="space-y-4">
          {/* CHP Room Section */}
          <div className="p-3 rounded-lg" style={{ backgroundColor: formData.chp_room_in_use ? '#FEF3C7' : '#F9FAFB' }}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.chp_room_in_use}
                onChange={(e) => setFormData(prev => ({ ...prev, chp_room_in_use: e.target.checked }))}
                className="w-4 h-4 rounded"
                style={{ accentColor: colors.chpAmber }}
              />
              <span className="font-medium" style={{ color: formData.chp_room_in_use ? colors.chpAmber : undefined }}>
                CHP Room In Use
              </span>
            </label>
            {formData.chp_room_in_use && (
              <textarea
                value={formData.chp_room_note}
                onChange={(e) => setFormData(prev => ({ ...prev, chp_room_note: e.target.value }))}
                className="w-full mt-2 px-3 py-2 border rounded text-sm"
                style={{ borderColor: colors.border }}
                rows={2}
                placeholder="Note about CHP room usage..."
              />
            )}
          </div>

          {/* Extra Room Section */}
          <div className="p-3 rounded-lg" style={{ backgroundColor: formData.extra_room_available ? '#EDE9FE' : '#F9FAFB' }}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.extra_room_available}
                onChange={(e) => setFormData(prev => ({ ...prev, extra_room_available: e.target.checked }))}
                className="w-4 h-4 rounded"
                style={{ accentColor: colors.extraPurple }}
              />
              <span className="font-medium" style={{ color: formData.extra_room_available ? colors.extraPurple : undefined }}>
                Extra Room Available
              </span>
            </label>
            {formData.extra_room_available && (
              <textarea
                value={formData.extra_room_note}
                onChange={(e) => setFormData(prev => ({ ...prev, extra_room_note: e.target.value }))}
                className="w-full mt-2 px-3 py-2 border rounded text-sm"
                style={{ borderColor: colors.border }}
                rows={2}
                placeholder="Note about extra room..."
              />
            )}
          </div>

          {/* Day Note Section */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.noteBlue }}>
              Day Note
            </label>
            <textarea
              value={formData.day_note}
              onChange={(e) => setFormData(prev => ({ ...prev, day_note: e.target.value }))}
              className="w-full px-3 py-2 border rounded text-sm"
              style={{ borderColor: colors.border }}
              rows={3}
              placeholder="General notes for this day/time..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
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
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
