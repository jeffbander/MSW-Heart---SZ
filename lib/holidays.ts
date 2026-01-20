// Mount Sinai Official Holidays

export interface Holiday {
  name: string;
  date: string; // YYYY-MM-DD format
}

// Helper to format date in local timezone (avoids UTC conversion issues)
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Services that can be scheduled on holidays (inpatient)
export const INPATIENT_SERVICES = ['Consults', 'Burgundy'];

/**
 * Get the nth occurrence of a specific day of week in a month
 * @param year - The year
 * @param month - The month (0-indexed, 0 = January)
 * @param dayOfWeek - Day of week (0 = Sunday, 1 = Monday, etc.)
 * @param n - Which occurrence (1 = first, 2 = second, etc.)
 */
function getNthDayOfMonth(year: number, month: number, dayOfWeek: number, n: number): string {
  const firstDay = new Date(year, month, 1);
  let firstOccurrence = firstDay.getDate();

  // Find the first occurrence of the day in the month
  while (firstDay.getDay() !== dayOfWeek) {
    firstDay.setDate(firstDay.getDate() + 1);
    firstOccurrence = firstDay.getDate();
  }

  // Add weeks to get to the nth occurrence
  const targetDate = firstOccurrence + (n - 1) * 7;

  const result = new Date(year, month, targetDate);
  return formatLocalDate(result);
}

/**
 * Get the last occurrence of a specific day of week in a month
 * @param year - The year
 * @param month - The month (0-indexed, 0 = January)
 * @param dayOfWeek - Day of week (0 = Sunday, 1 = Monday, etc.)
 */
function getLastDayOfMonth(year: number, month: number, dayOfWeek: number): string {
  // Start from the last day of the month
  const lastDay = new Date(year, month + 1, 0);

  // Move backward to find the last occurrence of the target day
  while (lastDay.getDay() !== dayOfWeek) {
    lastDay.setDate(lastDay.getDate() - 1);
  }

  return formatLocalDate(lastDay);
}

/**
 * Get the observed date for holidays that fall on weekends
 * If Saturday, observe on Friday; if Sunday, observe on Monday
 * @param year - The year
 * @param month - The month (0-indexed)
 * @param day - The day of month
 */
function getObservedDate(year: number, month: number, day: number): string {
  const date = new Date(year, month, day);
  const dayOfWeek = date.getDay();

  if (dayOfWeek === 6) {
    // Saturday - observe on Friday
    date.setDate(date.getDate() - 1);
  } else if (dayOfWeek === 0) {
    // Sunday - observe on Monday
    date.setDate(date.getDate() + 1);
  }

  return formatLocalDate(date);
}

/**
 * Generate all Mount Sinai holidays for a given year
 */
export function getHolidaysForYear(year: number): Holiday[] {
  return [
    { name: "New Year's Day", date: getObservedDate(year, 0, 1) },
    { name: "MLK Day", date: getNthDayOfMonth(year, 0, 1, 3) }, // 3rd Monday of January
    { name: "Presidents' Day", date: getNthDayOfMonth(year, 1, 1, 3) }, // 3rd Monday of February
    { name: "Memorial Day", date: getLastDayOfMonth(year, 4, 1) }, // Last Monday of May
    { name: "Juneteenth", date: getObservedDate(year, 5, 19) }, // June 19
    { name: "Independence Day", date: getObservedDate(year, 6, 4) }, // July 4
    { name: "Labor Day", date: getNthDayOfMonth(year, 8, 1, 1) }, // 1st Monday of September
    { name: "Thanksgiving", date: getNthDayOfMonth(year, 10, 4, 4) }, // 4th Thursday of November
    { name: "Christmas", date: getObservedDate(year, 11, 25) }, // December 25
  ];
}

/**
 * Check if a date string is a holiday
 * @param dateStr - Date in YYYY-MM-DD format
 * @returns Holiday object if it's a holiday, null otherwise
 */
export function isHoliday(dateStr: string): Holiday | null {
  const date = new Date(dateStr + 'T00:00:00');
  const year = date.getFullYear();
  const holidays = getHolidaysForYear(year);
  return holidays.find(h => h.date === dateStr) || null;
}

/**
 * Get all holidays within a date range
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @returns Map of date string to Holiday object
 */
export function getHolidaysInRange(startDate: string, endDate: string): Map<string, Holiday> {
  const holidayMap = new Map<string, Holiday>();

  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  // Get years we need to check
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  // Collect holidays from all relevant years
  for (let year = startYear; year <= endYear; year++) {
    const holidays = getHolidaysForYear(year);

    for (const holiday of holidays) {
      const holidayDate = new Date(holiday.date + 'T00:00:00');

      if (holidayDate >= start && holidayDate <= end) {
        holidayMap.set(holiday.date, holiday);
      }
    }
  }

  return holidayMap;
}

/**
 * Check if a service is an inpatient service (allowed on holidays)
 */
export function isInpatientService(serviceName: string): boolean {
  return INPATIENT_SERVICES.includes(serviceName);
}
