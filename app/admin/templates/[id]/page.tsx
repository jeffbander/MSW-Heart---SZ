'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ScheduleTemplate, TemplateAssignment, Service, Provider, TemplateType } from '@/lib/types';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  ptoRed: '#DC2626',
  border: '#E5E7EB',
  lightGray: '#F5F5F5',
};

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function TemplateEditorPage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.id as string;

  const [template, setTemplate] = useState<ScheduleTemplate | null>(null);
  const [assignments, setAssignments] = useState<TemplateAssignment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit form state
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [metaForm, setMetaForm] = useState({
    name: '',
    description: '',
    type: 'weekly' as TemplateType,
    is_global: true,
  });

  // Add assignment modal state
  const [selectedCell, setSelectedCell] = useState<{
    dayOfWeek: number;
    timeBlock: string;
  } | null>(null);
  const [assignmentForm, setAssignmentForm] = useState({
    service_id: '',
    provider_id: '',
    room_count: 0,
    is_pto: false,
  });

  useEffect(() => {
    fetchAll();
  }, [templateId]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [templateRes, assignmentsRes, servicesRes, providersRes] = await Promise.all([
        fetch(`/api/templates`).then((r) => r.json()),
        fetch(`/api/templates/${templateId}/assignments`).then((r) => r.json()),
        fetch('/api/services?all=true').then((r) => r.json()),
        fetch('/api/providers').then((r) => r.json()),
      ]);

      const foundTemplate = Array.isArray(templateRes)
        ? templateRes.find((t: ScheduleTemplate) => t.id === templateId)
        : null;

      setTemplate(foundTemplate);
      if (foundTemplate) {
        setMetaForm({
          name: foundTemplate.name,
          description: foundTemplate.description || '',
          type: foundTemplate.type,
          is_global: foundTemplate.is_global,
        });
      }

      setAssignments(Array.isArray(assignmentsRes) ? assignmentsRes : []);
      setServices(Array.isArray(servicesRes) ? servicesRes : []);
      setProviders(Array.isArray(providersRes) ? providersRes : []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMeta = async () => {
    try {
      const response = await fetch('/api/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: templateId,
          ...metaForm,
        }),
      });

      if (response.ok) {
        const updated = await response.json();
        setTemplate(updated);
        setIsEditingMeta(false);
      }
    } catch (error) {
      console.error('Error updating template:', error);
    }
  };

  const handleAddAssignment = async () => {
    if (!selectedCell || !assignmentForm.service_id || !assignmentForm.provider_id) return;

    try {
      const response = await fetch(`/api/templates/${templateId}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_of_week: selectedCell.dayOfWeek,
          time_block: selectedCell.timeBlock,
          service_id: assignmentForm.service_id,
          provider_id: assignmentForm.provider_id,
          room_count: assignmentForm.room_count,
          is_pto: assignmentForm.is_pto,
        }),
      });

      if (response.ok) {
        await fetchAll();
        setSelectedCell(null);
        resetAssignmentForm();
      }
    } catch (error) {
      console.error('Error adding assignment:', error);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      const response = await fetch(
        `/api/templates/${templateId}/assignments?assignmentId=${assignmentId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        await fetchAll();
      }
    } catch (error) {
      console.error('Error removing assignment:', error);
    }
  };

  const resetAssignmentForm = () => {
    setAssignmentForm({
      service_id: '',
      provider_id: '',
      room_count: 0,
      is_pto: false,
    });
  };

  const getAssignmentsForCell = (dayOfWeek: number, timeBlock: string) => {
    return assignments.filter(
      (a) => a.day_of_week === dayOfWeek && a.time_block === timeBlock
    );
  };

  if (loading) {
    return <div className="text-center py-8">Loading template...</div>;
  }

  if (!template) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-500 mb-4">Template not found</div>
        <Link
          href="/admin/templates"
          className="px-4 py-2 rounded text-white"
          style={{ backgroundColor: colors.primaryBlue }}
        >
          Back to Templates
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <Link
            href="/admin/templates"
            className="text-sm mb-2 inline-block hover:underline"
            style={{ color: colors.lightBlue }}
          >
            ← Back to Templates
          </Link>
          <h2 className="text-2xl font-bold" style={{ color: colors.primaryBlue }}>
            {template.name}
          </h2>
          {template.description && (
            <p className="text-gray-600 mt-1">{template.description}</p>
          )}
        </div>
        <button
          onClick={() => setIsEditingMeta(true)}
          className="px-4 py-2 rounded text-white"
          style={{ backgroundColor: colors.lightBlue }}
        >
          Edit Details
        </button>
      </div>

      {/* Edit Meta Modal */}
      {isEditingMeta && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full">
            <h3 className="text-xl font-bold mb-4" style={{ color: colors.primaryBlue }}>
              Edit Template
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={metaForm.name}
                  onChange={(e) => setMetaForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                  style={{ borderColor: colors.border }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={metaForm.description}
                  onChange={(e) => setMetaForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                  style={{ borderColor: colors.border }}
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select
                  value={metaForm.type}
                  onChange={(e) => setMetaForm((prev) => ({ ...prev, type: e.target.value as TemplateType }))}
                  className="w-full px-3 py-2 border rounded"
                  style={{ borderColor: colors.border }}
                >
                  <option value="weekly">Weekly</option>
                  <option value="provider-leave">Provider Leave</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={metaForm.is_global}
                  onChange={(e) => setMetaForm((prev) => ({ ...prev, is_global: e.target.checked }))}
                />
                <span className="text-sm">Global Template</span>
              </label>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleUpdateMeta}
                  className="px-6 py-2 rounded text-white font-medium"
                  style={{ backgroundColor: colors.primaryBlue }}
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setIsEditingMeta(false)}
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

      {/* Week Grid */}
      <div className="bg-white rounded-lg shadow overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th
                className="border px-3 py-2 text-left text-sm font-semibold"
                style={{ backgroundColor: colors.lightGray, borderColor: colors.border, color: colors.primaryBlue }}
              >
                Time Block
              </th>
              {SHORT_DAYS.map((day, idx) => (
                <th
                  key={idx}
                  className="border px-3 py-2 text-center text-sm font-semibold min-w-[120px]"
                  style={{ backgroundColor: colors.lightGray, borderColor: colors.border, color: colors.primaryBlue }}
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {['AM', 'PM'].map((timeBlock) => (
              <tr key={timeBlock}>
                <td
                  className="border px-3 py-2 font-semibold text-sm"
                  style={{ borderColor: colors.border, backgroundColor: colors.lightGray, color: colors.primaryBlue }}
                >
                  {timeBlock}
                </td>
                {SHORT_DAYS.map((_, dayOfWeek) => {
                  const cellAssignments = getAssignmentsForCell(dayOfWeek, timeBlock);
                  return (
                    <td
                      key={dayOfWeek}
                      className="border px-2 py-2 align-top cursor-pointer hover:bg-blue-50"
                      style={{ borderColor: colors.border, minHeight: '80px' }}
                      onClick={() => setSelectedCell({ dayOfWeek, timeBlock })}
                    >
                      {cellAssignments.length > 0 ? (
                        <div className="space-y-1">
                          {cellAssignments.map((a) => (
                            <div
                              key={a.id}
                              className="text-xs px-2 py-1 rounded flex justify-between items-center"
                              style={{
                                backgroundColor: a.is_pto ? `${colors.ptoRed}20` : `${colors.lightBlue}15`,
                                color: a.is_pto ? colors.ptoRed : colors.primaryBlue,
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="truncate">
                                {a.provider?.initials} - {a.service?.name?.substring(0, 10)}
                              </span>
                              <button
                                onClick={() => handleRemoveAssignment(a.id)}
                                className="ml-1 text-red-500 hover:text-red-700 font-bold"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center text-gray-400 text-xs py-2">
                          Click to add
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Assignment Modal */}
      {selectedCell && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full">
            <h3 className="text-xl font-bold mb-4" style={{ color: colors.primaryBlue }}>
              Add Assignment - {DAYS_OF_WEEK[selectedCell.dayOfWeek]} {selectedCell.timeBlock}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Service</label>
                <select
                  value={assignmentForm.service_id}
                  onChange={(e) => setAssignmentForm((prev) => ({ ...prev, service_id: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                  style={{ borderColor: colors.border }}
                >
                  <option value="">Select service...</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Provider</label>
                <select
                  value={assignmentForm.provider_id}
                  onChange={(e) => setAssignmentForm((prev) => ({ ...prev, provider_id: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                  style={{ borderColor: colors.border }}
                >
                  <option value="">Select provider...</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.initials} - {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Room Count</label>
                <input
                  type="number"
                  min={0}
                  value={assignmentForm.room_count}
                  onChange={(e) =>
                    setAssignmentForm((prev) => ({ ...prev, room_count: parseInt(e.target.value) || 0 }))
                  }
                  className="w-full px-3 py-2 border rounded"
                  style={{ borderColor: colors.border }}
                />
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={assignmentForm.is_pto}
                  onChange={(e) => setAssignmentForm((prev) => ({ ...prev, is_pto: e.target.checked }))}
                />
                <span className="text-sm">Mark as PTO</span>
              </label>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleAddAssignment}
                  disabled={!assignmentForm.service_id || !assignmentForm.provider_id}
                  className="px-6 py-2 rounded text-white font-medium disabled:opacity-50"
                  style={{ backgroundColor: colors.primaryBlue }}
                >
                  Add Assignment
                </button>
                <button
                  onClick={() => {
                    setSelectedCell(null);
                    resetAssignmentForm();
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

      {/* Stats */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Total Assignments</div>
          <div className="text-2xl font-bold" style={{ color: colors.primaryBlue }}>
            {assignments.length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Unique Providers</div>
          <div className="text-2xl font-bold" style={{ color: colors.teal }}>
            {new Set(assignments.map((a) => a.provider_id)).size}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Unique Services</div>
          <div className="text-2xl font-bold" style={{ color: colors.lightBlue }}>
            {new Set(assignments.map((a) => a.service_id)).size}
          </div>
        </div>
      </div>
    </div>
  );
}
