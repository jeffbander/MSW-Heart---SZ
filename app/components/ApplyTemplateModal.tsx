'use client';

import { useState, useEffect } from 'react';
import { ScheduleTemplate } from '@/lib/types';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  ptoRed: '#DC2626',
  border: '#E5E7EB',
};

interface ApplyTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (result: any) => void;
  defaultStartDate?: string;
  defaultEndDate?: string;
}

export default function ApplyTemplateModal({
  isOpen,
  onClose,
  onApply,
  defaultStartDate,
  defaultEndDate,
}: ApplyTemplateModalProps) {
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [startDate, setStartDate] = useState(defaultStartDate || '');
  const [endDate, setEndDate] = useState(defaultEndDate || '');
  const [conflictMode, setConflictMode] = useState<'replace' | 'fill' | null>(null);
  const [showConflictDialog, setShowConflictDialog] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      if (defaultStartDate) setStartDate(defaultStartDate);
      if (defaultEndDate) setEndDate(defaultEndDate);
    }
  }, [isOpen, defaultStartDate, defaultEndDate]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/templates');
      const data = await response.json();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (mode: 'replace' | 'fill') => {
    if (!selectedTemplateId || !startDate || !endDate) return;

    setApplying(true);
    setError(null);

    try {
      const response = await fetch('/api/templates/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplateId,
          startDate,
          endDate,
          options: {
            clearExisting: mode === 'replace',
            skipConflicts: mode === 'fill',
          },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to apply template');
        return;
      }

      onApply(result);
      handleClose();
    } catch (err) {
      setError('Failed to apply template');
      console.error('Error applying template:', err);
    } finally {
      setApplying(false);
      setShowConflictDialog(false);
    }
  };

  const handleSubmit = () => {
    // Show conflict dialog to ask user what to do
    setShowConflictDialog(true);
  };

  const handleClose = () => {
    setSelectedTemplateId('');
    setStartDate('');
    setEndDate('');
    setError(null);
    setShowConflictDialog(false);
    setConflictMode(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        {/* Conflict Dialog */}
        {showConflictDialog ? (
          <>
            <h3 className="text-xl font-bold mb-4" style={{ color: colors.primaryBlue }}>
              How should we handle existing assignments?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              The selected date range may already have assignments. Choose how to proceed:
            </p>

            <div className="space-y-3 mb-6">
              <button
                onClick={() => handleApply('replace')}
                disabled={applying}
                className="w-full p-4 border rounded-lg text-left hover:bg-gray-50 transition-colors"
                style={{ borderColor: colors.border }}
              >
                <div className="font-semibold" style={{ color: colors.primaryBlue }}>
                  Replace All
                </div>
                <div className="text-sm text-gray-600">
                  Clear all existing assignments and apply the template
                </div>
              </button>

              <button
                onClick={() => handleApply('fill')}
                disabled={applying}
                className="w-full p-4 border rounded-lg text-left hover:bg-gray-50 transition-colors"
                style={{ borderColor: colors.border }}
              >
                <div className="font-semibold" style={{ color: colors.teal }}>
                  Fill Empty Only
                </div>
                <div className="text-sm text-gray-600">
                  Keep existing assignments, only add where empty
                </div>
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded text-sm" style={{ backgroundColor: `${colors.ptoRed}10`, color: colors.ptoRed }}>
                {error}
              </div>
            )}

            <button
              onClick={() => setShowConflictDialog(false)}
              className="w-full px-4 py-2 rounded border"
              style={{ borderColor: colors.border }}
            >
              Back
            </button>
          </>
        ) : (
          <>
            <h3 className="text-xl font-bold mb-4" style={{ color: colors.primaryBlue }}>
              Apply Template
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Template</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  style={{ borderColor: colors.border }}
                  disabled={loading}
                >
                  <option value="">Select template...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                    style={{ borderColor: colors.border }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                    style={{ borderColor: colors.border }}
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 rounded text-sm" style={{ backgroundColor: `${colors.ptoRed}10`, color: colors.ptoRed }}>
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSubmit}
                  disabled={!selectedTemplateId || !startDate || !endDate || applying}
                  className="flex-1 px-4 py-2 rounded text-white font-medium disabled:opacity-50"
                  style={{ backgroundColor: colors.primaryBlue }}
                >
                  {applying ? 'Applying...' : 'Apply Template'}
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
          </>
        )}
      </div>
    </div>
  );
}
