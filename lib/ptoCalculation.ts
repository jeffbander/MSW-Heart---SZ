import { isHoliday, getHolidaysForYear, Holiday } from './holidays';
import { PTOTimeBlock, PTOValidationWarning } from './types';

// Helper to format date in local timezone (avoids UTC conversion issues)
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculate the number of PTO days for a given date range
 * Excludes weekends (Saturday, Sunday) and holidays
 * Half-day (AM/PM) requests count as 0.5 days
 * If work_days is provided, only counts days matching the provider's work schedule
 */
export function calculatePTODays(
  startDate: string,
  endDate: string,
  timeBlock: PTOTimeBlock,
  work_days?: number[] // JS day-of-week: 1=Mon, 2=Tue, ... 5=Fri
): number {
  let days = 0;
  const current = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  while (current <= end) {
    const dayOfWeek = current.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
    const dateStr = formatLocalDate(current);

    // Check if this is a valid work day
    const isWorkDay = work_days
      ? work_days.includes(dayOfWeek) // Use provider-specific work days
      : (dayOfWeek !== 0 && dayOfWeek !== 6); // Default: skip weekends

    if (isWorkDay) {
      // Skip holidays
      if (!isHoliday(dateStr)) {
        if (timeBlock === 'FULL') {
          days += 1;
        } else {
          days += 0.5; // AM or PM only
        }
      }
    }
    current.setDate(current.getDate() + 1);
  }
  return days;
}

/**
 * Get all weekdays (excluding weekends and holidays) in a date range
 * If work_days is provided, only returns days matching the provider's work schedule
 */
export function getWorkdaysInRange(
  startDate: string,
  endDate: string,
  work_days?: number[] // JS day-of-week: 1=Mon, 2=Tue, ... 5=Fri
): string[] {
  const workdays: string[] = [];
  const current = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const dateStr = formatLocalDate(current);

    const isWorkDay = work_days
      ? work_days.includes(dayOfWeek)
      : (dayOfWeek !== 0 && dayOfWeek !== 6);

    if (isWorkDay) {
      if (!isHoliday(dateStr)) {
        workdays.push(dateStr);
      }
    }
    current.setDate(current.getDate() + 1);
  }
  return workdays;
}

/**
 * Check if a date is within a specified number of days of any holiday
 */
export function isDateNearHoliday(
  dateStr: string,
  daysProximity: number = 7
): { isNear: boolean; holiday: Holiday | null } {
  const date = new Date(dateStr + 'T00:00:00');
  const year = date.getFullYear();

  // Check current year and next year (in case date is in late December)
  const yearsToCheck = [year - 1, year, year + 1];

  for (const y of yearsToCheck) {
    const holidays = getHolidaysForYear(y);

    for (const holiday of holidays) {
      const holidayDate = new Date(holiday.date + 'T00:00:00');
      const diffTime = Math.abs(date.getTime() - holidayDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= daysProximity) {
        return { isNear: true, holiday };
      }
    }
  }

  return { isNear: false, holiday: null };
}

/**
 * Check if any date in a range is near a holiday
 */
export function isRangeNearHoliday(
  startDate: string,
  endDate: string,
  daysProximity: number = 7
): { isNear: boolean; holiday: Holiday | null } {
  const current = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  while (current <= end) {
    const dateStr = formatLocalDate(current);
    const result = isDateNearHoliday(dateStr, daysProximity);

    if (result.isNear) {
      return result;
    }
    current.setDate(current.getDate() + 1);
  }

  return { isNear: false, holiday: null };
}

/**
 * Count how many PTO days a provider has taken near holidays in a given year
 * Returns count of requests (not days) that were near holidays
 */
export function countHolidayAdjacentPTORequests(
  approvedRequests: Array<{ start_date: string; end_date: string }>,
  year: number,
  daysProximity: number = 7
): number {
  let count = 0;

  for (const request of approvedRequests) {
    const requestYear = new Date(request.start_date + 'T00:00:00').getFullYear();

    // Only count requests from the specified year
    if (requestYear === year) {
      const result = isRangeNearHoliday(request.start_date, request.end_date, daysProximity);
      if (result.isNear) {
        count++;
      }
    }
  }

  return count;
}

/**
 * Build warnings for a PTO request submission
 */
export function buildPTOWarnings(
  overlappingProviders: Array<{ initials: string; name: string }>,
  holidayProximityCount: number,
  nearbyHoliday: Holiday | null
): PTOValidationWarning[] {
  const warnings: PTOValidationWarning[] = [];

  // Warning 1: Other providers off
  if (overlappingProviders.length > 0) {
    const providerList = overlappingProviders
      .map(p => p.initials)
      .join(', ');

    warnings.push({
      type: 'other_providers_off',
      severity: 'info',
      message: `The following providers are also off during this period: ${providerList}`,
      details: {
        providers: overlappingProviders
      }
    });
  }

  // Warning 2: Holiday proximity rule
  if (nearbyHoliday && holidayProximityCount >= 2) {
    warnings.push({
      type: 'holiday_proximity',
      severity: 'warning',
      message: `You have already taken ${holidayProximityCount} PTO request(s) near holidays this year. This request is near ${nearbyHoliday.name} (${nearbyHoliday.date}).`,
      details: {
        holidayAdjacentCount: holidayProximityCount,
        nearbyHoliday: nearbyHoliday
      }
    });
  }

  return warnings;
}

/**
 * Format PTO days for display (handles half days)
 */
export function formatPTODays(days: number): string {
  if (days === Math.floor(days)) {
    return `${days} day${days !== 1 ? 's' : ''}`;
  }
  return `${days} days`;
}
