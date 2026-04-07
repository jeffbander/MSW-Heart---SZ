import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const PAGE_SIZE = 1000;

/**
 * Fetch all rows from a Supabase query, paginating past the 1000-row default limit.
 * Supports both .eq() filters and .in() filters.
 */
async function fetchAll<T>(
  table: string,
  columns: string,
  filters: Record<string, string>,
  inFilters?: Record<string, string[]>
): Promise<T[]> {
  const allRows: T[] = [];
  let offset = 0;

  while (true) {
    let query = supabase
      .from(table)
      .select(columns);

    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }
    if (inFilters) {
      for (const [key, values] of Object.entries(inFilters)) {
        query = query.in(key, values);
      }
    }

    query = query.order('id').range(offset, offset + PAGE_SIZE - 1);

    const { data, error } = await query;
    if (error) throw new Error(`${table} query failed: ${error.message}`);
    if (!data || data.length === 0) break;

    allRows.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return allRows;
}

function toMonthArray(months: string | string[]): string[] {
  return Array.isArray(months) ? months : [months];
}

// GET /api/statistics/overview
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reportMonth = searchParams.get('reportMonth');
    const comparisonMode = searchParams.get('comparisonMode') || 'vs_prior_month';

    if (!reportMonth) {
      return NextResponse.json({ error: 'reportMonth is required' }, { status: 400 });
    }

    if (comparisonMode === 'vs_ytd_prior_year') {
      return handleYTDComparison(reportMonth);
    }

    const comparisonMonth = getComparisonMonth(reportMonth, comparisonMode);

    const [current, comparison] = await Promise.all([
      getOfficeVisitStats(reportMonth),
      comparisonMonth ? getOfficeVisitStats(comparisonMonth) : Promise.resolve(null),
    ]);

    const [testing, comparisonTesting] = await Promise.all([
      getTestingVolumeStats(reportMonth),
      comparisonMonth ? getTestingVolumeStats(comparisonMonth) : Promise.resolve(null),
    ]);

    const [orders, comparisonOrders] = await Promise.all([
      getOrderStats(reportMonth),
      comparisonMonth ? getOrderStats(comparisonMonth) : Promise.resolve(null),
    ]);

    return NextResponse.json({
      current: { ...current, testing, orders },
      comparison: comparison
        ? { ...comparison, testing: comparisonTesting, orders: comparisonOrders }
        : null,
      reportMonth,
      comparisonMonth,
      comparisonMode,
    });
  } catch (error) {
    console.error('Overview error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function getComparisonMonth(month: string, mode: string): string | null {
  const date = new Date(month + 'T00:00:00');
  if (mode === 'vs_prior_month') {
    date.setMonth(date.getMonth() - 1);
  } else if (mode === 'vs_same_year_ago') {
    date.setFullYear(date.getFullYear() - 1);
  } else {
    return null;
  }
  return date.toISOString().split('T')[0];
}

function getMonthRange(year: number, throughMonth: number): string[] {
  const months: string[] = [];
  for (let m = 1; m <= throughMonth; m++) {
    months.push(`${year}-${String(m).padStart(2, '0')}-01`);
  }
  return months;
}

async function handleYTDComparison(reportMonth: string) {
  const date = new Date(reportMonth + 'T00:00:00');
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  const currentMonths = getMonthRange(year, month);
  const priorMonths = getMonthRange(year - 1, month);

  const [current, comparison] = await Promise.all([
    getOfficeVisitStats(currentMonths),
    getOfficeVisitStats(priorMonths),
  ]);

  const [testing, comparisonTesting] = await Promise.all([
    getTestingVolumeStats(currentMonths),
    getTestingVolumeStats(priorMonths),
  ]);

  const [orders, comparisonOrders] = await Promise.all([
    getOrderStats(currentMonths),
    getOrderStats(priorMonths),
  ]);

  const monthName = date.toLocaleDateString('en-US', { month: 'short' });

  return NextResponse.json({
    current: { ...current, testing, orders },
    comparison: { ...comparison, testing: comparisonTesting, orders: comparisonOrders },
    reportMonth,
    comparisonMonth: null,
    comparisonMode: 'vs_ytd_prior_year',
    comparisonLabel: `YTD through ${monthName} ${year} vs ${year - 1}`,
  });
}

const VISIT_CATEGORIES = ['New Patient', 'Follow Up', 'Leqvio', 'Research', 'Video Visit', 'Annual Well Visit', 'Ancillary'];
const ANCILLARY_SUBCATEGORIES = ['Device Check', 'EKG', 'Blood Draw', 'Event Monitor'];

interface OfficeVisitRow {
  appointment_status: string;
  visit_type_category: string;
  visit_type_raw: string;
  late_cancel: number;
}

/**
 * Fetch office visit stats. Uses `all_statuses` source (which has actual appointment_status values).
 * Falls back to no source_type filter if all_statuses data doesn't exist.
 *
 * Note: The `completed` Epic report sets appointmentStatus to '' (empty) since every row
 * is inherently a completed visit. Only the `all_statuses` report has real status values
 * like 'Arrived', 'Completed', 'No Show'.
 */
async function getOfficeVisitStats(months: string | string[]) {
  const monthArr = toMonthArray(months);

  // Try all_statuses source first (has real appointment_status values)
  let visits = await fetchAll<OfficeVisitRow>(
    'stat_office_visits',
    'appointment_status, visit_type_category, visit_type_raw, late_cancel',
    { source_type: 'all_statuses' },
    { report_month: monthArr }
  );

  // Fallback: no source_type filter (for databases without all_statuses uploads)
  if (visits.length === 0) {
    visits = await fetchAll<OfficeVisitRow>(
      'stat_office_visits',
      'appointment_status, visit_type_category, visit_type_raw, late_cancel',
      {},
      { report_month: monthArr }
    );
  }

  if (visits.length === 0) {
    return {
      totalScheduled: 0, patientsSeen: 0, patientsSeenExclAncillary: 0,
      noShows: 0, noShowRate: 0, lateCancelRate: 0,
      newPatients: 0, newPatientPct: 0,
      visitBreakdown: Object.fromEntries(VISIT_CATEGORIES.map(c => [c, { total: 0, seen: 0 }])),
      ancillarySubcategories: Object.fromEntries(ANCILLARY_SUBCATEGORIES.map(c => [c, { total: 0, seen: 0 }])),
    };
  }

  const totalScheduled = visits.length;
  let arrived = 0, completed = 0, noShows = 0, lateCancels = 0;

  const visitBreakdown: Record<string, { total: number; seen: number }> = {};
  for (const cat of VISIT_CATEGORIES) visitBreakdown[cat] = { total: 0, seen: 0 };

  const ancillarySub: Record<string, { total: number; seen: number }> = {};
  for (const sub of ANCILLARY_SUBCATEGORIES) ancillarySub[sub] = { total: 0, seen: 0 };

  for (const v of visits) {
    const status = v.appointment_status;
    if (status === 'Arrived') arrived++;
    else if (status === 'Completed') completed++;
    else if (status === 'No Show') noShows++;
    if (v.late_cancel === 1) lateCancels++;

    const isSeen = status === 'Arrived' || status === 'Completed';
    const cat = v.visit_type_category || 'Other';

    if (visitBreakdown[cat]) {
      visitBreakdown[cat].total++;
      if (isSeen) visitBreakdown[cat].seen++;
    }

    if (cat === 'Ancillary' && v.visit_type_raw) {
      const rawUpper = v.visit_type_raw.toUpperCase();
      for (const sub of ANCILLARY_SUBCATEGORIES) {
        if (rawUpper.includes(sub.toUpperCase())) {
          ancillarySub[sub].total++;
          if (isSeen) ancillarySub[sub].seen++;
          break;
        }
      }
    }
  }

  const patientsSeen = arrived + completed;

  let patientsSeenExclAncillary = 0;
  for (const [cat, data] of Object.entries(visitBreakdown)) {
    if (cat !== 'Ancillary') {
      patientsSeenExclAncillary += data.seen;
    }
  }

  // totalSeen from breakdown categories — matches the denominator used by the table's "% of Total"
  const totalSeenFromBreakdown = Object.values(visitBreakdown).reduce((sum, d) => sum + d.seen, 0);
  const newPatients = visitBreakdown['New Patient']?.seen || 0;
  const newPatientPct = totalSeenFromBreakdown > 0 ? Number(((newPatients / totalSeenFromBreakdown) * 100).toFixed(1)) : 0;
  const noShowRate = (patientsSeen + noShows) > 0
    ? Number(((noShows / (patientsSeen + noShows)) * 100).toFixed(2))
    : 0;
  const lateCancelRate = totalScheduled > 0
    ? Number(((lateCancels / totalScheduled) * 100).toFixed(2))
    : 0;

  return {
    totalScheduled,
    patientsSeen,
    patientsSeenExclAncillary,
    noShows,
    noShowRate,
    lateCancelRate,
    newPatients,
    newPatientPct,
    visitBreakdown,
    ancillarySubcategories: ancillarySub,
  };
}

interface TestingVisitRow {
  appointment_status: string;
  department_normalized: string;
  department: string;
  late_cancel: number;
}

/**
 * Same pattern: prefer all_statuses source, fallback to no filter.
 */
async function getTestingVolumeStats(months: string | string[]) {
  const monthArr = toMonthArray(months);

  let visits = await fetchAll<TestingVisitRow>(
    'stat_testing_visits',
    'appointment_status, department_normalized, department, late_cancel',
    { source_type: 'all_statuses' },
    { report_month: monthArr }
  );

  if (visits.length === 0) {
    visits = await fetchAll<TestingVisitRow>(
      'stat_testing_visits',
      'appointment_status, department_normalized, department, late_cancel',
      {},
      { report_month: monthArr }
    );
  }

  const deptStats: Record<string, { total: number; completed: number; arrived: number; noShows: number; lateCancels: number }> = {};

  for (const v of visits) {
    const dept = v.department_normalized || v.department || 'Unknown';
    if (!deptStats[dept]) {
      deptStats[dept] = { total: 0, completed: 0, arrived: 0, noShows: 0, lateCancels: 0 };
    }
    deptStats[dept].total++;
    if (v.appointment_status === 'Completed') deptStats[dept].completed++;
    else if (v.appointment_status === 'Arrived') deptStats[dept].arrived++;
    else if (v.appointment_status === 'No Show') deptStats[dept].noShows++;
    if (v.late_cancel === 1) deptStats[dept].lateCancels++;
  }

  return deptStats;
}

interface OrderRow {
  order_category: string;
}

async function getOrderStats(months: string | string[]) {
  const monthArr = toMonthArray(months);
  const orders = await fetchAll<OrderRow>(
    'stat_orders',
    'order_category',
    {},
    { report_month: monthArr }
  );

  const counts: Record<string, number> = {};
  for (const o of orders) {
    const cat = o.order_category || 'Other';
    counts[cat] = (counts[cat] || 0) + 1;
  }
  return counts;
}
