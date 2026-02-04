'use client';

import { useState } from 'react';
import { TemplateType } from '@/lib/types';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  ptoRed: '#DC2626',
  border: '#E5E7EB',
};

interface SaveTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (result: any) => void;
  weekStartDate: string;
}

export default function SaveTemplateModal({
  isOpen,
  onClose,
  onSave,
  weekStartDate,
}: SaveTemplateModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TemplateType>('weekly');
  const [isGlobal, setIsGlobal] = useState(true);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Template name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/templates/from-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          type,
          weekStartDate,
          isGlobal,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to save template');
        return;
      }

      onSave(result);
      handleClose();
    } catch (err) {
      setError('Failed to save template');
      console.error('Error saving template:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setType('weekly');
    setIsGlobal(true);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  // Format the week date range for display
  const weekStart = new Date(weekStartDate + 'T00:00:00');
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-xl font-bold mb-2" style={{ color: colors.primaryBlue }}>
          Save Week as Template
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Creating template from {formatDate(weekStart)} - {formatDate(weekEnd)}
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Template Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              style={{ borderColor: colors.border }}
              placeholder="e.g., Week A, Standard Week"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              style={{ borderColor: colors.border }}
              rows={2}
              placeholder="Optional description..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Template Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as TemplateType)}
              className="w-full px-3 py-2 border rounded"
              style={{ borderColor: colors.border }}
            >
              <option value="weekly">Weekly Pattern</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isGlobal}
              onChange={(e) => setIsGlobal(e.target.checked)}
            />
            <span className="text-sm">Global Template (visible to all)</span>
          </label>

          {error && (
            <div className="p-3 rounded text-sm" style={{ backgroundColor: `${colors.ptoRed}10`, color: colors.ptoRed }}>
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="flex-1 px-4 py-2 rounded text-white font-medium disabled:opacity-50"
              style={{ backgroundColor: colors.primaryBlue }}
            >
              {saving ? 'Saving...' : 'Save Template'}
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
      </div>
    </div>
  );
}
