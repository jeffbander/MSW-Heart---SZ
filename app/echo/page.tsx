'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { EchoTech, EchoRoom, EchoScheduleAssignment, EchoPTO, EchoScheduleTemplate } from '@/lib/types';
import EchoCalendar from '@/app/components/EchoCalendar';
import EchoAssignmentModal from '@/app/components/EchoAssignmentModal';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  lightGray: '#F5F5F5',
  border: '#E5E7EB',
};

// Capacity Summary Component - Shows daily capacity for each day
function CapacitySummary({
  dateRange,
  echoTechs,
  echoRooms,
  assignments
}: {
  dateRange: string[];
  echoTechs: EchoTech[];
  echoRooms: EchoRoom[];
  assignments: EchoScheduleAssignment[];
}) {
  const techMap = new Map(echoTechs.map(t => [t.id, t]));

  // Calculate full-day capacity (AM + PM) for a specific date and capacity type
  const calculateDayCapacity = (date: string, capacityType: string) => {
    let total = 0;
    const countedTechs = new Set<string>();

    ['AM', 'PM'].forEach(timeBlock => {
      echoRooms
        .filter(room => room.capacity_type === capacityType && room.category === 'CVI')
        .forEach(room => {
          const roomAssignments = assignments.filter(
            a => a.echo_room_id === room.id && a.date === date && a.time_block === timeBlock
          );
          roomAssignments.forEach(assignment => {
            const key = `${timeBlock}-${assignment.echo_tech_id}`;
            if (!countedTechs.has(key)) {
              const tech = techMap.get(assignment.echo_tech_id);
              if (tech) {
                total += tech.capacity_per_half_day;
                countedTechs.add(key);
              }
            }
          });
        });
    });

    return total;
  };

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return { dayName: days[date.getDay()], dateStr: `${month}/${day}` };
  };

  const isWeekend = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.getDay() === 0 || date.getDay() === 6;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left p-2 font-medium text-gray-600" style={{ minWidth: '100px' }}>Capacity</th>
            {dateRange.map(date => {
              const { dayName, dateStr } = formatDateHeader(date);
              const weekend = isWeekend(date);
              return (
                <th
                  key={date}
                  className={`text-center p-2 font-medium ${weekend ? 'text-gray-400' : ''}`}
                  style={{ minWidth: '70px' }}
                >
                  <div>{dayName}</div>
                  <div className="text-xs font-normal">{dateStr}</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="p-2 font-medium" style={{ color: colors.teal }}>Echo</td>
            {dateRange.map(date => {
              const weekend = isWeekend(date);
              const capacity = weekend ? '-' : calculateDayCapacity(date, 'echo');
              return (
                <td key={date} className={`text-center p-2 font-bold text-lg ${weekend ? 'text-gray-300' : ''}`} style={{ color: weekend ? undefined : colors.primaryBlue }}>
                  {capacity}
                </td>
              );
            })}
          </tr>
          <tr>
            <td className="p-2 font-medium" style={{ color: colors.lightBlue }}>Stress Echo</td>
            {dateRange.map(date => {
              const weekend = isWeekend(date);
              const capacity = weekend ? '-' : calculateDayCapacity(date, 'stress_echo');
              return (
                <td key={date} className={`text-center p-2 font-bold text-lg ${weekend ? 'text-gray-300' : ''}`} style={{ color: weekend ? undefined : colors.primaryBlue }}>
                  {capacity}
                </td>
              );
            })}
          </tr>
          <tr>
            <td className="p-2 font-medium" style={{ color: colors.primaryBlue }}>Vascular</td>
            {dateRange.map(date => {
              const weekend = isWeekend(date);
              const capacity = weekend ? '-' : calculateDayCapacity(date, 'vascular');
              return (
                <td key={date} className={`text-center p-2 font-bold text-lg ${weekend ? 'text-gray-300' : ''}`} style={{ color: weekend ? undefined : colors.primaryBlue }}>
                  {capacity}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function EchoPage() {
  // Data state
  const [echoTechs, setEchoTechs] = useState<EchoTech[]>([]);
  const [echoRooms, setEchoRooms] = useState<EchoRoom[]>([]);
  const [assignments, setAssignments] = useState<EchoScheduleAssignment[]>([]);
  const [ptoDays, setPtoDays] = useState<EchoPTO[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [isAdmin, setIsAdmin] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);

  // Modal state
  const [selectedRoom, setSelectedRoom] = useState<EchoRoom | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTimeBlock, setSelectedTimeBlock] = useState<'AM' | 'PM'>('AM');
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showPTOModal, setShowPTOModal] = useState(false);

  // Template state
  const [templates, setTemplates] = useState<EchoScheduleTemplate[]>([]);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [showApplyTemplateModal, setShowApplyTemplateModal] = useState(false);

  // Collapsed sections state (Fourth Floor Lab hidden by default)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('echo-collapsed-categories');
      if (saved) return new Set(JSON.parse(saved));
    }
    return new Set(['Fourth Floor Lab']);
  });

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      localStorage.setItem('echo-collapsed-categories', JSON.stringify([...next]));
      return next;
    });
  };

  // Calculate date range for current week
  const dateRange = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek + 1 + (weekOffset * 7));

    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  }, [weekOffset]);

  const weekStartDate = dateRange[0];
  const weekEndDate = dateRange[6];

  // Fetch all data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [techsRes, roomsRes, assignmentsRes, ptoRes] = await Promise.all([
        fetch('/api/echo-techs'),
        fetch('/api/echo-rooms'),
        fetch(`/api/echo-schedule?startDate=${weekStartDate}&endDate=${weekEndDate}`),
        fetch(`/api/echo-pto?startDate=${weekStartDate}&endDate=${weekEndDate}`)
      ]);

      if (techsRes.ok) setEchoTechs(await techsRes.json());
      if (roomsRes.ok) setEchoRooms(await roomsRes.json());
      if (assignmentsRes.ok) setAssignments(await assignmentsRes.json());
      if (ptoRes.ok) setPtoDays(await ptoRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [weekStartDate, weekEndDate]);

  // Fetch templates
  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/echo-templates');
      if (res.ok) setTemplates(await res.json());
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchTemplates();
    }
  }, [isAdmin]);

  // Format week label
  const formatWeekLabel = () => {
    const start = new Date(weekStartDate + 'T00:00:00');
    const end = new Date(weekEndDate + 'T00:00:00');
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}, ${start.getFullYear()}`;
  };

  // Handle cell click
  const handleCellClick = (roomId: string, date: string, timeBlock: 'AM' | 'PM') => {
    const room = echoRooms.find(r => r.id === roomId);
    if (!room) return;
    setSelectedRoom(room);
    setSelectedDate(date);
    setSelectedTimeBlock(timeBlock);
    setShowAssignmentModal(true);
  };

  // Handle PTO click
  const handlePTOClick = (date: string, timeBlock: 'AM' | 'PM') => {
    setSelectedDate(date);
    setSelectedTimeBlock(timeBlock);
    setShowPTOModal(true);
  };

  // Get current assignments for modal
  const getCurrentAssignments = () => {
    if (!selectedRoom) return [];
    return assignments.filter(
      a => a.echo_room_id === selectedRoom.id &&
           a.date === selectedDate &&
           a.time_block === selectedTimeBlock
    );
  };

  // Save assignment
  const handleSaveAssignment = async (techId: string, notes: string | null) => {
    if (!selectedRoom) return;

    // Handle "Temp" special case
    if (techId === 'TEMP') {
      // For now, we'll skip Temp assignments as they need special handling
      alert('Temp assignments will be supported in a future update');
      return;
    }

    const response = await fetch('/api/echo-schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: selectedDate,
        echo_room_id: selectedRoom.id,
        echo_tech_id: techId,
        time_block: selectedTimeBlock,
        notes
      })
    });

    if (response.ok) {
      await fetchData();
    } else {
      const error = await response.json();
      alert(error.error || 'Failed to save assignment');
    }
  };

  // Delete assignment
  const handleDeleteAssignment = async (assignmentId: string) => {
    const response = await fetch(`/api/echo-schedule?id=${assignmentId}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      await fetchData();
    } else {
      alert('Failed to delete assignment');
    }
  };

  // Add PTO
  const handleAddPTO = async (techId: string, reason: string | null) => {
    const response = await fetch('/api/echo-pto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: selectedDate,
        echo_tech_id: techId,
        time_block: selectedTimeBlock,
        reason
      })
    });

    if (response.ok) {
      await fetchData();
      setShowPTOModal(false);
    } else {
      const error = await response.json();
      alert(error.error || 'Failed to add PTO');
    }
  };

  // Save current week as template
  const handleSaveAsTemplate = async (name: string, description: string) => {
    const response = await fetch('/api/echo-templates/from-week', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description: description || undefined,
        weekStartDate: weekStartDate
      })
    });

    if (response.ok) {
      await fetchTemplates();
      setShowSaveTemplateModal(false);
      alert('Template saved successfully!');
    } else {
      const error = await response.json();
      alert(error.error || 'Failed to save template');
    }
  };

  // Apply template to date range
  const handleApplyTemplate = async (templateId: string, startDate: string, endDate: string, fillEmptyOnly: boolean) => {
    const response = await fetch('/api/echo-templates/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateId,
        startDate,
        endDate,
        fillEmptyOnly
      })
    });

    if (response.ok) {
      const result = await response.json();
      await fetchData();
      setShowApplyTemplateModal(false);
      alert(result.message);
    } else {
      const error = await response.json();
      alert(error.error || 'Failed to apply template');
    }
  };

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: colors.lightGray }}>
      <div className="max-w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <Link
              href="/dashboard"
              className="text-sm hover:underline mb-1 inline-block"
              style={{ color: colors.primaryBlue }}
            >
              ← Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold" style={{ color: colors.primaryBlue }}>
              Echo Lab Schedule
            </h1>
          </div>

          {/* Admin Toggle */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">Admin Mode</span>
            </label>

            {isAdmin && (
              <>
                {/* Templates Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                    className="px-3 py-1 rounded text-sm font-medium text-white flex items-center gap-1"
                    style={{ backgroundColor: colors.teal }}
                  >
                    Templates
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showTemplateDropdown && (
                    <div
                      className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border z-50"
                      style={{ borderColor: colors.border }}
                    >
                      <button
                        onClick={() => {
                          setShowSaveTemplateModal(true);
                          setShowTemplateDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 rounded-t-lg"
                      >
                        Save Current Week as Template
                      </button>
                      <button
                        onClick={() => {
                          setShowApplyTemplateModal(true);
                          setShowTemplateDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                      >
                        Apply Template to Date Range
                      </button>
                      <div className="border-t" style={{ borderColor: colors.border }}>
                        <Link
                          href="/admin/echo/templates"
                          className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-50 rounded-b-lg"
                          style={{ color: colors.primaryBlue }}
                        >
                          Manage Templates →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                <Link
                  href="/admin/echo"
                  className="px-3 py-1 rounded text-sm font-medium text-white"
                  style={{ backgroundColor: colors.primaryBlue }}
                >
                  Manage Techs/Rooms
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Week Navigation */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setWeekOffset(w => w - 1)}
                className="px-3 py-1 rounded border hover:bg-gray-50"
                style={{ borderColor: colors.border }}
              >
                ← Prev
              </button>
              <button
                onClick={() => setWeekOffset(0)}
                className="px-3 py-1 rounded border hover:bg-gray-50"
                style={{ borderColor: colors.border }}
              >
                Today
              </button>
              <button
                onClick={() => setWeekOffset(w => w + 1)}
                className="px-3 py-1 rounded border hover:bg-gray-50"
                style={{ borderColor: colors.border }}
              >
                Next →
              </button>
            </div>

            <h2 className="text-lg font-semibold" style={{ color: colors.primaryBlue }}>
              Week of {formatWeekLabel()}
            </h2>

            <div className="text-sm text-gray-500">
              {echoTechs.length} techs, {echoRooms.length} rooms
            </div>
          </div>
        </div>

        {/* Capacity Summary Cards */}
        {!loading && (
          <CapacitySummary
            dateRange={dateRange}
            echoTechs={echoTechs}
            echoRooms={echoRooms}
            assignments={assignments}
          />
        )}

        {/* Calendar */}
        <div className="bg-white rounded-lg shadow-sm p-4 overflow-auto max-h-[calc(100vh-320px)]">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading schedule...</div>
          ) : (
            <EchoCalendar
              dateRange={dateRange}
              echoTechs={echoTechs}
              echoRooms={echoRooms}
              assignments={assignments}
              ptoDays={ptoDays}
              isAdmin={isAdmin}
              onCellClick={handleCellClick}
              onPTOClick={handlePTOClick}
              collapsedCategories={collapsedCategories}
              onToggleCategory={toggleCategory}
            />
          )}
        </div>

        {/* Legend */}
        <div className="mt-4 bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-medium mb-2">Legend</h3>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-amber-400">--</span>
              <span className="text-gray-600">Unassigned (weekday)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-red-600">⚠️</span>
              <span className="text-gray-600">Conflict (double-booked or PTO)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-100 border"></div>
              <span className="text-gray-600">Weekend</span>
            </div>
          </div>
        </div>
      </div>

      {/* Assignment Modal */}
      <EchoAssignmentModal
        isOpen={showAssignmentModal}
        room={selectedRoom}
        date={selectedDate}
        timeBlock={selectedTimeBlock}
        echoTechs={echoTechs}
        currentAssignments={getCurrentAssignments()}
        onClose={() => setShowAssignmentModal(false)}
        onSave={handleSaveAssignment}
        onDelete={handleDeleteAssignment}
      />

      {/* PTO Modal */}
      {showPTOModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowPTOModal(false)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4" style={{ color: colors.primaryBlue }}>
              Add PTO - {selectedDate} {selectedTimeBlock}
            </h3>

            <PTOForm
              echoTechs={echoTechs}
              existingPTO={ptoDays.filter(
                p => p.date === selectedDate &&
                     (p.time_block === selectedTimeBlock || p.time_block === 'BOTH')
              )}
              onSubmit={handleAddPTO}
              onCancel={() => setShowPTOModal(false)}
            />
          </div>
        </div>
      )}

      {/* Save Template Modal */}
      {showSaveTemplateModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowSaveTemplateModal(false)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4" style={{ color: colors.primaryBlue }}>
              Save Week as Template
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              This will capture the current week&apos;s assignments ({formatWeekLabel()}) and save them as a reusable template.
            </p>

            <SaveTemplateForm
              onSubmit={handleSaveAsTemplate}
              onCancel={() => setShowSaveTemplateModal(false)}
            />
          </div>
        </div>
      )}

      {/* Apply Template Modal */}
      {showApplyTemplateModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowApplyTemplateModal(false)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4" style={{ color: colors.primaryBlue }}>
              Apply Template
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Apply a saved template to fill empty slots in a date range. Existing assignments will not be overwritten.
            </p>

            <ApplyTemplateForm
              templates={templates}
              onSubmit={handleApplyTemplate}
              onCancel={() => setShowApplyTemplateModal(false)}
            />
          </div>
        </div>
      )}

      {/* Close dropdown when clicking outside */}
      {showTemplateDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowTemplateDropdown(false)}
        />
      )}
    </div>
  );
}

// PTO Form Component
function PTOForm({
  echoTechs,
  existingPTO,
  onSubmit,
  onCancel
}: {
  echoTechs: EchoTech[];
  existingPTO: EchoPTO[];
  onSubmit: (techId: string, reason: string | null) => void;
  onCancel: () => void;
}) {
  const [techId, setTechId] = useState('');
  const [reason, setReason] = useState('');

  const existingTechIds = new Set(existingPTO.map(p => p.echo_tech_id));
  const availableTechs = echoTechs.filter(t => t.is_active && !existingTechIds.has(t.id));

  return (
    <div>
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Tech</label>
        <select
          value={techId}
          onChange={(e) => setTechId(e.target.value)}
          className="w-full px-3 py-2 border rounded"
        >
          <option value="">Select a tech...</option>
          {availableTechs.map(tech => (
            <option key={tech.id} value={tech.id}>{tech.name}</option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Reason (optional)</label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g., off, sick, vacation"
          className="w-full px-3 py-2 border rounded"
        />
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded border font-medium"
        >
          Cancel
        </button>
        <button
          onClick={() => onSubmit(techId, reason || null)}
          disabled={!techId}
          className="px-4 py-2 rounded text-white font-medium disabled:opacity-50"
          style={{ backgroundColor: colors.teal }}
        >
          Add PTO
        </button>
      </div>
    </div>
  );
}

// Save Template Form Component
function SaveTemplateForm({
  onSubmit,
  onCancel
}: {
  onSubmit: (name: string, description: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSubmit(name.trim(), description.trim());
    setSaving(false);
  };

  return (
    <div>
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Template Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Standard Week, January Schedule"
          className="w-full px-3 py-2 border rounded"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add any notes about this template..."
          rows={2}
          className="w-full px-3 py-2 border rounded"
        />
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded border font-medium"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || saving}
          className="px-4 py-2 rounded text-white font-medium disabled:opacity-50"
          style={{ backgroundColor: colors.teal }}
        >
          {saving ? 'Saving...' : 'Save Template'}
        </button>
      </div>
    </div>
  );
}

// Apply Template Form Component
function ApplyTemplateForm({
  templates,
  onSubmit,
  onCancel
}: {
  templates: EchoScheduleTemplate[];
  onSubmit: (templateId: string, startDate: string, endDate: string, fillEmptyOnly: boolean) => void;
  onCancel: () => void;
}) {
  const [templateId, setTemplateId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [fillEmptyOnly, setFillEmptyOnly] = useState(true);
  const [applying, setApplying] = useState(false);

  const handleSubmit = async () => {
    if (!templateId || !startDate || !endDate) return;
    setApplying(true);
    await onSubmit(templateId, startDate, endDate, fillEmptyOnly);
    setApplying(false);
  };

  return (
    <div>
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Select Template *</label>
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="w-full px-3 py-2 border rounded"
        >
          <option value="">Choose a template...</option>
          {templates.map(t => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.description && ` - ${t.description}`}
            </option>
          ))}
        </select>
        {templates.length === 0 && (
          <p className="text-sm text-amber-600 mt-1">
            No templates available. Save a week as a template first.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium mb-2">Start Date *</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">End Date *</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
      </div>

      <div className="mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={fillEmptyOnly}
            onChange={(e) => setFillEmptyOnly(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm">Only fill empty slots (don&apos;t overwrite existing assignments)</span>
        </label>
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded border font-medium"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!templateId || !startDate || !endDate || applying}
          className="px-4 py-2 rounded text-white font-medium disabled:opacity-50"
          style={{ backgroundColor: colors.primaryBlue }}
        >
          {applying ? 'Applying...' : 'Apply Template'}
        </button>
      </div>
    </div>
  );
}
