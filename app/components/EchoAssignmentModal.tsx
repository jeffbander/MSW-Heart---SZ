'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { EchoTech, EchoRoom, EchoScheduleAssignment, EchoPTO } from '@/lib/types';

interface EchoAssignmentModalProps {
  isOpen: boolean;
  room: EchoRoom | null;
  date: string;
  timeBlock: 'AM' | 'PM';
  echoTechs: EchoTech[];
  currentAssignments: EchoScheduleAssignment[];
  allAssignments: EchoScheduleAssignment[];
  ptoDays: EchoPTO[];
  onClose: () => void;
  onSave: (techId: string, notes: string | null) => Promise<void>;
  onDelete: (assignmentId: string) => Promise<void>;
}

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  border: '#E5E7EB',
  warningRed: '#DC2626',
};

export default function EchoAssignmentModal({
  isOpen,
  room,
  date,
  timeBlock,
  echoTechs,
  currentAssignments,
  allAssignments,
  ptoDays,
  onClose,
  onSave,
  onDelete
}: EchoAssignmentModalProps) {
  const [selectedTechId, setSelectedTechId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Searchable dropdown state
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedTechId('');
      setNotes('');
      setSearchTerm('');
      setDropdownOpen(false);
      setConfirmDeleteId(null);
    }
  }, [isOpen, date, timeBlock, room?.id]);

  // Conflict warnings for selected tech — must be before early return to preserve hook order
  const conflicts = useMemo(() => {
    if (!isOpen || !room || !selectedTechId || selectedTechId === 'TEMP') return [];
    const warnings: { type: 'pto' | 'double_booked'; message: string }[] = [];

    // Check PTO conflict
    const hasPTO = ptoDays.some(
      p =>
        p.echo_tech_id === selectedTechId &&
        p.date === date &&
        (p.time_block === timeBlock || p.time_block === 'BOTH')
    );
    if (hasPTO) {
      const tech = echoTechs.find(t => t.id === selectedTechId);
      warnings.push({ type: 'pto', message: `${tech?.name} has PTO on this date/time` });
    }

    // Check double-booking in another room
    const otherRoomAssignment = allAssignments.find(
      a =>
        a.echo_tech_id === selectedTechId &&
        a.date === date &&
        a.time_block === timeBlock &&
        a.echo_room_id !== room.id
    );
    if (otherRoomAssignment) {
      const tech = echoTechs.find(t => t.id === selectedTechId);
      const otherRoom = otherRoomAssignment.echo_room;
      warnings.push({
        type: 'double_booked',
        message: `${tech?.name} is already assigned to ${otherRoom?.short_name || otherRoom?.name || 'another room'} at this time`,
      });
    }

    return warnings;
  }, [isOpen, room, selectedTechId, date, timeBlock, ptoDays, allAssignments, echoTechs]);

  if (!isOpen || !room) return null;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const handleSave = async () => {
    if (!selectedTechId) return;
    setSaving(true);
    try {
      await onSave(selectedTechId, notes || null);
      setSelectedTechId('');
      setNotes('');
      setSearchTerm('');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (assignmentId: string) => {
    setSaving(true);
    try {
      await onDelete(assignmentId);
      setConfirmDeleteId(null);
    } finally {
      setSaving(false);
    }
  };

  // Filter out techs already assigned
  const assignedTechIds = new Set(currentAssignments.map(a => a.echo_tech_id));
  const availableTechs = echoTechs.filter(t => t.is_active && !assignedTechIds.has(t.id));

  // Filtered list for searchable dropdown
  const filteredTechs = searchTerm
    ? availableTechs.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : availableTechs;

  const selectedTech = echoTechs.find(t => t.id === selectedTechId);

  const handleSelectTech = (techId: string) => {
    setSelectedTechId(techId);
    const tech = echoTechs.find(t => t.id === techId);
    setSearchTerm(tech?.name || '');
    setDropdownOpen(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-2" style={{ color: colors.primaryBlue }}>
          {room.short_name || room.name}
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          {formatDate(date)} - {timeBlock}
        </p>

        {/* Current Assignments */}
        {currentAssignments.length > 0 && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Current Assignments</label>
            <div className="space-y-2">
              {currentAssignments.map(assignment => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded"
                >
                  <div>
                    <span className="font-medium">{assignment.echo_tech?.name}</span>
                    {assignment.notes && (
                      <span className="text-sm text-gray-500 ml-2">({assignment.notes})</span>
                    )}
                  </div>
                  {confirmDeleteId === assignment.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(assignment.id)}
                        disabled={saving}
                        className="text-red-600 hover:text-red-800 text-xs font-semibold"
                      >
                        Yes, remove
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-gray-500 hover:text-gray-700 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(assignment.id)}
                      disabled={saving}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add New Assignment — Searchable Dropdown */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Add Tech</label>
          <div className="relative" ref={dropdownRef}>
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSelectedTechId('');
                setDropdownOpen(true);
              }}
              onFocus={() => setDropdownOpen(true)}
              placeholder="Search techs..."
              className="w-full px-3 py-2 border rounded mb-0"
              style={{ borderColor: colors.border }}
            />
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedTechId('');
                  inputRef.current?.focus();
                }}
                className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600 text-sm"
              >
                &times;
              </button>
            )}
            {dropdownOpen && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto" style={{ borderColor: colors.border }}>
                {filteredTechs.length > 0 ? (
                  <>
                    {filteredTechs.map(tech => (
                      <button
                        key={tech.id}
                        onClick={() => handleSelectTech(tech.id)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 flex justify-between items-center"
                      >
                        <span>{tech.name}</span>
                        <span className="text-gray-400 text-xs">cap: {tech.capacity_per_half_day}</span>
                      </button>
                    ))}
                    <button
                      onClick={() => handleSelectTech('TEMP')}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 text-gray-500 italic border-t"
                      style={{ borderColor: colors.border }}
                    >
                      Temp
                    </button>
                  </>
                ) : (
                  <div className="px-3 py-2 text-sm text-gray-500">No techs found</div>
                )}
              </div>
            )}
          </div>

          {/* Conflict Warnings */}
          {conflicts.length > 0 && (
            <div className="mt-2 space-y-1">
              {conflicts.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800"
                >
                  <svg className="w-4 h-4 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  {c.message}
                </div>
              ))}
            </div>
          )}

          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="w-full px-3 py-2 border rounded mt-2"
            style={{ borderColor: colors.border }}
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded border font-medium"
            style={{ borderColor: colors.border }}
          >
            Close
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedTechId || saving}
            className="px-4 py-2 rounded text-white font-medium disabled:opacity-50"
            style={{ backgroundColor: colors.teal }}
          >
            {saving ? 'Saving...' : 'Add Assignment'}
          </button>
        </div>
      </div>
    </div>
  );
}
