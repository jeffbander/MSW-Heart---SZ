'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Service, Provider, ScheduleAssignment, AvailabilityViolation, ProviderAvailabilityRule, ProviderLeave, DayMetadata } from '@/lib/types';
import { Holiday, getHolidaysInRange, isInpatientService } from '@/lib/holidays';
import ApplyTemplateModal from './ApplyTemplateModal';
import AlternatingTemplateModal from './AlternatingTemplateModal';
import SaveTemplateModal from './SaveTemplateModal';
import AvailabilityWarningModal from './AvailabilityWarningModal';
import PTOConflictModal from './PTOConflictModal';
import EditAssignmentModal from './calendar/EditAssignmentModal';
import DayMetadataModal from './DayMetadataModal';
import BulkScheduleModal from './calendar/BulkScheduleModal';

// Helper to format date in local timezone (avoids UTC conversion issues)
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Mount Sinai Colors
const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  chpAmber: '#F59E0B',
  extraPurple: '#8B5CF6',
  noteBlue: '#3B82F6',
  lightGray: '#F5F5F5',
  border: '#E5E7EB',
  ptoRed: '#DC2626',
  holidayPurple: '#7C3AED',
  holidayBgLight: '#EDE9FE',
  fellowPurple: '#7C3AED', // Purple color for fellows
};

type ViewMode = 'service' | 'provider';
type TimeFrame = 'day' | 'week' | 'month';

// Full day services that don't split into AM/PM
const FULL_DAY_SERVICES = ['PTO', 'Nuclear Stress', 'Heart Failure'];

// Services that require coverage - highlight empty cells on weekdays
const COVERAGE_REQUIRED_SERVICES = [
  'Burgundy', 'Consults', 'Fourth Floor Echo Lab',
  'Echo TTE AM', 'Echo TTE PM',
  'Stress Echo AM', 'Stress Echo PM',
  'Nuclear', 'Nuclear Stress'
];

// Map services to required capabilities for suggestions
const SERVICE_CAPABILITY_MAP: Record<string, string[]> = {
  'Burgundy': ['Inpatient', 'Consults'],
  'Consults': ['Inpatient', 'Consults'],
  'Fourth Floor Echo Lab': ['Echo'],
  'Echo TTE AM': ['Echo'],
  'Echo TTE PM': ['Echo'],
  'Stress Echo AM': ['Stress'],
  'Stress Echo PM': ['Stress'],
  'Nuclear': ['Nuclear'],
  'Nuclear Stress': ['Nuclear'],
  'Precepting': ['Precepting']
};

// Service abbreviations for cleaner display in Provider View
const SERVICE_ABBREVIATIONS: Record<string, string> = {
  'Fourth Floor Echo Lab': '4th Echo',
  'Echo TTE': 'Echo',
  'Echo TTE AM': 'Echo',
  'Echo TTE PM': 'Echo',
  'Stress Echo': 'Stress',
  'Stress Echo AM': 'Stress',
  'Stress Echo PM': 'Stress',
  'Nuclear Stress': 'Nuc Stress',
  'Provider Support': 'Support',
  'Inpatient': 'Inpt',
  'Precepting': 'Precept',
  'Offsites': 'Offsite',
  'Rooms AM': 'Rooms AM',
  'Rooms PM': 'Rooms PM',
};

// Helper to get abbreviated service name for Provider View
const getServiceAbbreviation = (serviceName: string): string => {
  return SERVICE_ABBREVIATIONS[serviceName] || serviceName;
};

interface MainCalendarProps {
  isAdmin?: boolean;
}

export default function MainCalendar({ isAdmin = false }: MainCalendarProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  // View controls
  const [viewMode, setViewMode] = useState<ViewMode>('service');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(new Date());

  // Sandbox mode
  const [sandboxMode, setSandboxMode] = useState(false);
  const [sandboxSessionId, setSandboxSessionId] = useState<string | null>(null);

  // Provider View filters
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [capabilityFilter, setCapabilityFilter] = useState<string>('all');
  const [selectedProviders, setSelectedProviders] = useState<Set<string>>(new Set());
  const [providerDropdownOpen, setProviderDropdownOpen] = useState(false);
  const [providerSearchInDropdown, setProviderSearchInDropdown] = useState('');
  const [showWeekend, setShowWeekend] = useState(true);
  const [savedViewName, setSavedViewName] = useState('');
  const [showSaveViewModal, setShowSaveViewModal] = useState(false);
  const [savedViews, setSavedViews] = useState<Array<{name: string; providerIds: string[]; roles: string[]; showWeekend: boolean}>>([]);

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
  const [showBulkScheduleModal, setShowBulkScheduleModal] = useState(false);

  // Provider search in assignment modal
  const [providerSearchQuery, setProviderSearchQuery] = useState('');
  // Covering checkbox in assignment modal
  const [isCoveringAssignment, setIsCoveringAssignment] = useState(false);

  // Edit assignment modal
  const [editingAssignment, setEditingAssignment] = useState<ScheduleAssignment | null>(null);

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

  // Provider leaves for filtering suggestions
  const [providerLeaves, setProviderLeaves] = useState<ProviderLeave[]>([]);

  // PTO conflict modal
  const [ptoConflictModal, setPtoConflictModal] = useState<{
    provider: Provider;
    date: string;
    ptoTimeBlocks: string[];
  } | null>(null);

  // Track overridden conflicts (session only - resets on page refresh)
  const [overriddenConflicts, setOverriddenConflicts] = useState<Set<string>>(new Set());

  // Day metadata (CHP room, extra room, notes)
  const [dayMetadata, setDayMetadata] = useState<DayMetadata[]>([]);
  const [metadataModalData, setMetadataModalData] = useState<{
    date: string;
    timeBlock: 'AM' | 'PM';
  } | null>(null);

  // Calculate date range based on time frame
  const dateRange = useMemo(() => {
    const dates: string[] = [];
    const start = new Date(currentDate);

    if (timeFrame === 'day') {
      dates.push(formatLocalDate(start));
    } else if (timeFrame === 'week') {
      // Start from Sunday of current week
      const dayOfWeek = start.getDay();
      start.setDate(start.getDate() - dayOfWeek);
      for (let i = 0; i < 7; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        dates.push(formatLocalDate(date));
      }
    } else if (timeFrame === 'month') {
      // Get first day of month
      start.setDate(1);
      const month = start.getMonth();
      while (start.getMonth() === month) {
        dates.push(formatLocalDate(start));
        start.setDate(start.getDate() + 1);
      }
    }

    return dates;
  }, [currentDate, timeFrame]);

  // Compute provider view date range (reorder: Mon-Fri-Sat-Sun, optionally hide weekend)
  const providerViewDateRange = useMemo(() => {
    if (timeFrame !== 'week') return dateRange;

    // dateRange is Sun-Mon-Tue-Wed-Thu-Fri-Sat (0-6)
    // Reorder to Mon-Tue-Wed-Thu-Fri-Sat-Sun
    const reordered = [
      ...dateRange.slice(1, 6), // Mon-Fri (indices 1-5)
      ...dateRange.slice(6),    // Sat (index 6)
      dateRange[0],             // Sun (index 0)
    ];

    if (!showWeekend) {
      // Return only Mon-Fri
      return reordered.slice(0, 5);
    }

    return reordered;
  }, [dateRange, timeFrame, showWeekend]);

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

  // Fetch provider leaves for filtering suggestions
  useEffect(() => {
    async function fetchProviderLeaves() {
      try {
        const response = await fetch(
          `/api/leaves?startDate=${dateRange[0]}&endDate=${dateRange[dateRange.length - 1]}`
        );
        const data = await response.json();
        setProviderLeaves(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error fetching provider leaves:', error);
      }
    }
    fetchProviderLeaves();
  }, [dateRange]);

  // Close provider dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (providerDropdownOpen && !target.closest('.provider-dropdown-container')) {
        setProviderDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [providerDropdownOpen]);

  // Load saved provider views from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('providerViewSavedViews');
    if (saved) {
      try {
        setSavedViews(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading saved views:', e);
      }
    }
  }, []);

  // Save a provider view
  const saveProviderView = (name: string) => {
    const newView = {
      name,
      providerIds: Array.from(selectedProviders),
      roles: Array.from(selectedRoles),
      showWeekend,
    };
    const updated = [...savedViews.filter(v => v.name !== name), newView];
    setSavedViews(updated);
    localStorage.setItem('providerViewSavedViews', JSON.stringify(updated));
    setShowSaveViewModal(false);
    setSavedViewName('');
  };

  // Load a saved provider view
  const loadProviderView = (view: {name: string; providerIds: string[]; roles: string[]; showWeekend: boolean}) => {
    setSelectedProviders(new Set(view.providerIds));
    setSelectedRoles(new Set(view.roles));
    setShowWeekend(view.showWeekend);
  };

  // Delete a saved provider view
  const deleteProviderView = (name: string) => {
    const updated = savedViews.filter(v => v.name !== name);
    setSavedViews(updated);
    localStorage.setItem('providerViewSavedViews', JSON.stringify(updated));
  };

  // Check if a provider is on leave for a specific date
  const isProviderOnLeave = (providerId: string, date: string): boolean => {
    return providerLeaves.some(leave =>
      leave.provider_id === providerId &&
      date >= leave.start_date &&
      date <= leave.end_date
    );
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [servicesRes, providersRes, assignmentsRes, metadataRes] = await Promise.all([
        fetch('/api/services'),
        fetch('/api/providers'),
        fetch(
          `/api/assignments?startDate=${dateRange[0]}&endDate=${dateRange[dateRange.length - 1]}`
        ),
        fetch(
          `/api/day-metadata?startDate=${dateRange[0]}&endDate=${dateRange[dateRange.length - 1]}`
        ),
      ]);

      const servicesData = await servicesRes.json();
      const providersData = await providersRes.json();
      const assignmentsData = await assignmentsRes.json();
      const metadataData = await metadataRes.json();

      setServices(servicesData);
      setProviders(providersData);
      setAssignments(assignmentsData);
      setDayMetadata(Array.isArray(metadataData) ? metadataData : []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter providers for Provider View
  const filteredProviders = useMemo(() => {
    return providers.filter((p) => {
      // Filter by selected providers (if any selected)
      if (selectedProviders.size > 0 && !selectedProviders.has(p.id)) return false;
      // Filter by selected roles (if any selected)
      if (selectedRoles.size > 0 && !selectedRoles.has(p.role)) return false;
      // Filter by capability
      if (capabilityFilter !== 'all' && !p.capabilities.includes(capabilityFilter)) return false;
      return true;
    });
  }, [providers, selectedProviders, selectedRoles, capabilityFilter]);

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
      Number(r.day_of_week) === dayOfWeek &&
      (r.time_block === timeBlock || r.time_block === 'BOTH')
    );
    return rule ? rule.enforcement : null; // null = available, 'warn' = soft warning, 'hard' = blocked
  };

  // Check if there are any fellows assigned to Rooms for a given date/timeBlock
  const hasFellowsInRooms = (date: string, timeBlock: string): boolean => {
    const roomsServiceName = timeBlock === 'AM' ? 'Rooms AM' : 'Rooms PM';
    const roomsService = services.find(s => s.name === roomsServiceName);
    if (!roomsService) return false;

    const roomsAssignments = getAssignmentsForCell(roomsService.id, date, timeBlock);
    return roomsAssignments.some(a => a.provider?.role === 'fellow');
  };

  // Get the provider assigned to Precepting for a given date/timeBlock
  const getPreceptorForTime = (date: string, timeBlock: string): Provider | null => {
    const preceptingService = services.find(s => s.name === 'Precepting');
    if (!preceptingService) return null;

    const preceptingAssignments = getAssignmentsForCell(preceptingService.id, date, timeBlock);
    if (preceptingAssignments.length === 0) return null;

    return preceptingAssignments[0].provider || null;
  };

  // Get room suggestions for reaching target
  const getRoomSuggestions = (date: string, timeBlock: string, assignedProviderIds: string[]) => {
    const dayOfWeek = new Date(date + 'T00:00:00').getDay();
    const isExtendedDay = (dayOfWeek === 3 || dayOfWeek === 4) && timeBlock === 'PM';
    const target = isExtendedDay ? 15 : 14;

    // Find the rooms service for this time block
    const roomsServiceName = timeBlock === 'AM' ? 'Rooms AM' : 'Rooms PM';
    const roomsService = services.find(s => s.name === roomsServiceName);
    if (!roomsService) return { needed: 0, target, currentRooms: 0, suggestions: [] as (Provider & { hasWarning: boolean; isPreceptorAvailable: boolean })[], fellowsInRooms: false };

    const currentAssignments = getAssignmentsForCell(roomsService.id, date, timeBlock);
    const currentRooms = currentAssignments.reduce((sum, a) => sum + (a.room_count || 0), 0);
    const needed = Math.max(0, target - currentRooms);

    if (needed === 0) return { needed: 0, target, currentRooms, suggestions: [] as (Provider & { hasWarning: boolean; isPreceptorAvailable: boolean })[], fellowsInRooms: false };

    // Services that block a provider from being suggested for rooms
    const BLOCKING_SERVICES = ['Consults', 'Burgundy', 'Fourth Floor Echo Lab', 'Offsites AM', 'Offsites PM'];

    // Check if provider has a blocking assignment at this time
    const hasBlockingAssignment = (providerId: string) => {
      const providerAssignments = assignments.filter(a =>
        a.provider_id === providerId &&
        a.date === date &&
        (a.time_block === timeBlock || a.time_block === 'BOTH')
      );
      return providerAssignments.some(a => {
        const serviceName = services.find(s => s.id === a.service_id)?.name;
        return serviceName && BLOCKING_SERVICES.includes(serviceName);
      });
    };

    // Check if provider has ANY hard availability block for this day/time (across all services)
    const hasAnyHardBlock = (providerId: string) => {
      return availabilityRules.some(r =>
        r.provider_id === providerId &&
        Number(r.day_of_week) === dayOfWeek &&
        (r.time_block === timeBlock || r.time_block === 'BOTH') &&
        r.enforcement === 'hard'
      );
    };

    // Check if provider has ANY soft availability warning for this day/time (across all services)
    const hasAnyWarning = (providerId: string) => {
      return availabilityRules.some(r =>
        r.provider_id === providerId &&
        Number(r.day_of_week) === dayOfWeek &&
        (r.time_block === timeBlock || r.time_block === 'BOTH') &&
        r.enforcement === 'warn'
      );
    };

    // Check if there are fellows in Rooms - if not, preceptor becomes available
    const fellowsInRooms = hasFellowsInRooms(date, timeBlock);
    const preceptor = getPreceptorForTime(date, timeBlock);

    // Get available providers with Rooms capability who aren't assigned and don't have PTO
    // Filter out providers with hard blocks and mark those with soft warnings
    const available = providers
      .filter(p => {
        if (!p.capabilities.includes('Rooms')) return false;
        if (assignedProviderIds.includes(p.id)) return false;
        if (getProviderPTOForDate(p.id, date).some(tb => tb === timeBlock || tb === 'BOTH')) return false;

        // Exclude providers on leave
        if (isProviderOnLeave(p.id, date)) return false;

        // Check if provider has a blocking assignment (Consults, Burgundy, Fourth Floor Echo Lab, Offsites)
        if (hasBlockingAssignment(p.id)) return false;

        // Check availability rules - exclude providers with hard blocks on ANY service
        if (hasAnyHardBlock(p.id)) return false;

        return true;
      })
      .map(p => ({
        ...p,
        hasWarning: hasAnyWarning(p.id),
        isPreceptorAvailable: false
      }))
      .sort((a, b) => {
        // Sort providers without warnings first, then by room count
        if (a.hasWarning !== b.hasWarning) {
          return a.hasWarning ? 1 : -1;
        }
        return b.default_room_count - a.default_room_count;
      });

    // If no fellows in Rooms and there's a preceptor, add them to suggestions
    if (!fellowsInRooms && preceptor && !assignedProviderIds.includes(preceptor.id)) {
      // Check if preceptor is already in the available list
      const preceptorInList = available.find(p => p.id === preceptor.id);
      if (!preceptorInList) {
        // Add preceptor to the front of the list with special flag
        available.unshift({
          ...preceptor,
          hasWarning: false,
          isPreceptorAvailable: true
        });
      }
    }

    return { needed, target, currentRooms, suggestions: available, fellowsInRooms };
  };

  // Get suggestions for coverage services based on capability and availability
  const getSuggestionsForService = (serviceName: string, date: string, timeBlock: string, assignedProviderIds: string[]) => {
    const dayOfWeek = new Date(date + 'T00:00:00').getDay();
    const requiredCapabilities = SERVICE_CAPABILITY_MAP[serviceName] || [];

    if (requiredCapabilities.length === 0) {
      return { suggestions: [], serviceName };
    }

    // Check if provider has ANY hard availability block for this day/time (across all services)
    const hasAnyHardBlock = (providerId: string) => {
      return availabilityRules.some(r =>
        r.provider_id === providerId &&
        Number(r.day_of_week) === dayOfWeek &&
        (r.time_block === timeBlock || r.time_block === 'BOTH') &&
        r.enforcement === 'hard'
      );
    };

    // Check if provider has ANY soft availability warning for this day/time (across all services)
    const hasAnyWarning = (providerId: string) => {
      return availabilityRules.some(r =>
        r.provider_id === providerId &&
        Number(r.day_of_week) === dayOfWeek &&
        (r.time_block === timeBlock || r.time_block === 'BOTH') &&
        r.enforcement === 'warn'
      );
    };

    // Check if provider has a blocking assignment at this time
    const hasBlockingAssignment = (providerId: string) => {
      const providerAssignments = assignments.filter(a =>
        a.provider_id === providerId &&
        a.date === date &&
        (a.time_block === timeBlock || a.time_block === 'BOTH')
      );
      // Provider is blocked if they have ANY assignment at this time
      return providerAssignments.length > 0;
    };

    // Filter providers who have at least one of the required capabilities
    const available = providers
      .filter(p => {
        // Must have at least one of the required capabilities
        const hasRequiredCapability = requiredCapabilities.some(cap => p.capabilities.includes(cap));
        if (!hasRequiredCapability) return false;

        // Exclude already assigned providers
        if (assignedProviderIds.includes(p.id)) return false;

        // Exclude providers on leave
        if (isProviderOnLeave(p.id, date)) return false;

        // Exclude providers with PTO
        if (getProviderPTOForDate(p.id, date).some(tb => tb === timeBlock || tb === 'BOTH')) return false;

        // Exclude providers with other assignments
        if (hasBlockingAssignment(p.id)) return false;

        // Exclude providers with hard availability blocks
        if (hasAnyHardBlock(p.id)) return false;

        return true;
      })
      .map(p => ({
        ...p,
        hasWarning: hasAnyWarning(p.id),
        matchingCapabilities: requiredCapabilities.filter(cap => p.capabilities.includes(cap))
      }))
      .sort((a, b) => {
        // Sort providers without warnings first
        if (a.hasWarning !== b.hasWarning) {
          return a.hasWarning ? 1 : -1;
        }
        // Then by name
        return a.name.localeCompare(b.name);
      });

    return { suggestions: available, serviceName };
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
    // Only allow editing in admin mode
    if (!isAdmin) return;

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
          is_covering: isCoveringAssignment,
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
          is_covering: isCoveringAssignment,
          force_override: true
        }),
      });

      if (response.ok) {
        await fetchData();
        // Only clear state and close modal on success
        setAvailabilityWarnings([]);
        setPendingAssignment(null);
        setSelectedCell(null);
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.error || 'Failed to assign provider. Please try again.');
      }
    } catch (error) {
      console.error('Error assigning provider:', error);
      alert('Failed to assign provider. Please try again.');
    }
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

  const handleToggleCovering = async (assignmentId: string, currentValue: boolean) => {
    try {
      const response = await fetch('/api/assignments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: assignmentId, is_covering: !currentValue })
      });

      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Error toggling covering status:', error);
    }
  };

  const handleSaveAssignment = async (updates: { id: string; provider_id?: string; room_count?: number; notes?: string; time_block?: string; is_covering?: boolean }) => {
    try {
      const response = await fetch('/api/assignments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Error saving assignment:', error);
    }
  };

  // Check if a service is full-day
  const isFullDayService = (serviceName: string) => {
    return FULL_DAY_SERVICES.includes(serviceName);
  };

  // Get day metadata for a specific date and time block
  const getMetadataForCell = (date: string, timeBlock: 'AM' | 'PM') => {
    return dayMetadata.find(m => m.date === date && m.time_block === timeBlock) || null;
  };

  // Get day note for a specific date (time_block = 'DAY')
  const getDayNote = (date: string) => {
    const meta = dayMetadata.find(m => m.date === date && m.time_block === 'DAY');
    return meta?.day_note || null;
  };

  // Check if a date has any metadata (for showing indicators)
  const hasMetadataForDate = (date: string) => {
    return dayMetadata.some(m =>
      m.date === date &&
      (m.chp_room_in_use || m.extra_room_available || m.day_note)
    );
  };

  // Save day metadata
  const handleSaveMetadata = async (metadata: Partial<DayMetadata>) => {
    try {
      const response = await fetch('/api/day-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata),
      });

      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Error saving day metadata:', error);
    }
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
            </div>
          </div>
        </div>
      </header>

      {/* Controls Bar */}
      <div className="bg-white border-b px-4 py-3" style={{ borderColor: colors.border }}>
        {/* Top Row: Time Frame Toggle + Navigation */}
        <div className="max-w-full mx-auto flex flex-wrap items-center gap-4">
          {/* Time Frame Toggle */}
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

          {/* Navigation */}
          <div className="flex items-center gap-2">
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
            <div className="relative">
              <span 
                className="text-lg font-semibold ml-2 cursor-pointer hover:underline" 
                style={{ color: colors.primaryBlue }}
                onClick={() => { setPickerDate(new Date(currentDate)); setShowDatePicker(!showDatePicker); }}
              >
                {getMonthYear()} ▼
              </span>
              {showDatePicker && (
                <div 
                  className="absolute top-full left-0 mt-2 bg-white border rounded-lg shadow-lg p-4 z-50"
                  style={{ borderColor: colors.border, minWidth: '280px' }}
                >
                  <div className="flex justify-between items-center mb-3">
                    <button 
                      onClick={() => setPickerDate(new Date(pickerDate.getFullYear(), pickerDate.getMonth() - 1, 1))}
                      className="px-2 py-1 hover:bg-gray-100 rounded"
                    >
                      ←
                    </button>
                    <span className="font-semibold" style={{ color: colors.primaryBlue }}>
                      {pickerDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                    <button 
                      onClick={() => setPickerDate(new Date(pickerDate.getFullYear(), pickerDate.getMonth() + 1, 1))}
                      className="px-2 py-1 hover:bg-gray-100 rounded"
                    >
                      →
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center text-sm">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                      <div key={d} className="font-medium text-gray-500 py-1">{d}</div>
                    ))}
                    {(() => {
                      const firstDay = new Date(pickerDate.getFullYear(), pickerDate.getMonth(), 1);
                      const lastDay = new Date(pickerDate.getFullYear(), pickerDate.getMonth() + 1, 0);
                      const days = [];
                      for (let i = 0; i < firstDay.getDay(); i++) {
                        days.push(<div key={`empty-${i}`} />);
                      }
                      for (let d = 1; d <= lastDay.getDate(); d++) {
                        const date = new Date(pickerDate.getFullYear(), pickerDate.getMonth(), d);
                        const isToday = date.toDateString() === new Date().toDateString();
                        const isCurrentWeek = (() => {
                          const weekStart = new Date(currentDate);
                          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                          const weekEnd = new Date(weekStart);
                          weekEnd.setDate(weekEnd.getDate() + 6);
                          return date >= weekStart && date <= weekEnd;
                        })();
                        days.push(
                          <button
                            key={d}
                            onClick={() => { setCurrentDate(date); setShowDatePicker(false); }}
                            className={`py-1 rounded hover:bg-blue-100 ${isToday ? "bg-blue-500 text-white hover:bg-blue-600" : ""} ${isCurrentWeek && !isToday ? "bg-blue-50" : ""}`}
                          >
                            {d}
                          </button>
                        );
                      }
                      return days;
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Template Actions - Show in week view (Admin only) */}
          {isAdmin && timeFrame === 'week' && (
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

          {/* Bulk Schedule Button (Admin only) */}
          {isAdmin && (
            <button
              onClick={() => setShowBulkScheduleModal(true)}
              className="px-3 py-2 rounded text-sm font-medium border hover:bg-gray-50 transition-colors"
              style={{ borderColor: colors.border, color: colors.primaryBlue }}
              title="Add or remove a provider from recurring schedule"
            >
              Bulk Schedule
            </button>
          )}

          {/* Sandbox Mode Toggle (Admin only) */}
          {isAdmin && (
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  if (!sandboxMode) {
                    // Start sandbox session
                    try {
                      const res = await fetch('/api/sandbox', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'create_session', name: `Sandbox ${new Date().toLocaleDateString()}` })
                      });
                      const session = await res.json();
                      setSandboxSessionId(session.id);
                      setSandboxMode(true);
                    } catch (err) {
                      console.error('Failed to start sandbox:', err);
                    }
                  } else {
                    // Exit sandbox mode
                    setSandboxMode(false);
                    setSandboxSessionId(null);
                  }
                }}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  sandboxMode
                    ? 'bg-orange-500 text-white hover:bg-orange-600'
                    : 'border hover:bg-gray-50'
                }`}
                style={!sandboxMode ? { borderColor: colors.border, color: colors.primaryBlue } : {}}
              >
                {sandboxMode ? '🧪 Exit Sandbox' : '🧪 Sandbox Mode'}
              </button>
            </div>
          )}

          {/* Spacer to push remaining items right */}
          <div className="flex-grow" />
        </div>

        {/* Second Row: Provider View Filters (only shown in provider view) */}
        {viewMode === 'provider' && (
          <div className="flex items-center gap-3 flex-wrap mt-3 pt-3 border-t" style={{ borderColor: colors.border }}>
            {/* Filter Controls Group */}
            <span className="text-sm font-medium text-gray-500">Filters:</span>

            {/* Multi-select Provider Dropdown */}
              <div className="relative provider-dropdown-container">
                <button
                  onClick={() => setProviderDropdownOpen(!providerDropdownOpen)}
                  className="px-3 py-2 border rounded text-sm flex items-center gap-2 bg-white"
                  style={{ borderColor: colors.border }}
                >
                  {selectedProviders.size === 0
                    ? 'All Providers'
                    : `${selectedProviders.size} selected`}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {providerDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-64 bg-white border rounded-lg shadow-lg max-h-64 overflow-auto" style={{ borderColor: colors.border }}>
                    {/* Search within dropdown */}
                    <input
                      type="text"
                      placeholder="Search providers..."
                      className="w-full px-3 py-2 border-b text-sm"
                      style={{ borderColor: colors.border }}
                      value={providerSearchInDropdown}
                      onChange={(e) => setProviderSearchInDropdown(e.target.value)}
                    />

                    {/* Provider checkboxes */}
                    {providers
                      .filter(p =>
                        !providerSearchInDropdown ||
                        p.name.toLowerCase().includes(providerSearchInDropdown.toLowerCase()) ||
                        p.initials.toLowerCase().includes(providerSearchInDropdown.toLowerCase())
                      )
                      .map(provider => (
                        <label key={provider.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedProviders.has(provider.id)}
                            onChange={(e) => {
                              const next = new Set(selectedProviders);
                              e.target.checked ? next.add(provider.id) : next.delete(provider.id);
                              setSelectedProviders(next);
                            }}
                            className="w-4 h-4"
                          />
                          <span className="text-sm">{provider.name} ({provider.initials})</span>
                        </label>
                      ))}

                    {/* Clear selection button */}
                    {selectedProviders.size > 0 && (
                      <button
                        onClick={() => setSelectedProviders(new Set())}
                        className="w-full px-3 py-2 text-sm text-red-600 border-t hover:bg-gray-50"
                        style={{ borderColor: colors.border }}
                      >
                        Clear selection
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Multi-select Role Checkboxes */}
              <div className="flex items-center gap-3 px-3 py-2 border rounded bg-white" style={{ borderColor: colors.border }}>
                <span className="text-sm text-gray-600">Roles:</span>
                {['attending', 'fellow', 'pa', 'np'].map((role) => (
                  <label key={role} className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedRoles.has(role)}
                      onChange={(e) => {
                        const next = new Set(selectedRoles);
                        e.target.checked ? next.add(role) : next.delete(role);
                        setSelectedRoles(next);
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{role === 'pa' ? 'PA' : role === 'np' ? 'NP' : role.charAt(0).toUpperCase() + role.slice(1)}</span>
                  </label>
                ))}
              </div>

              {/* Capability Filter */}
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

              {/* Divider between filter and display controls */}
              <div className="w-px h-8 bg-gray-300 mx-1" />

              {/* Display Controls Group */}
              {/* Weekend Toggle */}
              <label className="flex items-center gap-2 px-3 py-2 border rounded bg-white cursor-pointer" style={{ borderColor: colors.border }}>
                <input
                  type="checkbox"
                  checked={showWeekend}
                  onChange={(e) => setShowWeekend(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Weekend</span>
              </label>

              {/* Views Dropdown (combined Load/Save) */}
              <div className="relative">
                <select
                  onChange={(e) => {
                    if (e.target.value === '__save__') {
                      setShowSaveViewModal(true);
                    } else {
                      const view = savedViews.find(v => v.name === e.target.value);
                      if (view) loadProviderView(view);
                    }
                    e.target.value = '';
                  }}
                  className="px-3 py-2 border rounded text-sm bg-white"
                  style={{ borderColor: colors.border }}
                  defaultValue=""
                >
                  <option value="" disabled>Views</option>
                  <option value="__save__">+ Save Current View</option>
                  {savedViews.length > 0 && <option disabled>────────────</option>}
                  {savedViews.map((view) => (
                    <option key={view.name} value={view.name}>{view.name}</option>
                  ))}
                </select>
              </div>

              {/* Clear Filters Button */}
              {(selectedProviders.size > 0 || selectedRoles.size > 0 || capabilityFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSelectedProviders(new Set());
                    setSelectedRoles(new Set());
                    setCapabilityFilter('all');
                  }}
                  className="px-3 py-2 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50"
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}

          {/* Save View Modal */}
          {showSaveViewModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-lg p-6 w-96">
                <h3 className="text-lg font-semibold mb-4" style={{ color: colors.primaryBlue }}>Save Current View</h3>
                <input
                  type="text"
                  placeholder="View name..."
                  value={savedViewName}
                  onChange={(e) => setSavedViewName(e.target.value)}
                  className="w-full px-3 py-2 border rounded mb-4"
                  style={{ borderColor: colors.border }}
                  autoFocus
                />
                <div className="text-sm text-gray-600 mb-4">
                  This will save:
                  <ul className="list-disc ml-5 mt-1">
                    <li>{selectedProviders.size} selected providers</li>
                    <li>{selectedRoles.size} selected roles</li>
                    <li>Weekend: {showWeekend ? 'shown' : 'hidden'}</li>
                  </ul>
                </div>
                {savedViews.length > 0 && (
                  <div className="mb-4">
                    <div className="text-sm font-medium text-gray-700 mb-2">Existing views:</div>
                    <div className="space-y-1 max-h-32 overflow-auto">
                      {savedViews.map((view) => (
                        <div key={view.name} className="flex items-center justify-between text-sm bg-gray-50 px-2 py-1 rounded">
                          <span>{view.name}</span>
                          <button
                            onClick={() => deleteProviderView(view.name)}
                            className="text-red-500 hover:text-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setShowSaveViewModal(false);
                      setSavedViewName('');
                    }}
                    className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
                    style={{ borderColor: colors.border }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => savedViewName.trim() && saveProviderView(savedViewName.trim())}
                    disabled={!savedViewName.trim()}
                    className="px-4 py-2 text-sm text-white rounded hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: colors.primaryBlue }}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
      </div>

      {/* Sandbox Mode Banner (Admin only) */}
      {isAdmin && sandboxMode && (
        <div className="bg-orange-100 border-b-2 border-orange-400 px-4 py-3">
          <div className="max-w-full mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🧪</span>
              <div>
                <span className="font-semibold text-orange-800">Sandbox Mode Active</span>
                <p className="text-sm text-orange-700">Changes will not affect the live schedule until you publish them.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  if (confirm('Discard all sandbox changes? This cannot be undone.')) {
                    if (sandboxSessionId) {
                      await fetch(`/api/sandbox?sessionId=${sandboxSessionId}`, { method: 'DELETE' });
                    }
                    setSandboxMode(false);
                    setSandboxSessionId(null);
                  }
                }}
                className="px-4 py-2 rounded text-sm font-medium bg-white border border-orange-400 text-orange-700 hover:bg-orange-50 transition-colors"
              >
                Discard Changes
              </button>
              <button
                onClick={async () => {
                  if (confirm('Publish all sandbox changes to the live schedule?')) {
                    try {
                      const res = await fetch('/api/sandbox/publish', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionId: sandboxSessionId })
                      });
                      const result = await res.json();
                      if (result.success) {
                        alert(`Published ${result.published} changes to live schedule!`);
                        setSandboxMode(false);
                        setSandboxSessionId(null);
                        // Refresh assignments
                        window.location.reload();
                      } else {
                        alert('Failed to publish: ' + (result.error || 'Unknown error'));
                      }
                    } catch (err) {
                      console.error('Failed to publish:', err);
                      alert('Failed to publish changes');
                    }
                  }
                }}
                className="px-4 py-2 rounded text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                Publish to Live
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="p-4">
        {viewMode === 'service' ? (
          <ServiceView
            services={services}
            providers={providers}
            assignments={assignments}
            providerLeaves={providerLeaves}
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
            hasFellowsInRooms={hasFellowsInRooms}
            handleToggleCovering={handleToggleCovering}
            onEditAssignment={isAdmin ? setEditingAssignment : () => {}}
            getMetadataForCell={getMetadataForCell}
            onOpenMetadataModal={(date, timeBlock) => setMetadataModalData({ date, timeBlock })}
          />
        ) : (
          <ProviderView
            providers={filteredProviders}
            services={services}
            assignments={assignments}
            dateRange={providerViewDateRange}
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
            onClick={() => { setSelectedCell(null); setProviderSearchQuery(''); setIsCoveringAssignment(false); }}
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
                              style={{
                                color: p.isPreceptorAvailable ? colors.fellowPurple : (p.hasWarning ? '#F59E0B' : '#92400E'),
                                fontWeight: p.isPreceptorAvailable ? 'bold' : 'normal'
                              }}
                              title={p.isPreceptorAvailable ? 'Preceptor available - no fellows today' : (p.hasWarning ? 'Has availability warning for this time' : undefined)}
                            >
                              {i > 0 && ', '}
                              {p.initials} ({p.default_room_count}){p.isPreceptorAvailable ? ' 🎓' : ''}{p.hasWarning ? ' ⚠️' : ''}
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

              {/* Coverage Suggestions Section - for services that need coverage */}
              {service && cellAssignments.length === 0 && (() => {
                const dayOfWeek = new Date(selectedCell.date + 'T00:00:00').getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                // Don't show suggestions on weekends
                if (isWeekend) return null;

                // Check if this service needs coverage suggestions
                const isPrecepting = service.name === 'Precepting';
                const isCoverageService = COVERAGE_REQUIRED_SERVICES.includes(service.name);

                // For Precepting, only show if fellows are in Rooms
                if (isPrecepting) {
                  const hasFellowsAM = hasFellowsInRooms(selectedCell.date, 'AM');
                  const hasFellowsPM = hasFellowsInRooms(selectedCell.date, 'PM');
                  if (!hasFellowsAM && !hasFellowsPM) return null;
                } else if (!isCoverageService) {
                  return null;
                }

                const assignedIds = cellAssignments.map(a => a.provider_id);
                const coverageSuggestions = getSuggestionsForService(service.name, selectedCell.date, selectedCell.timeBlock, assignedIds);

                return (
                  <div className="mb-4 p-3 rounded" style={{ backgroundColor: '#FFEDD5', border: '1px solid #059669' }}>
                    <div className="font-semibold text-sm mb-2" style={{ color: '#9A3412' }}>
                      💡 Coverage needed for {service.name}
                    </div>
                    {coverageSuggestions.suggestions.length > 0 ? (
                      <div className="text-xs" style={{ color: '#9A3412' }}>
                        <span className="font-medium">Available providers: </span>
                        {coverageSuggestions.suggestions.slice(0, 6).map((p, i) => (
                          <span
                            key={p.id}
                            style={{
                              color: p.hasWarning ? '#F59E0B' : '#9A3412'
                            }}
                            title={p.hasWarning ? 'Has availability warning for this time' : `Capabilities: ${p.matchingCapabilities.join(', ')}`}
                          >
                            {i > 0 && ', '}
                            {p.initials}{p.hasWarning ? ' ⚠️' : ''}
                          </span>
                        ))}
                        {coverageSuggestions.suggestions.length > 6 && (
                          <span className="text-gray-500"> +{coverageSuggestions.suggestions.length - 6} more</span>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs" style={{ color: '#9A3412' }}>
                        No available providers with required capability
                      </div>
                    )}
                  </div>
                );
              })()}

              {availableProviders.length > 0 ? (
                <div>
                  <h3 className="font-semibold mb-2 text-sm">Add Provider:</h3>
                  <label className="flex items-center gap-2 mb-3 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isCoveringAssignment}
                      onChange={(e) => setIsCoveringAssignment(e.target.checked)}
                      className="w-4 h-4 rounded"
                      style={{ accentColor: '#059669' }}
                    />
                    <span style={{ color: isCoveringAssignment ? '#059669' : undefined }}>
                      Covering for someone
                    </span>
                  </label>
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
                onClick={() => { setSelectedCell(null); setProviderSearchQuery(''); setIsCoveringAssignment(false); }}
                className="mt-4 px-4 py-2 rounded w-full text-white hover:opacity-90"
                style={{ backgroundColor: colors.primaryBlue }}
              >
                Done
              </button>
            </div>
          </div>
        );
      })()}

      {/* Template Modals (Admin only) */}
      {isAdmin && (
        <>
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

          {showBulkScheduleModal && (
            <BulkScheduleModal
              providers={providers}
              services={services}
              onClose={() => setShowBulkScheduleModal(false)}
              onSuccess={() => {
                setShowBulkScheduleModal(false);
                fetchData();
              }}
            />
          )}
        </>
      )}

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

      {/* Edit Assignment Modal */}
      {editingAssignment && (
        <EditAssignmentModal
          assignment={editingAssignment}
          providers={providers}
          services={services}
          onSave={handleSaveAssignment}
          onDelete={handleRemoveAssignment}
          onClose={() => setEditingAssignment(null)}
          getProviderPTOForDate={getProviderPTOForDate}
        />
      )}

      {/* Day Metadata Modal */}
      {metadataModalData && (
        <DayMetadataModal
          date={metadataModalData.date}
          timeBlock={metadataModalData.timeBlock}
          existingMetadata={getMetadataForCell(metadataModalData.date, metadataModalData.timeBlock)}
          onSave={handleSaveMetadata}
          onClose={() => setMetadataModalData(null)}
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
  providerLeaves: ProviderLeave[];
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
    suggestions: (Provider & { hasWarning: boolean; isPreceptorAvailable: boolean })[];
    fellowsInRooms: boolean;
  };
  getConflictingAssignmentsForPTO: (providerId: string, date: string, ptoTimeBlocks: string[]) => ScheduleAssignment[];
  overriddenConflicts: Set<string>;
  getOverrideKey: (providerId: string, date: string) => string;
  onPTOConflictClick: (provider: Provider, date: string, ptoTimeBlocks: string[]) => void;
  hasFellowsInRooms: (date: string, timeBlock: string) => boolean;
  handleToggleCovering: (assignmentId: string, currentValue: boolean) => Promise<void>;
  onEditAssignment: (assignment: ScheduleAssignment) => void;
  getMetadataForCell: (date: string, timeBlock: 'AM' | 'PM') => DayMetadata | null;
  onOpenMetadataModal: (date: string, timeBlock: 'AM' | 'PM') => void;
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
  providerLeaves,
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
  hasFellowsInRooms,
  handleToggleCovering,
  onEditAssignment,
  getMetadataForCell,
  onOpenMetadataModal,
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

    if (current === 0) return '#FFEDD5'; // Light orange - empty, needs coverage urgently
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

    // Special handling for Precepting
    if (row.name === 'Precepting') {
      // Check both AM and PM for fellows since Precepting is typically BOTH
      const hasFellowsAM = hasFellowsInRooms(date, 'AM');
      const hasFellowsPM = hasFellowsInRooms(date, 'PM');
      const hasFellows = hasFellowsAM || hasFellowsPM;
      const preceptingDayOfWeek = new Date(date + 'T00:00:00').getDay();
      const isPreceptingWeekend = preceptingDayOfWeek === 0 || preceptingDayOfWeek === 6;

      if (!hasFellows) {
        // No fellows in Rooms - Precepting not needed, show blank
        return (
          <td
            key={date}
            className="border px-2 py-2 text-center"
            style={{ borderColor: colors.border }}
          >
            <div className="text-gray-400 text-xs">-</div>
          </td>
        );
      } else if (cellAssignments.length === 0 && !isPreceptingWeekend) {
        // Fellows ARE in Rooms but no preceptor assigned - needs coverage
        return (
          <td
            key={date}
            className="border px-2 py-2 cursor-pointer hover:bg-blue-50 transition-colors text-center"
            style={{ borderColor: colors.border, backgroundColor: '#FFEDD5' }}
            onClick={() => handleCellClick(row.serviceId!, date, row.timeBlock!)}
          >
            <div className="text-gray-400 text-xs">-</div>
          </td>
        );
      }
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
      // Date-aware logic
      const dayOfWeek = new Date(date + 'T00:00:00').getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isExtendedDay = (dayOfWeek === 3 || dayOfWeek === 4) && row.timeBlock === 'PM';
      const maxGreen = isExtendedDay ? 15 : 14;

      // For weekends, use neutral styling (no coverage colors or suggestions)
      const bgColor = isWeekend ? undefined : getRoomCapacityBgColor(current, date, row.timeBlock);
      const textColor = isWeekend ? colors.primaryBlue : (current === 0 ? '#9CA3AF' : current < 12 ? '#D97706' : current <= maxGreen ? '#059669' : '#DC2626');

      // Get room suggestions if under target (only for weekdays)
      const cellAssignments = getAssignmentsForCell(row.serviceId, date, row.timeBlock);
      const assignedIds = cellAssignments.map(a => a.provider_id);
      const suggestions = isWeekend ? { needed: 0, suggestions: [], fellowsInRooms: true } : getRoomSuggestions(date, row.timeBlock, assignedIds);

      return (
        <td
          key={date}
          className="border px-1 py-1 cursor-pointer hover:opacity-80 transition-colors text-center"
          style={{ borderColor: colors.border, backgroundColor: bgColor }}
          onClick={() => handleCellClick(row.serviceId!, date, row.timeBlock!)}
        >
          <div className="text-xs font-medium">
            {cellAssignments.length > 0 ? (
              cellAssignments.map((a, idx) => {
                const providerColor = a.is_covering === true ? '#059669' : (a.provider?.role === 'fellow' ? colors.fellowPurple : colors.primaryBlue);
                return (
                  <span
                    key={a.id}
                    style={{ color: providerColor, cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditAssignment(a);
                    }}
                    title="Click to edit"
                  >
                    {idx > 0 && ', '}{a.provider?.initials}
                  </span>
                );
              })
            ) : '-'}
          </div>
          {!isWeekend && (
            <div className="text-xs font-semibold" style={{ color: textColor }}>
              ({current}/{maxGreen})
            </div>
          )}
          {!isWeekend && suggestions.needed > 0 && suggestions.suggestions.length > 0 && (
            <div className="text-[10px] mt-0.5" style={{ color: '#92400E' }}>
              +{suggestions.suggestions.slice(0, 3).map(p => (
                <span
                  key={p.id}
                  style={{
                    color: p.isPreceptorAvailable ? colors.fellowPurple : (p.hasWarning ? '#F59E0B' : '#92400E'),
                    fontWeight: p.isPreceptorAvailable ? 'bold' : 'normal'
                  }}
                >
                  {p.initials}({p.default_room_count}){p.isPreceptorAvailable ? '🎓' : ''}{p.hasWarning ? '!' : ''}
                </span>
              )).reduce((prev, curr, i) => i === 0 ? [curr] : [...prev, ', ', curr], [] as React.ReactNode[])}
            </div>
          )}
          {/* CHP and Extra Room badges + Notes button */}
          {(() => {
            const metadata = getMetadataForCell(date, row.timeBlock as 'AM' | 'PM');
            const hasMetadata = metadata && (metadata.chp_room_in_use || metadata.extra_room_available || metadata.day_note);
            return (
              <div className="flex justify-center gap-1 mt-1 flex-wrap">
                {metadata?.chp_room_in_use && (
                  <span
                    className="text-[9px] px-1 rounded cursor-pointer"
                    style={{ backgroundColor: '#FEF3C7', color: colors.chpAmber }}
                    title={metadata.chp_room_note || 'CHP room in use'}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenMetadataModal(date, row.timeBlock as 'AM' | 'PM');
                    }}
                  >
                    CHP
                  </span>
                )}
                {metadata?.extra_room_available && (
                  <span
                    className="text-[9px] px-1 rounded cursor-pointer"
                    style={{ backgroundColor: '#EDE9FE', color: colors.extraPurple }}
                    title={metadata.extra_room_note || 'Extra room available'}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenMetadataModal(date, row.timeBlock as 'AM' | 'PM');
                    }}
                  >
                    +Extra
                  </span>
                )}
                {metadata?.day_note && (
                  <span
                    className="text-[9px] px-1 rounded cursor-pointer"
                    style={{ backgroundColor: '#DBEAFE', color: colors.noteBlue }}
                    title={metadata.day_note}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenMetadataModal(date, row.timeBlock as 'AM' | 'PM');
                    }}
                  >
                    Note
                  </span>
                )}
                {/* Always show a button to add/edit room notes */}
                <span
                  className="text-[9px] px-1 rounded cursor-pointer opacity-50 hover:opacity-100"
                  style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}
                  title="Add room notes (CHP, Extra, Notes)"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenMetadataModal(date, row.timeBlock as 'AM' | 'PM');
                  }}
                >
                  {hasMetadata ? '...' : '+'}
                </span>
              </div>
            );
          })()}
        </td>
      );
    }

    // Normal cell rendering (with holiday background for inpatient services on holidays)
    // Also check for coverage highlighting on empty cells for specific services
    const dayOfWeek = new Date(date + 'T00:00:00').getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const needsCoverage = !isWeekend && cellAssignments.length === 0 && COVERAGE_REQUIRED_SERVICES.includes(row.name);

    let bgStyle: string | undefined;
    if (holiday && isInpatient) {
      bgStyle = colors.holidayBgLight;
    } else if (needsCoverage) {
      bgStyle = '#FFEDD5'; // Light orange - needs coverage
    }

    // For PTO row: also get approved PTO leaves from providerLeaves (excluding maternity and weekends)
    const approvedPTOLeaves = (isPTO && !isWeekend) ? providerLeaves.filter((leave: ProviderLeave) =>
      date >= leave.start_date &&
      date <= leave.end_date &&
      leave.leave_type !== 'maternity'
    ) : [];
    // Get provider IDs already in cellAssignments to avoid duplicates
    const assignedProviderIds = new Set(cellAssignments.map(a => a.provider_id));
    // Filter to leaves not already shown via assignments
    const additionalPTOLeaves = approvedPTOLeaves.filter((leave: ProviderLeave) => !assignedProviderIds.has(leave.provider_id));

    // Check if there's anything to show in PTO row (assignments OR approved leaves)
    const hasPTOContent = isPTO && (cellAssignments.length > 0 || additionalPTOLeaves.length > 0);

    return (
      <td
        key={date}
        className="border px-2 py-2 cursor-pointer hover:bg-blue-50 transition-colors text-center"
        style={{ borderColor: colors.border, backgroundColor: bgStyle }}
        onClick={() => handleCellClick(row.serviceId!, date, row.timeBlock!)}
      >
        {(cellAssignments.length > 0 || (isPTO && additionalPTOLeaves.length > 0)) ? (
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

              // Determine provider color: Covering = orange, PTO = red, Fellow = purple, Attending = blue
              const providerColor = a.is_covering === true ? '#059669' : (isPTO ? colors.ptoRed : (a.provider?.role === 'fellow' ? colors.fellowPurple : colors.primaryBlue));

              return (
                <span key={a.id}>
                  {idx > 0 && ', '}
                  <span
                    style={{
                      color: providerColor,
                      backgroundColor: hasActiveConflicts ? `${colors.ptoRed}20` : undefined,
                      padding: hasActiveConflicts ? '1px 3px' : undefined,
                      borderRadius: hasActiveConflicts ? '2px' : undefined,
                      cursor: 'pointer',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditAssignment(a);
                    }}
                    title="Click to edit"
                  >
                    {a.provider?.initials}
                    {hasActiveConflicts && <span style={{ color: colors.ptoRed }}>*</span>}
                  </span>
                </span>
              );
            })}
            {/* Render approved PTO leaves (from provider_leaves table) */}
            {isPTO && additionalPTOLeaves.map((leave: ProviderLeave, idx: number) => {
              // Use nested provider data from API response instead of looking it up
              if (!leave.provider?.initials) return null;
              const displayIdx = cellAssignments.length + idx;
              return (
                <span key={`leave-${leave.id}`}>
                  {displayIdx > 0 && ', '}
                  <span
                    style={{ color: colors.ptoRed }}
                    title="Approved PTO"
                  >
                    {leave.provider.initials}
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
      <div className="bg-white rounded-lg shadow overflow-auto max-h-[calc(100vh-200px)]">
        <table className="min-w-full border-collapse">
          <thead className="sticky top-0 z-30">
            <tr>
              <th
                className="sticky left-0 z-40 border px-3 py-3 text-left font-semibold text-sm"
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
                        <div className="text-xs font-medium">
                          {cellAssignments.map((a, idx) => {
                            const providerColor = a.is_covering === true ? '#059669' : (isPTO ? colors.ptoRed : (a.provider?.role === 'fellow' ? colors.fellowPurple : colors.primaryBlue));
                            return (
                              <span
                                key={a.id}
                                style={{ color: providerColor, cursor: 'pointer' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditAssignment(a);
                                }}
                                title="Click to edit"
                              >
                                {idx > 0 && ', '}{a.provider?.initials}
                              </span>
                            );
                          })}
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
                          <div className="text-xs font-medium">
                            {cellAssignments.map((a, idx) => {
                              const providerColor = a.is_covering === true ? '#059669' : (a.provider?.role === 'fellow' ? colors.fellowPurple : colors.primaryBlue);
                              return (
                                <span
                                  key={a.id}
                                  style={{ color: providerColor, cursor: 'pointer' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEditAssignment(a);
                                  }}
                                  title="Click to edit"
                                >
                                  {idx > 0 && ', '}{a.provider?.initials}
                                </span>
                              );
                            })}
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
                          <div className="text-xs font-medium">
                            {cellAssignments.map((a, idx) => {
                              const providerColor = a.is_covering === true ? '#059669' : (a.provider?.role === 'fellow' ? colors.fellowPurple : colors.primaryBlue);
                              return (
                                <span
                                  key={a.id}
                                  style={{ color: providerColor, cursor: 'pointer' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEditAssignment(a);
                                  }}
                                  title="Click to edit"
                                >
                                  {idx > 0 && ', '}{a.provider?.initials}
                                </span>
                              );
                            })}
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
      <div className="bg-white rounded-lg shadow overflow-auto max-h-[calc(100vh-200px)]">
        <table className="min-w-full border-collapse">
          <thead className="sticky top-0 z-30">
            <tr>
              <th
                className="sticky left-0 z-40 border px-3 py-3 text-left font-semibold text-sm"
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
                                {cellAssignments.map((a, idx) => {
                                  const providerColor = a.is_covering === true ? '#059669' : (isPTO ? colors.ptoRed : (a.provider?.role === 'fellow' ? colors.fellowPurple : colors.primaryBlue));
                                  return (
                                    <span
                                      key={a.id}
                                      style={{ color: providerColor, cursor: 'pointer' }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onEditAssignment(a);
                                      }}
                                      title="Click to edit"
                                    >
                                      {idx > 0 && ', '}{a.provider?.initials}
                                    </span>
                                  );
                                })}
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
  // Helper to get base service name (strip AM/PM suffix)
  const getBaseServiceName = (serviceName: string): string => {
    return serviceName.replace(/ (AM|PM)$/, '');
  };

  // Helper to check if service should show AM/PM separately (Rooms)
  const shouldShowAmPmSeparately = (serviceName: string): boolean => {
    return serviceName.startsWith('Rooms');
  };

  const renderProviderCell = (provider: Provider, date: string, timeBlock?: string) => {
    const providerAssignments = getProviderAssignments(provider.id, date, timeBlock);

    if (providerAssignments.length === 0) {
      return <span className="text-gray-400">-</span>;
    }

    // If timeBlock is specified (day view), show all assignments with abbreviations
    if (timeBlock) {
      return (
        <div className="space-y-1">
          {providerAssignments.map((assignment) => {
            const service = services.find((s) => s.id === assignment.service_id);
            const isPTO = service?.name === 'PTO';
            const hasNotes = assignment.notes && assignment.notes.trim().length > 0;
            const displayName = service ? getServiceAbbreviation(service.name) : '';
            return (
              <div
                key={assignment.id}
                className="text-xs px-2 py-0.5 rounded"
                style={{
                  backgroundColor: isPTO ? `${colors.ptoRed}20` : `${colors.lightBlue}20`,
                  color: isPTO ? colors.ptoRed : colors.primaryBlue,
                }}
                title={hasNotes ? `${service?.name}: ${assignment.notes}` : service?.name}
              >
                <span>{displayName}</span>
                {hasNotes && <span className="text-gray-500 ml-1">*</span>}
              </div>
            );
          })}
        </div>
      );
    }

    // Week/month view: show services with AM/PM indicator
    const consolidatedServices: Array<{
      displayName: string;
      timeIndicator: 'AM' | 'PM' | null; // null = full day or already has AM/PM in name
      isPTO: boolean;
      notes: string | null;
      key: string;
    }> = [];
    const serviceTimeBlocks = new Map<string, Set<string>>(); // base name -> set of time blocks

    // First pass: collect time blocks per base service
    providerAssignments.forEach((assignment) => {
      const service = services.find((s) => s.id === assignment.service_id);
      if (!service) return;

      const serviceName = service.name;
      const baseName = getBaseServiceName(serviceName);
      const timeBlock = serviceName.endsWith(' AM') ? 'AM' : serviceName.endsWith(' PM') ? 'PM' : 'FULL';

      if (!serviceTimeBlocks.has(baseName)) {
        serviceTimeBlocks.set(baseName, new Set());
      }
      serviceTimeBlocks.get(baseName)!.add(timeBlock);
    });

    const seenBaseNames = new Set<string>();

    providerAssignments.forEach((assignment) => {
      const service = services.find((s) => s.id === assignment.service_id);
      if (!service) return;

      const serviceName = service.name;
      const baseName = getBaseServiceName(serviceName);
      const isPTO = serviceName === 'PTO';

      // For Rooms, always show separately with AM/PM (already in name)
      if (shouldShowAmPmSeparately(serviceName)) {
        consolidatedServices.push({
          displayName: getServiceAbbreviation(serviceName),
          timeIndicator: null,
          isPTO,
          notes: assignment.notes,
          key: assignment.id,
        });
        return;
      }

      // For other services, only show once per base name
      if (!seenBaseNames.has(baseName)) {
        seenBaseNames.add(baseName);

        // Determine time indicator
        const timeBlocks = serviceTimeBlocks.get(baseName);
        let timeIndicator: 'AM' | 'PM' | null = null;

        if (timeBlocks) {
          if (timeBlocks.has('FULL') || (timeBlocks.has('AM') && timeBlocks.has('PM'))) {
            // Full day assignment - no indicator needed
            timeIndicator = null;
          } else if (timeBlocks.has('AM')) {
            timeIndicator = 'AM';
          } else if (timeBlocks.has('PM')) {
            timeIndicator = 'PM';
          }
        }

        consolidatedServices.push({
          displayName: getServiceAbbreviation(baseName),
          timeIndicator,
          isPTO,
          notes: assignment.notes,
          key: assignment.id,
        });
      }
    });

    return (
      <div className="space-y-1">
        {consolidatedServices.map((item) => {
          const hasNotes = item.notes && item.notes.trim().length > 0;
          return (
            <div
              key={item.key}
              className="text-xs px-2 py-0.5 rounded whitespace-nowrap"
              style={{
                backgroundColor: item.isPTO ? `${colors.ptoRed}20` : `${colors.lightBlue}20`,
                color: item.isPTO ? colors.ptoRed : colors.primaryBlue,
              }}
              title={hasNotes ? `${item.displayName}: ${item.notes}` : item.displayName}
            >
              <span>{item.displayName}</span>
              {item.timeIndicator && <span className="text-gray-500 ml-1">{item.timeIndicator}</span>}
              {hasNotes && <span className="text-gray-500 ml-1">*</span>}
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
                    className="border px-3 py-3 min-w-[120px]"
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
                      className="border px-2 py-2"
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
