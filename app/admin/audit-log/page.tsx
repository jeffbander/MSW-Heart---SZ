'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  lightGray: '#F5F5F5',
  border: '#E5E7EB',
};

interface AuditLogEntry {
  id: number;
  user_id: string;
  user_display_name: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

interface AuditResponse {
  data: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
}

const ACTION_LABELS: Record<string, string> = {
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
  bulk_create: 'Bulk Create',
  bulk_delete: 'Bulk Delete',
  approve: 'Approve',
  deny: 'Deny',
};

const ENTITY_LABELS: Record<string, string> = {
  echo_assignment: 'Echo Assignment',
  echo_pto: 'Echo PTO',
  assignment: 'Schedule Assignment',
  user: 'User',
  provider: 'Provider',
  pto_request: 'PTO Request',
  echo_template: 'Echo Template',
  echo_room: 'Echo Room',
  echo_tech: 'Echo Tech',
  data_upload: 'Data Upload',
};

const ACTION_COLORS: Record<string, string> = {
  create: '#059669',
  update: '#0078C8',
  delete: '#DC2626',
  bulk_create: '#059669',
  bulk_delete: '#DC2626',
  approve: '#059669',
  deny: '#DC2626',
};

function formatDetails(entry: AuditLogEntry): string {
  const d = entry.details;
  if (!d || Object.keys(d).length === 0) return '-';

  switch (entry.entity_type) {
    case 'echo_assignment': {
      const tech = d.echo_tech_name || d.echo_tech_id || '';
      const room = d.echo_room_name || d.echo_room_id || '';
      const date = d.date || '';
      const block = d.time_block || '';
      if (entry.action === 'create') return `Assigned ${tech} to ${room} on ${date} (${block})`;
      if (entry.action === 'delete') return `Removed ${tech} from ${room} on ${date} (${block})`;
      if (entry.action === 'update') return `Updated assignment on ${date} (${block})`;
      break;
    }
    case 'echo_pto': {
      const tech = d.echo_tech_name || d.echo_tech_id || '';
      const date = d.date || '';
      const block = d.time_block || '';
      if (entry.action === 'create') return `Added PTO for ${tech} on ${date} (${block})`;
      if (entry.action === 'delete') return `Removed PTO for ${tech} on ${date}`;
      break;
    }
    case 'user': {
      const name = d.display_name || d.username || '';
      if (entry.action === 'create') return `Created user "${name}" with role ${d.role || ''}`;
      if (entry.action === 'update') {
        if (d.role_from && d.role_to) return `Changed ${name} role from ${d.role_from} to ${d.role_to}`;
        return `Updated user "${name}"`;
      }
      if (entry.action === 'delete') return `Deleted user "${name}"`;
      break;
    }
    case 'provider': {
      const name = d.name || '';
      if (entry.action === 'create') return `Created provider "${name}"`;
      if (entry.action === 'update') return `Updated provider "${name}"`;
      if (entry.action === 'delete') return `Deleted provider "${name}"`;
      break;
    }
    case 'pto_request': {
      const provider = d.provider_name || '';
      if (entry.action === 'create') return `Submitted PTO for ${provider} (${d.start_date} - ${d.end_date})`;
      if (entry.action === 'approve') return `Approved PTO for ${provider} (${d.start_date} - ${d.end_date})`;
      if (entry.action === 'deny') return `Denied PTO for ${provider} (${d.start_date} - ${d.end_date})`;
      break;
    }
    case 'assignment': {
      const provider = d.provider_name || d.provider_id || '';
      const date = d.date || '';
      if (entry.action === 'create') return `Assigned ${provider} on ${date} (${d.time_block || ''})`;
      if (entry.action === 'update') return `Updated assignment for ${provider} on ${date}`;
      if (entry.action === 'delete') return `Deleted assignment for ${provider} on ${date}`;
      break;
    }
  }

  // Fallback: show truncated JSON
  const json = JSON.stringify(d);
  return json.length > 120 ? json.slice(0, 120) + '...' : json;
}

function getDefaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
}

function getDefaultEndDate(): string {
  return new Date().toISOString().split('T')[0];
}

export default function AuditLogPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 50;

  // Filters
  const [filterUser, setFilterUser] = useState('');
  const [filterEntityType, setFilterEntityType] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [startDate, setStartDate] = useState(getDefaultStartDate);
  const [endDate, setEndDate] = useState(getDefaultEndDate);

  // Distinct users from the log for the dropdown
  const [userOptions, setUserOptions] = useState<{ id: string; name: string }[]>([]);

  const fetchLog = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (filterUser) params.set('userId', filterUser);
      if (filterEntityType) params.set('entityType', filterEntityType);
      if (filterAction) params.set('action', filterAction);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await fetch(`/api/admin/audit-log?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json: AuditResponse = await res.json();
      setEntries(json.data);
      setTotal(json.total);
    } catch (err) {
      console.error('Error fetching audit log:', err);
    } finally {
      setLoading(false);
    }
  }, [page, filterUser, filterEntityType, filterAction, startDate, endDate]);

  // Fetch distinct users (once)
  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch('/api/admin/audit-log?limit=1&page=1');
        if (!res.ok) return;
        // Fetch a larger set to extract unique users
        const allRes = await fetch('/api/admin/audit-log?limit=100&page=1');
        if (!allRes.ok) return;
        const json: AuditResponse = await allRes.json();
        const seen = new Map<string, string>();
        json.data.forEach((e) => {
          if (!seen.has(e.user_id)) seen.set(e.user_id, e.user_display_name);
        });
        setUserOptions(Array.from(seen.entries()).map(([id, name]) => ({ id, name })));
      } catch {
        // ignore
      }
    }
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchLog();
  }, [fetchLog]);

  if (user?.role !== 'super_admin') {
    return (
      <div className="p-8 text-center text-gray-500">
        You do not have permission to view this page.
      </div>
    );
  }

  const totalPages = Math.ceil(total / limit);
  const showingFrom = total === 0 ? 0 : (page - 1) * limit + 1;
  const showingTo = Math.min(page * limit, total);

  function clearFilters() {
    setFilterUser('');
    setFilterEntityType('');
    setFilterAction('');
    setStartDate(getDefaultStartDate());
    setEndDate(getDefaultEndDate());
    setPage(1);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6" style={{ color: colors.primaryBlue }}>
        Audit Log
      </h1>

      {/* Filter Bar */}
      <div className="bg-white rounded-lg border p-4 mb-4 flex flex-wrap gap-3 items-end" style={{ borderColor: colors.border }}>
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-500 mb-1">User</label>
          <select
            value={filterUser}
            onChange={(e) => { setFilterUser(e.target.value); setPage(1); }}
            className="border rounded px-2 py-1.5 text-sm min-w-[160px]"
          >
            <option value="">All Users</option>
            {userOptions.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-500 mb-1">Entity Type</label>
          <select
            value={filterEntityType}
            onChange={(e) => { setFilterEntityType(e.target.value); setPage(1); }}
            className="border rounded px-2 py-1.5 text-sm min-w-[160px]"
          >
            <option value="">All Types</option>
            {Object.entries(ENTITY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-500 mb-1">Action</label>
          <select
            value={filterAction}
            onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
            className="border rounded px-2 py-1.5 text-sm min-w-[120px]"
          >
            <option value="">All Actions</option>
            {Object.entries(ACTION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-500 mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="border rounded px-2 py-1.5 text-sm"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-500 mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="border rounded px-2 py-1.5 text-sm"
          />
        </div>

        <button
          onClick={clearFilters}
          className="px-3 py-1.5 text-sm rounded border hover:bg-gray-50 text-gray-600"
        >
          Clear
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: colors.border }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ backgroundColor: colors.lightGray }}>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date/Time</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Action</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No audit log entries found.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {entry.user_display_name}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-xs font-medium text-white"
                        style={{ backgroundColor: ACTION_COLORS[entry.action] || '#6B7280' }}
                      >
                        {ACTION_LABELS[entry.action] || entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {ENTITY_LABELS[entry.entity_type] || entry.entity_type}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-md truncate" title={formatDetails(entry)}>
                      {formatDetails(entry)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: colors.border }}>
            <span className="text-sm text-gray-500">
              Showing {showingFrom}–{showingTo} of {total}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 text-sm rounded border hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 text-sm rounded border hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
