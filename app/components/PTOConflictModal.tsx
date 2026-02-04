'use client';

import { Provider, ScheduleAssignment } from '@/lib/types';

interface PTOConflictModalProps {
  provider: Provider;
  date: string;
  ptoTimeBlocks: string[];
  conflictingAssignments: ScheduleAssignment[];
  onRemoveAssignment: (assignmentId: string) => void;
  onOverrideAll: () => void;
  onClose: () => void;
}

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  ptoRed: '#DC2626',
  warningYellow: '#F59E0B',
  border: '#E5E7EB',
};

export default function PTOConflictModal({
  provider,
  date,
  ptoTimeBlocks,
  conflictingAssignments,
  onRemoveAssignment,
  onOverrideAll,
  onClose
}: PTOConflictModalProps) {
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const ptoLabel = ptoTimeBlocks.includes('BOTH')
    ? 'All Day'
    : ptoTimeBlocks.join(' & ');

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-lg w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
            style={{ backgroundColor: `${colors.ptoRed}20` }}
          >
            ⚠️
          </div>
          <div>
            <h3 className="text-xl font-bold" style={{ color: colors.primaryBlue }}>
              PTO Conflict
            </h3>
            <p className="text-sm text-gray-600">
              {provider.name} ({provider.initials})
            </p>
          </div>
        </div>

        {/* PTO Info */}
        <div
          className="mb-4 p-3 rounded"
          style={{ backgroundColor: `${colors.ptoRed}10`, border: `1px solid ${colors.ptoRed}` }}
        >
          <div className="text-sm font-medium" style={{ color: colors.ptoRed }}>
            PTO Scheduled: {formatDate(date)} - {ptoLabel}
          </div>
        </div>

        {/* Explanation */}
        <p className="text-gray-600 mb-4 text-sm">
          This provider has PTO but is also assigned to the following services.
          You can remove individual assignments or override to keep all.
        </p>

        {/* Conflicting Assignments */}
        <div className="mb-4">
          <h4 className="font-semibold text-sm mb-2" style={{ color: colors.primaryBlue }}>
            Conflicting Assignments:
          </h4>
          <div className="space-y-2 max-h-48 overflow-auto">
            {conflictingAssignments.map((assignment) => (
              <div
                key={assignment.id}
                className="flex items-center justify-between p-3 rounded"
                style={{ backgroundColor: '#F3F4F6', border: `1px solid ${colors.border}` }}
              >
                <div>
                  <div className="font-medium text-sm" style={{ color: colors.primaryBlue }}>
                    {assignment.service?.name || 'Unknown Service'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {assignment.time_block}
                    {assignment.room_count ? ` • ${assignment.room_count} rooms` : ''}
                  </div>
                </div>
                <button
                  onClick={() => onRemoveAssignment(assignment.id)}
                  className="px-3 py-1 rounded text-sm font-medium hover:opacity-80"
                  style={{ backgroundColor: `${colors.ptoRed}15`, color: colors.ptoRed }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t" style={{ borderColor: colors.border }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded border font-medium hover:bg-gray-50"
            style={{ borderColor: colors.border }}
          >
            Cancel
          </button>
          <button
            onClick={onOverrideAll}
            className="px-4 py-2 rounded text-white font-medium hover:opacity-90"
            style={{ backgroundColor: colors.warningYellow }}
          >
            Override All
          </button>
        </div>
      </div>
    </div>
  );
}
