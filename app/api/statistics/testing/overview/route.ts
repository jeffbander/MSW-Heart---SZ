import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const PAGE_SIZE = 1000;

async function fetchAll<T>(
  table: string,
  columns: string,
  filters: Record<string, string>,
  inFilters?: Record<string, string[]>
): Promise<T[]> {
  const allRows: T[] = [];
  let offset = 0;
  while (true) {
    let query = supabase.from(table).select(columns);
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

function getComparisonMonth(month: string, mode: string): string | null {
  const date = new Date(month + 'T00:00:00');
  if (mode === 'vs_prior_month') date.setMonth(date.getMonth() - 1);
  else if (mode === 'vs_same_year_ago') date.setFullYear(date.getFullYear() - 1);
  else return null;
  return date.toISOString().split('T')[0];
}

function getMonthRange(year: number, throughMonth: number): string[] {
  const months: string[] = [];
  for (let m = 1; m <= throughMonth; m++) {
    months.push(`${year}-${String(m).padStart(2, '0')}-01`);
  }
  return months;
}

interface CompletedTestingRow {
  department_normalized: string;
  visit_type: string;
}

interface AllStatusesTestingRow {
  department_normalized: string;
  appointment_status: string;
  late_cancel: number;
  visit_type: string;
}

// Consolidate visit type names for cleaner display
const VISIT_TYPE_MERGE: Record<string, string> = {
  'TRANSTHORACIC ECHO': 'Echo',
  'ECHO': 'Echo',
  'ECHOCARDIOGRAM LIMITED': 'Echo',
};

function normalizeVisitType(vt: string): string {
  return VISIT_TYPE_MERGE[vt] || vt;
}

function normalizeVisitTypes(visitTypes: Record<string, number>): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const [vt, count] of Object.entries(visitTypes)) {
    const normalized = normalizeVisitType(vt);
    merged[normalized] = (merged[normalized] || 0) + count;
  }
  return merged;
}

interface DeptStats {
  completed: number;
  noShows: number;
  lateCancels: number;
  totalScheduled: number;
  noShowRate: number;
  lateCancelRate: number;
  visitTypes: Record<string, number>;
}

async function getTestingOverview(months: string | string[]): Promise<Record<string, DeptStats>> {
  const monthArr = toMonthArray(months);

  // 1. Completed testing visits — every row = completed study
  const completedVisits = await fetchAll<CompletedTestingRow>(
    'stat_testing_visits',
    'department_normalized, visit_type',
    { source_type: 'completed' },
    { report_month: monthArr }
  );

  // 2. All statuses for rates (no show, late cancel) — also fetch visit_type
  //    for departments that don't have a separate completed report
  let allStatusVisits = await fetchAll<AllStatusesTestingRow>(
    'stat_testing_visits',
    'department_normalized, appointment_status, late_cancel, visit_type',
    { source_type: 'all_statuses' },
    { report_month: monthArr }
  );

  if (allStatusVisits.length === 0) {
    allStatusVisits = await fetchAll<AllStatusesTestingRow>(
      'stat_testing_visits',
      'department_normalized, appointment_status, late_cancel, visit_type',
      {},
      { report_month: monthArr }
    );
  }

  const KNOWN_DEPARTMENTS = ['CVI Echo', 'Echo Lab (4th Floor)', 'Vascular', 'Nuclear', 'EP', 'CT', 'Cardio Vein'];

  const deptStats: Record<string, DeptStats> = {};

  const ensureDept = (dept: string) => {
    if (!deptStats[dept]) {
      deptStats[dept] = {
        completed: 0, noShows: 0, lateCancels: 0, totalScheduled: 0,
        noShowRate: 0, lateCancelRate: 0, visitTypes: {},
      };
    }
  };

  // Pre-populate all known departments so they always appear
  for (const dept of KNOWN_DEPARTMENTS) ensureDept(dept);

  // Count completed studies from both sources per department, use whichever is higher.
  // The completed source undercounts some departments (e.g. Echo Lab only captures
  // a fraction), so we compare against all_statuses Completed count and use the max.

  // First pass: tally from completed source
  const completedSourceStats: Record<string, { count: number; visitTypes: Record<string, number> }> = {};
  for (const v of completedVisits) {
    const dept = v.department_normalized || 'Unknown';
    if (dept === 'Other') continue;
    if (!completedSourceStats[dept]) completedSourceStats[dept] = { count: 0, visitTypes: {} };
    completedSourceStats[dept].count++;
    const vt = normalizeVisitType(v.visit_type || 'Unknown');
    completedSourceStats[dept].visitTypes[vt] = (completedSourceStats[dept].visitTypes[vt] || 0) + 1;
  }

  // Second pass: tally Completed from all_statuses
  const allStatusCompletedStats: Record<string, { count: number; visitTypes: Record<string, number> }> = {};
  for (const v of allStatusVisits) {
    const dept = v.department_normalized || 'Unknown';
    if (dept === 'Other') continue;
    if (v.appointment_status === 'Completed' || v.appointment_status === 'Arrived') {
      if (!allStatusCompletedStats[dept]) allStatusCompletedStats[dept] = { count: 0, visitTypes: {} };
      allStatusCompletedStats[dept].count++;
      const vt = normalizeVisitType(v.visit_type || 'Unknown');
      allStatusCompletedStats[dept].visitTypes[vt] = (allStatusCompletedStats[dept].visitTypes[vt] || 0) + 1;
    }
  }

  // Use whichever source has the higher count per department
  const allDeptKeys = new Set([...Object.keys(completedSourceStats), ...Object.keys(allStatusCompletedStats)]);
  for (const dept of allDeptKeys) {
    ensureDept(dept);
    const compSrc = completedSourceStats[dept] || { count: 0, visitTypes: {} };
    const allSrc = allStatusCompletedStats[dept] || { count: 0, visitTypes: {} };
    if (compSrc.count >= allSrc.count) {
      deptStats[dept].completed = compSrc.count;
      deptStats[dept].visitTypes = compSrc.visitTypes;
    } else {
      deptStats[dept].completed = allSrc.count;
      deptStats[dept].visitTypes = allSrc.visitTypes;
    }
  }

  // Compute rates from all_statuses
  for (const v of allStatusVisits) {
    const dept = v.department_normalized || 'Unknown';
    if (dept === 'Other') continue;
    ensureDept(dept);
    deptStats[dept].totalScheduled++;
    if (v.appointment_status === 'No Show') deptStats[dept].noShows++;
    if (v.late_cancel === 1) deptStats[dept].lateCancels++;
  }

  // Calculate rates
  for (const stats of Object.values(deptStats)) {
    const seen = stats.completed;
    stats.noShowRate = (seen + stats.noShows) > 0
      ? Number(((stats.noShows / (seen + stats.noShows)) * 100).toFixed(2))
      : 0;
    stats.lateCancelRate = stats.totalScheduled > 0
      ? Number(((stats.lateCancels / stats.totalScheduled) * 100).toFixed(2))
      : 0;
  }

  return deptStats;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reportMonth = searchParams.get('reportMonth');
    const comparisonMode = searchParams.get('comparisonMode') || 'vs_prior_month';

    if (!reportMonth) {
      return NextResponse.json({ error: 'reportMonth is required' }, { status: 400 });
    }

    if (comparisonMode === 'vs_ytd_prior_year') {
      const date = new Date(reportMonth + 'T00:00:00');
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const ytdYears = Math.min(Math.max(parseInt(searchParams.get('ytdYears') || '2'), 2), 4);

      const currentMonths = getMonthRange(year, month);
      const priorPromises = [];
      for (let i = 1; i < ytdYears; i++) {
        priorPromises.push(getTestingOverview(getMonthRange(year - i, month)));
      }

      const [current, ...priorResults] = await Promise.all([
        getTestingOverview(currentMonths),
        ...priorPromises,
      ]);

      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      const comparisonYears = Array.from({ length: ytdYears - 1 }, (_, i) => year - (i + 1));
      const comparisons = priorResults.map((result, i) => ({
        year: comparisonYears[i],
        data: result,
      }));

      return NextResponse.json({
        departments: current,
        comparison: priorResults[0], // backward compat
        comparisons,
        reportMonth,
        comparisonMonth: null,
        comparisonMode,
        comparisonLabel: `YTD through ${monthName} ${year} vs ${comparisonYears.join(', ')}`,
      });
    }

    const comparisonMonth = getComparisonMonth(reportMonth, comparisonMode);

    const [current, comparison] = await Promise.all([
      getTestingOverview(reportMonth),
      comparisonMonth ? getTestingOverview(comparisonMonth) : Promise.resolve(null),
    ]);

    return NextResponse.json({
      departments: current,
      comparison,
      reportMonth,
      comparisonMonth,
      comparisonMode,
    });
  } catch (error) {
    console.error('Testing overview error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
