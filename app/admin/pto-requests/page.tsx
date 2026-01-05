'use client';

import { useEffect, useState } from 'react';
import { Provider, PTORequest, LeaveType, PTOTimeBlock } from '@/lib/types';
import PTOCalendar from '@/app/components/admin/PTOCalendar';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  lightGray: '#F5F5F5',
  border: '#E5E7EB',
  warning: '#F59E0B',
  error: '#DC2626',
  success: '#059669',
};

const leaveTypes: { value: LeaveType; label: string }[] = [
  { value: 'vacation', label: 'Vacation' },
  { value: 'personal', label: 'Personal' },
  { value: 'medical', label: 'Medical' },
  { value: 'conference', label: 'Conference' },
  { value: 'maternity', label: 'Maternity/Paternity' },
  { value: 'other', label: 'Other' },
];

const timeBlocks: { value: PTOTimeBlock; label: string }[] = [
  { value: 'FULL', label: 'Full Day' },
  { value: 'AM', label: 'AM Only' },
  { value: 'PM', label: 'PM Only' },
];

type TabType = 'pending' | 'approved' | 'denied' | 'all';
type ViewMode = 'calendar' | 'table';

export default function AdminPTORequestsPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [requests, setRequests] = useState<PTORequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [filterProviderId, setFilterProviderId] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalAction, setModalAction] = useState<'approve' | 'deny'>('approve');
  const [selectedRequest, setSelectedRequest] = useState<PTORequest | null>(null);
  const [adminName, setAdminName] = useState('');
  const [adminComment, setAdminComment] = useState('');
  const [processing, setProcessing] = useState(false);

  // Admin entry form
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminFormProviderId, setAdminFormProviderId] = useState('');
  const [adminFormStartDate, setAdminFormStartDate] = useState('');
  const [adminFormEndDate, setAdminFormEndDate] = useState('');
  const [adminFormLeaveType, setAdminFormLeaveType] = useState<LeaveType>('vacation');
  const [adminFormTimeBlock, setAdminFormTimeBlock] = useState<PTOTimeBlock>('FULL');
  const [adminFormReason, setAdminFormReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [providersRes, requestsRes] = await Promise.all([
        fetch('/api/providers'),
        fetch('/api/pto-requests'),
      ]);
      const providersData = await providersRes.json();
      const requestsData = await requestsRes.json();
      setProviders(providersData || []);
      setRequests(requestsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(request: PTORequest, action: 'approve' | 'deny') {
    setSelectedRequest(request);
    setModalAction(action);
    setAdminComment('');
    setShowModal(true);
  }

  async function submitAction() {
    if (!selectedRequest || !adminName) return;
    if (modalAction === 'deny' && !adminComment) {
      alert('Please provide a reason for denial');
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch(`/api/pto-requests/${selectedRequest.id}/${modalAction}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_name: adminName,
          admin_comment: adminComment || null,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        fetchData();
      } else {
        const error = await res.json();
        alert(error.error || `Failed to ${modalAction} request`);
      }
    } catch (error) {
      console.error('Action error:', error);
      alert(`Failed to ${modalAction} request`);
    } finally {
      setProcessing(false);
    }
  }

  async function handleAdminSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!adminFormProviderId || !adminFormStartDate || !adminFormEndDate) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/pto-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_id: adminFormProviderId,
          start_date: adminFormStartDate,
          end_date: adminFormEndDate,
          leave_type: adminFormLeaveType,
          time_block: adminFormTimeBlock,
          reason: adminFormReason || null,
          requested_by: 'admin',
        }),
      });

      if (res.ok) {
        // Reset form
        setAdminFormProviderId('');
        setAdminFormStartDate('');
        setAdminFormEndDate('');
        setAdminFormLeaveType('vacation');
        setAdminFormTimeBlock('FULL');
        setAdminFormReason('');
        setShowAdminForm(false);
        fetchData();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to create PTO entry');
      }
    } catch (error) {
      console.error('Submit error:', error);
      alert('Failed to create PTO entry');
    } finally {
      setSubmitting(false);
    }
  }

  const filteredRequests = requests.filter((r) => {
    if (activeTab !== 'all' && r.status !== activeTab) return false;
    if (filterProviderId && r.provider_id !== filterProviderId) return false;
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return colors.success;
      case 'denied':
        return colors.error;
      default:
        return colors.warning;
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold" style={{ color: colors.primaryBlue }}>
          PTO Requests
          {pendingCount > 0 && (
            <span
              className="ml-2 px-2 py-1 text-sm rounded-full text-white"
              style={{ backgroundColor: colors.warning }}
            >
              {pendingCount} pending
            </span>
          )}
        </h2>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: colors.border }}>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                viewMode === 'calendar' ? 'bg-blue-500 text-white' : 'bg-white hover:bg-gray-50'
              }`}
              style={viewMode !== 'calendar' ? { color: colors.primaryBlue } : {}}
            >
              Calendar
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                viewMode === 'table' ? 'bg-blue-500 text-white' : 'bg-white hover:bg-gray-50'
              }`}
              style={viewMode !== 'table' ? { color: colors.primaryBlue } : {}}
            >
              Table
            </button>
          </div>
          <button
            onClick={() => setShowAdminForm(!showAdminForm)}
            className="px-4 py-2 rounded text-white font-medium"
            style={{ backgroundColor: colors.teal }}
          >
            {showAdminForm ? 'Cancel' : '+ Add PTO Entry'}
          </button>
        </div>
      </div>

      {/* Admin Entry Form */}
      {showAdminForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4" style={{ color: colors.primaryBlue }}>
            Add PTO Entry (Auto-Approved)
          </h3>
          <form onSubmit={handleAdminSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Provider</label>
                <select
                  value={adminFormProviderId}
                  onChange={(e) => setAdminFormProviderId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border rounded"
                  style={{ borderColor: colors.border }}
                >
                  <option value="">Select Provider</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.initials} - {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Start Date</label>
                <input
                  type="date"
                  value={adminFormStartDate}
                  onChange={(e) => setAdminFormStartDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 border rounded"
                  style={{ borderColor: colors.border }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End Date</label>
                <input
                  type="date"
                  value={adminFormEndDate}
                  onChange={(e) => setAdminFormEndDate(e.target.value)}
                  required
                  min={adminFormStartDate}
                  className="w-full px-3 py-2 border rounded"
                  style={{ borderColor: colors.border }}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Leave Type</label>
                <select
                  value={adminFormLeaveType}
                  onChange={(e) => setAdminFormLeaveType(e.target.value as LeaveType)}
                  className="w-full px-3 py-2 border rounded"
                  style={{ borderColor: colors.border }}
                >
                  {leaveTypes.map((lt) => (
                    <option key={lt.value} value={lt.value}>
                      {lt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Time Block</label>
                <select
                  value={adminFormTimeBlock}
                  onChange={(e) => setAdminFormTimeBlock(e.target.value as PTOTimeBlock)}
                  className="w-full px-3 py-2 border rounded"
                  style={{ borderColor: colors.border }}
                >
                  {timeBlocks.map((tb) => (
                    <option key={tb.value} value={tb.value}>
                      {tb.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reason</label>
                <input
                  type="text"
                  value={adminFormReason}
                  onChange={(e) => setAdminFormReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  style={{ borderColor: colors.border }}
                  placeholder="Optional"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded text-white font-medium disabled:opacity-50"
              style={{ backgroundColor: colors.primaryBlue }}
            >
              {submitting ? 'Creating...' : 'Create PTO Entry'}
            </button>
          </form>
        </div>
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <PTOCalendar
            requests={requests}
            providers={providers}
            onApprove={(request) => handleAction(request, 'approve')}
            onDeny={(request) => handleAction(request, 'deny')}
            onDelete={async (request) => {
              try {
                const res = await fetch(`/api/pto-requests/${request.id}`, {
                  method: 'DELETE',
                });
                if (res.ok) {
                  fetchData();
                } else {
                  alert('Failed to delete request');
                }
              } catch (err) {
                console.error('Delete error:', err);
                alert('Failed to delete request');
              }
            }}
          />
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <>
          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Filter by Provider</label>
                <select
                  value={filterProviderId}
                  onChange={(e) => setFilterProviderId(e.target.value)}
                  className="px-3 py-1.5 border rounded text-sm"
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
            </div>
          </div>

          {/* Tabs */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="flex border-b" style={{ borderColor: colors.border }}>
          {(['pending', 'approved', 'denied', 'all'] as TabType[]).map((tab) => {
            const count =
              tab === 'all'
                ? requests.length
                : requests.filter((r) => r.status === tab).length;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-current'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                style={{
                  color:
                    activeTab === tab
                      ? tab === 'all'
                        ? colors.primaryBlue
                        : getStatusColor(tab)
                      : undefined,
                }}
              >
                {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)} ({count})
              </button>
            );
          })}
        </div>

        {/* Request Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: colors.lightGray }}>
                <th className="px-4 py-3 text-left text-sm font-medium">Provider</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Dates</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                <th className="px-4 py-3 text-center text-sm font-medium">Time</th>
                <th className="px-4 py-3 text-center text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Requested</th>
                <th className="px-4 py-3 text-center text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: colors.border }}>
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No requests found
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-bold" style={{ color: colors.primaryBlue }}>
                        {req.provider?.initials}
                      </span>
                      <span className="ml-2 text-sm text-gray-600">{req.provider?.name}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {req.start_date === req.end_date
                        ? req.start_date
                        : `${req.start_date} - ${req.end_date}`}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {leaveTypes.find((lt) => lt.value === req.leave_type)?.label}
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      {req.time_block === 'FULL' ? 'Full' : req.time_block}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium text-white"
                        style={{ backgroundColor: getStatusColor(req.status) }}
                      >
                        {req.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {req.requested_by === 'admin' ? 'Admin' : 'Provider'}
                      <br />
                      <span className="text-xs">
                        {new Date(req.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {req.status === 'pending' ? (
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleAction(req, 'approve')}
                            className="px-3 py-1 text-xs rounded text-white font-medium"
                            style={{ backgroundColor: colors.success }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleAction(req, 'deny')}
                            className="px-3 py-1 text-xs rounded text-white font-medium"
                            style={{ backgroundColor: colors.error }}
                          >
                            Deny
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">
                          {req.reviewed_by_admin_name && (
                            <>
                              by {req.reviewed_by_admin_name}
                              <br />
                              {req.reviewed_at &&
                                new Date(req.reviewed_at).toLocaleDateString()}
                            </>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}

      {/* Approve/Deny Modal */}
      {showModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3
              className="text-lg font-semibold mb-4"
              style={{ color: modalAction === 'approve' ? colors.success : colors.error }}
            >
              {modalAction === 'approve' ? 'Approve' : 'Deny'} PTO Request
            </h3>

            <div className="mb-4 p-3 rounded" style={{ backgroundColor: colors.lightGray }}>
              <p className="font-medium" style={{ color: colors.primaryBlue }}>
                {selectedRequest.provider?.initials} - {selectedRequest.provider?.name}
              </p>
              <p className="text-sm text-gray-600">
                {selectedRequest.start_date === selectedRequest.end_date
                  ? selectedRequest.start_date
                  : `${selectedRequest.start_date} to ${selectedRequest.end_date}`}
              </p>
              <p className="text-sm text-gray-600">
                {leaveTypes.find((lt) => lt.value === selectedRequest.leave_type)?.label} (
                {selectedRequest.time_block === 'FULL' ? 'Full Day' : selectedRequest.time_block})
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Your Name *</label>
              <input
                type="text"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                style={{ borderColor: colors.border }}
                placeholder="Enter your name"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Comment {modalAction === 'deny' ? '*' : '(optional)'}
              </label>
              <textarea
                value={adminComment}
                onChange={(e) => setAdminComment(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border rounded"
                style={{ borderColor: colors.border }}
                placeholder={
                  modalAction === 'deny'
                    ? 'Please provide a reason for denial'
                    : 'Optional comment'
                }
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm rounded border"
                style={{ borderColor: colors.border }}
              >
                Cancel
              </button>
              <button
                onClick={submitAction}
                disabled={processing || !adminName || (modalAction === 'deny' && !adminComment)}
                className="px-4 py-2 text-sm rounded text-white font-medium disabled:opacity-50"
                style={{
                  backgroundColor: modalAction === 'approve' ? colors.success : colors.error,
                }}
              >
                {processing
                  ? 'Processing...'
                  : modalAction === 'approve'
                  ? 'Approve Request'
                  : 'Deny Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
