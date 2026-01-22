'use client';

import { useState, useEffect } from 'react';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  ptoRed: '#DC2626',
  warningAmber: '#F59E0B',
  border: '#E5E7EB',
};

interface ChangeHistoryRecord {
  id: string;
  operation_type: string;
  operation_description: string;
  affected_date_start: string;
  affected_date_end: string;
  created_at: string;
  is_undone: boolean;
  undone_at: string | null;
  is_redone: boolean;
  redone_at: string | null;
  metadata: {
    template_name?: string;
    template_names?: string[];
    pto_conflicts_count?: number;
    holiday_conflicts_count?: number;
    provider_name?: string;
    service_name?: string;
    action?: string;
  };
}

interface ConflictInfo {
  id: string;
  date: string;
  time_block: string;
  provider_name?: string;
  service_name?: string;
  change_type: 'modified' | 'deleted' | 'added';
  details?: string;
}

interface UndoHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActionComplete: () => void;
}

export default function UndoHistoryModal({
  isOpen,
  onClose,
  onActionComplete,
}: UndoHistoryModalProps) {
  const [history, setHistory] = useState<ChangeHistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    historyId: string;
    action: 'undo' | 'redo';
    conflicts?: ConflictInfo[];
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen]);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/change-history?limit=20&daysBack=30');
      const data = await response.json();
      if (Array.isArray(data)) {
        setHistory(data);
      } else {
        setHistory([]);
        if (data.error) {
          setError(data.error);
        }
      }
    } catch (err) {
      console.error('Error fetching history:', err);
      setError('Failed to fetch change history');
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = async (historyId: string, force: boolean = false) => {
    setActionInProgress(historyId);
    setError(null);

    try {
      const response = await fetch('/api/admin/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historyId, force }),
      });

      const result = await response.json();

      if (result.requiresConfirmation && result.conflicts) {
        setConfirmDialog({
          historyId,
          action: 'undo',
          conflicts: result.conflicts,
        });
        return;
      }

      if (!response.ok) {
        setError(result.error || 'Failed to undo');
        return;
      }

      // Success - refresh history
      await fetchHistory();
      onActionComplete();

    } catch (err) {
      console.error('Error performing undo:', err);
      setError('Failed to undo operation');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRedo = async (historyId: string) => {
    setActionInProgress(historyId);
    setError(null);

    try {
      const response = await fetch('/api/admin/redo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historyId }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to redo');
        return;
      }

      // Success - refresh history
      await fetchHistory();
      onActionComplete();

    } catch (err) {
      console.error('Error performing redo:', err);
      setError('Failed to redo operation');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleConfirmUndo = async () => {
    if (confirmDialog) {
      setConfirmDialog(null);
      await handleUndo(confirmDialog.historyId, true);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getOperationIcon = (type: string) => {
    switch (type) {
      case 'template_apply':
      case 'template_apply_alternating':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        );
      case 'bulk_add':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        );
      case 'bulk_remove':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold" style={{ color: colors.primaryBlue }}>
            Recent Changes
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded text-sm" style={{ backgroundColor: `${colors.ptoRed}10`, color: colors.ptoRed }}>
            {error}
          </div>
        )}

        {/* History list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading history...</div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No recent changes found</div>
          ) : (
            <div className="space-y-3">
              {history.map((record) => (
                <div
                  key={record.id}
                  className={`p-4 rounded-lg border ${record.is_undone && !record.is_redone ? 'bg-gray-50' : ''}`}
                  style={{ borderColor: colors.border }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="p-2 rounded-lg"
                      style={{
                        backgroundColor: record.is_undone && !record.is_redone
                          ? colors.border
                          : `${colors.lightBlue}15`,
                        color: record.is_undone && !record.is_redone
                          ? '#6B7280'
                          : colors.lightBlue,
                      }}
                    >
                      {getOperationIcon(record.operation_type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {record.operation_description}
                        </span>
                        {record.is_undone && !record.is_redone && (
                          <span className="px-2 py-0.5 text-xs rounded bg-gray-200 text-gray-600">
                            UNDONE
                          </span>
                        )}
                      </div>

                      <div className="text-sm text-gray-500 mt-1">
                        {formatDate(record.affected_date_start)} - {formatDate(record.affected_date_end)}
                      </div>

                      {record.metadata && (
                        <div className="text-sm text-gray-500 mt-1">
                          {record.metadata.pto_conflicts_count && record.metadata.pto_conflicts_count > 0 && (
                            <span className="mr-3" style={{ color: colors.warningAmber }}>
                              PTO Skipped: {record.metadata.pto_conflicts_count}
                            </span>
                          )}
                          {record.metadata.holiday_conflicts_count && record.metadata.holiday_conflicts_count > 0 && (
                            <span>
                              Holidays: {record.metadata.holiday_conflicts_count}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="text-xs text-gray-400 mt-2">
                        {formatDateTime(record.created_at)}
                        {record.is_undone && record.undone_at && (
                          <span> | Undone {formatDateTime(record.undone_at)}</span>
                        )}
                        {record.is_redone && record.redone_at && (
                          <span> | Redone {formatDateTime(record.redone_at)}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      {record.is_undone && !record.is_redone ? (
                        <button
                          onClick={() => handleRedo(record.id)}
                          disabled={actionInProgress !== null}
                          className="px-3 py-1 rounded text-sm font-medium transition-colors disabled:opacity-50"
                          style={{
                            backgroundColor: `${colors.teal}15`,
                            color: colors.teal,
                          }}
                        >
                          {actionInProgress === record.id ? 'Redoing...' : 'Redo'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUndo(record.id)}
                          disabled={actionInProgress !== null}
                          className="px-3 py-1 rounded text-sm font-medium transition-colors disabled:opacity-50"
                          style={{
                            backgroundColor: `${colors.ptoRed}10`,
                            color: colors.ptoRed,
                          }}
                        >
                          {actionInProgress === record.id ? 'Undoing...' : 'Undo'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t" style={{ borderColor: colors.border }}>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded border"
            style={{ borderColor: colors.border }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full" style={{ backgroundColor: `${colors.warningAmber}20` }}>
                <svg className="w-6 h-6" style={{ color: colors.warningAmber }} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <h4 className="text-lg font-bold" style={{ color: colors.primaryBlue }}>
                Schedule Has Been Modified
              </h4>
            </div>

            <p className="text-gray-600 mb-4">
              Since this operation was performed, {confirmDialog.conflicts?.length || 0} changes have been made:
            </p>

            <div className="max-h-48 overflow-y-auto mb-4 space-y-2">
              {confirmDialog.conflicts?.slice(0, 5).map((conflict, index) => (
                <div key={index} className="text-sm p-2 rounded border" style={{ borderColor: colors.border }}>
                  <div className="flex justify-between">
                    <span className="font-medium">
                      {conflict.date} {conflict.time_block}
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{
                        backgroundColor:
                          conflict.change_type === 'deleted' ? `${colors.ptoRed}15` :
                          conflict.change_type === 'added' ? `${colors.teal}15` :
                          `${colors.warningAmber}15`,
                        color:
                          conflict.change_type === 'deleted' ? colors.ptoRed :
                          conflict.change_type === 'added' ? colors.teal :
                          colors.warningAmber,
                      }}
                    >
                      {conflict.change_type}
                    </span>
                  </div>
                  {conflict.provider_name && (
                    <div className="text-gray-500">{conflict.provider_name}</div>
                  )}
                  {conflict.details && (
                    <div className="text-gray-400 text-xs">{conflict.details}</div>
                  )}
                </div>
              ))}
              {confirmDialog.conflicts && confirmDialog.conflicts.length > 5 && (
                <div className="text-sm text-gray-500 italic">
                  ...and {confirmDialog.conflicts.length - 5} more
                </div>
              )}
            </div>

            <p className="text-sm text-gray-500 mb-4">
              Undoing will <strong>overwrite</strong> these changes.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 px-4 py-2 rounded border"
                style={{ borderColor: colors.border }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUndo}
                className="flex-1 px-4 py-2 rounded text-white font-medium"
                style={{ backgroundColor: colors.ptoRed }}
              >
                Undo Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
