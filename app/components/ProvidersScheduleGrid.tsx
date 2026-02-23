'use client';

import React, { useState, useMemo, useRef } from 'react';
import { Provider, Service, ScheduleAssignment, Holiday } from '@/lib/types';
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
  holidays: Holiday[];
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

const getLastName = (name: string): string => {
  const parts = name.trim().split(' ');
  return parts[parts.length - 1];
};

export default function ProvidersScheduleGrid({
  weekDates,
  assignments,
  services,
  providers,
  isAdmin,
  onAssignmentChange,
  holidays,
}: ProvidersScheduleGridProps) {
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalService, setModalService] = useState<Service | null>(null);
  const [modalDate, setModalDate] = useState('');
  const [modalTimeBlock, setModalTimeBlock] = useState<'AM' | 'PM'>('AM');
  const [modalCurrentAssignment, setModalCurrentAssignment] = useState<ScheduleAssignment | null>(null);

  // PDF export state
  const tableRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Build holiday lookup map
  const holidayMap = useMemo(() => {
    const map = new Map<string, Holiday>();
    for (const h of holidays) {
      map.set(h.date, h);
    }
    return map;
  }, [holidays]);

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

  // Check if a provider has PTO overlapping with a given date/time_block
  const providerHasPTO = (providerId: string, date: string, timeBlock: 'AM' | 'PM'): boolean => {
    return assignments.some(a =>
      a.provider_id === providerId &&
      a.date === date &&
      a.is_pto &&
      (a.time_block === 'BOTH' || a.time_block === timeBlock)
    );
  };

  const handleCellClick = (service: Service, date: string, timeBlock: 'AM' | 'PM') => {
    if (!isAdmin) return;
    if (holidayMap.has(date)) return; // Non-clickable on holidays
    const assignment = getAssignment(service, date, timeBlock);
    setModalService(service);
    setModalDate(date);
    setModalTimeBlock(timeBlock);
    setModalCurrentAssignment(assignment);
    setModalOpen(true);
  };

  const formatLocalDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleDownloadMonthlyPDF = async () => {
    setIsExporting(true);

    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      // Determine current month from weekDates
      const refDate = new Date(weekDates[0] + 'T00:00:00');
      const month = refDate.getMonth();
      const year = refDate.getFullYear();
      const monthName = refDate.toLocaleDateString('en-US', { month: 'long' });

      const firstOfMonth = new Date(year, month, 1);
      const lastOfMonth = new Date(year, month + 1, 0);
      const startStr = formatLocalDate(firstOfMonth);
      const endStr = formatLocalDate(lastOfMonth);

      // Fetch full month data
      const [assignmentsRes, holidaysRes] = await Promise.all([
        fetch(`/api/assignments?startDate=${startStr}&endDate=${endStr}`),
        fetch(`/api/holidays?startDate=${startStr}&endDate=${endStr}`),
      ]);

      const monthAssignments: ScheduleAssignment[] = assignmentsRes.ok ? await assignmentsRes.json() : [];
      const monthHolidays: Holiday[] = holidaysRes.ok ? await holidaysRes.json() : [];

      // Build holiday map for month
      const mHolidayMap = new Map<string, Holiday>();
      for (const h of monthHolidays) mHolidayMap.set(h.date, h);

      // Calculate all weeks in the month (Mon-Fri)
      const weeks: string[][] = [];
      const cursor = new Date(firstOfMonth);
      while (cursor.getDay() !== 1) cursor.setDate(cursor.getDate() - 1);

      while (cursor <= lastOfMonth || weeks.length === 0) {
        const weekDays: string[] = [];
        for (let i = 0; i < 5; i++) {
          const d = new Date(cursor);
          d.setDate(cursor.getDate() + i);
          weekDays.push(formatLocalDate(d));
        }
        if (weekDays.some(d => new Date(d + 'T00:00:00').getMonth() === month)) {
          weeks.push(weekDays);
        }
        cursor.setDate(cursor.getDate() + 7);
      }

      // Service rows
      const { cviRows: mCviRows, fourthFloorRows: mFourthFloorRows } = buildServiceRows(services);
      const allCategories = [
        ...(mCviRows.length > 0 ? [{ header: 'CVI TESTING', rows: mCviRows }] : []),
        ...(mFourthFloorRows.length > 0 ? [{ header: 'FOURTH FLOOR ECHO LAB', rows: mFourthFloorRows }] : []),
      ];

      // Helper to find assignment in month data
      const findAssignment = (serviceId: string, date: string, timeBlock: 'AM' | 'PM', serviceTimeBlock: string) => {
        return monthAssignments.find(a =>
          a.service_id === serviceId &&
          a.date === date &&
          (a.time_block === timeBlock || a.time_block === 'BOTH' || serviceTimeBlock === 'BOTH')
        ) || null;
      };

      // Compact cell styles for single-page fit
      const cellStyle = (bg: string, color: string) =>
        `border:1px solid #ccc;padding:2px 3px;text-align:center;font-size:9px;font-weight:500;background:${bg};color:${color};`;

      const buildDataCell = (row: ServiceRow, date: string, timeBlock: 'AM' | 'PM') => {
        const holiday = mHolidayMap.get(date);
        if (holiday) {
          return `<td style="${cellStyle('#EDE9FE', '#7C3AED')}">HOL</td>`;
        }
        const service = timeBlock === 'AM' ? row.amService : row.pmService;
        if (!service) {
          return `<td style="${cellStyle('white', '#D1D5DB')}">--</td>`;
        }
        const assignment = findAssignment(service.id, date, timeBlock, service.time_block);
        const name = assignment?.provider?.name ? getLastName(assignment.provider.name) : '--';
        const color = name !== '--' ? '#003D7A' : '#D1D5DB';
        const bg = name !== '--' ? 'rgba(0,120,200,0.06)' : 'white';
        return `<td style="${cellStyle(bg, color)}">${name}</td>`;
      };

      const buildFullDayCell = (row: ServiceRow, date: string) => {
        const holiday = mHolidayMap.get(date);
        if (holiday) {
          return `<td colspan="2" style="${cellStyle('#EDE9FE', '#7C3AED')}">HOL</td>`;
        }
        const service = row.amService;
        if (!service) {
          return `<td colspan="2" style="${cellStyle('white', '#D1D5DB')}">--</td>`;
        }
        const assignment = findAssignment(service.id, date, 'AM', service.time_block) || findAssignment(service.id, date, 'PM', service.time_block);
        const name = assignment?.provider?.name ? getLastName(assignment.provider.name) : '--';
        const color = name !== '--' ? '#003D7A' : '#D1D5DB';
        const bg = name !== '--' ? 'rgba(0,120,200,0.06)' : 'white';
        return `<td colspan="2" style="${cellStyle(bg, color)}">${name}</td>`;
      };

      // Create off-screen container — compact width
      const container = document.createElement('div');
      container.style.cssText = 'position:absolute;left:-9999px;top:0;background:white;padding:12px;width:1000px;';
      document.body.appendChild(container);

      // Compact title
      let html = `<div style="color:#003D7A;font-size:14px;font-weight:bold;margin-bottom:8px;font-family:system-ui,sans-serif;">
        Testing Providers Schedule &mdash; ${monthName} ${year}
      </div>`;

      // Build a compact table for each week
      for (const weekDays of weeks) {
        const wStart = formatDayHeader(weekDays[0]);
        const wEnd = formatDayHeader(weekDays[4]);

        html += `<div style="margin-bottom:8px;">
          <div style="color:#003D7A;font-size:10px;font-weight:600;margin-bottom:3px;font-family:system-ui,sans-serif;">
            Week of ${wStart.dateLabel} &ndash; ${wEnd.dateLabel}
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:9px;font-family:system-ui,sans-serif;">
            <thead>
              <tr>
                <th style="border:1px solid #ccc;padding:2px 3px;text-align:left;color:#003D7A;font-weight:600;background:white;font-size:9px;">Service</th>`;

        // Date headers — single row with day + date + holiday
        for (const date of weekDays) {
          const { dayName, dateLabel } = formatDayHeader(date);
          const hol = mHolidayMap.get(date);
          const bg = hol ? '#EDE9FE' : 'white';
          const clr = hol ? '#7C3AED' : '#003D7A';
          html += `<th colspan="2" style="border:1px solid #ccc;padding:2px 3px;text-align:center;color:${clr};font-weight:600;background:${bg};font-size:9px;">
            ${dayName} ${dateLabel}${hol ? ` <span style="font-weight:normal;font-size:8px;">(${hol.name})</span>` : ''}
          </th>`;
        }

        html += `</tr><tr>
          <th style="border:1px solid #ccc;padding:1px 3px;background:white;font-size:8px;"></th>`;

        // AM/PM sub-headers
        for (const date of weekDays) {
          const hol = mHolidayMap.get(date);
          const bg = hol ? '#EDE9FE' : 'white';
          const clr = hol ? '#7C3AED' : '#6B7280';
          html += `<th style="border:1px solid #ccc;padding:1px 3px;text-align:center;font-size:8px;font-weight:500;color:${clr};background:${bg};">AM</th>`;
          html += `<th style="border:1px solid #ccc;padding:1px 3px;text-align:center;font-size:8px;font-weight:500;color:${clr};background:${bg};">PM</th>`;
        }

        html += `</tr></thead><tbody>`;

        // Service rows per category
        for (const cat of allCategories) {
          html += `<tr><td colspan="${1 + weekDays.length * 2}" style="border:1px solid #ccc;padding:2px 3px;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.03em;background:rgba(0,61,122,0.06);color:#003D7A;">${cat.header}</td></tr>`;

          for (const row of cat.rows) {
            html += `<tr>`;
            html += `<td style="border:1px solid #ccc;padding:2px 3px;font-size:9px;font-weight:500;color:#003D7A;white-space:nowrap;background:white;">${row.label}</td>`;

            for (const date of weekDays) {
              if (row.isFullDay) {
                html += buildFullDayCell(row, date);
              } else {
                html += buildDataCell(row, date, 'AM');
                html += buildDataCell(row, date, 'PM');
              }
            }
            html += `</tr>`;
          }
        }

        html += `</tbody></table></div>`;
      }

      container.innerHTML = html;

      // Capture the full container
      const canvas = await html2canvas(container, { scale: 2, useCORS: true, logging: false });

      // Single-page landscape PDF — scale to fit
      const pdf = new jsPDF('landscape', 'mm', 'letter');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const availableWidth = pageWidth - margin * 2;
      const availableHeight = pageHeight - margin * 2;

      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      // Scale to fit BOTH width and height on one page
      const scale = Math.min(availableWidth / imgWidth, availableHeight / imgHeight);
      const pdfW = imgWidth * scale;
      const pdfH = imgHeight * scale;
      const xOffset = margin + (availableWidth - pdfW) / 2;
      const yOffset = margin;

      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', xOffset, yOffset, pdfW, pdfH);

      // Clean up
      document.body.removeChild(container);
      pdf.save(`testing-providers-schedule-${monthName.toLowerCase()}-${year}.pdf`);
    } catch (error) {
      console.error('Error generating monthly PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const renderCell = (
    row: ServiceRow,
    date: string,
    timeBlock: 'AM' | 'PM'
  ) => {
    const holiday = holidayMap.get(date);
    if (holiday) {
      return (
        <td
          key={`${date}-${timeBlock}`}
          className="border px-2 py-1 text-center text-xs font-medium"
          style={{
            borderColor: colors.border,
            backgroundColor: '#EDE9FE',
            color: '#7C3AED',
          }}
        >
          HOLIDAY
        </td>
      );
    }

    const service = timeBlock === 'AM' ? row.amService : row.pmService;
    if (!service) {
      return (
        <td key={`${date}-${timeBlock}`} className="border px-2 py-1 text-center text-xs text-gray-300 min-w-[60px]" style={{ borderColor: colors.border }}>
          --
        </td>
      );
    }

    const assignment = getAssignment(service, date, timeBlock);
    const displayName = assignment?.provider?.name ? getLastName(assignment.provider.name) : '';
    const isEmpty = !displayName;
    const hasPTOOverlap = assignment?.provider_id && !assignment.is_pto
      ? providerHasPTO(assignment.provider_id, date, timeBlock)
      : false;

    return (
      <td
        key={`${date}-${timeBlock}`}
        className={`border px-2 py-1 text-center text-xs font-medium min-w-[60px] ${
          isAdmin ? 'cursor-pointer hover:bg-blue-50' : ''
        } ${isEmpty ? 'text-gray-300' : ''}`}
        style={{
          borderColor: colors.border,
          color: isEmpty ? undefined : hasPTOOverlap ? '#B45309' : colors.primaryBlue,
          backgroundColor: isEmpty ? undefined : hasPTOOverlap ? '#FEF3C7' : `${colors.lightBlue}10`,
        }}
        onClick={() => handleCellClick(service, date, timeBlock)}
        title={
          hasPTOOverlap
            ? `${assignment?.provider?.name} — has PTO overlap`
            : assignment?.provider?.name || 'Unassigned'
        }
      >
        {hasPTOOverlap ? `⚠ ${displayName}` : displayName || '--'}
      </td>
    );
  };

  const renderFullDayCell = (row: ServiceRow, date: string) => {
    const holiday = holidayMap.get(date);
    if (holiday) {
      return (
        <td
          key={date}
          colSpan={2}
          className="border px-2 py-1 text-center text-xs font-medium"
          style={{
            borderColor: colors.border,
            backgroundColor: '#EDE9FE',
            color: '#7C3AED',
          }}
        >
          HOLIDAY
        </td>
      );
    }

    const service = row.amService; // same service for both
    if (!service) {
      return (
        <td key={date} colSpan={2} className="border px-2 py-1 text-center text-xs text-gray-300 min-w-[60px]" style={{ borderColor: colors.border }}>
          --
        </td>
      );
    }

    const assignment = getAssignment(service, date, 'AM') || getAssignment(service, date, 'PM');
    const displayName = assignment?.provider?.name ? getLastName(assignment.provider.name) : '';
    const isEmpty = !displayName;
    const hasPTOOverlap = assignment?.provider_id && !assignment.is_pto
      ? providerHasPTO(assignment.provider_id, date, 'AM') || providerHasPTO(assignment.provider_id, date, 'PM')
      : false;

    // Determine what time_block to use for modal - use BOTH if service is BOTH, otherwise AM
    const effectiveTimeBlock = service.time_block === 'BOTH' ? 'AM' : service.time_block as 'AM' | 'PM';

    return (
      <td
        key={date}
        colSpan={2}
        className={`border px-2 py-1 text-center text-xs font-medium min-w-[60px] ${
          isAdmin ? 'cursor-pointer hover:bg-blue-50' : ''
        } ${isEmpty ? 'text-gray-300' : ''}`}
        style={{
          borderColor: colors.border,
          color: isEmpty ? undefined : hasPTOOverlap ? '#B45309' : colors.primaryBlue,
          backgroundColor: isEmpty ? undefined : hasPTOOverlap ? '#FEF3C7' : `${colors.lightBlue}10`,
        }}
        onClick={() => handleCellClick(service, date, effectiveTimeBlock)}
        title={
          hasPTOOverlap
            ? `${assignment?.provider?.name} — has PTO overlap`
            : assignment?.provider?.name || 'Unassigned'
        }
      >
        {hasPTOOverlap ? `⚠ ${displayName}` : displayName || '--'}
      </td>
    );
  };

  const renderServiceRow = (row: ServiceRow) => (
    <tr key={row.label}>
      <td
        className="border px-2 py-1 text-xs font-medium whitespace-nowrap sticky left-0 bg-white z-10"
        style={{ borderColor: colors.border, color: colors.primaryBlue, minWidth: '90px' }}
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
      {/* Download PDF button */}
      {!isExporting && (
        <div className="mb-2 flex justify-end">
          <button
            onClick={handleDownloadMonthlyPDF}
            className="px-3 py-1.5 rounded text-sm font-medium text-white flex items-center gap-1.5"
            style={{ backgroundColor: colors.primaryBlue }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download Monthly PDF
          </button>
        </div>
      )}

      <div ref={tableRef} className="bg-white rounded-lg shadow-sm overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th
                className="border px-2 py-2 text-left text-xs font-semibold sticky left-0 bg-white z-20"
                style={{ borderColor: colors.border, color: colors.primaryBlue, minWidth: '90px' }}
              >
                Service
              </th>
              {weekdays.map(date => {
                const { dayName, dateLabel } = formatDayHeader(date);
                const holiday = holidayMap.get(date);
                return (
                  <th
                    key={date}
                    colSpan={2}
                    className="border px-2 py-2 text-center text-xs font-semibold"
                    style={{
                      borderColor: colors.border,
                      color: holiday ? '#7C3AED' : colors.primaryBlue,
                      backgroundColor: holiday ? '#EDE9FE' : undefined,
                    }}
                  >
                    <div>{dayName}</div>
                    <div className="font-normal text-gray-500" style={holiday ? { color: '#7C3AED' } : undefined}>
                      {dateLabel}
                    </div>
                    {holiday && (
                      <div className="font-normal text-[10px] mt-0.5" style={{ color: '#7C3AED' }}>
                        {holiday.name}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
            <tr>
              <th
                className="border px-2 py-1 sticky left-0 bg-white z-20"
                style={{ borderColor: colors.border }}
              />
              {weekdays.map(date => {
                const holiday = holidayMap.get(date);
                return (
                  <React.Fragment key={date}>
                    <th
                      className="border px-2 py-0.5 text-center text-xs font-medium text-gray-500 min-w-[60px]"
                      style={{
                        borderColor: colors.border,
                        backgroundColor: holiday ? '#EDE9FE' : undefined,
                        color: holiday ? '#7C3AED' : undefined,
                      }}
                    >
                      AM
                    </th>
                    <th
                      className="border px-2 py-0.5 text-center text-xs font-medium text-gray-500 min-w-[60px]"
                      style={{
                        borderColor: colors.border,
                        backgroundColor: holiday ? '#EDE9FE' : undefined,
                        color: holiday ? '#7C3AED' : undefined,
                      }}
                    >
                      PM
                    </th>
                  </React.Fragment>
                );
              })}
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
