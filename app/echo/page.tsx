'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { EchoTech, EchoRoom, EchoScheduleAssignment, EchoPTO, EchoScheduleTemplate, Holiday, Provider, Service, ScheduleAssignment } from '@/lib/types';
import { ScheduleGrid } from '@/components/schedule-grid';
import EchoAssignmentModal from '@/app/components/EchoAssignmentModal';
import ProvidersScheduleGrid from '@/app/components/ProvidersScheduleGrid';
import { useAuth } from '@/app/contexts/AuthContext';
import { useToast } from '@/app/contexts/ToastContext';
import { useUndoRedo } from './useUndoRedo';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  lightGray: '#F5F5F5',
  border: '#E5E7EB',
};

// Helper to format date in local timezone (avoids UTC conversion issues)
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function EchoPage() {
  // Data state
  const [echoTechs, setEchoTechs] = useState<EchoTech[]>([]);
  const [echoRooms, setEchoRooms] = useState<EchoRoom[]>([]);
  const [assignments, setAssignments] = useState<EchoScheduleAssignment[]>([]);
  const [ptoDays, setPtoDays] = useState<EchoPTO[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  // Admin state
  const { canManageTesting, user, requestLogin } = useAuth();
  const toast = useToast();
  const undoRedo = useUndoRedo();
  const undoingRef = useRef(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'techs' | 'providers'>('techs');

  // Providers tab data
  const [mainProviders, setMainProviders] = useState<Provider[]>([]);
  const [mainServices, setMainServices] = useState<Service[]>([]);
  const [mainAssignments, setMainAssignments] = useState<ScheduleAssignment[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);

  // UI state
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

  // Freeze "today" on mount so the week doesn't shift if the page stays open past midnight
  const frozenToday = useRef(new Date()).current;

  // Calculate date range for current week
  const dateRange = useMemo(() => {
    const dayOfWeek = frozenToday.getDay();
    const monday = new Date(frozenToday);
    monday.setDate(frozenToday.getDate() - dayOfWeek + 1 + (weekOffset * 7));

    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(formatLocalDate(d));
    }
    return dates;
  }, [weekOffset]);

  const weekStartDate = dateRange[0];
  const weekEndDate = dateRange[6];

  // Fetch all data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [techsRes, roomsRes, assignmentsRes, ptoRes, holidaysRes] = await Promise.all([
        fetch('/api/echo-techs'),
        fetch('/api/echo-rooms'),
        fetch(`/api/echo-schedule?startDate=${weekStartDate}&endDate=${weekEndDate}`),
        fetch(`/api/echo-pto?startDate=${weekStartDate}&endDate=${weekEndDate}`),
        fetch(`/api/holidays?startDate=${weekStartDate}&endDate=${weekEndDate}`)
      ]);

      if (techsRes.ok) setEchoTechs(await techsRes.json());
      if (roomsRes.ok) setEchoRooms(await roomsRes.json());
      if (assignmentsRes.ok) setAssignments(await assignmentsRes.json());
      if (ptoRes.ok) setPtoDays(await ptoRes.json());
      if (holidaysRes.ok) setHolidays(await holidaysRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [weekStartDate, weekEndDate]);

  // Fetch providers tab data
  const fetchProvidersData = async () => {
    setProvidersLoading(true);
    try {
      const [providersRes, servicesRes, assignmentsRes] = await Promise.all([
        fetch('/api/providers'),
        fetch('/api/services'),
        fetch(`/api/assignments?startDate=${weekStartDate}&endDate=${weekEndDate}`),
      ]);

      if (providersRes.ok) setMainProviders(await providersRes.json());
      if (servicesRes.ok) setMainServices(await servicesRes.json());
      if (assignmentsRes.ok) setMainAssignments(await assignmentsRes.json());
    } catch (error) {
      console.error('Error fetching providers data:', error);
    } finally {
      setProvidersLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'providers') {
      fetchProvidersData();
    }
  }, [activeTab, weekStartDate, weekEndDate]);

  // Clear undo/redo stack when week changes
  useEffect(() => {
    undoRedo.clear();
  }, [weekStartDate]);

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
    if (canManageTesting) {
      fetchTemplates();
    }
  }, [canManageTesting]);

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

  // Save assignment (optimistic)
  const handleSaveAssignment = async (techId: string, notes: string | null) => {
    if (!selectedRoom) return;

    // Handle "Temp" special case
    if (techId === 'TEMP') {
      toast.info('Temp assignments will be supported in a future update');
      return;
    }

    const tech = echoTechs.find(t => t.id === techId);
    const optimisticId = `optimistic-${Date.now()}`;
    const optimistic: EchoScheduleAssignment = {
      id: optimisticId,
      date: selectedDate,
      echo_room_id: selectedRoom.id,
      echo_tech_id: techId,
      time_block: selectedTimeBlock,
      notes,
      created_at: new Date().toISOString(),
      echo_tech: tech,
      echo_room: selectedRoom,
    };

    // Optimistically add and close modal
    setAssignments(prev => [...prev, optimistic]);
    setShowAssignmentModal(false);
    toast.success(`Assigned ${tech?.name || 'tech'}`);

    try {
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
        const real = await response.json();
        setAssignments(prev => prev.map(a => a.id === optimisticId ? { ...real, echo_tech: tech, echo_room: selectedRoom } : a));
        undoRedo.push({
          type: 'create_assignment',
          assignmentId: real.id,
          techId,
          techName: tech?.name || 'tech',
          roomId: selectedRoom.id,
          date: selectedDate,
          timeBlock: selectedTimeBlock,
          notes: notes || null,
        });
      } else {
        const error = await response.json();
        setAssignments(prev => prev.filter(a => a.id !== optimisticId));
        toast.error(error.error || 'Failed to save assignment');
      }
    } catch {
      setAssignments(prev => prev.filter(a => a.id !== optimisticId));
      toast.error('Failed to save assignment');
    }
  };

  // Delete assignment (optimistic)
  const handleDeleteAssignment = async (assignmentId: string) => {
    const removed = assignments.find(a => a.id === assignmentId);
    setAssignments(prev => prev.filter(a => a.id !== assignmentId));
    toast.success('Assignment removed');

    try {
      const response = await fetch(`/api/echo-schedule?id=${assignmentId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        if (removed) setAssignments(prev => [...prev, removed]);
        toast.error('Failed to delete assignment');
      } else if (removed && !assignmentId.startsWith('optimistic-')) {
        undoRedo.push({
          type: 'delete_assignment',
          assignmentId,
          techId: removed.echo_tech_id,
          techName: removed.echo_tech?.name || 'tech',
          roomId: removed.echo_room_id,
          date: removed.date,
          timeBlock: removed.time_block as 'AM' | 'PM',
          notes: removed.notes || null,
        });
      }
    } catch {
      if (removed) setAssignments(prev => [...prev, removed]);
      toast.error('Failed to delete assignment');
    }
  };

  // Delete PTO (optimistic)
  const handleDeletePTO = async (ptoId: string) => {
    const removed = ptoDays.find(p => p.id === ptoId);
    setPtoDays(prev => prev.filter(p => p.id !== ptoId));
    toast.success('PTO removed');

    try {
      const response = await fetch(`/api/echo-pto?id=${ptoId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        if (removed) setPtoDays(prev => [...prev, removed]);
        toast.error('Failed to delete PTO');
      }
    } catch {
      if (removed) setPtoDays(prev => [...prev, removed]);
      toast.error('Failed to delete PTO');
    }
  };

  // Add PTO (optimistic)
  const handleAddPTO = async (techId: string, reason: string | null, timeBlock: 'AM' | 'PM' | 'BOTH') => {
    const tech = echoTechs.find(t => t.id === techId);
    const optimisticId = `optimistic-pto-${Date.now()}`;
    const optimistic: EchoPTO = {
      id: optimisticId,
      date: selectedDate,
      echo_tech_id: techId,
      time_block: timeBlock,
      reason,
      created_at: new Date().toISOString(),
      echo_tech: tech,
    };

    setPtoDays(prev => [...prev, optimistic]);
    setShowPTOModal(false);
    const label = timeBlock === 'BOTH' ? 'Full Day' : timeBlock;
    toast.success(`PTO added for ${tech?.name || 'tech'} (${label})`);

    try {
      const response = await fetch('/api/echo-pto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          echo_tech_id: techId,
          time_block: timeBlock,
          reason
        })
      });

      if (response.ok) {
        const real = await response.json();
        setPtoDays(prev => prev.map(p => p.id === optimisticId ? { ...real, echo_tech: tech } : p));
      } else {
        setPtoDays(prev => prev.filter(p => p.id !== optimisticId));
        const error = await response.json();
        toast.error(error.error || 'Failed to add PTO');
      }
    } catch {
      setPtoDays(prev => prev.filter(p => p.id !== optimisticId));
      toast.error('Failed to add PTO');
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
      toast.success('Template saved successfully!');
    } else {
      const error = await response.json();
      toast.error(error.error || 'Failed to save template');
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
      toast.success(result.message);
    } else {
      const error = await response.json();
      toast.error(error.error || 'Failed to apply template');
    }
  };

  // Copy previous week's assignments
  const [copyingWeek, setCopyingWeek] = useState(false);

  const handleCopyPreviousWeek = async () => {
    setCopyingWeek(true);
    try {
      // Calculate previous week date range
      const prevStart = new Date(weekStartDate + 'T00:00:00');
      prevStart.setDate(prevStart.getDate() - 7);
      const prevEnd = new Date(weekEndDate + 'T00:00:00');
      prevEnd.setDate(prevEnd.getDate() - 7);
      const prevStartStr = formatLocalDate(prevStart);
      const prevEndStr = formatLocalDate(prevEnd);

      // Fetch previous week's assignments
      const res = await fetch(`/api/echo-schedule?startDate=${prevStartStr}&endDate=${prevEndStr}`);
      if (!res.ok) {
        toast.error('Failed to fetch previous week');
        return;
      }
      const prevAssignments: EchoScheduleAssignment[] = await res.json();

      if (prevAssignments.length === 0) {
        toast.info('No assignments found in previous week');
        return;
      }

      // Build set of existing slots to skip
      const existingSlots = new Set(
        assignments.map(a => `${a.echo_room_id}-${a.date}-${a.time_block}-${a.echo_tech_id}`)
      );

      let copied = 0;
      let skipped = 0;
      const createdForUndo: { assignmentId: string; techId: string; roomId: string; date: string; timeBlock: 'AM' | 'PM' }[] = [];

      for (const prev of prevAssignments) {
        const prevDate = new Date(prev.date + 'T00:00:00');
        prevDate.setDate(prevDate.getDate() + 7);
        const newDate = formatLocalDate(prevDate);
        const slotKey = `${prev.echo_room_id}-${newDate}-${prev.time_block}-${prev.echo_tech_id}`;

        if (existingSlots.has(slotKey)) {
          skipped++;
          continue;
        }

        const response = await fetch('/api/echo-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: newDate,
            echo_room_id: prev.echo_room_id,
            echo_tech_id: prev.echo_tech_id,
            time_block: prev.time_block,
            notes: prev.notes
          })
        });

        if (response.ok) {
          const real = await response.json();
          createdForUndo.push({
            assignmentId: real.id,
            techId: prev.echo_tech_id,
            roomId: prev.echo_room_id,
            date: newDate,
            timeBlock: prev.time_block as 'AM' | 'PM',
          });
          copied++;
        } else {
          skipped++;
        }
      }

      await fetchData();
      toast.success(`Copied ${copied} assignments${skipped > 0 ? ` (${skipped} skipped)` : ''}`);
      if (createdForUndo.length > 0) {
        undoRedo.push({ type: 'bulk_create', assignments: createdForUndo, techName: 'previous week' });
      }
    } catch {
      toast.error('Failed to copy previous week');
    } finally {
      setCopyingWeek(false);
    }
  };

  // Quick assign from inline dropdown (Feature 7)
  const handleQuickAssign = async (roomId: string, date: string, timeBlock: 'AM' | 'PM', techId: string) => {
    const tech = echoTechs.find(t => t.id === techId);
    const room = echoRooms.find(r => r.id === roomId);
    const optimisticId = `optimistic-${Date.now()}`;
    const optimistic: EchoScheduleAssignment = {
      id: optimisticId,
      date,
      echo_room_id: roomId,
      echo_tech_id: techId,
      time_block: timeBlock,
      notes: null,
      created_at: new Date().toISOString(),
      echo_tech: tech,
      echo_room: room,
    };

    setAssignments(prev => [...prev, optimistic]);
    toast.success(`Assigned ${tech?.name || 'tech'}`);

    try {
      const response = await fetch('/api/echo-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, echo_room_id: roomId, echo_tech_id: techId, time_block: timeBlock })
      });

      if (response.ok) {
        const real = await response.json();
        setAssignments(prev => prev.map(a => a.id === optimisticId ? { ...real, echo_tech: tech, echo_room: room } : a));
        undoRedo.push({
          type: 'create_assignment',
          assignmentId: real.id,
          techId,
          techName: tech?.name || 'tech',
          roomId,
          date,
          timeBlock,
          notes: null,
        });
      } else {
        setAssignments(prev => prev.filter(a => a.id !== optimisticId));
        const error = await response.json();
        toast.error(error.error || 'Failed to save assignment');
      }
    } catch {
      setAssignments(prev => prev.filter(a => a.id !== optimisticId));
      toast.error('Failed to save assignment');
    }
  };

  // Bulk assign to multiple cells (Feature 8)
  const handleBulkAssign = async (cells: { roomId: string; date: string; timeBlock: 'AM' | 'PM' }[], techId: string) => {
    const tech = echoTechs.find(t => t.id === techId);
    const optimisticAssignments: EchoScheduleAssignment[] = cells.map((cell, i) => ({
      id: `optimistic-bulk-${Date.now()}-${i}`,
      date: cell.date,
      echo_room_id: cell.roomId,
      echo_tech_id: techId,
      time_block: cell.timeBlock,
      notes: null,
      created_at: new Date().toISOString(),
      echo_tech: tech,
      echo_room: echoRooms.find(r => r.id === cell.roomId),
    }));

    setAssignments(prev => [...prev, ...optimisticAssignments]);
    toast.success(`Assigning ${tech?.name || 'tech'} to ${cells.length} cell${cells.length !== 1 ? 's' : ''}...`);

    let failCount = 0;
    const created: { assignmentId: string; techId: string; roomId: string; date: string; timeBlock: 'AM' | 'PM' }[] = [];

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const optId = optimisticAssignments[i].id;

      try {
        const response = await fetch('/api/echo-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: cell.date,
            echo_room_id: cell.roomId,
            echo_tech_id: techId,
            time_block: cell.timeBlock
          })
        });

        if (response.ok) {
          const real = await response.json();
          setAssignments(prev => prev.map(a => a.id === optId ? { ...real, echo_tech: tech, echo_room: echoRooms.find(r => r.id === cell.roomId) } : a));
          created.push({ assignmentId: real.id, techId, roomId: cell.roomId, date: cell.date, timeBlock: cell.timeBlock });
        } else {
          setAssignments(prev => prev.filter(a => a.id !== optId));
          failCount++;
        }
      } catch {
        setAssignments(prev => prev.filter(a => a.id !== optId));
        failCount++;
      }
    }

    if (failCount > 0) {
      toast.error(`${failCount} assignment${failCount !== 1 ? 's' : ''} failed`);
    }
    if (created.length > 0) {
      undoRedo.push({ type: 'bulk_create', assignments: created, techName: tech?.name || 'tech' });
    }
  };

  // Move assignment to a different cell via drag (Feature 9)
  const handleMoveAssignment = async (assignmentId: string, newRoomId: string, newDate: string, newTimeBlock: 'AM' | 'PM') => {
    const existing = assignments.find(a => a.id === assignmentId);
    if (!existing) return;

    // Skip if dropped in same cell
    if (existing.echo_room_id === newRoomId && existing.date === newDate && existing.time_block === newTimeBlock) return;

    const newRoom = echoRooms.find(r => r.id === newRoomId);

    // Optimistically update
    setAssignments(prev => prev.map(a =>
      a.id === assignmentId
        ? { ...a, echo_room_id: newRoomId, date: newDate, time_block: newTimeBlock, echo_room: newRoom }
        : a
    ));
    toast.success(`Moved ${existing.echo_tech?.name || 'tech'}`);

    try {
      const response = await fetch('/api/echo-schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: assignmentId,
          echo_room_id: newRoomId,
          date: newDate,
          time_block: newTimeBlock
        })
      });

      if (response.ok) {
        const real = await response.json();
        setAssignments(prev => prev.map(a => a.id === assignmentId ? { ...real } : a));
        undoRedo.push({
          type: 'move_assignment',
          assignmentId,
          techName: existing.echo_tech?.name || 'tech',
          fromRoomId: existing.echo_room_id,
          fromDate: existing.date,
          fromTimeBlock: existing.time_block as 'AM' | 'PM',
          toRoomId: newRoomId,
          toDate: newDate,
          toTimeBlock: newTimeBlock,
        });
      } else {
        // Revert
        setAssignments(prev => prev.map(a =>
          a.id === assignmentId ? existing : a
        ));
        toast.error('Failed to move assignment');
      }
    } catch {
      setAssignments(prev => prev.map(a =>
        a.id === assignmentId ? existing : a
      ));
      toast.error('Failed to move assignment');
    }
  };

  // Undo last action
  const handleUndo = async () => {
    if (undoingRef.current) return;
    undoingRef.current = true;
    try {
      const action = undoRedo.popUndo();
      if (!action) return;

      switch (action.type) {
        case 'create_assignment': {
          setAssignments(prev => prev.filter(a => a.id !== action.assignmentId));
          toast.info(`Undid: assigned ${action.techName}`);
          try {
            const res = await fetch(`/api/echo-schedule?id=${action.assignmentId}`, { method: 'DELETE' });
            if (!res.ok) { fetchData(); }
          } catch { fetchData(); }
          undoRedo.pushRedo(action);
          break;
        }
        case 'delete_assignment': {
          const tech = echoTechs.find(t => t.id === action.techId);
          const room = echoRooms.find(r => r.id === action.roomId);
          const optimisticId = `optimistic-undo-${Date.now()}`;
          setAssignments(prev => [...prev, {
            id: optimisticId, date: action.date, echo_room_id: action.roomId,
            echo_tech_id: action.techId, time_block: action.timeBlock,
            notes: action.notes, created_at: new Date().toISOString(),
            echo_tech: tech, echo_room: room,
          } as EchoScheduleAssignment]);
          toast.info(`Undid: removed ${action.techName}`);
          try {
            const res = await fetch('/api/echo-schedule', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ date: action.date, echo_room_id: action.roomId, echo_tech_id: action.techId, time_block: action.timeBlock, notes: action.notes })
            });
            if (res.ok) {
              const real = await res.json();
              setAssignments(prev => prev.map(a => a.id === optimisticId ? { ...real, echo_tech: tech, echo_room: room } : a));
              action.assignmentId = real.id;
            } else {
              setAssignments(prev => prev.filter(a => a.id !== optimisticId));
              toast.error('Undo failed on server');
            }
          } catch {
            setAssignments(prev => prev.filter(a => a.id !== optimisticId));
            toast.error('Undo failed on server');
          }
          undoRedo.pushRedo(action);
          break;
        }
        case 'move_assignment': {
          const fromRoom = echoRooms.find(r => r.id === action.fromRoomId);
          setAssignments(prev => prev.map(a =>
            a.id === action.assignmentId
              ? { ...a, echo_room_id: action.fromRoomId, date: action.fromDate, time_block: action.fromTimeBlock, echo_room: fromRoom }
              : a
          ));
          toast.info(`Undid: moved ${action.techName}`);
          try {
            const res = await fetch('/api/echo-schedule', {
              method: 'PUT', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: action.assignmentId, echo_room_id: action.fromRoomId, date: action.fromDate, time_block: action.fromTimeBlock })
            });
            if (!res.ok) { fetchData(); }
          } catch { fetchData(); }
          undoRedo.pushRedo(action);
          break;
        }
        case 'bulk_create': {
          const ids = new Set(action.assignments.map(a => a.assignmentId));
          setAssignments(prev => prev.filter(a => !ids.has(a.id)));
          toast.info(`Undid: bulk assigned ${action.techName} (${action.assignments.length})`);
          for (const a of action.assignments) {
            try { await fetch(`/api/echo-schedule?id=${a.assignmentId}`, { method: 'DELETE' }); } catch { /* best effort */ }
          }
          undoRedo.pushRedo(action);
          break;
        }
      }
    } finally {
      undoingRef.current = false;
    }
  };

  // Redo last undone action
  const handleRedo = async () => {
    if (undoingRef.current) return;
    undoingRef.current = true;
    try {
      const action = undoRedo.popRedo();
      if (!action) return;

      switch (action.type) {
        case 'create_assignment': {
          const tech = echoTechs.find(t => t.id === action.techId);
          const room = echoRooms.find(r => r.id === action.roomId);
          const optimisticId = `optimistic-redo-${Date.now()}`;
          setAssignments(prev => [...prev, {
            id: optimisticId, date: action.date, echo_room_id: action.roomId,
            echo_tech_id: action.techId, time_block: action.timeBlock,
            notes: action.notes, created_at: new Date().toISOString(),
            echo_tech: tech, echo_room: room,
          } as EchoScheduleAssignment]);
          toast.info(`Redid: assigned ${action.techName}`);
          try {
            const res = await fetch('/api/echo-schedule', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ date: action.date, echo_room_id: action.roomId, echo_tech_id: action.techId, time_block: action.timeBlock, notes: action.notes })
            });
            if (res.ok) {
              const real = await res.json();
              setAssignments(prev => prev.map(a => a.id === optimisticId ? { ...real, echo_tech: tech, echo_room: room } : a));
              action.assignmentId = real.id;
            } else {
              setAssignments(prev => prev.filter(a => a.id !== optimisticId));
              toast.error('Redo failed');
            }
          } catch {
            setAssignments(prev => prev.filter(a => a.id !== optimisticId));
            toast.error('Redo failed');
          }
          undoRedo.pushUndo(action);
          break;
        }
        case 'delete_assignment': {
          setAssignments(prev => prev.filter(a => a.id !== action.assignmentId));
          toast.info(`Redid: removed ${action.techName}`);
          try {
            const res = await fetch(`/api/echo-schedule?id=${action.assignmentId}`, { method: 'DELETE' });
            if (!res.ok) { fetchData(); }
          } catch { fetchData(); }
          undoRedo.pushUndo(action);
          break;
        }
        case 'move_assignment': {
          const toRoom = echoRooms.find(r => r.id === action.toRoomId);
          setAssignments(prev => prev.map(a =>
            a.id === action.assignmentId
              ? { ...a, echo_room_id: action.toRoomId, date: action.toDate, time_block: action.toTimeBlock, echo_room: toRoom }
              : a
          ));
          toast.info(`Redid: moved ${action.techName}`);
          try {
            const res = await fetch('/api/echo-schedule', {
              method: 'PUT', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: action.assignmentId, echo_room_id: action.toRoomId, date: action.toDate, time_block: action.toTimeBlock })
            });
            if (!res.ok) { fetchData(); }
          } catch { fetchData(); }
          undoRedo.pushUndo(action);
          break;
        }
        case 'bulk_create': {
          const tech = echoTechs.find(t => t.id === action.assignments[0]?.techId);
          const newAssignments: typeof action.assignments = [];
          toast.info(`Redid: bulk assigned ${action.techName} (${action.assignments.length})`);
          for (const a of action.assignments) {
            try {
              const res = await fetch('/api/echo-schedule', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: a.date, echo_room_id: a.roomId, echo_tech_id: a.techId, time_block: a.timeBlock })
              });
              if (res.ok) {
                const real = await res.json();
                const room = echoRooms.find(r => r.id === a.roomId);
                setAssignments(prev => [...prev, { ...real, echo_tech: tech, echo_room: room }]);
                newAssignments.push({ ...a, assignmentId: real.id });
              }
            } catch { /* best effort */ }
          }
          action.assignments = newAssignments;
          undoRedo.pushUndo(action);
          break;
        }
      }
    } finally {
      undoingRef.current = false;
    }
  };

  // Handle room reorder (drag and drop)
  const handleRoomReorder = async (category: string, roomIds: string[]) => {
    try {
      const response = await fetch('/api/echo-rooms/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomIds })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to save room order:', error);
      }
    } catch (error) {
      console.error('Error saving room order:', error);
    }
  };

  // Keyboard shortcuts for undo/redo
  const handleUndoRef = useRef(handleUndo);
  const handleRedoRef = useRef(handleRedo);
  handleUndoRef.current = handleUndo;
  handleRedoRef.current = handleRedo;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!canManageTesting) return;
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndoRef.current();
      }
      if ((isMod && e.key === 'z' && e.shiftKey) || (isMod && e.key === 'y')) {
        e.preventDefault();
        handleRedoRef.current();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canManageTesting]);

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
              Testing Schedule
            </h1>
          </div>

          {/* Access Badge */}
          <div className="flex items-center gap-4">
            {canManageTesting ? (
              <span className="px-3 py-1 rounded text-sm font-medium bg-green-100 text-green-700">
                Edit Mode
              </span>
            ) : !user ? (
              <button
                onClick={requestLogin}
                className="px-3 py-1 rounded text-sm font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
              >
                Log in to edit
              </button>
            ) : (
              <span className="px-3 py-1 rounded text-sm font-medium bg-gray-100 text-gray-500">
                View Only
              </span>
            )}

            {canManageTesting && (
              <>
                {/* Undo/Redo */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleUndo}
                    disabled={!undoRedo.canUndo}
                    className="px-2 py-1 rounded text-sm font-medium border transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-white hover:bg-gray-100"
                    style={{ borderColor: colors.border }}
                    title="Undo (Ctrl+Z)"
                  >
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" />
                      </svg>
                      Undo
                    </span>
                  </button>
                  <button
                    onClick={handleRedo}
                    disabled={!undoRedo.canRedo}
                    className="px-2 py-1 rounded text-sm font-medium border transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-white hover:bg-gray-100"
                    style={{ borderColor: colors.border }}
                    title="Redo (Ctrl+Shift+Z)"
                  >
                    <span className="flex items-center gap-1">
                      Redo
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a5 5 0 00-5 5v2M21 10l-4-4M21 10l-4 4" />
                      </svg>
                    </span>
                  </button>
                </div>

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

                <button
                  onClick={handleCopyPreviousWeek}
                  disabled={copyingWeek}
                  className="px-3 py-1 rounded text-sm font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: colors.lightBlue }}
                >
                  {copyingWeek ? 'Copying...' : 'Copy Previous Week'}
                </button>

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

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm mb-4">
          <div className="flex border-b" style={{ borderColor: colors.border }}>
            <button
              onClick={() => setActiveTab('techs')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'techs'
                  ? 'border-current text-[#003D7A]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              style={activeTab === 'techs' ? { color: colors.primaryBlue } : undefined}
            >
              Techs
            </button>
            <button
              onClick={() => setActiveTab('providers')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'providers'
                  ? 'border-current text-[#003D7A]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              style={activeTab === 'providers' ? { color: colors.primaryBlue } : undefined}
            >
              Providers
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'techs' ? (
          <div className="overflow-auto max-h-[calc(100vh-260px)]">
            {loading ? (
              <div className="bg-white rounded-lg shadow-sm p-4 text-center py-8 text-gray-500">
                Loading schedule...
              </div>
            ) : (
              <ScheduleGrid
                dateRange={dateRange}
                echoTechs={echoTechs}
                echoRooms={echoRooms}
                assignments={assignments}
                ptoDays={ptoDays}
                holidays={holidays}
                isAdmin={canManageTesting}
                onCellClick={handleCellClick}
                onPTOClick={handlePTOClick}
                onPTODelete={handleDeletePTO}
                onQuickDelete={handleDeleteAssignment}
                onQuickAssign={handleQuickAssign}
                onBulkAssign={handleBulkAssign}
                onMoveAssignment={handleMoveAssignment}
                collapsedCategories={collapsedCategories}
                onToggleCategory={toggleCategory}
                onRoomReorder={handleRoomReorder}
              />
            )}
          </div>
        ) : (
          <div className="overflow-auto max-h-[calc(100vh-260px)]">
            {providersLoading ? (
              <div className="bg-white rounded-lg shadow-sm p-4 text-center py-8 text-gray-500">
                Loading providers schedule...
              </div>
            ) : (
              <ProvidersScheduleGrid
                weekDates={dateRange}
                assignments={mainAssignments}
                services={mainServices}
                providers={mainProviders}
                isAdmin={canManageTesting}
                onAssignmentChange={fetchProvidersData}
                holidays={holidays}
              />
            )}
          </div>
        )}
      </div>

      {/* Assignment Modal */}
      <EchoAssignmentModal
        isOpen={showAssignmentModal}
        room={selectedRoom}
        date={selectedDate}
        timeBlock={selectedTimeBlock}
        echoTechs={echoTechs}
        currentAssignments={getCurrentAssignments()}
        allAssignments={assignments}
        ptoDays={ptoDays}
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
              Add PTO - {selectedDate}
            </h3>

            <PTOForm
              echoTechs={echoTechs}
              existingPTO={ptoDays.filter(p => p.date === selectedDate)}
              defaultTimeBlock={selectedTimeBlock}
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
  defaultTimeBlock,
  onSubmit,
  onCancel
}: {
  echoTechs: EchoTech[];
  existingPTO: EchoPTO[];
  defaultTimeBlock: 'AM' | 'PM';
  onSubmit: (techId: string, reason: string | null, timeBlock: 'AM' | 'PM' | 'BOTH') => void;
  onCancel: () => void;
}) {
  const [techId, setTechId] = useState('');
  const [reason, setReason] = useState('');
  const [timeBlock, setTimeBlock] = useState<'AM' | 'PM' | 'BOTH'>(defaultTimeBlock);

  // Filter out techs that already have PTO for the selected time block
  const availableTechs = echoTechs.filter(t => {
    if (!t.is_active) return false;
    const techPTO = existingPTO.filter(p => p.echo_tech_id === t.id);
    for (const p of techPTO) {
      // If existing PTO is BOTH, tech is fully covered
      if (p.time_block === 'BOTH') return false;
      // If we're adding BOTH but tech has any existing PTO, skip
      if (timeBlock === 'BOTH' && (p.time_block === 'AM' || p.time_block === 'PM')) return false;
      // If existing matches selected time block, skip
      if (p.time_block === timeBlock) return false;
    }
    return true;
  });

  return (
    <div>
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Time Block</label>
        <div className="flex rounded-lg border border-slate-300 overflow-hidden">
          {(['AM', 'PM', 'BOTH'] as const).map((tb) => (
            <button
              key={tb}
              onClick={() => setTimeBlock(tb)}
              className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                timeBlock === tb
                  ? 'bg-amber-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              } ${tb !== 'AM' ? 'border-l border-slate-300' : ''}`}
            >
              {tb === 'BOTH' ? 'Full Day' : tb}
            </button>
          ))}
        </div>
      </div>

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
          onClick={() => onSubmit(techId, reason || null, timeBlock)}
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
