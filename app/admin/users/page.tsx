'use client';

import { useState, useEffect } from 'react';
import { AppUser, UserRole, Provider, Service } from '@/lib/types';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  lightGray: '#F5F5F5',
  border: '#E5E7EB',
  error: '#DC2626',
  success: '#059669',
};

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  scheduler_full: 'Scheduler (Full)',
  scheduler_limited: 'Scheduler (Limited)',
  provider: 'Provider',
  viewer: 'Viewer',
};

const ROLE_COLORS: Record<UserRole, string> = {
  super_admin: colors.error,
  scheduler_full: colors.teal,
  scheduler_limited: colors.lightBlue,
  provider: '#7C3AED',
  viewer: '#6B7280',
};

export default function ManageUsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  // Create/Edit form
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    display_name: '',
    role: 'viewer' as UserRole,
    provider_id: '',
    allowed_service_ids: [] as string[],
    is_active: true,
    can_manage_testing: false,
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [usersRes, providersRes, servicesRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/providers'),
        fetch('/api/services?all=true'),
      ]);
      const usersData = await usersRes.json();
      const providersData = await providersRes.json();
      const servicesData = await servicesRes.json();
      setUsers(Array.isArray(usersData) ? usersData : []);
      setProviders(Array.isArray(providersData) ? providersData : []);
      setServices(Array.isArray(servicesData) ? servicesData : []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  function openCreateForm() {
    setEditingUser(null);
    setFormData({
      username: '',
      password: '',
      display_name: '',
      role: 'viewer',
      provider_id: '',
      allowed_service_ids: [],
      is_active: true,
      can_manage_testing: false,
    });
    setFormError('');
    setShowForm(true);
  }

  function openEditForm(user: AppUser) {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: '',
      display_name: user.display_name,
      role: user.role,
      provider_id: user.provider_id || '',
      allowed_service_ids: user.allowed_service_ids || [],
      is_active: user.is_active,
      can_manage_testing: user.can_manage_testing || false,
    });
    setFormError('');
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setSaving(true);

    try {
      if (editingUser) {
        // Update
        const body: Record<string, unknown> = {
          id: editingUser.id,
          display_name: formData.display_name,
          role: formData.role,
          provider_id: formData.provider_id || null,
          allowed_service_ids: formData.allowed_service_ids,
          is_active: formData.is_active,
          can_manage_testing: formData.can_manage_testing,
        };
        if (formData.password) {
          body.password = formData.password;
        }

        const res = await fetch('/api/admin/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const err = await res.json();
          setFormError(err.error || 'Failed to update user');
          return;
        }
      } else {
        // Create
        if (!formData.password) {
          setFormError('Password is required for new users');
          return;
        }

        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: formData.username,
            password: formData.password,
            display_name: formData.display_name,
            role: formData.role,
            provider_id: formData.provider_id || null,
            allowed_service_ids: formData.allowed_service_ids,
            can_manage_testing: formData.can_manage_testing,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          setFormError(err.error || 'Failed to create user');
          return;
        }
      }

      setShowForm(false);
      fetchData();
    } catch {
      setFormError('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(user: AppUser) {
    if (!confirm(`Are you sure you want to delete user "${user.display_name}" (${user.username})?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users?id=${user.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete user');
      }
    } catch {
      alert('Failed to delete user');
    }
  }

  function toggleServiceId(serviceId: string) {
    setFormData(prev => ({
      ...prev,
      allowed_service_ids: prev.allowed_service_ids.includes(serviceId)
        ? prev.allowed_service_ids.filter(id => id !== serviceId)
        : [...prev.allowed_service_ids, serviceId],
    }));
  }

  if (loading) {
    return <div className="text-center py-8">Loading users...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold" style={{ color: colors.primaryBlue }}>
          Manage Users ({users.length})
        </h2>
        <button
          onClick={openCreateForm}
          className="px-4 py-2 rounded text-white font-medium"
          style={{ backgroundColor: colors.teal }}
        >
          + New User
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: colors.primaryBlue }}>
              <th className="px-4 py-3 text-left text-white text-sm font-medium">Username</th>
              <th className="px-4 py-3 text-left text-white text-sm font-medium">Display Name</th>
              <th className="px-4 py-3 text-center text-white text-sm font-medium">Role</th>
              <th className="px-4 py-3 text-center text-white text-sm font-medium">Linked Provider</th>
              <th className="px-4 py-3 text-center text-white text-sm font-medium">Status</th>
              <th className="px-4 py-3 text-right text-white text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, idx) => {
              const linkedProvider = user.provider_id
                ? providers.find(p => p.id === user.provider_id)
                : null;

              return (
                <tr key={user.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 font-medium" style={{ color: colors.primaryBlue }}>
                    {user.username}
                  </td>
                  <td className="px-4 py-3">{user.display_name}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className="px-2 py-1 rounded text-xs font-medium text-white"
                      style={{ backgroundColor: ROLE_COLORS[user.role] }}
                    >
                      {ROLE_LABELS[user.role]}
                    </span>
                    {user.can_manage_testing && (
                      <span className="ml-1 px-2 py-1 rounded text-xs font-medium text-white bg-amber-500">
                        Testing
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600">
                    {linkedProvider ? `${linkedProvider.initials} - ${linkedProvider.name}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {user.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEditForm(user)}
                      className="px-3 py-1 rounded text-sm text-white mr-2"
                      style={{ backgroundColor: colors.lightBlue }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(user)}
                      className="px-3 py-1 rounded text-sm text-white"
                      style={{ backgroundColor: colors.error }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4" style={{ color: colors.primaryBlue }}>
              {editingUser ? 'Edit User' : 'Create New User'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username (only for new users) */}
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium mb-1">Username</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={e => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    className="w-full px-3 py-2 border rounded"
                    style={{ borderColor: colors.border }}
                    required
                    placeholder="e.g., jsmith"
                  />
                </div>
              )}

              {/* Display Name */}
              <div>
                <label className="block text-sm font-medium mb-1">Display Name</label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={e => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                  style={{ borderColor: colors.border }}
                  required
                  placeholder="e.g., John Smith"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  {editingUser ? 'New Password (leave blank to keep current)' : 'Password'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                  style={{ borderColor: colors.border }}
                  required={!editingUser}
                  placeholder={editingUser ? 'Leave blank to keep current' : 'Enter password'}
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={e => setFormData(prev => ({ ...prev, role: e.target.value as UserRole }))}
                  className="w-full px-3 py-2 border rounded"
                  style={{ borderColor: colors.border }}
                >
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Provider Link (for provider role) */}
              {formData.role === 'provider' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Linked Provider</label>
                  <select
                    value={formData.provider_id}
                    onChange={e => setFormData(prev => ({ ...prev, provider_id: e.target.value }))}
                    className="w-full px-3 py-2 border rounded"
                    style={{ borderColor: colors.border }}
                  >
                    <option value="">Select Provider</option>
                    {providers.map(p => (
                      <option key={p.id} value={p.id}>{p.initials} - {p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Allowed Services (for scheduler_limited role) */}
              {formData.role === 'scheduler_limited' && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Allowed Services ({formData.allowed_service_ids.length} selected)
                  </label>
                  <div className="border rounded p-3 max-h-48 overflow-y-auto" style={{ borderColor: colors.border }}>
                    {services.map(service => (
                      <label key={service.id} className="flex items-center gap-2 py-1">
                        <input
                          type="checkbox"
                          checked={formData.allowed_service_ids.includes(service.id)}
                          onChange={() => toggleServiceId(service.id)}
                        />
                        <span className="text-sm">{service.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Can Manage Testing */}
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.can_manage_testing}
                    onChange={e => setFormData(prev => ({ ...prev, can_manage_testing: e.target.checked }))}
                  />
                  <span className="text-sm font-medium">Can Manage Testing</span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-5">
                  Grants admin access to the Testing/Echo page (manage techs, rooms, templates, edit schedule)
                </p>
              </div>

              {/* Active Toggle (edit only) */}
              {editingUser && (
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={e => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    />
                    <span className="text-sm font-medium">Account Active</span>
                  </label>
                </div>
              )}

              {/* Error */}
              {formError && (
                <p className="text-sm" style={{ color: colors.error }}>{formError}</p>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 rounded text-white font-medium disabled:opacity-50"
                  style={{ backgroundColor: colors.primaryBlue }}
                >
                  {saving ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-6 py-2 rounded border font-medium"
                  style={{ borderColor: colors.border }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Role Legend */}
      <div className="mt-6 bg-blue-50 rounded-lg p-4">
        <h4 className="font-semibold mb-2" style={{ color: colors.primaryBlue }}>
          Role Permissions
        </h4>
        <ul className="text-sm text-gray-700 space-y-1">
          <li><strong>Super Admin:</strong> Full access - edit schedule, approve PTO, manage providers/services/templates/users</li>
          <li><strong>Scheduler (Full):</strong> Edit all services on schedule, view reports, submit PTO on behalf</li>
          <li><strong>Scheduler (Limited):</strong> Edit only assigned services, view reports, submit PTO on behalf</li>
          <li><strong>Provider:</strong> View schedule, manage own PTO, view reports</li>
          <li><strong>Viewer:</strong> View schedule, submit PTO, view reports</li>
          <li><strong>Can Manage Testing:</strong> Any role with this permission gets admin access to the Testing/Echo page (manage techs, rooms, templates, edit schedule)</li>
        </ul>
      </div>
    </div>
  );
}
