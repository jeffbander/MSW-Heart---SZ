'use client';

import { useState } from 'react';

interface DayNoteModalProps {
  date: string;
  existingNote: string | null;
  onSave: (date: string, note: string) => Promise<void>;
  onClose: () => void;
}

const colors = {
  primaryBlue: '#003D7A',
  border: '#E5E7EB',
  noteBlue: '#3B82F6',
};

export default function DayNoteModal({
  date,
  existingNote,
  onSave,
  onClose,
}: DayNoteModalProps) {
  const [note, setNote] = useState(existingNote || '');
  const [saving, setSaving] = useState(false);

  // Format date for display
  const formatDisplayDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(date, note);
      onClose();
    } catch (error) {
      console.error('Error saving day note:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold mb-1" style={{ color: colors.primaryBlue }}>
          {existingNote ? 'Edit Day Note' : 'Add Day Note'}
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          {formatDisplayDate(date)}
        </p>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: colors.noteBlue }}>
            Note
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            style={{ borderColor: colors.border }}
            rows={4}
            placeholder="Enter a note for this day..."
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded border font-medium hover:bg-gray-50"
            style={{ borderColor: colors.border }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded text-white font-medium disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: colors.primaryBlue }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
