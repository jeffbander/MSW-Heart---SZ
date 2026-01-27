'use client';

import { useState, useEffect, useMemo } from 'react';
import { Provider, PTORequest } from '@/lib/types';

// Helper to format date in local timezone (avoids UTC conversion issues)
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  lightGray: '#F5F5F5',
  border: '#E5E7EB',
  success: '#059669',
  warning: '#F59E0B',
  error: '#DC2626',
};

const leaveTypeLabels: Record<string, string> = {
  vacation: 'Vacation',
  personal: 'Personal',
  medical: 'Medical',
  conference: 'Conference',
  maternity: 'Maternity/Paternity',
  other: 'Other',
};

interface PTOCalendarProps {
  requests: PTORequest[];
  providers: Provider[];
  onApprove: (request: PTORequest) => void;
  onDeny: (request: PTORequest) => void;
  onDelete?: (request: PTORequest) => void;
}

export default function PTOCalendar({
  requests,
  providers,
  onApprove,
  onDeny,
  onDelete,
}: PTOCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedRequest, setSelectedRequest] = useState<PTORequest | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterProviderId, setFilterProviderId] = useState<string>('');

  // Get days for current month view
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);

    // Start from the Sunday of the week containing the first day
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    // End on the Saturday of the week containing the last day
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

    const days: Date[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return days;
  }, [currentDate]);

  // Filter requests
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (filterProviderId && r.provider_id !== filterProviderId) return false;
      return true;
    });
  }, [requests, filterStatus, filterProviderId]);

  // Get requests for a specific date
  const getRequestsForDate = (date: Date) => {
    const dateStr = formatLocalDate(date);
    return filteredRequests.filter((r) => {
      const start = new Date(r.start_date + 'T00:00:00');
      const end = new Date(r.end_date + 'T00:00:00');
      const checkDate = new Date(dateStr + 'T00:00:00');
      return checkDate >= start && checkDate <= end;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return colors.success;
      case 'denied':
        return colors.error;
      case 'pending':
        return colors.warning;
      default:
        return colors.border;
    }
  };

  const getProviderName = (providerId: string) => {
    const provider = providers.find((p) => p.id === providerId);
    return provider ? provider.initials : '?';
  };

  const navigateMonth = (delta: number) => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + delta);
      return newDate;
    });
  };

  const monthYear = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-4 items-center">
        <div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded border text-sm"
            style={{ borderColor: colors.border }}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="denied">Denied</option>
          </select>
        </div>
        <div>
          <select
            value={filterProviderId}
            onChange={(e) => setFilterProviderId(e.target.value)}
            className="px-3 py-2 rounded border text-sm"
            style={{ borderColor: colors.border }}
          >
            <option value="">All Providers</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.initials} - {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Legend */}
        <div className="ml-auto flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: colors.warning }}
            />
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: colors.success }}
            />
            <span>Approved</span>
          </div>
          <div className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: colors.error }}
            />
            <span>Denied</span>
          </div>
        </div>
      </div>

      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigateMonth(-1)}
          className="px-3 py-1 rounded border hover:bg-gray-50"
          style={{ borderColor: colors.border }}
        >
          ← Prev
        </button>
        <h3 className="text-lg font-semibold" style={{ color: colors.primaryBlue }}>
          {monthYear}
        </h3>
        <button
          onClick={() => navigateMonth(1)}
          className="px-3 py-1 rounded border hover:bg-gray-50"
          style={{ borderColor: colors.border }}
        >
          Next →
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="border rounded-lg overflow-hidden" style={{ borderColor: colors.border }}>
        {/* Day Headers */}
        <div className="grid grid-cols-7 bg-gray-50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div
              key={day}
              className="px-2 py-2 text-center text-sm font-medium text-gray-600 border-b"
              style={{ borderColor: colors.border }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7">
          {calendarDays.map((date, idx) => {
            const dayRequests = getRequestsForDate(date);
            const isInMonth = isCurrentMonth(date);
            const isTodayDate = isToday(date);

            return (
              <div
                key={idx}
                className={`min-h-[100px] p-1 border-b border-r cursor-pointer ${
                  isInMonth ? 'bg-white' : 'bg-gray-50'
                }`}
                style={{ borderColor: colors.border }}
                onClick={() => dayRequests.length > 0 && setSelectedDate(date)}
              >
                <div
                  className={`text-sm mb-1 ${
                    isInMonth ? 'text-gray-700' : 'text-gray-400'
                  } ${isTodayDate ? 'font-bold' : ''}`}
                >
                  <span
                    className={`inline-block w-6 h-6 text-center leading-6 rounded-full ${
                      isTodayDate ? 'bg-blue-500 text-white' : ''
                    }`}
                  >
                    {date.getDate()}
                  </span>
                </div>

                {/* PTO Requests for this day */}
                <div className="space-y-1">
                  {dayRequests.slice(0, 3).map((request) => (
                    <button
                      key={request.id}
                      onClick={(e) => { e.stopPropagation(); setSelectedRequest(request); }}
                      className="w-full text-left px-1 py-0.5 rounded text-xs text-white truncate hover:opacity-90"
                      style={{ backgroundColor: getStatusColor(request.status) }}
                      title={`${getProviderName(request.provider_id)} - ${request.status}`}
                    >
                      {getProviderName(request.provider_id)}
                    </button>
                  ))}
                  {dayRequests.length > 3 && (
                    <div className="text-xs text-gray-400 px-1">
                      +{dayRequests.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Request Detail Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ color: colors.primaryBlue }}>
                PTO Request Details
              </h3>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <div>
                <p className="text-sm text-gray-500">Provider</p>
                <p className="font-medium" style={{ color: colors.primaryBlue }}>
                  {providers.find((p) => p.id === selectedRequest.provider_id)?.name || 'Unknown'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Dates</p>
                <p className="font-medium">
                  {selectedRequest.start_date === selectedRequest.end_date
                    ? selectedRequest.start_date
                    : `${selectedRequest.start_date} - ${selectedRequest.end_date}`}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Leave Type</p>
                  <p className="font-medium">
                    {leaveTypeLabels[selectedRequest.leave_type] || selectedRequest.leave_type}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Time Block</p>
                  <p className="font-medium">
                    {selectedRequest.time_block === 'FULL' ? 'Full Day' : selectedRequest.time_block}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <span
                  className="inline-block px-2 py-1 text-xs font-medium rounded text-white mt-1"
                  style={{ backgroundColor: getStatusColor(selectedRequest.status) }}
                >
                  {selectedRequest.status.toUpperCase()}
                </span>
              </div>
              {selectedRequest.reason && (
                <div>
                  <p className="text-sm text-gray-500">Reason</p>
                  <p className="text-sm">{selectedRequest.reason}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {selectedRequest.status === 'pending' && (
                <>
                  <button
                    onClick={() => {
                      onApprove(selectedRequest);
                      setSelectedRequest(null);
                    }}
                    className="flex-1 py-2 rounded text-white font-medium"
                    style={{ backgroundColor: colors.success }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      onDeny(selectedRequest);
                      setSelectedRequest(null);
                    }}
                    className="flex-1 py-2 rounded text-white font-medium"
                    style={{ backgroundColor: colors.error }}
                  >
                    Deny
                  </button>
                </>
              )}
              {onDelete && selectedRequest.status !== 'pending' && (
                <button
                  onClick={() => {
                    if (confirm('Delete this PTO request? This cannot be undone.')) {
                      onDelete(selectedRequest);
                      setSelectedRequest(null);
                    }
                  }}
                  className="flex-1 py-2 rounded border font-medium hover:bg-gray-50"
                  style={{ borderColor: colors.error, color: colors.error }}
                >
                  Delete Request
                </button>
              )}
              <button
                onClick={() => setSelectedRequest(null)}
                className="flex-1 py-2 rounded border font-medium hover:bg-gray-50"
                style={{ borderColor: colors.border }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Day Summary Modal */}
      {selectedDate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ color: colors.primaryBlue }}>
                PTO for {selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </h3>
              <button
                onClick={() => setSelectedDate(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 mb-6 max-h-[400px] overflow-y-auto">
              {getRequestsForDate(selectedDate).map((request) => (
                <button
                  key={request.id}
                  onClick={() => {
                    setSelectedRequest(request);
                    setSelectedDate(null);
                  }}
                  className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                  style={{ borderColor: colors.border }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium" style={{ color: colors.primaryBlue }}>
                      {providers.find((p) => p.id === request.provider_id)?.name || 'Unknown'}{' '}
                      - {leaveTypeLabels[request.leave_type] || request.leave_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-gray-500">
                      {request.time_block === 'FULL' ? 'Full Day' : `${request.time_block} Only`}
                    </span>
                    <span
                      className="px-2 py-0.5 text-xs font-medium rounded text-white"
                      style={{ backgroundColor: getStatusColor(request.status) }}
                    >
                      {request.status.toUpperCase()}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedDate(null)}
                className="px-4 py-2 rounded border font-medium hover:bg-gray-50"
                style={{ borderColor: colors.border }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
