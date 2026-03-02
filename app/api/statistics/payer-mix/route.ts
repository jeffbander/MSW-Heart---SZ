import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const PAGE_SIZE = 1000;

async function fetchAllPayers(
  table: string,
  filters: Record<string, string>,
  inFilters?: Record<string, string[]>
): Promise<(string | null)[]> {
  const allPayers: (string | null)[] = [];
  let offset = 0;

  while (true) {
    let query = supabase.from(table).select('primary_payer');
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }
    if (inFilters) {
      for (const [key, values] of Object.entries(inFilters)) {
        query = query.in(key, values);
      }
    }
    query = query.range(offset, offset + PAGE_SIZE - 1);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    allPayers.push(...data.map((d: { primary_payer: string | null }) => d.primary_payer));
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return allPayers;
}

function getMonthRange(year: number, throughMonth: number): string[] {
  const months: string[] = [];
  for (let m = 1; m <= throughMonth; m++) {
    months.push(`${year}-${String(m).padStart(2, '0')}-01`);
  }
  return months;
}

// GET /api/statistics/payer-mix
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reportMonth = searchParams.get('reportMonth');
    const visitType = searchParams.get('visitType');
    const department = searchParams.get('department');
    const timeRange = searchParams.get('timeRange') || 'month';

    if (!reportMonth) {
      return NextResponse.json({ error: 'reportMonth is required' }, { status: 400 });
    }

    // Determine month(s) to query
    let monthFilter: Record<string, string[]>;
    if (timeRange === 'ytd') {
      const date = new Date(reportMonth + 'T00:00:00');
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      monthFilter = { report_month: getMonthRange(year, month) };
    } else {
      monthFilter = { report_month: [reportMonth] };
    }

    if (department) {
      // Use all_statuses source (has real appointment_status values)
      const payers = await fetchAllPayers(
        'stat_testing_visits',
        { department_normalized: department, source_type: 'all_statuses' },
        { ...monthFilter, appointment_status: ['Arrived', 'Completed'] }
      );
      if (payers.length > 0) {
        return NextResponse.json(buildPayerDistribution(payers));
      }
      // Fallback: no source_type filter
      const fallbackPayers = await fetchAllPayers(
        'stat_testing_visits',
        { department_normalized: department },
        { ...monthFilter, appointment_status: ['Arrived', 'Completed'] }
      );
      return NextResponse.json(buildPayerDistribution(fallbackPayers));
    }

    // Use all_statuses source (has real appointment_status values)
    const eqFilters: Record<string, string> = { source_type: 'all_statuses' };
    if (visitType) eqFilters.visit_type_category = visitType;

    let payers = await fetchAllPayers(
      'stat_office_visits',
      eqFilters,
      { ...monthFilter, appointment_status: ['Arrived', 'Completed'] }
    );

    // Fallback: no source_type filter
    if (payers.length === 0) {
      const fallbackFilters: Record<string, string> = {};
      if (visitType) fallbackFilters.visit_type_category = visitType;
      payers = await fetchAllPayers(
        'stat_office_visits',
        fallbackFilters,
        { ...monthFilter, appointment_status: ['Arrived', 'Completed'] }
      );
    }

    return NextResponse.json(buildPayerDistribution(payers));
  } catch (error) {
    console.error('Payer mix error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function buildPayerDistribution(payers: (string | null)[]) {
  if (payers.length === 0) {
    return { distribution: {}, percentages: {}, total: 0 };
  }

  const distribution: Record<string, number> = {};
  for (const payer of payers) {
    const key = payer || 'Unknown';
    distribution[key] = (distribution[key] || 0) + 1;
  }

  const total = payers.length;
  const percentages: Record<string, number> = {};
  for (const [key, count] of Object.entries(distribution)) {
    percentages[key] = Number(((count / total) * 100).toFixed(1));
  }

  return { distribution, percentages, total };
}
