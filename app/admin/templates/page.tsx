'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ScheduleTemplate, TemplateType } from '@/lib/types';
import { useAdmin } from '@/app/contexts/AdminContext';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  ptoRed: '#DC2626',
  border: '#E5E7EB',
  purple: '#7C3AED',
};

const TYPE_LABELS: Record<TemplateType, string> = {
  weekly: 'Weekly',
  'provider-leave': 'Provider Leave',
  custom: 'Custom',
};

const TYPE_COLORS: Record<TemplateType, string> = {
  weekly: colors.teal,
  'provider-leave': colors.ptoRed,
  custom: colors.purple,
};

export default function TemplatesAdminPage() {
  const { isAdminMode } = useAdmin();
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'weekly' as TemplateType,
    is_global: true,
  });

  useEffect(() => {
    fetchTemplates();
  }, [typeFilter]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      let url = '/api/templates';
      if (typeFilter !== 'all') {
        url += `?type=${typeFilter}`;
      }
      const response = await fetch(url);
      const data = await response.json();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await fetchTemplates();
        setIsCreating(false);
        resetForm();
      }
    } catch (error) {
      console.error('Error creating template:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/templates?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchTemplates();
      }
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: 'weekly',
      is_global: true,
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return <div className="text-center py-8">Loading templates...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold" style={{ color: colors.primaryBlue }}>
          Schedule Templates ({templates.length})
        </h2>
        <div className="flex items-center gap-3">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border rounded"
            style={{ borderColor: colors.border }}
          >
            <option value="all">All Types</option>
            <option value="weekly">Weekly</option>
            <option value="provider-leave">Provider Leave</option>
            <option value="custom">Custom</option>
          </select>
          <button
            onClick={() => {
              setIsCreating(true);
              resetForm();
            }}
            disabled={!isAdminMode}
            className={`px-4 py-2 rounded text-white font-medium ${!isAdminMode ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={{ backgroundColor: colors.teal }}
            title={!isAdminMode ? 'Admin Mode required' : ''}
          >
            + New Template
          </button>
        </div>
      </div>

      {/* Create Form Modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full">
            <h3 className="text-xl font-bold mb-4" style={{ color: colors.primaryBlue }}>
              Create New Template
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Template Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                  style={{ borderColor: colors.border }}
                  placeholder="e.g., Week A, Maternity Leave"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                  style={{ borderColor: colors.border }}
                  rows={2}
                  placeholder="Optional description..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Template Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value as TemplateType }))}
                  className="w-full px-3 py-2 border rounded"
                  style={{ borderColor: colors.border }}
                >
                  <option value="weekly">Weekly Pattern</option>
                  <option value="provider-leave">Provider Leave (Maternity, etc.)</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_global}
                    onChange={(e) => setFormData((prev) => ({ ...prev, is_global: e.target.checked }))}
                  />
                  <span className="text-sm">Global Template (visible to all)</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCreate}
                  disabled={!formData.name}
                  className="px-6 py-2 rounded text-white font-medium disabled:opacity-50"
                  style={{ backgroundColor: colors.primaryBlue }}
                >
                  Create Template
                </button>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    resetForm();
                  }}
                  className="px-6 py-2 rounded border font-medium"
                  style={{ borderColor: colors.border }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Templates Table */}
      {templates.length > 0 ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: colors.primaryBlue }}>
                <th className="px-4 py-3 text-left text-white text-sm font-medium">Name</th>
                <th className="px-4 py-3 text-left text-white text-sm font-medium">Type</th>
                <th className="px-4 py-3 text-left text-white text-sm font-medium">Description</th>
                <th className="px-4 py-3 text-center text-white text-sm font-medium">Scope</th>
                <th className="px-4 py-3 text-left text-white text-sm font-medium">Created</th>
                <th className="px-4 py-3 text-right text-white text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template, idx) => (
                <tr key={template.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/templates/${template.id}`}
                      className="font-medium hover:underline"
                      style={{ color: colors.primaryBlue }}
                    >
                      {template.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="px-2 py-1 rounded text-xs font-medium text-white"
                      style={{ backgroundColor: TYPE_COLORS[template.type] }}
                    >
                      {TYPE_LABELS[template.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                    {template.description || '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{
                        backgroundColor: template.is_global ? '#E6F2FF' : '#FEF3C7',
                        color: template.is_global ? colors.primaryBlue : '#92400E',
                      }}
                    >
                      {template.is_global ? 'Global' : 'Personal'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatDate(template.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={isAdminMode ? `/admin/templates/${template.id}` : '#'}
                      onClick={(e) => !isAdminMode && e.preventDefault()}
                      className={`px-3 py-1 rounded text-sm mr-2 inline-block ${!isAdminMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                      style={{ backgroundColor: colors.lightBlue, color: 'white' }}
                      title={!isAdminMode ? 'Admin Mode required' : ''}
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(template.id)}
                      disabled={!isAdminMode}
                      className={`px-3 py-1 rounded text-sm ${!isAdminMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                      style={{ backgroundColor: colors.ptoRed, color: 'white' }}
                      title={!isAdminMode ? 'Admin Mode required' : ''}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-gray-500 mb-4">No templates found</div>
          <button
            onClick={() => {
              setIsCreating(true);
              resetForm();
            }}
            disabled={!isAdminMode}
            className={`px-4 py-2 rounded text-white font-medium ${!isAdminMode ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={{ backgroundColor: colors.teal }}
            title={!isAdminMode ? 'Admin Mode required' : ''}
          >
            Create Your First Template
          </button>
        </div>
      )}

      {/* Quick Tips */}
      <div className="mt-6 bg-blue-50 rounded-lg p-4">
        <h4 className="font-semibold mb-2" style={{ color: colors.primaryBlue }}>
          Template Tips
        </h4>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>
            <strong>Weekly:</strong> Use for regular rotation patterns (Week A, Week B)
          </li>
          <li>
            <strong>Provider Leave:</strong> Use for maternity leave, sabbaticals - marks all-day PTO
          </li>
          <li>
            <strong>Custom:</strong> Use for special scheduling scenarios
          </li>
          <li>
            You can also save a template directly from the calendar by clicking "Save Week as Template"
          </li>
        </ul>
      </div>
    </div>
  );
}
