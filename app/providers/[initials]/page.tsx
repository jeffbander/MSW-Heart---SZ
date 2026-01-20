'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Provider, Service, ScheduleAssignment, PTOSummary } from '@/lib/types';
import ProviderAvailabilityEditor from '@/app/components/ProviderAvailabilityEditor';
import ProviderLeaveManager from '@/app/components/ProviderLeaveManager';
import ProviderAssignmentModal from '@/app/components/ProviderAssignmentModal';
import { useAdmin } from '@/app/contexts/AdminContext';
import PasscodeModal from '@/app/components/layout/PasscodeModal';

// Mount Sinai Colors
const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  lightGray: '#F5F5F5',
  border: '#E5E7EB',
  pto: '#DC2626',
  free: '#9CA3AF',
  lightBlueBg: '#E6F2FF',
};

// Full-day services that show in both AM and PM
const FULL_DAY_SERVICES = ['PTO', 'Nuclear Stress', 'Fourth Floor Echo Lab', 'Precepting', 'Nuclear', 'Inpatient'];

type ViewMode = 'week' | 'month';

interface AssignmentWithService extends ScheduleAssignment {
  service: Service;
}

// Helper to get start of week (Monday)
function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Helper to format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Helper to add days
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Helper to get month start/end
function getMonthRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start, end };
}

export default function ProviderProfilePage() {
  const params = useParams();
  const initials = params.initials as string;

  const [provider, setProvider] = useState<Provider | null>(null);
  const [assignments, setAssignments] = useState<AssignmentWithService[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [services, setServices] = useState<Service[]>([]);
  const [showAvailabilityEditor, setShowAvailabilityEditor] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{
    date: string;
    timeBlock: 'AM' | 'PM';
  } | null>(null);
  const [ptoSummary, setPtoSummary] = useState<PTOSummary | null>(null);
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);

  // Admin authentication
  const { isAuthenticated, authenticate } = useAdmin();

  // Fetch provider data
  useEffect(() => {
    async function fetchProvider() {
      const { data, error } = await supabase
        .from('providers')
        .select('*')
        .eq('initials', initials)
        .single();

      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setProvider(data);
    }

    fetchProvider();
  }, [initials]);

  // Fetch services for availability editor
  useEffect(() => {
    async function fetchServices() {
      const { data } = await supabase.from('services').select('*');
      setServices(data || []);
    }
    fetchServices();
  }, []);

  // Fetch PTO summary
  useEffect(() => {
    async function fetchPTOSummary() {
      if (!provider) return;
      try {
        const year = new Date().getFullYear();
        const res = await fetch(`/api/providers/${provider.id}/pto-summary?year=${year}`);
        if (res.ok) {
          const data = await res.json();
          setPtoSummary(data);
        }
      } catch (error) {
        console.error('Error fetching PTO summary:', error);
      }
    }
    fetchPTOSummary();
  }, [provider]);

  // Fetch assignments function (reusable)
  const fetchAssignments = async () => {
    if (!provider) return;

    let startDate: string;
    let endDate: string;

    if (viewMode === 'week') {
      const weekStart = getStartOfWeek(currentDate);
      const weekEnd = addDays(weekStart, 6);
      startDate = formatDate(weekStart);
      endDate = formatDate(weekEnd);
    } else {
      const { start, end } = getMonthRange(currentDate);
      startDate = formatDate(start);
      endDate = formatDate(end);
    }

    const { data, error } = await supabase
      .from('schedule_assignments')
      .select('*, service:services(*)')
      .eq('provider_id', provider.id)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date');

    if (error) {
      console.error('Error fetching assignments:', error);
    } else {
      setAssignments(data || []);
    }
    setLoading(false);
  };

  // Fetch assignments based on view mode and date
  useEffect(() => {
    if (!provider) return;
    fetchAssignments();
  }, [provider, viewMode, currentDate]);

  // Navigation handlers
  const navigatePrev = () => {
    if (viewMode === 'week') {
      setCurrentDate(addDays(currentDate, -7));
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    }
  };

  const navigateNext = () => {
    if (viewMode === 'week') {
      setCurrentDate(addDays(currentDate, 7));
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Provider Not Found</h1>
        <p className="text-gray-600 mb-6">
          No provider with initials &quot;{initials}&quot; exists in the system.
        </p>
        <Link
          href="/providers"
          className="px-4 py-2 rounded text-white"
          style={{ backgroundColor: colors.primaryBlue }}
        >
          ← Back to Provider Directory
        </Link>
      </div>
    );
  }

  if (loading || !provider) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header
        className="py-4 px-4 shadow-sm"
        style={{ backgroundColor: colors.primaryBlue }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link
            href="/providers"
            className="text-blue-100 hover:text-white text-sm"
          >
            ← Back to Directory
          </Link>
          <span className="text-blue-100 text-sm">
            Mount Sinai West - Fuster Heart Hospital
          </span>
        </div>
      </header>

      {/* Profile Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex flex-wrap items-start gap-4">
            {/* Initials Badge */}
            <div
              className="w-16 h-16 rounded-lg flex items-center justify-center text-white text-2xl font-bold"
              style={{ backgroundColor: colors.primaryBlue }}
            >
              {provider.initials}
            </div>

            {/* Name and Info */}
            <div className="flex-1">
              <h1
                className="text-2xl md:text-3xl font-bold"
                style={{ color: colors.primaryBlue }}
              >
                {provider.name}
              </h1>

              <div className="flex flex-wrap items-center gap-2 mt-2">
                {/* Credentials Badge */}
                <span
                  className="px-3 py-1 rounded-full text-sm font-medium text-white"
                  style={{ backgroundColor: colors.lightBlue }}
                >
                  {provider.role === 'fellow' ? 'Fellow' : 'MD'}
                </span>

                {/* Room Count */}
                {provider.default_room_count > 0 && (
                  <span
                    className="px-3 py-1 rounded-full text-sm font-medium"
                    style={{
                      backgroundColor: `${colors.teal}20`,
                      color: colors.teal,
                    }}
                  >
                    {provider.default_room_count} room{provider.default_room_count > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Capabilities */}
              <div className="flex flex-wrap gap-2 mt-3">
                {provider.capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="px-3 py-1 rounded-full text-sm"
                    style={{
                      backgroundColor: colors.lightBlueBg,
                      color: colors.primaryBlue,
                    }}
                  >
                    {cap}
                  </span>
                ))}
              </div>

              {/* Availability Rules Button - Admin Only */}
              {isAuthenticated && (
                <div className="mt-4">
                  <button
                    onClick={() => setShowAvailabilityEditor(!showAvailabilityEditor)}
                    className="px-4 py-2 rounded text-sm font-medium"
                    style={{ backgroundColor: colors.lightBlue, color: 'white' }}
                  >
                    {showAvailabilityEditor ? 'Hide' : 'Manage'} Availability Rules
                  </button>
                </div>
              )}
            </div>

            {/* PTO Summary Card */}
            {ptoSummary && (
              <div
                className="rounded-lg p-4 min-w-[200px]"
                style={{ backgroundColor: colors.lightBlueBg }}
              >
                <h3 className="text-sm font-semibold mb-2" style={{ color: colors.primaryBlue }}>
                  PTO Summary ({ptoSummary.year})
                </h3>
                <div className="text-2xl font-bold mb-1" style={{ color: colors.pto }}>
                  {ptoSummary.total_pto_days} day{ptoSummary.total_pto_days !== 1 ? 's' : ''}
                </div>
                {Object.keys(ptoSummary.requests_by_type).length > 0 && (
                  <div className="text-xs text-gray-600 space-y-0.5">
                    {Object.entries(ptoSummary.requests_by_type).map(([type, days]) => (
                      <div key={type} className="flex justify-between">
                        <span className="capitalize">{type}:</span>
                        <span>{days} day{days !== 1 ? 's' : ''}</span>
                      </div>
                    ))}
                  </div>
                )}
                {ptoSummary.holidays_taken > 0 && (
                  <div className="mt-2 text-xs" style={{ color: colors.teal }}>
                    {ptoSummary.holidays_taken} request{ptoSummary.holidays_taken !== 1 ? 's' : ''} near holidays
                  </div>
                )}
                <Link
                  href="/pto-requests"
                  className="mt-2 inline-block text-xs underline"
                  style={{ color: colors.lightBlue }}
                >
                  Request PTO →
                </Link>
              </div>
            )}
          </div>

          {/* Availability Editor */}
          {showAvailabilityEditor && provider && (
            <div className="mt-4">
              <ProviderAvailabilityEditor
                providerId={provider.id}
                providerName={provider.name}
                services={services}
              />
            </div>
          )}
        </div>
      </div>

      {/* Schedule Section */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* View Toggle and Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          {/* View Mode Toggle */}
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: colors.border }}>
            <button
              onClick={() => setViewMode('week')}
              className="px-4 py-2 text-sm font-medium transition-colors"
              style={{
                backgroundColor: viewMode === 'week' ? colors.primaryBlue : 'white',
                color: viewMode === 'week' ? 'white' : colors.primaryBlue,
              }}
            >
              Weekly View
            </button>
            <button
              onClick={() => setViewMode('month')}
              className="px-4 py-2 text-sm font-medium transition-colors"
              style={{
                backgroundColor: viewMode === 'month' ? colors.primaryBlue : 'white',
                color: viewMode === 'month' ? 'white' : colors.primaryBlue,
              }}
            >
              Monthly View
            </button>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={navigatePrev}
              className="px-3 py-2 rounded text-sm font-medium text-white hover:opacity-90"
              style={{ backgroundColor: colors.primaryBlue }}
            >
              ← Previous
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-2 rounded text-sm font-medium border hover:bg-gray-50"
              style={{ borderColor: colors.border, color: colors.primaryBlue }}
            >
              Today
            </button>
            <button
              onClick={navigateNext}
              className="px-3 py-2 rounded text-sm font-medium text-white hover:opacity-90"
              style={{ backgroundColor: colors.primaryBlue }}
            >
              Next →
            </button>
          </div>
        </div>

        {/* Date Range Display */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold" style={{ color: colors.primaryBlue }}>
            {viewMode === 'week' ? (
              <>
                {formatDate(getStartOfWeek(currentDate))} to{' '}
                {formatDate(addDays(getStartOfWeek(currentDate), 6))}
              </>
            ) : (
              currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            )}
          </h2>
        </div>

        {/* Schedule Grid */}
        {viewMode === 'week' ? (
          <WeeklySchedule
            assignments={assignments}
            currentDate={currentDate}
            onCellClick={isAuthenticated
              ? (date, timeBlock) => setSelectedSlot({ date, timeBlock })
              : () => setShowPasscodeModal(true)
            }
          />
        ) : (
          <MonthlySchedule
            assignments={assignments}
            currentDate={currentDate}
          />
        )}

        {/* Leave Manager - Admin Only */}
        {isAuthenticated && (
          <div className="mt-6">
            <ProviderLeaveManager
              providerId={provider.id}
              providerName={provider.name}
            />
          </div>
        )}
      </main>

      {/* Assignment Modal */}
      {selectedSlot && provider && (
        <ProviderAssignmentModal
          provider={provider}
          date={selectedSlot.date}
          timeBlock={selectedSlot.timeBlock}
          assignments={assignments.filter(a =>
            a.date === selectedSlot.date &&
            (a.time_block === selectedSlot.timeBlock || a.time_block === 'BOTH')
          )}
          services={services}
          onClose={() => setSelectedSlot(null)}
          onAssignmentChange={() => {
            fetchAssignments();
          }}
        />
      )}

      {/* Admin Passcode Modal */}
      <PasscodeModal
        isOpen={showPasscodeModal}
        onClose={() => setShowPasscodeModal(false)}
        onAuthenticate={authenticate}
      />
    </div>
  );
}

// Weekly Schedule Component
function WeeklySchedule({
  assignments,
  currentDate,
  onCellClick,
}: {
  assignments: AssignmentWithService[];
  currentDate: Date;
  onCellClick?: (date: string, timeBlock: 'AM' | 'PM') => void;
}) {
  const weekStart = getStartOfWeek(currentDate);
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const timeBlocks = ['AM', 'PM'];

  // Build schedule grid
  const buildGrid = () => {
    const grid: { [key: string]: { [key: string]: string[] } } = {
      AM: {},
      PM: {},
    };

    // Initialize all cells
    days.forEach((_, idx) => {
      const date = formatDate(addDays(weekStart, idx));
      grid.AM[date] = [];
      grid.PM[date] = [];
    });

    // Fill with assignments
    assignments.forEach((a) => {
      const serviceName = a.service?.name || 'Unknown';
      const isFullDay = a.service?.time_block === 'BOTH' || FULL_DAY_SERVICES.some(s => serviceName.includes(s));

      if (isFullDay) {
        if (!grid.AM[a.date]?.includes(serviceName)) {
          grid.AM[a.date]?.push(serviceName);
        }
        if (!grid.PM[a.date]?.includes(serviceName)) {
          grid.PM[a.date]?.push(serviceName);
        }
      } else if (a.time_block === 'AM') {
        if (!grid.AM[a.date]?.includes(serviceName)) {
          grid.AM[a.date]?.push(serviceName);
        }
      } else if (a.time_block === 'PM') {
        if (!grid.PM[a.date]?.includes(serviceName)) {
          grid.PM[a.date]?.push(serviceName);
        }
      }
    });

    return grid;
  };

  const grid = buildGrid();

  const getCellStyle = (services: string[]) => {
    if (services.length === 0) {
      return {
        backgroundColor: colors.lightGray,
        color: colors.free,
      };
    }
    if (services.some((s) => s === 'PTO')) {
      return {
        backgroundColor: colors.pto,
        color: 'white',
      };
    }
    return {
      backgroundColor: 'white',
      color: colors.primaryBlue,
    };
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th
              className="p-3 text-left text-sm font-semibold"
              style={{ backgroundColor: colors.lightGray }}
            >
              Time
            </th>
            {days.map((day, idx) => {
              const date = addDays(weekStart, idx);
              return (
                <th
                  key={day}
                  className="p-3 text-center text-sm font-semibold text-white min-w-[120px]"
                  style={{ backgroundColor: colors.primaryBlue }}
                >
                  <div>{day}</div>
                  <div className="text-xs font-normal opacity-80">
                    {date.getMonth() + 1}/{date.getDate()}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {timeBlocks.map((block) => (
            <tr key={block}>
              <td
                className="p-3 text-center text-sm font-semibold text-white"
                style={{ backgroundColor: colors.lightBlue }}
              >
                {block}
              </td>
              {days.map((_, idx) => {
                const date = formatDate(addDays(weekStart, idx));
                const services = grid[block][date] || [];
                const style = getCellStyle(services);

                return (
                  <td
                    key={date}
                    className={`p-3 text-center text-sm border ${onCellClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                    style={{
                      ...style,
                      borderColor: colors.border,
                    }}
                    onClick={() => onCellClick?.(date, block as 'AM' | 'PM')}
                  >
                    {services.length > 0 ? (
                      <span className="font-medium">
                        {services.join(', ')}
                      </span>
                    ) : (
                      <span className="italic">Free</span>
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

// Monthly Schedule Component
function MonthlySchedule({
  assignments,
  currentDate,
}: {
  assignments: AssignmentWithService[];
  currentDate: Date;
}) {
  const { start, end } = getMonthRange(currentDate);
  const daysInMonth = end.getDate();
  const firstDayOfWeek = start.getDay(); // 0 = Sunday
  const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // Adjust for Monday start

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Build assignment map
  const assignmentMap: { [date: string]: { AM: string[]; PM: string[] } } = {};

  for (let d = 1; d <= daysInMonth; d++) {
    const date = formatDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), d));
    assignmentMap[date] = { AM: [], PM: [] };
  }

  assignments.forEach((a) => {
    if (!assignmentMap[a.date]) return;

    const serviceName = a.service?.name || 'Unknown';
    const isFullDay = a.service?.time_block === 'BOTH' || FULL_DAY_SERVICES.some(s => serviceName.includes(s));

    if (isFullDay) {
      if (!assignmentMap[a.date].AM.includes(serviceName)) {
        assignmentMap[a.date].AM.push(serviceName);
      }
      if (!assignmentMap[a.date].PM.includes(serviceName)) {
        assignmentMap[a.date].PM.push(serviceName);
      }
    } else if (a.time_block === 'AM') {
      if (!assignmentMap[a.date].AM.includes(serviceName)) {
        assignmentMap[a.date].AM.push(serviceName);
      }
    } else if (a.time_block === 'PM') {
      if (!assignmentMap[a.date].PM.includes(serviceName)) {
        assignmentMap[a.date].PM.push(serviceName);
      }
    }
  });

  // Build calendar grid
  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = [];

  // Add empty cells for days before start
  for (let i = 0; i < adjustedFirstDay; i++) {
    week.push(null);
  }

  // Add days
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }

  // Add empty cells for remaining days
  while (week.length > 0 && week.length < 7) {
    week.push(null);
  }
  if (week.length > 0) {
    weeks.push(week);
  }

  const getCellBgColor = (dayAssignments: { AM: string[]; PM: string[] }) => {
    const hasPTO = dayAssignments.AM.includes('PTO') || dayAssignments.PM.includes('PTO');
    if (hasPTO) return colors.pto;
    return 'white';
  };

  const shortenService = (name: string) => {
    // Shorten long service names for calendar display
    const shortNames: { [key: string]: string } = {
      'Fourth Floor Echo Lab': '4th Echo',
      'Echo TTE AM': 'TTE',
      'Echo TTE PM': 'TTE',
      'Stress Echo AM': 'Stress',
      'Stress Echo PM': 'Stress',
      'Nuclear Stress': 'Nuclear',
      'Rooms AM': 'Rooms',
      'Rooms PM': 'Rooms',
      'Admin AM': 'Admin',
      'Admin PM': 'Admin',
      'Offsites AM': 'Offsite',
      'Offsites PM': 'Offsite',
      'Inpatient': 'Inpat',
    };
    return shortNames[name] || name;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {dayNames.map((day) => (
              <th
                key={day}
                className="p-2 text-center text-sm font-semibold text-white"
                style={{ backgroundColor: colors.primaryBlue }}
              >
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, weekIdx) => (
            <tr key={weekIdx}>
              {week.map((day, dayIdx) => {
                if (day === null) {
                  return (
                    <td
                      key={dayIdx}
                      className="p-1 border h-24"
                      style={{
                        backgroundColor: colors.lightGray,
                        borderColor: colors.border,
                      }}
                    />
                  );
                }

                const date = formatDate(
                  new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
                );
                const dayAssignments = assignmentMap[date] || { AM: [], PM: [] };
                const bgColor = getCellBgColor(dayAssignments);
                const hasPTO = dayAssignments.AM.includes('PTO');

                return (
                  <td
                    key={dayIdx}
                    className="p-1 border align-top h-24"
                    style={{
                      backgroundColor: bgColor,
                      borderColor: colors.border,
                    }}
                  >
                    {/* Date Number */}
                    <div
                      className="text-sm font-semibold mb-1"
                      style={{ color: hasPTO ? 'white' : colors.primaryBlue }}
                    >
                      {day}
                    </div>

                    {/* AM Assignments */}
                    <div
                      className="text-xs mb-0.5"
                      style={{ color: hasPTO ? 'white' : colors.primaryBlue }}
                    >
                      <span className="font-medium" style={{ color: hasPTO ? 'rgba(255,255,255,0.8)' : colors.lightBlue }}>
                        AM:
                      </span>{' '}
                      {dayAssignments.AM.length > 0 ? (
                        dayAssignments.AM.map(shortenService).join(', ')
                      ) : (
                        <span style={{ color: hasPTO ? 'rgba(255,255,255,0.6)' : colors.free }}>Free</span>
                      )}
                    </div>

                    {/* PM Assignments */}
                    <div
                      className="text-xs"
                      style={{ color: hasPTO ? 'white' : colors.primaryBlue }}
                    >
                      <span className="font-medium" style={{ color: hasPTO ? 'rgba(255,255,255,0.8)' : colors.lightBlue }}>
                        PM:
                      </span>{' '}
                      {dayAssignments.PM.length > 0 ? (
                        dayAssignments.PM.map(shortenService).join(', ')
                      ) : (
                        <span style={{ color: hasPTO ? 'rgba(255,255,255,0.6)' : colors.free }}>Free</span>
                      )}
                    </div>
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
