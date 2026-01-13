'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { EchoTech, EchoRoom, EchoScheduleAssignment, EchoPTO } from '@/lib/types';
import EchoCalendar from '@/app/components/EchoCalendar';
import EchoAssignmentModal from '@/app/components/EchoAssignmentModal';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  lightGray: '#F5F5F5',
  border: '#E5E7EB',
};

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
              <Link
                href="/admin/echo"
                className="px-3 py-1 rounded text-sm font-medium text-white"
                style={{ backgroundColor: colors.primaryBlue }}
              >
                Manage Techs/Rooms
              </Link>
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

        {/* Calendar */}
        <div className="bg-white rounded-lg shadow-sm p-4 overflow-auto max-h-[calc(100vh-280px)]">
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
