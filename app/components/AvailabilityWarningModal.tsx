'use client';

import { AvailabilityViolation } from '@/lib/types';

interface AvailabilityWarningModalProps {
  warnings: AvailabilityViolation[];
  onConfirm: () => void;
  onCancel: () => void;
}

const colors = {
  primaryBlue: '#003D7A',
  warningYellow: '#F59E0B',
  border: '#E5E7EB',
};

export default function AvailabilityWarningModal({
  warnings,
  onConfirm,
  onCancel
}: AvailabilityWarningModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-lg w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
            style={{ backgroundColor: `${colors.warningYellow}20` }}
          >
            &#9888;
          </div>
          <h3 className="text-xl font-bold" style={{ color: colors.primaryBlue }}>
            Availability Warning
          </h3>
        </div>

        <p className="text-gray-600 mb-4">
          The following assignments have availability conflicts. Do you want to proceed anyway?
        </p>

        <div className="max-h-60 overflow-auto mb-4">
          {warnings.map((warning, idx) => (
            <div
              key={idx}
              className="p-3 rounded mb-2"
              style={{ backgroundColor: `${colors.warningYellow}10`, border: `1px solid ${colors.warningYellow}` }}
            >
              <div className="font-medium" style={{ color: colors.primaryBlue }}>
                {warning.provider_initials} - {warning.service_name}
              </div>
              <div className="text-sm text-gray-600">
                {warning.date} ({warning.time_block})
              </div>
              {warning.reason && (
                <div className="text-sm text-gray-500 mt-1">
                  {warning.reason}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded border font-medium"
            style={{ borderColor: colors.border }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2 rounded text-white font-medium"
            style={{ backgroundColor: colors.warningYellow }}
          >
            Proceed Anyway
          </button>
        </div>
      </div>
    </div>
  );
}
