'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Service, Provider, ScheduleAssignment, AvailabilityViolation, ProviderAvailabilityRule } from '@/lib/types';
import { Holiday, getHolidaysInRange, isInpatientService } from '@/lib/holidays';
import ApplyTemplateModal from './ApplyTemplateModal';
import AlternatingTemplateModal from './AlternatingTemplateModal';
import SaveTemplateModal from './SaveTemplateModal';
import AvailabilityWarningModal from './AvailabilityWarningModal';
import PTOConflictModal from './PTOConflictModal';

// Mount Sinai Colors
const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  lightGray: '#F5F5F5',
  border: '#E5E7EB',
  ptoRed: '#DC2626',
  holidayPurple: '#7C3AED',
  holidayBgLight: '#EDE9FE',
};

type ViewMode = 'service' | 'provider';
type TimeFrame = 'day' | 'week' | 'month';

// Full day services that don't split into AM/PM
const FULL_DAY_SERVICES = ['PTO', 'Nuclear Stress', 'Heart Failure'];

export default function MainCalendar() {
  const [services, setServices] = useState<Service[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  // View controls
  const [viewMode, setViewMode] = useState<ViewMode>('service');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('week');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Provider View filters
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [capabilityFilter, setCapabilityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [selectedCell, setSelectedCell] = useState<{
    serviceId: string;
    date: string;
    timeBlock: string;
  } | null>(null);

  // Holidays
  const [holidays, setHolidays] = useState<Map<string, Holiday>>(new Map());

  // Template modals
  const [showApplyTemplateModal, setShowApplyTemplateModal] = useState(false);
  const [showAlternatingModal, setShowAlternatingModal] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);

  // Provider search in assignment modal
  const [providerSearchQuery, setProviderSearchQuery] = useState('');

  // Availability warning modal
  const [availabilityWarnings, setAvailabilityWarnings] = useState<AvailabilityViolation[]>([]);
  const [pendingAssignment, setPendingAssignment] = useState<{
    providerId: string;
    serviceId: string;
    date: string;
    timeBlock: string;
  } | null>(null);

  // Availability rules for filtering suggestions
  const [availabilityRules, setAvailabilityRules] = useState<ProviderAvailabilityRule[]>([]);

  // PTO conflict modal
  const [ptoConflictModal, setPtoConflictModal] = useState<{
    provider: Provider;
    date: string;
    ptoTimeBlocks: string[];
  } | null>(null);

  // Track overridden conflicts (session only - resets on page refresh)
  const [overriddenConflicts, setOverriddenConflicts] = useState<Set<string>>(new Set());

  // Calculate date range based on time frame
  const dateRange = useMemo(() => {
    const dates: string[] = [];
    const start = new Date(currentDate);

    if (timeFrame === 'day') {
      dates.push(start.toISOString().split('T')[0]);
    } else if (timeFrame === 'week') {
      // Start from Sunday of current week
      const dayOfWeek = start.getDay();
      start.setDate(start.getDate() - dayOfWeek);
      for (let i = 0; i < 7; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        dates.push(date.toISOString().split('T')[0]);
      }
    } else if (timeFrame === 'month') {
      // Get first day of month
      start.setDate(1);
      const month = start.getMonth();
      while (start.getMonth() === month) {
        dates.push(start.toISOString().split('T')[0]);
        start.setDate(start.getDate() + 1);
      }
    }

    return dates;
  }, [currentDate, timeFrame]);

  // Fetch data when date range changes
  useEffect(() => {
    if (dateRange.length > 0) {
      fetchData();
      // Load holidays for the date range
      const holidayMap = getHolidaysInRange(dateRange[0], dateRange[dateRange.length - 1]);
      setHolidays(holidayMap);
    }
  }, [dateRange]);

  // Fetch availability rules for filtering suggestions
  useEffect(() => {
    async function fetchAvailabilityRules() {
      try {
        const response = await fetch('/api/availability/rules');
        const data = await response.json();
        setAvailabilityRules(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error fetching availability rules:', error);
      }
    }
    fetchAvailabilityRules();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [servicesRes, providersRes, assignmentsRes] = await Promise.all([
        fetch('/api/services'),
        fetch('/api/providers'),
        fetch(
          `/api/assignments?startDate=${dateRange[0]}&endDate=${dateRange[dateRange.length - 1]}`
        ),
      ]);

      const servicesData = await servicesRes.json();
      const providersData = await providersRes.json();
      const assignmentsData = await assignmentsRes.json();

      setServices(servicesData);
      setProviders(providersData);
      setAssignments(assignmentsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter providers for Provider View
  const filteredProviders = useMemo(() => {
    return providers.filter((p) => {
      if (roleFilter !== 'all' && p.role !== roleFilter) return false;
      if (capabilityFilter !== 'all' && !p.capabilities.includes(capabilityFilter)) return false;
      if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !p.initials.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [providers, roleFilter, capabilityFilter, searchQuery]);

  // Get unique capabilities for filter dropdown
  const allCapabilities = useMemo(() => {
    const caps = new Set<string>();
    providers.forEach((p) => p.capabilities.forEach((c) => caps.add(c)));
    return Array.from(caps).sort();
  }, [providers]);

  // Get assignments for a specific cell
  const getAssignmentsForCell = (
    serviceId: string,
    date: string,
    timeBlock: string
  ) => {
    return assignments.filter(
      (a) =>
        a.service_id === serviceId &&
        a.date === date &&
        a.time_block === timeBlock
    );
  };

  // Get assignments for a provider on a specific date/time
  const getProviderAssignments = (
    providerId: string,
    date: string,
    timeBlock?: string
  ) => {
    return assignments.filter(
      (a) =>
        a.provider_id === providerId &&
        a.date === date &&
        (timeBlock ? a.time_block === timeBlock : true)
    );
  };

  // Calculate room capacity for Rooms service
  const getRoomCapacity = (date: string, timeBlock: string) => {
    const roomsService = services.find((s) => s.name === 'Rooms');
    if (!roomsService) return { current: 0, max: 14, providers: [] };

    const roomAssignments = getAssignmentsForCell(roomsService.id, date, timeBlock);
    const current = roomAssignments.reduce((sum, a) => sum + (a.room_count || 0), 0);
    const providerInitials = roomAssignments.map((a) => a.provider?.initials).filter(Boolean);

    return { current, max: 14, providers: providerInitials };
  };

  // Get color for room capacity (date-aware for Wed/Thu PM extended limit)
  const getRoomCapacityColor = (current: number, date: string, timeBlock: string) => {
    const dayOfWeek = new Date(date + 'T00:00:00').getDay(); // 0=Sun, 3=Wed, 4=Thu
    const isExtendedDay = (dayOfWeek === 3 || dayOfWeek === 4) && timeBlock === 'PM';
    const maxGreen = isExtendedDay ? 15 : 14;

    if (current < 12) return '#EAB308'; // Yellow - under-staffed
    if (current <= maxGreen) return '#22C55E'; // Green - optimal
    return '#EF4444'; // Red - over capacity
  };

  // Get PTO time blocks for a provider on a specific date
  const getProviderPTOForDate = (providerId: string, date: string): string[] => {
    const ptoAssignments = assignments.filter(a =>
      a.provider_id === providerId &&
      a.date === date &&
      (a.is_pto || services.find(s => s.id === a.service_id)?.name === 'PTO')
    );
    return ptoAssignments.map(a => a.time_block);
  };

  // Get conflicting assignments for a provider who has PTO
  const getConflictingAssignmentsForPTO = (
    providerId: string,
    date: string,
    ptoTimeBlocks: string[]
  ): ScheduleAssignment[] => {
    const timeBlocksToCheck = ptoTimeBlocks.includes('BOTH')
      ? ['AM', 'PM', 'BOTH']
      : [...ptoTimeBlocks, 'BOTH'];

    return assignments.filter(a =>
      a.provider_id === providerId &&
      a.date === date &&
      timeBlocksToCheck.includes(a.time_block) &&
      !a.is_pto &&
      services.find(s => s.id === a.service_id)?.name !== 'PTO'
    );
  };

  // Helper to create override key for PTO conflicts
  const getOverrideKey = (providerId: string, date: string) => `${providerId}-${date}`;

  // Handle override of PTO conflict
  const handleOverrideConflict = (providerId: string, date: string) => {
    setOverriddenConflicts(prev => new Set(prev).add(getOverrideKey(providerId, date)));
    setPtoConflictModal(null);
  };

  // Handle clicking on a provider with PTO conflicts
  const handlePTOConflictClick = (provider: Provider, date: string, ptoTimeBlocks: string[]) => {
    setPtoConflictModal({ provider, date, ptoTimeBlocks });
  };

  // Helper to check if provider has availability restriction for a given service/day/time
  const getProviderAvailability = (providerId: string, serviceId: string, dayOfWeek: number, timeBlock: string) => {
    const rule = availabilityRules.find(r =>
      r.provider_id === providerId &&
      r.service_id === serviceId &&
      r.day_of_week === dayOfWeek &&
      (r.time_block === timeBlock || r.time_block === 'BOTH')
    );
    return rule ? rule.enforcement : null; // null = available, 'warn' = soft warning, 'hard' = blocked
  };

  // Get room suggestions for reaching target
  const getRoomSuggestions = (date: string, timeBlock: string, assignedProviderIds: string[]) => {
    const dayOfWeek = new Date(date + 'T00:00:00').getDay();
    const isExtendedDay = (dayOfWeek === 3 || dayOfWeek === 4) && timeBlock === 'PM';
    const target = isExtendedDay ? 15 : 14;

    // Find the rooms service for this time block
    const roomsServiceName = timeBlock === 'AM' ? 'Rooms AM' : 'Rooms PM';
    const roomsService = services.find(s => s.name === roomsServiceName);
    if (!roomsService) return { needed: 0, target, currentRooms: 0, suggestions: [] };

    const currentAssignments = getAssignmentsForCell(roomsService.id, date, timeBlock);
    const currentRooms = currentAssignments.reduce((sum, a) => sum + (a.room_count || 0), 0);
    const needed = Math.max(0, target - currentRooms);

    if (needed === 0) return { needed: 0, target, currentRooms, suggestions: [] };

    // Get available providers with Rooms capability who aren't assigned and don't have PTO
    // Filter out providers with hard blocks and mark those with soft warnings
    const available = providers
      .filter(p => {
        if (!p.capabilities.includes('Rooms')) return false;
        if (assignedProviderIds.includes(p.id)) return false;
        if (getProviderPTOForDate(p.id, date).some(tb => tb === timeBlock || tb === 'BOTH')) return false;

        // Check availability rules - exclude hard blocks
        const availability = getProviderAvailability(p.id, roomsService.id, dayOfWeek, timeBlock);
        if (availability === 'hard') return false;

        return true;
      })
      .map(p => ({
        ...p,
        hasWarning: getProviderAvailability(p.id, roomsService.id, dayOfWeek, timeBlock) === 'warn'
      }))
      .sort((a, b) => {
        // Sort providers without warnings first, then by room count
        if (a.hasWarning !== b.hasWarning) {
          return a.hasWarning ? 1 : -1;
        }
        return b.default_room_count - a.default_room_count;
      });

    return { needed, target, currentRooms, suggestions: available };
  };

  // Navigation handlers
  const navigatePrevious = () => {
    const newDate = new Date(currentDate);
    if (timeFrame === 'day') newDate.setDate(newDate.getDate() - 1);
    else if (timeFrame === 'week') newDate.setDate(newDate.getDate() - 7);
    else newDate.setMonth(newDate.getMonth() - 1);
    setCurrentDate(newDate);
  };

  const navigateNext = () => {
    const newDate = new Date(currentDate);
    if (timeFrame === 'day') newDate.setDate(newDate.getDate() + 1);
    else if (timeFrame === 'week') newDate.setDate(newDate.getDate() + 7);
    else newDate.setMonth(newDate.getMonth() + 1);
    setCurrentDate(newDate);
  };

  const navigateToday = () => {
    setCurrentDate(new Date());
  };

  // Format helpers
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getDayOfWeek = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const getMonthYear = () => {
    return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const handleCellClick = (
    serviceId: string,
    date: string,
    timeBlock: string
  ) => {
    // Check if date is a holiday
    const holiday = holidays.get(date);
    if (holiday) {
      const service = services.find(s => s.id === serviceId);
      if (!service || !isInpatientService(service.name)) {
        alert(`Cannot schedule on ${holiday.name}. Only Inpatient services (Consults, Burgundy) are allowed on holidays.`);
        return;
      }
    }
    setSelectedCell({ serviceId, date, timeBlock });
  };

  const handleAssignProvider = async (providerId: string) => {
    if (!selectedCell) return;

    const service = services.find((s) => s.id === selectedCell.serviceId);
    const provider = providers.find((p) => p.id === providerId);

    if (!service || !provider) return;

    // Check for PTO conflicts (time-block specific - allows half-day PTO)
    const timeBlocksToCheck = selectedCell.timeBlock === 'BOTH'
      ? ['AM', 'PM', 'BOTH']
      : [selectedCell.timeBlock, 'BOTH'];

    const providerAssignmentsForTimeBlock = assignments.filter(
      (a) =>
        a.provider_id === providerId &&
        a.date === selectedCell.date &&
        timeBlocksToCheck.includes(a.time_block)
    );

    const hasPTOForTimeBlock = providerAssignmentsForTimeBlock.some(
      (a) => a.is_pto || services.find((s) => s.id === a.service_id)?.name === 'PTO'
    );
    const isAssigningPTO = service.name === 'PTO';

    if (hasPTOForTimeBlock && !isAssigningPTO) {
      alert(`${provider.name} has PTO for this time block and cannot be assigned work.`);
      return;
    }

    if (isAssigningPTO && providerAssignmentsForTimeBlock.some((a) => !a.is_pto && services.find((s) => s.id === a.service_id)?.name !== 'PTO')) {
      alert(`${provider.name} has work assignments for this time block. Remove them before assigning PTO.`);
      return;
    }

    if (
      service.required_capability &&
      !provider.capabilities.includes(service.required_capability)
    ) {
      alert(
        `${provider.name} does not have the required capability: ${service.required_capability}`
      );
      return;
    }

    const cellAssignments = getAssignmentsForCell(
      selectedCell.serviceId,
      selectedCell.date,
      selectedCell.timeBlock
    );
    const isAlreadyAssigned = cellAssignments.some(
      (a) => a.provider_id === providerId
    );

    if (isAlreadyAssigned) {
      alert(`${provider.name} is already assigned to this service/time.`);
      return;
    }

    // Check availability rules
    try {
      const availResponse = await fetch('/api/availability/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_id: providerId,
          service_id: selectedCell.serviceId,
          date: selectedCell.date,
          time_block: selectedCell.timeBlock
        })
      });

      const availResult = await availResponse.json();

      if (!availResult.allowed) {
        if (availResult.enforcement === 'hard') {
          alert(`Cannot assign ${provider.name}: ${availResult.reason}`);
          return;
        } else {
          // Show warning modal for soft block
          setAvailabilityWarnings([{
            provider_id: providerId,
            provider_initials: provider.initials,
            date: selectedCell.date,
            time_block: selectedCell.timeBlock,
            service_name: service.name,
            enforcement: 'warn',
            reason: availResult.reason
          }]);
          setPendingAssignment({
            providerId,
            serviceId: selectedCell.serviceId,
            date: selectedCell.date,
            timeBlock: selectedCell.timeBlock
          });
          return;
        }
      }
    } catch (error) {
      console.error('Error checking availability:', error);
      // Continue with assignment if check fails
    }

    try {
      const response = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: selectedCell.serviceId,
          provider_id: providerId,
          date: selectedCell.date,
          time_block: selectedCell.timeBlock,
          room_count: service.requires_rooms ? provider.default_room_count : 0,
          is_pto: service.name === 'PTO',
        }),
      });

      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Error assigning provider:', error);
    }
  };

  // Handle confirmation of assignment despite availability warning
  const handleConfirmAssignment = async () => {
    if (!pendingAssignment) return;

    const service = services.find((s) => s.id === pendingAssignment.serviceId);
    const provider = providers.find((p) => p.id === pendingAssignment.providerId);

    if (!service || !provider) return;

    try {
      const response = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: pendingAssignment.serviceId,
          provider_id: pendingAssignment.providerId,
          date: pendingAssignment.date,
          time_block: pendingAssignment.timeBlock,
          room_count: service.requires_rooms ? provider.default_room_count : 0,
          is_pto: service.name === 'PTO',
          force_override: true
        }),
      });

      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Error assigning provider:', error);
    }

    setAvailabilityWarnings([]);
    setPendingAssignment(null);
    setSelectedCell(null);
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      const response = await fetch(`/api/assignments?id=${assignmentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Error removing assignment:', error);
    }
  };

  // Check if a service is full-day
  const isFullDayService = (serviceName: string) => {
    return FULL_DAY_SERVICES.includes(serviceName);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: colors.lightGray }}>
        <div className="text-xl" style={{ color: colors.primaryBlue }}>Loading calendar...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.lightGray }}>
      {/* Header */}
      <header className="py-4 px-4 shadow-sm" style={{ backgroundColor: colors.primaryBlue }}>
        <div className="max-w-full mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">
                MSW Heart Cardiology Scheduler
              </h1>
              <p className="text-blue-100 mt-1">
                Mount Sinai West - Fuster Heart Hospital
              </p>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2">
              <div className="bg-white/20 rounded-lg p-1 flex">
                <button
                  onClick={() => setViewMode('service')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'service'
                      ? 'bg-white text-blue-900'
                      : 'text-white hover:bg-white/10'
                  }`}
                >
                  Service View
                </button>
                <button
                  onClick={() => setViewMode('provider')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'provider'
                      ? 'bg-white text-blue-900'
                      : 'text-white hover:bg-white/10'
                  }`}
                >
                  Provider View
                </button>
              </div>
              <Link
                href="/admin"
                className="px-4 py-2 rounded-md text-sm font-medium bg-white/20 text-white hover:bg-white/30 transition-colors"
              >
                Admin Panel
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Controls Bar */}
      <div className="bg-white border-b px-4 py-3" style={{ borderColor: colors.border }}>
        <div className="max-w-full mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Time Frame Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium" style={{ color: colors.primaryBlue }}>View:</span>
            <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: colors.border }}>
              {(['day', 'week', 'month'] as TimeFrame[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeFrame(tf)}
                  className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                    timeFrame === tf
                      ? 'text-white'
                      : 'bg-white hover:bg-gray-50'
                  }`}
                  style={timeFrame === tf ? { backgroundColor: colors.lightBlue, color: 'white' } : { color: colors.primaryBlue }}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-3">
            <button
              onClick={navigatePrevious}
              className="px-3 py-2 rounded border hover:bg-gray-50 transition-colors"
              style={{ borderColor: colors.border, color: colors.primaryBlue }}
            >
              ← Previous
            </button>
            <button
              onClick={navigateToday}
              className="px-4 py-2 rounded text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: colors.teal }}
            >
              Today
            </button>
            <button
              onClick={navigateNext}
              className="px-3 py-2 rounded border hover:bg-gray-50 transition-colors"
              style={{ borderColor: colors.border, color: colors.primaryBlue }}
            >
              Next →
            </button>
            <span className="text-lg font-semibold ml-2" style={{ color: colors.primaryBlue }}>
              {getMonthYear()}
            </span>
          </div>

          {/* Template Actions - Show in week view */}
          {timeFrame === 'week' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSaveTemplateModal(true)}
                className="px-3 py-2 rounded text-sm font-medium border hover:bg-gray-50 transition-colors"
                style={{ borderColor: colors.border, color: colors.primaryBlue }}
                title="Save current week as a template"
              >
                Save as Template
              </button>
              <button
                onClick={() => setShowApplyTemplateModal(true)}
                className="px-3 py-2 rounded text-sm font-medium text-white hover:opacity-90 transition-colors"
                style={{ backgroundColor: colors.teal }}
                title="Apply a template to selected dates"
              >
                Apply Template
              </button>
              <button
                onClick={() => setShowAlternatingModal(true)}
                className="px-3 py-2 rounded text-sm font-medium text-white hover:opacity-90 transition-colors"
                style={{ backgroundColor: '#7C3AED' }}
                title="Apply alternating templates (Week A/B)"
              >
                Alternating
              </button>
            </div>
          )}

          {/* Provider View Filters */}
          {viewMode === 'provider' && (
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="text"
                placeholder="Search providers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-2 border rounded text-sm w-48"
                style={{ borderColor: colors.border }}
              />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 border rounded text-sm"
                style={{ borderColor: colors.border }}
              >
                <option value="all">All Roles</option>
                <option value="attending">Attending</option>
                <option value="fellow">Fellow</option>
              </select>
              <select
                value={capabilityFilter}
                onChange={(e) => setCapabilityFilter(e.target.value)}
                className="px-3 py-2 border rounded text-sm"
                style={{ borderColor: colors.border }}
              >
                <option value="all">All Capabilities</option>
                {allCapabilities.map((cap) => (
                  <option key={cap} value={cap}>{cap}</option>
                ))}
              </select>
            </div>
          )}

          {/* Link to Provider Directory */}
          <Link
            href="/providers"
            className="px-4 py-2 rounded text-sm font-medium text-white hover:opacity-90 transition-colors"
            style={{ backgroundColor: colors.lightBlue }}
          >
            Provider Directory →
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <main className="p-4">
        {viewMode === 'service' ? (
          <ServiceView
            services={services}
            providers={providers}
            assignments={assignments}
            dateRange={dateRange}
            timeFrame={timeFrame}
            getAssignmentsForCell={getAssignmentsForCell}
            getRoomCapacity={getRoomCapacity}
            getRoomCapacityColor={getRoomCapacityColor}
            formatDate={formatDate}
            getDayOfWeek={getDayOfWeek}
            handleCellClick={handleCellClick}
            isFullDayService={isFullDayService}
            colors={colors}
            holidays={holidays}
            getProviderPTOForDate={getProviderPTOForDate}
            getRoomSuggestions={getRoomSuggestions}
            getConflictingAssignmentsForPTO={getConflictingAssignmentsForPTO}
            overriddenConflicts={overriddenConflicts}
            getOverrideKey={getOverrideKey}
            onPTOConflictClick={handlePTOConflictClick}
          />
        ) : (
          <ProviderView
            providers={filteredProviders}
            services={services}
            assignments={assignments}
            dateRange={dateRange}
            timeFrame={timeFrame}
            getProviderAssignments={getProviderAssignments}
            formatDate={formatDate}
            getDayOfWeek={getDayOfWeek}
            isFullDayService={isFullDayService}
            colors={colors}
            holidays={holidays}
          />
        )}
      </main>

      {/* Provider Assignment Modal */}
      {selectedCell && (() => {
        const service = services.find((s) => s.id === selectedCell.serviceId);
        const cellAssignments = getAssignmentsForCell(
          selectedCell.serviceId,
          selectedCell.date,
          selectedCell.timeBlock
        );
        const availableProviders = providers.filter((p) => {
          const hasCapability =
            !service?.required_capability ||
            p.capabilities.includes(service.required_capability);
          const notAlreadyAssigned = !cellAssignments.some(
            (a) => a.provider_id === p.id
          );
          return hasCapability && notAlreadyAssigned;
        });

        return (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-30"
            onClick={() => { setSelectedCell(null); setProviderSearchQuery(''); }}
          >
            <div
              className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold mb-2" style={{ color: colors.primaryBlue }}>
                Manage Assignments
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                <span className="font-semibold">{service?.name}</span> |{' '}
                {formatDate(selectedCell.date)} | {selectedCell.timeBlock}
              </p>

              {cellAssignments.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold mb-2 text-sm">Currently Assigned:</h3>
                  <div className="space-y-2">
                    {cellAssignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="flex items-center justify-between rounded px-3 py-2"
                        style={{ backgroundColor: `${colors.lightBlue}15`, border: `1px solid ${colors.lightBlue}40` }}
                      >
                        <div>
                          <span className="font-medium">
                            {assignment.provider?.initials} - {assignment.provider?.name}
                          </span>
                          {service?.requires_rooms && (
                            <span className="text-sm ml-2" style={{ color: colors.teal }}>
                              ({assignment.room_count} rooms)
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveAssignment(assignment.id)}
                          className="font-bold px-2 hover:opacity-70"
                          style={{ color: colors.ptoRed }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  {service?.requires_rooms && (
                    <div className="mt-2 text-sm font-semibold" style={{ color: colors.teal }}>
                      Total Rooms: {cellAssignments.reduce((sum, a) => sum + (a.room_count || 0), 0)}
                    </div>
                  )}
                </div>
              )}

              {/* Room Suggestions Section */}
              {service?.requires_rooms && (() => {
                const assignedIds = cellAssignments.map(a => a.provider_id);
                const suggestions = getRoomSuggestions(selectedCell.date, selectedCell.timeBlock, assignedIds);

                if (suggestions.needed > 0) {
                  return (
                    <div className="mb-4 p-3 rounded" style={{ backgroundColor: '#FEF3C7', border: '1px solid #F59E0B' }}>
                      <div className="font-semibold text-sm mb-2" style={{ color: '#92400E' }}>
                        💡 Need {suggestions.needed} more rooms to reach {suggestions.target}
                      </div>
                      {suggestions.suggestions.length > 0 ? (
                        <div className="text-xs" style={{ color: '#92400E' }}>
                          <span className="font-medium">Suggested providers: </span>
                          {suggestions.suggestions.slice(0, 5).map((p, i) => (
                            <span
                              key={p.id}
                              style={{ color: p.hasWarning ? '#F59E0B' : '#92400E' }}
                              title={p.hasWarning ? 'Has availability warning for this time' : undefined}
                            >
                              {i > 0 && ', '}
                              {p.initials} ({p.default_room_count}){p.hasWarning ? ' ⚠️' : ''}
                            </span>
                          ))}
                          {suggestions.suggestions.length > 5 && (
                            <span className="text-gray-500"> +{suggestions.suggestions.length - 5} more</span>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs" style={{ color: '#92400E' }}>
                          No available providers with Rooms capability
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              })()}

              {availableProviders.length > 0 ? (
                <div>
                  <h3 className="font-semibold mb-2 text-sm">Add Provider:</h3>
                  <input
                    type="text"
                    placeholder="Search by name or initials..."
                    value={providerSearchQuery}
                    onChange={(e) => setProviderSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 border rounded mb-3 text-sm"
                    style={{ borderColor: colors.border }}
                  />
                  <div className="grid grid-cols-2 gap-2 max-h-60 overflow-auto">
                    {availableProviders
                      .filter((p) =>
                        providerSearchQuery === '' ||
                        p.name.toLowerCase().includes(providerSearchQuery.toLowerCase()) ||
                        p.initials.toLowerCase().includes(providerSearchQuery.toLowerCase())
                      )
                      .map((provider) => {
                        const providerPTO = getProviderPTOForDate(provider.id, selectedCell.date);
                        const hasPTOToday = providerPTO.length > 0;
                        const ptoLabel = providerPTO.includes('BOTH') ? 'All Day PTO' :
                          providerPTO.map(tb => `${tb} PTO`).join(', ');

                        // Check availability rules for this provider/service/time
                        const dayOfWeek = new Date(selectedCell.date + 'T00:00:00').getDay();
                        const availability = getProviderAvailability(
                          provider.id,
                          selectedCell.serviceId,
                          dayOfWeek,
                          selectedCell.timeBlock
                        );
                        const hasAvailabilityWarning = availability === 'warn';
                        const hasHardBlock = availability === 'hard';

                        // Determine border and background color
                        let borderColor = colors.border;
                        let bgColor = undefined;
                        if (hasHardBlock) {
                          borderColor = colors.ptoRed;
                          bgColor = `${colors.ptoRed}15`;
                        } else if (hasAvailabilityWarning) {
                          borderColor = '#F59E0B';
                          bgColor = '#FEF3C720';
                        } else if (hasPTOToday) {
                          borderColor = colors.ptoRed;
                          bgColor = `${colors.ptoRed}08`;
                        }

                        return (
                          <button
                            key={provider.id}
                            onClick={() => handleAssignProvider(provider.id)}
                            className="text-left p-3 border rounded transition-colors hover:shadow-md"
                            style={{
                              borderColor: borderColor,
                              backgroundColor: bgColor,
                              opacity: hasHardBlock ? 0.6 : 1
                            }}
                            disabled={hasHardBlock}
                            title={hasHardBlock ? 'Provider has a hard block for this time' : undefined}
                          >
                            <div className="font-semibold" style={{ color: colors.primaryBlue }}>
                              {provider.initials}
                              {hasHardBlock && <span className="ml-1 text-red-600">🚫</span>}
                            </div>
                            <div className="text-sm text-gray-600">{provider.name}</div>
                            {service?.requires_rooms && (
                              <div className="text-xs" style={{ color: colors.teal }}>
                                {provider.default_room_count} rooms
                              </div>
                            )}
                            {hasPTOToday && (
                              <div className="text-xs mt-1 font-medium" style={{ color: colors.ptoRed }}>
                                ⚠️ {ptoLabel}
                              </div>
                            )}
                            {hasAvailabilityWarning && !hasPTOToday && (
                              <div className="text-xs mt-1 font-medium" style={{ color: '#F59E0B' }}>
                                ⚠️ Availability Warning
                              </div>
                            )}
                            {hasHardBlock && (
                              <div className="text-xs mt-1 font-medium" style={{ color: colors.ptoRed }}>
                                🚫 Blocked
                              </div>
                            )}
                          </button>
                        );
                      })}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  {cellAssignments.length > 0
                    ? 'All qualified providers have been assigned.'
                    : 'No providers available with the required capability.'}
                </p>
              )}

              <button
                onClick={() => { setSelectedCell(null); setProviderSearchQuery(''); }}
                className="mt-4 px-4 py-2 rounded w-full text-white hover:opacity-90"
                style={{ backgroundColor: colors.primaryBlue }}
              >
                Done
              </button>
            </div>
          </div>
        );
      })()}

      {/* Template Modals */}
      <ApplyTemplateModal
        isOpen={showApplyTemplateModal}
        onClose={() => setShowApplyTemplateModal(false)}
        onApply={(result) => {
          fetchData();
          alert(`Template applied! Created ${result.created} assignments.`);
        }}
        defaultStartDate={dateRange[0]}
        defaultEndDate={dateRange[dateRange.length - 1]}
      />

      <AlternatingTemplateModal
        isOpen={showAlternatingModal}
        onClose={() => setShowAlternatingModal(false)}
        onApply={(result) => {
          fetchData();
          alert(`Alternating templates applied! Created ${result.created} assignments.`);
        }}
      />

      <SaveTemplateModal
        isOpen={showSaveTemplateModal}
        onClose={() => setShowSaveTemplateModal(false)}
        onSave={(result) => {
          alert(`Template "${result.template.name}" saved with ${result.sourceWeek.assignmentCount} assignments!`);
        }}
        weekStartDate={dateRange[0]}
      />

      {/* Availability Warning Modal */}
      {availabilityWarnings.length > 0 && (
        <AvailabilityWarningModal
          warnings={availabilityWarnings}
          onConfirm={handleConfirmAssignment}
          onCancel={() => {
            setAvailabilityWarnings([]);
            setPendingAssignment(null);
          }}
        />
      )}

      {/* PTO Conflict Modal */}
      {ptoConflictModal && (
        <PTOConflictModal
          provider={ptoConflictModal.provider}
          date={ptoConflictModal.date}
          ptoTimeBlocks={ptoConflictModal.ptoTimeBlocks}
          conflictingAssignments={getConflictingAssignmentsForPTO(
            ptoConflictModal.provider.id,
            ptoConflictModal.date,
            ptoConflictModal.ptoTimeBlocks
          )}
          onRemoveAssignment={async (assignmentId) => {
            await handleRemoveAssignment(assignmentId);
            // Check if there are still conflicts
            const remaining = getConflictingAssignmentsForPTO(
              ptoConflictModal.provider.id,
              ptoConflictModal.date,
              ptoConflictModal.ptoTimeBlocks
            ).filter(a => a.id !== assignmentId);
            if (remaining.length === 0) {
              setPtoConflictModal(null);
            }
          }}
          onOverrideAll={() => handleOverrideConflict(ptoConflictModal.provider.id, ptoConflictModal.date)}
          onClose={() => setPtoConflictModal(null)}
        />
      )}

      {/* Footer */}
      <footer className="py-4 px-4 border-t mt-8" style={{ borderColor: colors.border }}>
        <div className="max-w-full mx-auto text-center text-sm text-gray-500">
          MSW Heart Cardiology Scheduler | Mount Sinai West
        </div>
      </footer>
    </div>
  );
}

// Service View Component
interface ServiceViewProps {
  services: Service[];
  providers: Provider[];
  assignments: ScheduleAssignment[];
  dateRange: string[];
  timeFrame: TimeFrame;
  getAssignmentsForCell: (serviceId: string, date: string, timeBlock: string) => ScheduleAssignment[];
  getRoomCapacity: (date: string, timeBlock: string) => { current: number; max: number; providers: (string | undefined)[] };
  getRoomCapacityColor: (current: number, date: string, timeBlock: string) => string;
  formatDate: (dateStr: string) => string;
  getDayOfWeek: (dateStr: string) => string;
  handleCellClick: (serviceId: string, date: string, timeBlock: string) => void;
  isFullDayService: (serviceName: string) => boolean;
  colors: typeof colors;
  holidays: Map<string, Holiday>;
  getProviderPTOForDate: (providerId: string, date: string) => string[];
  getRoomSuggestions: (date: string, timeBlock: string, assignedProviderIds: string[]) => {
    needed: number;
    target: number;
    currentRooms: number;
    suggestions: (Provider & { hasWarning: boolean })[];
  };
  getConflictingAssignmentsForPTO: (providerId: string, date: string, ptoTimeBlocks: string[]) => ScheduleAssignment[];
  overriddenConflicts: Set<string>;
  getOverrideKey: (providerId: string, date: string) => string;
  onPTOConflictClick: (provider: Provider, date: string, ptoTimeBlocks: string[]) => void;
}

// Service grouping configuration
interface ServiceRowConfig {
  type: 'service' | 'group-header';
  name: string;
  serviceId?: string;
  timeBlock?: 'AM' | 'PM' | 'BOTH';
  indented?: boolean;
  isRooms?: boolean;
}

function ServiceView({
  services,
  providers,
  dateRange,
  timeFrame,
  getAssignmentsForCell,
  formatDate,
  getDayOfWeek,
  handleCellClick,
  colors,
  holidays,
  getProviderPTOForDate,
  getRoomSuggestions,
  getConflictingAssignmentsForPTO,
  overriddenConflicts,
  getOverrideKey,
  onPTOConflictClick,
}: ServiceViewProps) {
  // Helper to find service by name
  const findService = (name: string) => services.find((s) => s.name === name);

  // Helper to get room capacity for a specific service
  const getRoomCapacityForService = (serviceId: string, date: string, timeBlock: string) => {
    const roomAssignments = getAssignmentsForCell(serviceId, date, timeBlock);
    const current = roomAssignments.reduce((sum, a) => sum + (a.room_count || 0), 0);
    const providerInitials = roomAssignments.map((a) => a.provider?.initials).filter(Boolean);
    return { current, max: 14, providers: providerInitials };
  };

  // Helper to get room capacity background color (date-aware for Wed/Thu PM)
  const getRoomCapacityBgColor = (current: number, date: string, timeBlock: string) => {
    const dayOfWeek = new Date(date + 'T00:00:00').getDay();
    const isExtendedDay = (dayOfWeek === 3 || dayOfWeek === 4) && timeBlock === 'PM';
    const maxGreen = isExtendedDay ? 15 : 14;

    if (current === 0) return '#F9FAFB'; // Light gray - no coverage
    if (current < 12) return '#FEF3C7'; // Light yellow - under-staffed
    if (current <= maxGreen) return '#D1FAE5'; // Light green - optimal
    return '#FEE2E2'; // Light red - over capacity
  };

  // Build the ordered list of rows for the service view
  // Database has services with AM/PM suffixes: "Echo TTE AM", "Rooms AM", etc.
  const buildServiceRows = (): ServiceRowConfig[] => {
    const rows: ServiceRowConfig[] = [];

    // 1. PTO (single row, no group)
    const ptoService = findService('PTO');
    if (ptoService) {
      rows.push({ type: 'service', name: 'PTO', serviceId: ptoService.id, timeBlock: 'BOTH' });
    }
 // 2. INPATIENT group (with Consults and Burgundy as separate services)
    const consultsService = findService('Consults');
    const burgundyService = findService('Burgundy');

    if (consultsService || burgundyService) {
      rows.push({ type: 'group-header', name: 'INPATIENT' });

      if (burgundyService) {
        rows.push({
          type: 'service',
          name: 'Burgundy',
          serviceId: burgundyService.id,
          timeBlock: 'AM',
          indented: true
        });
      }

      if (consultsService) {
        rows.push({
          type: 'service',
          name: 'Consults',
          serviceId: consultsService.id,
          timeBlock: 'AM',
          indented: true
        });
      }
    }

    // 3. Fourth Floor Echo Lab (single row, no group)
    const fourthFloorService = findService('Fourth Floor Echo Lab');
    if (fourthFloorService) {
      rows.push({ type: 'service', name: 'Fourth Floor Echo Lab', serviceId: fourthFloorService.id, timeBlock: fourthFloorService.time_block as 'AM' | 'PM' | 'BOTH' });
    }

    // 4. CVI TESTING group
    rows.push({ type: 'group-header', name: 'CVI TESTING' });

    // Echo TTE AM/PM - database has separate services "Echo TTE AM" and "Echo TTE PM"
    const echoTTEAMService = findService('Echo TTE AM');
    if (echoTTEAMService) {
      rows.push({ type: 'service', name: 'Echo TTE AM', serviceId: echoTTEAMService.id, timeBlock: 'AM', indented: true });
    }
    const echoTTEPMService = findService('Echo TTE PM');
    if (echoTTEPMService) {
      rows.push({ type: 'service', name: 'Echo TTE PM', serviceId: echoTTEPMService.id, timeBlock: 'PM', indented: true });
    }

    // Stress Echo AM/PM - database has separate services
    const stressEchoAMService = findService('Stress Echo AM');
    if (stressEchoAMService) {
      rows.push({ type: 'service', name: 'Stress Echo AM', serviceId: stressEchoAMService.id, timeBlock: 'AM', indented: true });
    }
    const stressEchoPMService = findService('Stress Echo PM');
    if (stressEchoPMService) {
      rows.push({ type: 'service', name: 'Stress Echo PM', serviceId: stressEchoPMService.id, timeBlock: 'PM', indented: true });
    }

    // Nuclear Stress
    const nuclearStressService = findService('Nuclear Stress');
    if (nuclearStressService) {
      rows.push({ type: 'service', name: 'Nuclear Stress', serviceId: nuclearStressService.id, timeBlock: nuclearStressService.time_block as 'AM' | 'PM' | 'BOTH', indented: true });
    }

    // Nuclear
    const nuclearService = findService('Nuclear');
    if (nuclearService) {
      rows.push({ type: 'service', name: 'Nuclear', serviceId: nuclearService.id, timeBlock: nuclearService.time_block as 'AM' | 'PM' | 'BOTH', indented: true });
    }

    // 5. ROOMS group
    rows.push({ type: 'group-header', name: 'ROOMS' });

    // Rooms AM/PM - database has separate services "Rooms AM" and "Rooms PM"
    const roomsAMService = findService('Rooms AM');
    if (roomsAMService) {
      rows.push({ type: 'service', name: 'Rooms AM', serviceId: roomsAMService.id, timeBlock: 'AM', indented: true, isRooms: true });
    }
    const roomsPMService = findService('Rooms PM');
    if (roomsPMService) {
      rows.push({ type: 'service', name: 'Rooms PM', serviceId: roomsPMService.id, timeBlock: 'PM', indented: true, isRooms: true });
    }

    // 6. Precepting (single row, no group)
    const preceptingService = findService('Precepting');
    if (preceptingService) {
      rows.push({ type: 'service', name: 'Precepting', serviceId: preceptingService.id, timeBlock: preceptingService.time_block as 'AM' | 'PM' | 'BOTH' });
    }

    // 7. ADMINISTRATIVE group
    rows.push({ type: 'group-header', name: 'ADMINISTRATIVE' });

    // Admin AM/PM - database has separate services
    const adminAMService = findService('Admin AM');
    if (adminAMService) {
      rows.push({ type: 'service', name: 'Admin AM', serviceId: adminAMService.id, timeBlock: 'AM', indented: true });
    }
    const adminPMService = findService('Admin PM');
    if (adminPMService) {
      rows.push({ type: 'service', name: 'Admin PM', serviceId: adminPMService.id, timeBlock: 'PM', indented: true });
    }

    // 8. OFFSITES group
    rows.push({ type: 'group-header', name: 'OFFSITES' });

    // Offsites AM/PM - database has separate services
    const offsitesAMService = findService('Offsites AM');
    if (offsitesAMService) {
      rows.push({ type: 'service', name: 'Offsites AM', serviceId: offsitesAMService.id, timeBlock: 'AM', indented: true });
    }
    const offsitesPMService = findService('Offsites PM');
    if (offsitesPMService) {
      rows.push({ type: 'service', name: 'Offsites PM', serviceId: offsitesPMService.id, timeBlock: 'PM', indented: true });
    }

    return rows;
  };

  const serviceRows = buildServiceRows();

  // Render a cell for a service row
  const renderCell = (row: ServiceRowConfig, date: string) => {
    if (!row.serviceId || !row.timeBlock) return null;

    const cellAssignments = getAssignmentsForCell(row.serviceId, date, row.timeBlock);
    const isPTO = row.name === 'PTO';
    const holiday = holidays.get(date);
    const isInpatient = isInpatientService(row.name);

    // For holidays on non-inpatient services, show "CLOSED"
    if (holiday && !isInpatient) {
      return (
        <td
          key={date}
          className="border px-2 py-2 text-center"
          style={{ borderColor: colors.border, backgroundColor: colors.holidayBgLight }}
        >
          <div className="text-xs font-medium" style={{ color: colors.holidayPurple }}>
            CLOSED
          </div>
        </td>
      );
    }

    // Special handling for Rooms rows (also closed on holidays)
    if (row.isRooms) {
      if (holiday) {
        return (
          <td
            key={date}
            className="border px-2 py-2 text-center"
            style={{ borderColor: colors.border, backgroundColor: colors.holidayBgLight }}
          >
            <div className="text-xs font-medium" style={{ color: colors.holidayPurple }}>
              CLOSED
            </div>
          </td>
        );
      }

      const { current, max, providers: providerInitials } = getRoomCapacityForService(row.serviceId, date, row.timeBlock);
      const bgColor = getRoomCapacityBgColor(current, date, row.timeBlock);
      // Date-aware text color for Wed/Thu PM extended limit
      const dayOfWeek = new Date(date + 'T00:00:00').getDay();
      const isExtendedDay = (dayOfWeek === 3 || dayOfWeek === 4) && row.timeBlock === 'PM';
      const maxGreen = isExtendedDay ? 15 : 14;
      const textColor = current === 0 ? '#9CA3AF' : current < 12 ? '#D97706' : current <= maxGreen ? '#059669' : '#DC2626';

      // Get room suggestions if under target
      const cellAssignments = getAssignmentsForCell(row.serviceId, date, row.timeBlock);
      const assignedIds = cellAssignments.map(a => a.provider_id);
      const suggestions = getRoomSuggestions(date, row.timeBlock, assignedIds);

      return (
        <td
          key={date}
          className="border px-1 py-1 cursor-pointer hover:opacity-80 transition-colors text-center"
          style={{ borderColor: colors.border, backgroundColor: bgColor }}
          onClick={() => handleCellClick(row.serviceId!, date, row.timeBlock!)}
        >
          <div className="text-xs font-medium" style={{ color: colors.primaryBlue }}>
            {providerInitials.length > 0 ? providerInitials.join(', ') : '-'}
          </div>
          <div className="text-xs font-semibold" style={{ color: textColor }}>
            ({current}/{maxGreen})
          </div>
          {suggestions.needed > 0 && current > 0 && (
            <div className="text-[10px] mt-0.5" style={{ color: '#92400E' }}>
              +{suggestions.suggestions.slice(0, 2).map(p => (
                <span key={p.id} style={{ color: p.hasWarning ? '#F59E0B' : '#92400E' }}>
                  {p.initials}({p.default_room_count}){p.hasWarning ? '!' : ''}
                </span>
              )).reduce((prev, curr, i) => i === 0 ? [curr] : [...prev, ', ', curr], [] as React.ReactNode[])}
            </div>
          )}
        </td>
      );
    }

    // Normal cell rendering (with holiday background for inpatient services on holidays)
    const bgStyle = holiday && isInpatient ? colors.holidayBgLight : undefined;

    return (
      <td
        key={date}
        className="border px-2 py-2 cursor-pointer hover:bg-blue-50 transition-colors text-center"
        style={{ borderColor: colors.border, backgroundColor: bgStyle }}
        onClick={() => handleCellClick(row.serviceId!, date, row.timeBlock!)}
      >
        {cellAssignments.length > 0 ? (
          <div className="text-xs font-medium">
            {cellAssignments.map((a, idx) => {
              const providerPTO = a.provider?.id ? getProviderPTOForDate(a.provider.id, date) : [];
              const hasPTOToday = providerPTO.length > 0;
              const ptoTooltip = hasPTOToday ?
                (providerPTO.includes('BOTH') ? 'All Day PTO' : providerPTO.map(tb => `${tb} PTO`).join(', ')) : '';

              // For PTO row: check if provider has conflicts in other services
              if (isPTO && a.provider) {
                const conflicts = getConflictingAssignmentsForPTO(a.provider.id, date, providerPTO.length > 0 ? providerPTO : [row.timeBlock!]);
                const isOverridden = overriddenConflicts.has(getOverrideKey(a.provider.id, date));
                const hasActiveConflicts = conflicts.length > 0 && !isOverridden;

                return (
                  <span key={a.id}>
                    {idx > 0 && ', '}
                    <span
                      onClick={(e) => {
                        if (hasActiveConflicts) {
                          e.stopPropagation();
                          const provider = providers.find(p => p.id === a.provider_id);
                          if (provider) {
                            onPTOConflictClick(provider, date, providerPTO.length > 0 ? providerPTO : [row.timeBlock!]);
                          }
                        }
                      }}
                      style={{
                        color: colors.ptoRed,
                        backgroundColor: hasActiveConflicts ? `${colors.ptoRed}20` : undefined,
                        padding: hasActiveConflicts ? '1px 3px' : undefined,
                        borderRadius: hasActiveConflicts ? '2px' : undefined,
                        cursor: hasActiveConflicts ? 'pointer' : 'default',
                        textDecoration: hasActiveConflicts ? 'underline' : 'none',
                      }}
                      title={hasActiveConflicts ? `Click to view ${conflicts.length} conflict(s)` : undefined}
                    >
                      {a.provider?.initials}
                      {hasActiveConflicts && <span style={{ color: colors.ptoRed }}>*</span>}
                    </span>
                  </span>
                );
              }

              // For non-PTO rows: check if provider has PTO conflicts
              const conflicts = hasPTOToday && a.provider ? getConflictingAssignmentsForPTO(a.provider.id, date, providerPTO) : [];
              const isOverridden = a.provider ? overriddenConflicts.has(getOverrideKey(a.provider.id, date)) : false;
              const hasActiveConflicts = hasPTOToday && conflicts.length > 0 && !isOverridden;

              return (
                <span key={a.id}>
                  {idx > 0 && ', '}
                  <span
                    style={{
                      color: isPTO ? colors.ptoRed : colors.primaryBlue,
                      backgroundColor: hasActiveConflicts ? `${colors.ptoRed}20` : undefined,
                      padding: hasActiveConflicts ? '1px 3px' : undefined,
                      borderRadius: hasActiveConflicts ? '2px' : undefined,
                    }}
                    title={hasPTOToday ? ptoTooltip : undefined}
                  >
                    {a.provider?.initials}
                    {hasActiveConflicts && <span style={{ color: colors.ptoRed }}>*</span>}
                  </span>
                </span>
              );
            })}
          </div>
        ) : (
          <div className="text-gray-400 text-xs">-</div>
        )}
      </td>
    );
  };

  // Render group header row
  const renderGroupHeader = (name: string, colSpan: number) => (
    <tr key={`group-${name}`}>
      <td
        colSpan={colSpan}
        className="px-3 py-2 font-bold text-sm uppercase tracking-wide"
        style={{
          backgroundColor: '#E6F2FF',
          borderTop: `2px solid ${colors.lightBlue}`,
          borderBottom: `1px solid ${colors.lightBlue}`,
          borderLeft: `1px solid ${colors.border}`,
          borderRight: `1px solid ${colors.border}`,
          color: colors.primaryBlue,
          letterSpacing: '0.5px',
        }}
      >
        {name}
      </td>
    </tr>
  );

  // Render service row
  const renderServiceRow = (row: ServiceRowConfig, dates: string[]) => {
    if (!row.serviceId) return null;

    return (
      <tr key={`${row.name}-${row.timeBlock}`} className="hover:bg-gray-50">
        <td
          className="sticky left-0 z-10 border text-sm"
          style={{
            borderColor: colors.border,
            borderRight: `2px solid ${colors.border}`,
            backgroundColor: '#F9FAFB',
            color: '#1F2937',
            paddingLeft: row.indented ? '24px' : '12px',
            paddingRight: '12px',
            paddingTop: '12px',
            paddingBottom: '12px',
            fontWeight: row.indented ? 'normal' : 500,
            width: '220px',
          }}
        >
          {row.name}
        </td>
        {dates.map((date) => renderCell(row, date))}
      </tr>
    );
  };

  if (timeFrame === 'day') {
    // Day View: Services as rows, AM/PM as columns
    const date = dateRange[0];

    return (
      <div className="bg-white rounded-lg shadow overflow-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr>
              <th
                className="sticky left-0 z-20 border px-3 py-3 text-left font-semibold text-sm"
                style={{
                  backgroundColor: colors.lightGray,
                  borderColor: colors.border,
                  borderRight: `2px solid ${colors.border}`,
                  color: colors.primaryBlue,
                  width: '220px',
                }}
              >
                Service
              </th>
              <th
                className="border px-4 py-3 text-center font-semibold text-sm min-w-[200px]"
                style={{ backgroundColor: colors.lightGray, borderColor: colors.border, color: colors.primaryBlue }}
              >
                AM
              </th>
              <th
                className="border px-4 py-3 text-center font-semibold text-sm min-w-[200px]"
                style={{ backgroundColor: colors.lightGray, borderColor: colors.border, color: colors.primaryBlue }}
              >
                PM
              </th>
            </tr>
          </thead>
          <tbody>
            {serviceRows.map((row) => {
              if (row.type === 'group-header') {
                return renderGroupHeader(row.name, 3);
              }

              if (!row.serviceId) return null;

              // For day view, we need to handle AM/PM columns differently
              const isAMRow = row.timeBlock === 'AM' || row.name.endsWith('AM');
              const isPMRow = row.timeBlock === 'PM' || row.name.endsWith('PM');
              const isFullDay = row.timeBlock === 'BOTH';

              if (isFullDay) {
                const cellAssignments = getAssignmentsForCell(row.serviceId, date, 'BOTH');
                const isPTO = row.name === 'PTO';

                return (
                  <tr key={row.name} className="hover:bg-gray-50">
                    <td
                      className="sticky left-0 z-10 border text-sm"
                      style={{
                        borderColor: colors.border,
                        borderRight: `2px solid ${colors.border}`,
                        backgroundColor: '#F9FAFB',
                        color: '#1F2937',
                        paddingLeft: row.indented ? '24px' : '12px',
                        paddingRight: '12px',
                        paddingTop: '12px',
                        paddingBottom: '12px',
                        fontWeight: row.indented ? 'normal' : 500,
                      }}
                    >
                      {row.name}
                    </td>
                    <td
                      colSpan={2}
                      className="border px-2 py-2 cursor-pointer hover:bg-blue-50 transition-colors text-center"
                      style={{ borderColor: colors.border }}
                      onClick={() => handleCellClick(row.serviceId!, date, 'BOTH')}
                    >
                      {cellAssignments.length > 0 ? (
                        <div className="text-xs font-medium" style={{ color: isPTO ? colors.ptoRed : colors.primaryBlue }}>
                          {cellAssignments.map((a) => a.provider?.initials).join(', ')}
                        </div>
                      ) : (
                        <div className="text-gray-400 text-xs">-</div>
                      )}
                    </td>
                  </tr>
                );
              }

              // For AM/PM specific rows in day view
              const cellAssignments = getAssignmentsForCell(row.serviceId, date, row.timeBlock!);

              // Rooms handling for day view
              if (row.isRooms) {
                const { current, max, providers } = getRoomCapacityForService(row.serviceId, date, row.timeBlock!);
                const bgColor = getRoomCapacityBgColor(current, date, row.timeBlock!);
                // Date-aware text color for Wed/Thu PM extended limit
                const dayOfWeek = new Date(date + 'T00:00:00').getDay();
                const isExtendedDay = (dayOfWeek === 3 || dayOfWeek === 4) && row.timeBlock === 'PM';
                const maxGreen = isExtendedDay ? 15 : 14;
                const textColor = current === 0 ? '#9CA3AF' : current < 12 ? '#D97706' : current <= maxGreen ? '#059669' : '#DC2626';

                return (
                  <tr key={row.name} className="hover:bg-gray-50">
                    <td
                      className="sticky left-0 z-10 border text-sm"
                      style={{
                        borderColor: colors.border,
                        borderRight: `2px solid ${colors.border}`,
                        backgroundColor: '#F9FAFB',
                        color: '#1F2937',
                        paddingLeft: '24px',
                        paddingRight: '12px',
                        paddingTop: '12px',
                        paddingBottom: '12px',
                        fontWeight: 'normal',
                      }}
                    >
                      {row.name}
                    </td>
                    {isAMRow ? (
                      <>
                        <td
                          className="border px-2 py-2 cursor-pointer hover:opacity-80 transition-colors text-center"
                          style={{ borderColor: colors.border, backgroundColor: bgColor }}
                          onClick={() => handleCellClick(row.serviceId!, date, 'AM')}
                        >
                          <div className="text-xs font-medium" style={{ color: colors.primaryBlue }}>
                            {providers.length > 0 ? providers.join(', ') : '-'}
                          </div>
                          <div className="text-xs font-semibold" style={{ color: textColor }}>
                            ({current}/{max})
                          </div>
                        </td>
                        <td className="border bg-gray-100" style={{ borderColor: colors.border }}></td>
                      </>
                    ) : (
                      <>
                        <td className="border bg-gray-100" style={{ borderColor: colors.border }}></td>
                        <td
                          className="border px-2 py-2 cursor-pointer hover:opacity-80 transition-colors text-center"
                          style={{ borderColor: colors.border, backgroundColor: bgColor }}
                          onClick={() => handleCellClick(row.serviceId!, date, 'PM')}
                        >
                          <div className="text-xs font-medium" style={{ color: colors.primaryBlue }}>
                            {providers.length > 0 ? providers.join(', ') : '-'}
                          </div>
                          <div className="text-xs font-semibold" style={{ color: textColor }}>
                            ({current}/{max})
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              }

              return (
                <tr key={row.name} className="hover:bg-gray-50">
                  <td
                    className="sticky left-0 z-10 border text-sm"
                    style={{
                      borderColor: colors.border,
                      borderRight: `2px solid ${colors.border}`,
                      backgroundColor: '#F9FAFB',
                      color: '#1F2937',
                      paddingLeft: row.indented ? '24px' : '12px',
                      paddingRight: '12px',
                      paddingTop: '12px',
                      paddingBottom: '12px',
                      fontWeight: row.indented ? 'normal' : 500,
                    }}
                  >
                    {row.name}
                  </td>
                  {isAMRow ? (
                    <>
                      <td
                        className="border px-2 py-2 cursor-pointer hover:bg-blue-50 transition-colors text-center"
                        style={{ borderColor: colors.border }}
                        onClick={() => handleCellClick(row.serviceId!, date, 'AM')}
                      >
                        {cellAssignments.length > 0 ? (
                          <div className="text-xs font-medium" style={{ color: colors.primaryBlue }}>
                            {cellAssignments.map((a) => a.provider?.initials).join(', ')}
                          </div>
                        ) : (
                          <div className="text-gray-400 text-xs">-</div>
                        )}
                      </td>
                      <td className="border bg-gray-100" style={{ borderColor: colors.border }}></td>
                    </>
                  ) : (
                    <>
                      <td className="border bg-gray-100" style={{ borderColor: colors.border }}></td>
                      <td
                        className="border px-2 py-2 cursor-pointer hover:bg-blue-50 transition-colors text-center"
                        style={{ borderColor: colors.border }}
                        onClick={() => handleCellClick(row.serviceId!, date, 'PM')}
                      >
                        {cellAssignments.length > 0 ? (
                          <div className="text-xs font-medium" style={{ color: colors.primaryBlue }}>
                            {cellAssignments.map((a) => a.provider?.initials).join(', ')}
                          </div>
                        ) : (
                          <div className="text-gray-400 text-xs">-</div>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  if (timeFrame === 'week') {
    // Week View: Days as columns, services grouped with AM/PM as separate rows
    return (
      <div className="bg-white rounded-lg shadow overflow-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr>
              <th
                className="sticky left-0 z-20 border px-3 py-3 text-left font-semibold text-sm"
                style={{
                  backgroundColor: colors.lightGray,
                  borderColor: colors.border,
                  borderRight: `2px solid ${colors.border}`,
                  color: colors.primaryBlue,
                  width: '220px',
                }}
              >
                Service
              </th>
              {dateRange.map((date) => {
                const holiday = holidays.get(date);
                return (
                  <th
                    key={date}
                    className="border px-3 py-2 min-w-[120px]"
                    style={{
                      backgroundColor: holiday ? colors.holidayBgLight : colors.lightGray,
                      borderColor: colors.border,
                    }}
                  >
                    <div className="text-center">
                      <div
                        className="font-semibold text-sm"
                        style={{ color: holiday ? colors.holidayPurple : colors.primaryBlue }}
                      >
                        {getDayOfWeek(date)}
                      </div>
                      <div
                        className="text-xs"
                        style={{ color: holiday ? colors.holidayPurple : '#4B5563' }}
                      >
                        {formatDate(date)}
                      </div>
                      {holiday && (
                        <div
                          className="text-xs font-medium mt-1"
                          style={{ color: colors.holidayPurple }}
                        >
                          {holiday.name}
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {serviceRows.map((row) => {
              if (row.type === 'group-header') {
                return renderGroupHeader(row.name, dateRange.length + 1);
              }
              return renderServiceRow(row, dateRange);
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // Month View: Calendar grid with mini schedule per day
  // Group dates by week for calendar layout
  const weeks: string[][] = [];
  let currentWeek: string[] = [];

  // Add empty cells for days before the first date
  const firstDate = new Date(dateRange[0] + 'T00:00:00');
  const startDayOfWeek = firstDate.getDay();
  for (let i = 0; i < startDayOfWeek; i++) {
    currentWeek.push('');
  }

  dateRange.forEach((date) => {
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push(date);
  });

  // Fill remaining days of last week
  while (currentWeek.length < 7) {
    currentWeek.push('');
  }
  weeks.push(currentWeek);

  return (
    <div className="bg-white rounded-lg shadow overflow-auto">
      <table className="min-w-full border-collapse">
        <thead>
          <tr>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <th
                key={day}
                className="border px-2 py-2 text-center font-semibold text-sm min-w-[140px]"
                style={{ backgroundColor: colors.lightGray, borderColor: colors.border, color: colors.primaryBlue }}
              >
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, weekIndex) => (
            <tr key={weekIndex}>
              {week.map((date, dayIndex) => (
                <td
                  key={dayIndex}
                  className="border p-1 align-top h-32"
                  style={{ borderColor: colors.border, backgroundColor: date ? 'white' : colors.lightGray }}
                >
                  {date && (
                    <div className="h-full">
                      <div className="text-xs font-semibold mb-1" style={{ color: colors.primaryBlue }}>
                        {formatDate(date)}
                      </div>
                      <div className="space-y-0.5 text-[10px] overflow-y-auto max-h-24">
                        {serviceRows
                          .filter((row) => row.type === 'service' && row.serviceId)
                          .slice(0, 8)
                          .map((row) => {
                            const cellAssignments = getAssignmentsForCell(row.serviceId!, date, row.timeBlock!);
                            if (cellAssignments.length === 0) return null;

                            const isPTO = row.name === 'PTO';
                            const displayName = row.name.length > 10 ? row.name.substring(0, 10) : row.name;

                            return (
                              <div
                                key={`${row.name}-${row.timeBlock}`}
                                className="truncate cursor-pointer hover:bg-blue-50 px-1 rounded"
                                onClick={() => handleCellClick(row.serviceId!, date, row.timeBlock!)}
                                title={`${row.name}: ${cellAssignments.map((a) => a.provider?.initials).join(', ')}`}
                              >
                                <span className="font-medium" style={{ color: isPTO ? colors.ptoRed : colors.teal }}>
                                  {displayName}:
                                </span>{' '}
                                <span style={{ color: isPTO ? colors.ptoRed : colors.primaryBlue }}>
                                  {cellAssignments.map((a) => a.provider?.initials).join(', ')}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Provider View Component
interface ProviderViewProps {
  providers: Provider[];
  services: Service[];
  assignments: ScheduleAssignment[];
  dateRange: string[];
  timeFrame: TimeFrame;
  getProviderAssignments: (providerId: string, date: string, timeBlock?: string) => ScheduleAssignment[];
  formatDate: (dateStr: string) => string;
  getDayOfWeek: (dateStr: string) => string;
  isFullDayService: (serviceName: string) => boolean;
  colors: typeof colors;
  holidays: Map<string, Holiday>;
}

function ProviderView({
  providers,
  services,
  dateRange,
  timeFrame,
  getProviderAssignments,
  formatDate,
  getDayOfWeek,
  isFullDayService,
  colors,
  holidays,
}: ProviderViewProps) {
  const renderProviderCell = (provider: Provider, date: string, timeBlock?: string) => {
    const providerAssignments = getProviderAssignments(provider.id, date, timeBlock);

    if (providerAssignments.length === 0) {
      return <span className="text-gray-400">-</span>;
    }

    return (
      <div className="space-y-0.5">
        {providerAssignments.map((assignment) => {
          const service = services.find((s) => s.id === assignment.service_id);
          const isPTO = service?.name === 'PTO';
          return (
            <div
              key={assignment.id}
              className="text-xs px-1 rounded truncate"
              style={{
                backgroundColor: isPTO ? `${colors.ptoRed}20` : `${colors.lightBlue}20`,
                color: isPTO ? colors.ptoRed : colors.primaryBlue,
              }}
              title={service?.name}
            >
              {service?.name.substring(0, 8)}
            </div>
          );
        })}
      </div>
    );
  };

  if (timeFrame === 'day') {
    const date = dateRange[0];
    return (
      <div className="bg-white rounded-lg shadow overflow-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr>
              <th
                className="sticky left-0 z-20 border px-4 py-3 text-left font-semibold text-sm"
                style={{ backgroundColor: colors.lightGray, borderColor: colors.border, color: colors.primaryBlue }}
              >
                Provider
              </th>
              <th
                className="border px-4 py-3 text-center font-semibold text-sm min-w-[200px]"
                style={{ backgroundColor: colors.lightGray, borderColor: colors.border, color: colors.primaryBlue }}
              >
                AM
              </th>
              <th
                className="border px-4 py-3 text-center font-semibold text-sm min-w-[200px]"
                style={{ backgroundColor: colors.lightGray, borderColor: colors.border, color: colors.primaryBlue }}
              >
                PM
              </th>
            </tr>
          </thead>
          <tbody>
            {providers.map((provider) => (
              <tr key={provider.id} className="hover:bg-gray-50">
                <td
                  className="sticky left-0 z-10 bg-white border px-4 py-2"
                  style={{ borderColor: colors.border }}
                >
                  <Link href={`/providers/${provider.initials}`} className="hover:underline">
                    <div className="font-bold" style={{ color: colors.primaryBlue }}>
                      {provider.initials}
                    </div>
                    <div className="text-xs text-gray-600">{provider.name}</div>
                  </Link>
                </td>
                <td className="border px-2 py-2" style={{ borderColor: colors.border }}>
                  {renderProviderCell(provider, date, 'AM')}
                </td>
                <td className="border px-2 py-2" style={{ borderColor: colors.border }}>
                  {renderProviderCell(provider, date, 'PM')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (timeFrame === 'week') {
    return (
      <div className="bg-white rounded-lg shadow overflow-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr>
              <th
                className="sticky left-0 z-20 border px-4 py-3 text-left font-semibold text-sm"
                style={{ backgroundColor: colors.lightGray, borderColor: colors.border, color: colors.primaryBlue }}
              >
                Provider
              </th>
              {dateRange.map((date) => {
                const holiday = holidays.get(date);
                return (
                  <th
                    key={date}
                    className="border px-2 py-2 min-w-[100px]"
                    style={{
                      backgroundColor: holiday ? colors.holidayBgLight : colors.lightGray,
                      borderColor: colors.border,
                    }}
                  >
                    <div className="text-center">
                      <div
                        className="font-semibold text-xs"
                        style={{ color: holiday ? colors.holidayPurple : colors.primaryBlue }}
                      >
                        {getDayOfWeek(date)}
                      </div>
                      <div
                        className="text-xs"
                        style={{ color: holiday ? colors.holidayPurple : '#4B5563' }}
                      >
                        {formatDate(date)}
                      </div>
                      {holiday && (
                        <div
                          className="text-xs font-medium mt-1"
                          style={{ color: colors.holidayPurple }}
                        >
                          {holiday.name}
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {providers.map((provider) => (
              <tr key={provider.id} className="hover:bg-gray-50">
                <td
                  className="sticky left-0 z-10 bg-white border px-3 py-2"
                  style={{ borderColor: colors.border }}
                >
                  <Link href={`/providers/${provider.initials}`} className="hover:underline">
                    <div className="font-bold text-sm" style={{ color: colors.primaryBlue }}>
                      {provider.initials}
                    </div>
                    <div className="text-xs text-gray-500 truncate max-w-[100px]">{provider.name}</div>
                  </Link>
                </td>
                {dateRange.map((date) => {
                  const holiday = holidays.get(date);
                  return (
                    <td
                      key={date}
                      className="border px-1 py-1"
                      style={{
                        borderColor: colors.border,
                        backgroundColor: holiday ? colors.holidayBgLight : undefined,
                      }}
                    >
                      {holiday ? (
                        <div className="text-xs font-medium text-center" style={{ color: colors.holidayPurple }}>
                          HOLIDAY
                        </div>
                      ) : (
                        renderProviderCell(provider, date)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Month View: Grid of provider cards with mini calendar
  // Group dates by week for calendar layout
  const weeks: string[][] = [];
  let currentWeek: string[] = [];

  const firstDate = new Date(dateRange[0] + 'T00:00:00');
  const startDayOfWeek = firstDate.getDay();
  for (let i = 0; i < startDayOfWeek; i++) {
    currentWeek.push('');
  }

  dateRange.forEach((date) => {
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push(date);
  });

  while (currentWeek.length < 7) {
    currentWeek.push('');
  }
  weeks.push(currentWeek);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {providers.map((provider) => (
        <div
          key={provider.id}
          className="bg-white rounded-lg shadow border overflow-hidden"
          style={{ borderColor: colors.border }}
        >
          {/* Provider Header */}
          <Link href={`/providers/${provider.initials}`}>
            <div
              className="px-3 py-2 flex items-center justify-between cursor-pointer hover:opacity-90"
              style={{ backgroundColor: colors.lightBlue }}
            >
              <span className="text-white font-bold">{provider.initials}</span>
              <span
                className="px-2 py-0.5 rounded text-xs font-medium text-white"
                style={{ backgroundColor: colors.teal }}
              >
                {provider.role === 'fellow' ? 'Fellow' : 'MD'}
              </span>
            </div>
          </Link>

          {/* Mini Month Calendar */}
          <div className="p-2">
            <div className="text-xs font-medium mb-1 truncate" style={{ color: colors.primaryBlue }}>
              {provider.name}
            </div>
            <table className="w-full border-collapse text-[9px]">
              <thead>
                <tr>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                    <th key={i} className="p-0.5 text-gray-500 font-normal">{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((week, weekIndex) => (
                  <tr key={weekIndex}>
                    {week.map((date, dayIndex) => {
                      if (!date) {
                        return <td key={dayIndex} className="p-0.5"></td>;
                      }
                      const providerAssignments = getProviderAssignments(provider.id, date);
                      const hasPTO = providerAssignments.some((a) => {
                        const service = services.find((s) => s.id === a.service_id);
                        return service?.name === 'PTO';
                      });
                      const hasAssignment = providerAssignments.length > 0;

                      return (
                        <td
                          key={dayIndex}
                          className="p-0.5 text-center"
                          style={{
                            backgroundColor: hasPTO
                              ? `${colors.ptoRed}30`
                              : hasAssignment
                              ? `${colors.lightBlue}20`
                              : 'transparent',
                            color: hasPTO ? colors.ptoRed : colors.primaryBlue,
                          }}
                          title={providerAssignments.map(a => {
                            const service = services.find(s => s.id === a.service_id);
                            return service?.name;
                          }).join(', ')}
                        >
                          {new Date(date + 'T00:00:00').getDate()}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
