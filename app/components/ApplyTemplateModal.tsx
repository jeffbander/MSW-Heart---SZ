'use client';

import { useState, useEffect } from 'react';
import { ScheduleTemplate } from '@/lib/types';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  ptoRed: '#DC2626',
  warningAmber: '#F59E0B',
  border: '#E5E7EB',
};

interface PTOConflict {
  provider_id: string;
  provider_name?: string;
  date: string;
  time_block: string;
  intended_service_id: string;
  intended_service_name?: string;
  reason: string;
}

interface ApplyTemplateResult {
  success: boolean;
  created: number;
  skipped: number;
  holidayConflicts?: string[];
  ptoConflicts?: PTOConflict[];
  coverageNeeded?: number;
  historyId?: string;
  message?: string;
}

interface ApplyTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (result: ApplyTemplateResult) => void;
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
  const [showConflictDialog, setShowConflictDialog] = useState(false);

  // Result display state
  const [applyResult, setApplyResult] = useState<ApplyTemplateResult | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [showFullPTOList, setShowFullPTOList] = useState(false);

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

      const result: ApplyTemplateResult = await response.json();

      if (!response.ok) {
        setError(result.message || 'Failed to apply template');
        return;
      }

      // Show result dialog with PTO conflicts if any
      setApplyResult(result);
      setShowConflictDialog(false);
      setShowResultDialog(true);

    } catch (err) {
      setError('Failed to apply template');
      console.error('Error applying template:', err);
    } finally {
      setApplying(false);
    }
  };

  const handleResultClose = () => {
    if (applyResult) {
      onApply(applyResult);
    }
    handleClose();
  };

  const handleSubmit = () => {
    setShowConflictDialog(true);
  };

  const handleClose = () => {
    setSelectedTemplateId('');
    setStartDate('');
    setEndDate('');
    setError(null);
    setShowConflictDialog(false);
    setApplyResult(null);
    setShowResultDialog(false);
    setShowFullPTOList(false);
    onClose();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  if (!isOpen) return null;

  // Result dialog showing PTO conflicts
  if (showResultDialog && applyResult) {
    const hasPTOConflicts = applyResult.ptoConflicts && applyResult.ptoConflicts.length > 0;
    const hasHolidayConflicts = applyResult.holidayConflicts && applyResult.holidayConflicts.length > 0;
    const displayedPTOConflicts = showFullPTOList
      ? applyResult.ptoConflicts
      : applyResult.ptoConflicts?.slice(0, 5);

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <h3 className="text-xl font-bold mb-4" style={{ color: colors.primaryBlue }}>
            Template Applied Successfully!
          </h3>

          {/* Summary stats */}
          <div className="space-y-2 mb-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Created:</span>
              <span className="font-semibold" style={{ color: colors.teal }}>
                {applyResult.created} assignments
              </span>
            </div>
            {applyResult.skipped > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Skipped (existing):</span>
                <span className="font-semibold text-gray-500">{applyResult.skipped}</span>
              </div>
            )}
            {hasPTOConflicts && (
              <div className="flex justify-between">
                <span className="text-gray-600">Skipped (PTO conflicts):</span>
                <span className="font-semibold" style={{ color: colors.warningAmber }}>
                  {applyResult.ptoConflicts!.length}
                </span>
              </div>
            )}
          </div>

          {/* PTO Conflicts Warning */}
          {hasPTOConflicts && (
            <div
              className="mb-4 p-4 rounded-lg"
              style={{ backgroundColor: `${colors.warningAmber}15`, borderLeft: `4px solid ${colors.warningAmber}` }}
            >
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5" style={{ color: colors.warningAmber }} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="font-semibold" style={{ color: colors.warningAmber }}>
                  Coverage Needed
                </span>
              </div>
              <p className="text-sm text-gray-700 mb-3">
                The following assignments were skipped because providers have PTO on those days.
                You may need to assign coverage:
              </p>
              <div className="space-y-2">
                {displayedPTOConflicts?.map((conflict, index) => (
                  <div key={index} className="text-sm p-2 bg-white rounded border" style={{ borderColor: colors.border }}>
                    <div className="flex justify-between">
                      <span className="font-medium">{formatDate(conflict.date)} {conflict.time_block}</span>
                      <span className="text-gray-500">{conflict.intended_service_name}</span>
                    </div>
                    <div className="text-gray-600">
                      {conflict.provider_name} (PTO)
                    </div>
                  </div>
                ))}
              </div>
              {applyResult.ptoConflicts!.length > 5 && !showFullPTOList && (
                <button
                  onClick={() => setShowFullPTOList(true)}
                  className="mt-2 text-sm font-medium hover:underline"
                  style={{ color: colors.lightBlue }}
                >
                  Show all {applyResult.ptoConflicts!.length} conflicts
                </button>
              )}
              {showFullPTOList && applyResult.ptoConflicts!.length > 5 && (
                <button
                  onClick={() => setShowFullPTOList(false)}
                  className="mt-2 text-sm font-medium hover:underline"
                  style={{ color: colors.lightBlue }}
                >
                  Show less
                </button>
              )}
            </div>
          )}

          {/* Holiday Conflicts */}
          {hasHolidayConflicts && (
            <div
              className="mb-4 p-4 rounded-lg"
              style={{ backgroundColor: `${colors.primaryBlue}10`, borderLeft: `4px solid ${colors.primaryBlue}` }}
            >
              <div className="font-semibold mb-2" style={{ color: colors.primaryBlue }}>
                Holiday Restrictions Applied
              </div>
              <p className="text-sm text-gray-600 mb-2">
                Non-inpatient services were not scheduled on these holidays:
              </p>
              <div className="text-sm text-gray-500">
                {applyResult.holidayConflicts!.slice(0, 5).map((conflict, index) => (
                  <div key={index}>{conflict}</div>
                ))}
                {applyResult.holidayConflicts!.length > 5 && (
                  <div className="italic">...and {applyResult.holidayConflicts!.length - 5} more</div>
                )}
              </div>
            </div>
          )}

          {/* Undo hint */}
          {applyResult.historyId && (
            <div className="text-sm text-gray-500 mb-4">
              This operation can be undone from the Recent Changes panel.
            </div>
          )}

          <button
            onClick={handleResultClose}
            className="w-full px-4 py-2 rounded text-white font-medium"
            style={{ backgroundColor: colors.primaryBlue }}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

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

            <div className="text-sm text-gray-500 mb-4 p-3 rounded" style={{ backgroundColor: colors.lightBlue + '10' }}>
              <strong>Note:</strong> Providers with PTO will be automatically skipped, and you&apos;ll see a coverage needed summary.
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
