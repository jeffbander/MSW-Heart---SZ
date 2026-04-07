import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const PAGE_SIZE = 1000;

/**
 * Fetch rows preferring all_statuses source (which has real appointment_status values).
 * Falls back to no source_type filter if all_statuses doesn't exist.
 */
async function fetchWithSourceFallback<T>(
  table: string,
  columns: string,
  preferredSource: 'all_statuses' | 'completed' = 'all_statuses'
): Promise<T[]> {
  const rows = await fetchAllRows<T>(table, columns, { source_type: preferredSource });
  if (rows.length > 0) return rows;
  // Fallback: no source_type filter
  return fetchAllRows<T>(table, columns);
}

async function fetchAllRows<T>(
  table: string,
  columns: string,
  filters?: Record<string, string>,
  inFilters?: Record<string, string[]>
): Promise<T[]> {
  const allRows: T[] = [];
  let offset = 0;

  while (true) {
    let query = supabase.from(table).select(columns);
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        query = query.eq(key, value);
      }
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

const TREND_COLORS = ['#003D7A', '#0078C8', '#00A3AD', '#059669', '#D97706', '#DC2626', '#7C3AED'];

type Metric = 'total_patients_seen' | 'by_visit_type' | 'by_testing_department' | 'no_show_rate' | 'late_cancel_rate' | 'new_patient_pct';

// GET /api/statistics/trends
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const months = parseInt(searchParams.get('months') || '12', 10);
    const metric = (searchParams.get('metric') || 'total_patients_seen') as Metric;

    const handler = metricHandlers[metric];
    if (!handler) {
      return NextResponse.json({ error: `Unknown metric: ${metric}` }, { status: 400 });
    }

    const result = await handler(months);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Trends error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function sliceAndSort<T extends { month: string }>(data: T[], limit: number): T[] {
  return data.sort((a, b) => a.month.localeCompare(b.month)).slice(-limit);
}

interface TrendResult {
  trends: Record<string, unknown>[];
  series: { key: string; label: string; color: string }[];
  isPercentage: boolean;
}

const metricHandlers: Record<Metric, (months: number) => Promise<TrendResult>> = {
  async total_patients_seen(limit) {
    // Use all_statuses (has real appointment_status), fallback to unfiltered
    const rows = await fetchWithSourceFallback<{ report_month: string; appointment_status: string }>(
      'stat_office_visits',
      'report_month, appointment_status',
      'all_statuses'
    );

    const monthMap: Record<string, { total: number; seen: number }> = {};
    for (const row of rows) {
      const m = row.report_month;
      if (!monthMap[m]) monthMap[m] = { total: 0, seen: 0 };
      monthMap[m].total++;
      if (row.appointment_status === 'Arrived' || row.appointment_status === 'Completed') {
        monthMap[m].seen++;
      }
    }

    const trends = sliceAndSort(
      Object.entries(monthMap).map(([month, stats]) => ({ month, ...stats })),
      limit
    );

    return {
      trends,
      series: [
        { key: 'seen', label: 'Patients Seen', color: '#00A3AD' },
        { key: 'total', label: 'Total Scheduled', color: '#0078C8' },
      ],
      isPercentage: false,
    };
  },

  async by_visit_type(limit) {
    const CATEGORIES = ['New Patient', 'Follow Up', 'Leqvio', 'Research', 'Video Visit', 'Annual Well Visit', 'Ancillary'];

    const rows = await fetchWithSourceFallback<{ report_month: string; appointment_status: string; visit_type_category: string }>(
      'stat_office_visits',
      'report_month, appointment_status, visit_type_category',
      'all_statuses'
    );

    const monthMap: Record<string, Record<string, number>> = {};
    for (const row of rows) {
      const m = row.report_month;
      if (!monthMap[m]) monthMap[m] = {};
      if (row.appointment_status === 'Arrived' || row.appointment_status === 'Completed') {
        const cat = row.visit_type_category || 'Other';
        if (CATEGORIES.includes(cat)) {
          monthMap[m][cat] = (monthMap[m][cat] || 0) + 1;
        }
      }
    }

    const trends = sliceAndSort(
      Object.entries(monthMap).map(([month, cats]) => ({ month, ...cats })),
      limit
    );

    return {
      trends,
      series: CATEGORIES.map((cat, i) => ({
        key: cat,
        label: cat,
        color: TREND_COLORS[i % TREND_COLORS.length],
      })),
      isPercentage: false,
    };
  },

  async by_testing_department(limit) {
    const rows = await fetchWithSourceFallback<{ report_month: string; appointment_status: string; department_normalized: string }>(
      'stat_testing_visits',
      'report_month, appointment_status, department_normalized',
      'all_statuses'
    );

    const monthMap: Record<string, Record<string, number>> = {};
    const deptSet = new Set<string>();

    for (const row of rows) {
      const dept = row.department_normalized || 'Unknown';
      if (dept === 'Other') continue;
      const m = row.report_month;
      if (!monthMap[m]) monthMap[m] = {};
      if (row.appointment_status === 'Arrived' || row.appointment_status === 'Completed') {
        monthMap[m][dept] = (monthMap[m][dept] || 0) + 1;
        deptSet.add(dept);
      }
    }

    const departments = Array.from(deptSet).sort();
    const trends = sliceAndSort(
      Object.entries(monthMap).map(([month, depts]) => ({ month, ...depts })),
      limit
    );

    return {
      trends,
      series: departments.map((dept, i) => ({
        key: dept,
        label: dept,
        color: TREND_COLORS[i % TREND_COLORS.length],
      })),
      isPercentage: false,
    };
  },

  async no_show_rate(limit) {
    // Rate metrics only make sense from all_statuses data
    const rows = await fetchWithSourceFallback<{ report_month: string; appointment_status: string }>(
      'stat_office_visits',
      'report_month, appointment_status',
      'all_statuses'
    );

    const monthMap: Record<string, { seen: number; noShows: number }> = {};
    for (const row of rows) {
      const m = row.report_month;
      if (!monthMap[m]) monthMap[m] = { seen: 0, noShows: 0 };
      if (row.appointment_status === 'Arrived' || row.appointment_status === 'Completed') {
        monthMap[m].seen++;
      } else if (row.appointment_status === 'No Show') {
        monthMap[m].noShows++;
      }
    }

    const trends = sliceAndSort(
      Object.entries(monthMap).map(([month, stats]) => ({
        month,
        no_show_rate: (stats.seen + stats.noShows) > 0
          ? Number(((stats.noShows / (stats.seen + stats.noShows)) * 100).toFixed(2))
          : 0,
      })),
      limit
    );

    return {
      trends,
      series: [{ key: 'no_show_rate', label: 'No Show Rate', color: '#DC2626' }],
      isPercentage: true,
    };
  },

  async late_cancel_rate(limit) {
    const rows = await fetchWithSourceFallback<{ report_month: string; late_cancel: number }>(
      'stat_office_visits',
      'report_month, late_cancel',
      'all_statuses'
    );

    const monthMap: Record<string, { total: number; lateCancels: number }> = {};
    for (const row of rows) {
      const m = row.report_month;
      if (!monthMap[m]) monthMap[m] = { total: 0, lateCancels: 0 };
      monthMap[m].total++;
      if (row.late_cancel === 1) monthMap[m].lateCancels++;
    }

    const trends = sliceAndSort(
      Object.entries(monthMap).map(([month, stats]) => ({
        month,
        late_cancel_rate: stats.total > 0
          ? Number(((stats.lateCancels / stats.total) * 100).toFixed(2))
          : 0,
      })),
      limit
    );

    return {
      trends,
      series: [{ key: 'late_cancel_rate', label: 'Late Cancel Rate', color: '#D97706' }],
      isPercentage: true,
    };
  },

  async new_patient_pct(limit) {
    const rows = await fetchWithSourceFallback<{ report_month: string; appointment_status: string; visit_type_category: string }>(
      'stat_office_visits',
      'report_month, appointment_status, visit_type_category',
      'all_statuses'
    );

    const monthMap: Record<string, { seen: number; newPatients: number }> = {};
    for (const row of rows) {
      const m = row.report_month;
      if (!monthMap[m]) monthMap[m] = { seen: 0, newPatients: 0 };
      if (row.appointment_status === 'Arrived' || row.appointment_status === 'Completed') {
        monthMap[m].seen++;
        if (row.visit_type_category === 'New Patient') {
          monthMap[m].newPatients++;
        }
      }
    }

    const trends = sliceAndSort(
      Object.entries(monthMap).map(([month, stats]) => ({
        month,
        new_patient_pct: stats.seen > 0
          ? Number(((stats.newPatients / stats.seen) * 100).toFixed(1))
          : 0,
      })),
      limit
    );

    return {
      trends,
      series: [{ key: 'new_patient_pct', label: 'New Patient %', color: '#003D7A' }],
      isPercentage: true,
    };
  },
};
