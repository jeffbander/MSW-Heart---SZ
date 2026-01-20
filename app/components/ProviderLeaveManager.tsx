'use client';

import { useState, useEffect } from 'react';
import { ProviderLeave, LeaveType } from '@/lib/types';

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
  border: '#E5E7EB',
  ptoRed: '#DC2626',
};

const LEAVE_TYPES: { value: LeaveType; label: string; icon: string }[] = [
  { value: 'maternity', label: 'Maternity/Paternity', icon: '👶' },
  { value: 'vacation', label: 'Vacation', icon: '🏖️' },
  { value: 'medical', label: 'Medical', icon: '🏥' },
  { value: 'personal', label: 'Personal', icon: '🏠' },
  { value: 'conference', label: 'Conference/Training', icon: '📚' },
  { value: 'other', label: 'Other', icon: '📋' },
];

interface ProviderLeaveManagerProps {
  providerId: string;
  providerName: string;
}

export default function ProviderLeaveManager({ providerId, providerName }: ProviderLeaveManagerProps) {
  const [leaves, setLeaves] = useState<ProviderLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form state
  const [leaveType, setLeaveType] = useState<LeaveType>('vacation');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (providerId) {
      fetchLeaves();
    }
  }, [providerId]);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/providers/${providerId}/leaves`);
      const data = await response.json();
      setLeaves(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching leaves:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLeave = async () => {
    if (!startDate || !endDate || !leaveType) {
      alert('Please fill in all required fields');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      alert('Start date must be before or equal to end date');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/providers/${providerId}/leaves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          leave_type: leaveType,
          reason: reason || null
        })
      });

      if (response.ok) {
        await fetchLeaves();
        setShowAddForm(false);
        setStartDate('');
        setEndDate('');
        setReason('');
        setLeaveType('vacation');
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error adding leave:', error);
      alert('Failed to add leave');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLeave = async (leaveId: string) => {
    if (!confirm('Are you sure you want to delete this leave?')) return;

    try {
      const response = await fetch(`/api/providers/${providerId}/leaves?leaveId=${leaveId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchLeaves();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error deleting leave:', error);
      alert('Failed to delete leave');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getLeaveTypeInfo = (type: LeaveType) => {
    return LEAVE_TYPES.find(t => t.value === type) || LEAVE_TYPES[5]; // Default to 'other'
  };

  const isActiveLeave = (leave: ProviderLeave) => {
    const today = formatLocalDate(new Date());
    return leave.start_date <= today && leave.end_date >= today;
  };

  const currentAndUpcomingLeaves = leaves.filter(l => {
    const today = formatLocalDate(new Date());
    return l.end_date >= today;
  });

  const pastLeaves = leaves.filter(l => {
    const today = formatLocalDate(new Date());
    return l.end_date < today;
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border" style={{ borderColor: colors.border }}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📅</span>
          <span className="font-semibold" style={{ color: colors.primaryBlue }}>
            Manage Leaves
          </span>
          {currentAndUpcomingLeaves.length > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-700">
              {currentAndUpcomingLeaves.length} active/upcoming
            </span>
          )}
        </div>
        <span className="text-gray-400">{isExpanded ? '−' : '+'}</span>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 pt-0 border-t" style={{ borderColor: colors.border }}>
          {loading ? (
            <div className="text-center py-4 text-gray-500">Loading...</div>
          ) : (
            <>
              {/* Current & Upcoming Leaves */}
              {currentAndUpcomingLeaves.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-600 mb-2">Current & Upcoming Leaves:</h4>
                  <div className="space-y-2">
                    {currentAndUpcomingLeaves.map(leave => {
                      const typeInfo = getLeaveTypeInfo(leave.leave_type);
                      const isActive = isActiveLeave(leave);
                      return (
                        <div
                          key={leave.id}
                          className="p-3 rounded-lg border"
                          style={{
                            borderColor: isActive ? colors.ptoRed : colors.border,
                            backgroundColor: isActive ? '#FEF2F2' : '#F9FAFB'
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span>{typeInfo.icon}</span>
                                <span className="font-medium" style={{ color: colors.primaryBlue }}>
                                  {typeInfo.label}
                                </span>
                                {isActive && (
                                  <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">
                                    Currently on leave
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-600 mt-1">
                                {formatDate(leave.start_date)} - {formatDate(leave.end_date)}
                              </div>
                              {leave.reason && (
                                <div className="text-xs text-gray-500 mt-1 italic">
                                  "{leave.reason}"
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => handleDeleteLeave(leave.id)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Past Leaves (collapsed by default) */}
              {pastLeaves.length > 0 && (
                <details className="mb-4">
                  <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                    Past Leaves ({pastLeaves.length})
                  </summary>
                  <div className="mt-2 space-y-2">
                    {pastLeaves.slice(0, 5).map(leave => {
                      const typeInfo = getLeaveTypeInfo(leave.leave_type);
                      return (
                        <div
                          key={leave.id}
                          className="p-2 rounded border text-sm"
                          style={{ borderColor: colors.border, backgroundColor: '#F9FAFB' }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span>{typeInfo.icon}</span>
                              <span className="text-gray-600">
                                {formatDate(leave.start_date)} - {formatDate(leave.end_date)}
                              </span>
                            </div>
                            <button
                              onClick={() => handleDeleteLeave(leave.id)}
                              className="text-red-500 hover:text-red-700 text-xs"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {pastLeaves.length > 5 && (
                      <div className="text-xs text-gray-400 text-center">
                        +{pastLeaves.length - 5} more past leaves
                      </div>
                    )}
                  </div>
                </details>
              )}

              {leaves.length === 0 && !showAddForm && (
                <div className="text-center py-4 text-gray-500 text-sm">
                  No leaves scheduled for {providerName}
                </div>
              )}

              {/* Add Leave Form */}
              {showAddForm ? (
                <div className="mt-4 p-4 rounded-lg border" style={{ borderColor: colors.lightBlue, backgroundColor: '#F0F9FF' }}>
                  <h4 className="font-medium mb-3" style={{ color: colors.primaryBlue }}>Add New Leave</h4>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Leave Type</label>
                      <select
                        value={leaveType}
                        onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                        className="w-full px-3 py-2 border rounded text-sm"
                        style={{ borderColor: colors.border }}
                      >
                        {LEAVE_TYPES.map(type => (
                          <option key={type.value} value={type.value}>
                            {type.icon} {type.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Start Date</label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full px-3 py-2 border rounded text-sm"
                          style={{ borderColor: colors.border }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">End Date</label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full px-3 py-2 border rounded text-sm"
                          style={{ borderColor: colors.border }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Notes (optional)</label>
                      <input
                        type="text"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g., Returning March 15"
                        className="w-full px-3 py-2 border rounded text-sm"
                        style={{ borderColor: colors.border }}
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleAddLeave}
                        disabled={saving}
                        className="px-4 py-2 text-white rounded text-sm font-medium disabled:opacity-50"
                        style={{ backgroundColor: colors.primaryBlue }}
                      >
                        {saving ? 'Saving...' : 'Save Leave'}
                      </button>
                      <button
                        onClick={() => {
                          setShowAddForm(false);
                          setStartDate('');
                          setEndDate('');
                          setReason('');
                        }}
                        className="px-4 py-2 border rounded text-sm"
                        style={{ borderColor: colors.border }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full mt-2 px-4 py-2 border-2 border-dashed rounded-lg text-sm font-medium transition-colors hover:bg-gray-50"
                  style={{ borderColor: colors.lightBlue, color: colors.lightBlue }}
                >
                  + Add Leave
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
