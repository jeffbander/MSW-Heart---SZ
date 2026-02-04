'use client';

import React, { useState, useMemo } from 'react';
import { Provider, Service, ScheduleAssignment } from '@/lib/types';
import TestingProviderAssignmentModal from './TestingProviderAssignmentModal';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  lightGray: '#F5F5F5',
  border: '#E5E7EB',
};

interface ProvidersScheduleGridProps {
  weekDates: string[];
  assignments: ScheduleAssignment[];
  services: Service[];
  providers: Provider[];
  isAdmin: boolean;
  onAssignmentChange: () => void;
}

// Service row definition after merging AM/PM variants
interface ServiceRow {
  label: string;
  amService: Service | null;
  pmService: Service | null;
  isFullDay: boolean; // true = single service spans AM+PM
}

// CVI Testing service names to look for
const CVI_SERVICE_PATTERNS = [
  'Echo TTE',
  'Stress Echo',
  'Nuclear Stress',
  'Nuclear',
];

const FOURTH_FLOOR_PATTERN = 'Fourth Floor Echo Lab';

function matchService(service: Service, pattern: string): boolean {
  return service.name.toLowerCase().includes(pattern.toLowerCase());
}

function buildServiceRows(services: Service[]): { cviRows: ServiceRow[]; fourthFloorRows: ServiceRow[] } {
  const cviRows: ServiceRow[] = [];
  const fourthFloorRows: ServiceRow[] = [];

  // Helper: find services matching a base name
  const findAMPM = (baseName: string) => {
    const am = services.find(s =>
      s.name.toLowerCase() === `${baseName} am`.toLowerCase() ||
      (s.name.toLowerCase() === baseName.toLowerCase() && s.time_block === 'AM')
    );
    const pm = services.find(s =>
      s.name.toLowerCase() === `${baseName} pm`.toLowerCase() ||
      (s.name.toLowerCase() === baseName.toLowerCase() && s.time_block === 'PM')
    );
    const both = services.find(s =>
      s.name.toLowerCase() === baseName.toLowerCase() && s.time_block === 'BOTH'
    );
    return { am, pm, both };
  };

  // Echo TTE - look for AM/PM variants
  const echoTTE = findAMPM('Echo TTE');
  if (echoTTE.am || echoTTE.pm) {
    cviRows.push({
      label: 'Echo TTE',
      amService: echoTTE.am || null,
      pmService: echoTTE.pm || null,
      isFullDay: false,
    });
  } else if (echoTTE.both) {
    cviRows.push({
      label: 'Echo TTE',
      amService: echoTTE.both,
      pmService: echoTTE.both,
      isFullDay: true,
    });
  }

  // Stress Echo - look for AM/PM variants
  const stressEcho = findAMPM('Stress Echo');
  if (stressEcho.am || stressEcho.pm) {
    cviRows.push({
      label: 'Stress Echo',
      amService: stressEcho.am || null,
      pmService: stressEcho.pm || null,
      isFullDay: false,
    });
  } else if (stressEcho.both) {
    cviRows.push({
      label: 'Stress Echo',
      amService: stressEcho.both,
      pmService: stressEcho.both,
      isFullDay: true,
    });
  }

  // Nuclear Stress - full day
  const nuclearStress = services.find(s => matchService(s, 'Nuclear Stress'));
  if (nuclearStress) {
    cviRows.push({
      label: 'Nuclear Stress',
      amService: nuclearStress,
      pmService: nuclearStress,
      isFullDay: true,
    });
  }

  // Nuclear (but not Nuclear Stress) - full day
  const nuclear = services.find(s =>
    s.name.toLowerCase() === 'nuclear' ||
    (matchService(s, 'Nuclear') && !matchService(s, 'Nuclear Stress'))
  );
  if (nuclear && nuclear.id !== nuclearStress?.id) {
    cviRows.push({
      label: 'Nuclear',
      amService: nuclear,
      pmService: nuclear,
      isFullDay: true,
    });
  }

  // Fourth Floor Echo Lab - full day
  const fourthFloor = services.find(s => matchService(s, FOURTH_FLOOR_PATTERN));
  if (fourthFloor) {
    fourthFloorRows.push({
      label: 'Fourth Floor Echo Lab',
      amService: fourthFloor,
      pmService: fourthFloor,
      isFullDay: true,
    });
  }

  return { cviRows, fourthFloorRows };
}

function formatDayHeader(dateStr: string): { dayName: string; dateLabel: string } {
  const d = new Date(dateStr + 'T00:00:00');
  const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
  const dateLabel = d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
  return { dayName, dateLabel };
}

export default function ProvidersScheduleGrid({
  weekDates,
  assignments,
  services,
  providers,
  isAdmin,
  onAssignmentChange,
}: ProvidersScheduleGridProps) {
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalService, setModalService] = useState<Service | null>(null);
  const [modalDate, setModalDate] = useState('');
  const [modalTimeBlock, setModalTimeBlock] = useState<'AM' | 'PM'>('AM');
  const [modalCurrentAssignment, setModalCurrentAssignment] = useState<ScheduleAssignment | null>(null);

  // Only show weekdays (Mon-Fri)
  const weekdays = weekDates.filter(d => {
    const day = new Date(d + 'T00:00:00').getDay();
    return day >= 1 && day <= 5;
  });

  const { cviRows, fourthFloorRows } = useMemo(() => buildServiceRows(services), [services]);

  // Get assignment for a service + date + time_block
  const getAssignment = (service: Service | null, date: string, timeBlock: 'AM' | 'PM'): ScheduleAssignment | null => {
    if (!service) return null;
    // For BOTH services, match any time_block
    const match = assignments.find(a =>
      a.service_id === service.id &&
      a.date === date &&
      (a.time_block === timeBlock || a.time_block === 'BOTH' || service.time_block === 'BOTH')
    );
    return match || null;
  };

  const handleCellClick = (service: Service, date: string, timeBlock: 'AM' | 'PM') => {
    if (!isAdmin) return;
    const assignment = getAssignment(service, date, timeBlock);
    setModalService(service);
    setModalDate(date);
    setModalTimeBlock(timeBlock);
    setModalCurrentAssignment(assignment);
    setModalOpen(true);
  };

  const renderCell = (
    row: ServiceRow,
    date: string,
    timeBlock: 'AM' | 'PM'
  ) => {
    const service = timeBlock === 'AM' ? row.amService : row.pmService;
    if (!service) {
      return (
        <td key={`${date}-${timeBlock}`} className="border px-1 py-1 text-center text-xs text-gray-300" style={{ borderColor: colors.border }}>
          --
        </td>
      );
    }

    const assignment = getAssignment(service, date, timeBlock);
    const initials = assignment?.provider?.initials || '';
    const isEmpty = !initials;

    return (
      <td
        key={`${date}-${timeBlock}`}
        className={`border px-1 py-1 text-center text-xs font-medium ${
          isAdmin ? 'cursor-pointer hover:bg-blue-50' : ''
        } ${isEmpty ? 'text-gray-300' : ''}`}
        style={{
          borderColor: colors.border,
          color: isEmpty ? undefined : colors.primaryBlue,
          backgroundColor: isEmpty ? undefined : `${colors.lightBlue}10`,
        }}
        onClick={() => handleCellClick(service, date, timeBlock)}
        title={assignment?.provider?.name || 'Unassigned'}
      >
        {initials || '--'}
      </td>
    );
  };

  const renderFullDayCell = (row: ServiceRow, date: string) => {
    const service = row.amService; // same service for both
    if (!service) {
      return (
        <td key={date} colSpan={2} className="border px-1 py-1 text-center text-xs text-gray-300" style={{ borderColor: colors.border }}>
          --
        </td>
      );
    }

    const assignment = getAssignment(service, date, 'AM') || getAssignment(service, date, 'PM');
    const initials = assignment?.provider?.initials || '';
    const isEmpty = !initials;

    // Determine what time_block to use for modal - use BOTH if service is BOTH, otherwise AM
    const effectiveTimeBlock = service.time_block === 'BOTH' ? 'AM' : service.time_block as 'AM' | 'PM';

    return (
      <td
        key={date}
        colSpan={2}
        className={`border px-1 py-1 text-center text-xs font-medium ${
          isAdmin ? 'cursor-pointer hover:bg-blue-50' : ''
        } ${isEmpty ? 'text-gray-300' : ''}`}
        style={{
          borderColor: colors.border,
          color: isEmpty ? undefined : colors.primaryBlue,
          backgroundColor: isEmpty ? undefined : `${colors.lightBlue}10`,
        }}
        onClick={() => handleCellClick(service, date, effectiveTimeBlock)}
        title={assignment?.provider?.name || 'Unassigned'}
      >
        {initials || '--'}
      </td>
    );
  };

  const renderServiceRow = (row: ServiceRow) => (
    <tr key={row.label}>
      <td
        className="border px-2 py-1 text-xs font-medium whitespace-nowrap sticky left-0 bg-white z-10"
        style={{ borderColor: colors.border, color: colors.primaryBlue }}
      >
        {row.label}
      </td>
      {weekdays.map(date =>
        row.isFullDay
          ? renderFullDayCell(row, date)
          : (
            <React.Fragment key={date}>
              {renderCell(row, date, 'AM')}
              {renderCell(row, date, 'PM')}
            </React.Fragment>
          )
      )}
    </tr>
  );

  const renderCategoryHeader = (label: string) => (
    <tr key={`header-${label}`}>
      <td
        colSpan={1 + weekdays.length * 2}
        className="border px-2 py-2 text-xs font-bold uppercase tracking-wide"
        style={{
          borderColor: colors.border,
          backgroundColor: `${colors.primaryBlue}10`,
          color: colors.primaryBlue,
        }}
      >
        {label}
      </td>
    </tr>
  );

  if (cviRows.length === 0 && fourthFloorRows.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
        <p className="mb-2 font-medium">No matching services found</p>
        <p className="text-sm">
          The Providers tab looks for services named: Echo TTE AM/PM, Stress Echo AM/PM,
          Nuclear Stress, Nuclear, and Fourth Floor Echo Lab.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th
                className="border px-2 py-2 text-left text-xs font-semibold sticky left-0 bg-white z-20"
                style={{ borderColor: colors.border, color: colors.primaryBlue, minWidth: '120px' }}
              >
                Service
              </th>
              {weekdays.map(date => {
                const { dayName, dateLabel } = formatDayHeader(date);
                return (
                  <th
                    key={date}
                    colSpan={2}
                    className="border px-1 py-1 text-center text-xs font-semibold"
                    style={{ borderColor: colors.border, color: colors.primaryBlue }}
                  >
                    <div>{dayName}</div>
                    <div className="font-normal text-gray-500">{dateLabel}</div>
                  </th>
                );
              })}
            </tr>
            <tr>
              <th
                className="border px-2 py-1 sticky left-0 bg-white z-20"
                style={{ borderColor: colors.border }}
              />
              {weekdays.map(date => (
                <React.Fragment key={date}>
                  <th
                    className="border px-1 py-0.5 text-center text-xs font-medium text-gray-500"
                    style={{ borderColor: colors.border }}
                  >
                    AM
                  </th>
                  <th
                    className="border px-1 py-0.5 text-center text-xs font-medium text-gray-500"
                    style={{ borderColor: colors.border }}
                  >
                    PM
                  </th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {cviRows.length > 0 && (
              <>
                {renderCategoryHeader('CVI Testing')}
                {cviRows.map(row => renderServiceRow(row))}
              </>
            )}
            {fourthFloorRows.length > 0 && (
              <>
                {renderCategoryHeader('Fourth Floor Echo Lab')}
                {fourthFloorRows.map(row => renderServiceRow(row))}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Assignment Modal */}
      {modalService && (
        <TestingProviderAssignmentModal
          isOpen={modalOpen}
          service={modalService}
          date={modalDate}
          timeBlock={modalTimeBlock}
          providers={providers}
          currentAssignment={modalCurrentAssignment}
          onClose={() => {
            setModalOpen(false);
            setModalService(null);
          }}
          onAssignmentChange={onAssignmentChange}
        />
      )}
    </>
  );
}

