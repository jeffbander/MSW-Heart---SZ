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
    query = query.range(offset, offset + PAGE_SIZE - 1);
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

function getDateRange(months: string | string[]): { gte: string; lt: string } {
  const arr = toMonthArray(months);
  const sorted = [...arr].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const lastDate = new Date(last + 'T00:00:00');
  lastDate.setMonth(lastDate.getMonth() + 1);
  return { gte: first, lt: lastDate.toISOString().split('T')[0] };
}

const VISIT_CATEGORIES = ['New Patient', 'Follow Up', 'Leqvio', 'Research', 'Video Visit', 'Annual Well Visit', 'Ancillary'];
const ANCILLARY_SUBCATEGORIES = ['Device Check', 'EKG', 'Blood Draw', 'Event Monitor'];

interface CompletedVisitRow {
  visit_type_category: string;
  visit_type_raw: string;
}

interface AllStatusesVisitRow {
  appointment_status: string;
  visit_type_category: string;
  visit_type_raw: string;
  late_cancel: number;
}

async function getProviderStats(providerId: string, months: string | string[]) {
  const monthArr = toMonthArray(months);

  // 1. Fetch completed office visits for patient volumes
  //    source_type='completed' — every row IS a seen visit
  const completedVisits = await fetchAll<CompletedVisitRow>(
    'stat_office_visits',
    'visit_type_category, visit_type_raw',
    { source_type: 'completed', primary_provider_id: providerId },
    { report_month: monthArr }
  );

  // 2. Fetch all_statuses office visits for rates (no show, late cancel)
  let allStatusVisits = await fetchAll<AllStatusesVisitRow>(
    'stat_office_visits',
    'appointment_status, visit_type_category, visit_type_raw, late_cancel',
    { source_type: 'all_statuses', primary_provider_id: providerId },
    { report_month: monthArr }
  );

  // Fallback: no source_type filter if all_statuses data doesn't exist
  if (allStatusVisits.length === 0) {
    allStatusVisits = await fetchAll<AllStatusesVisitRow>(
      'stat_office_visits',
      'appointment_status, visit_type_category, visit_type_raw, late_cancel',
      { primary_provider_id: providerId },
      { report_month: monthArr }
    );
  }

  // 3. Fetch sessions from schedule_assignments (Rooms AM / Rooms PM)
  let sessionsCount = 0;
  const { data: services } = await supabase
    .from('services')
    .select('id, name')
    .in('name', ['Rooms AM', 'Rooms PM']);
  const serviceIds = (services || []).map(s => s.id);

  if (serviceIds.length > 0) {
    const { gte, lt } = getDateRange(months);
    const { data: assignments } = await supabase
      .from('schedule_assignments')
      .select('date')
      .eq('provider_id', providerId)
      .in('service_id', serviceIds)
      .gte('date', gte)
      .lt('date', lt);
    const uniqueDates = new Set((assignments || []).map(a => a.date));
    sessionsCount = uniqueDates.size;
  }

  // 4. Compute visit breakdown from completed source
  const visitBreakdown: Record<string, { total: number; seen: number }> = {};
  for (const cat of VISIT_CATEGORIES) visitBreakdown[cat] = { total: 0, seen: 0 };

  const ancillarySub: Record<string, { total: number; seen: number }> = {};
  for (const sub of ANCILLARY_SUBCATEGORIES) ancillarySub[sub] = { total: 0, seen: 0 };

  for (const v of completedVisits) {
    const cat = v.visit_type_category || 'Other';
    if (visitBreakdown[cat]) {
      visitBreakdown[cat].total++;
      visitBreakdown[cat].seen++;
    }

    if (cat === 'Ancillary' && v.visit_type_raw) {
      const rawUpper = v.visit_type_raw.toUpperCase();
      for (const sub of ANCILLARY_SUBCATEGORIES) {
        if (rawUpper.includes(sub.toUpperCase())) {
          ancillarySub[sub].total++;
          ancillarySub[sub].seen++;
          break;
        }
      }
    }
  }

  const totalSeenFromBreakdown = Object.values(visitBreakdown).reduce((sum, d) => sum + d.seen, 0);
  const patientsSeen = totalSeenFromBreakdown;

  let patientsSeenExclAncillary = 0;
  for (const [cat, data] of Object.entries(visitBreakdown)) {
    if (cat !== 'Ancillary') {
      patientsSeenExclAncillary += data.seen;
    }
  }

  const newPatients = visitBreakdown['New Patient']?.seen || 0;
  const newPatientPct = totalSeenFromBreakdown > 0
    ? Number(((newPatients / totalSeenFromBreakdown) * 100).toFixed(1))
    : 0;

  // Compute rates from all_statuses source
  let ratesSeen = 0;
  let noShows = 0;
  let lateCancels = 0;
  let totalScheduled = 0;

  for (const v of allStatusVisits) {
    totalScheduled++;
    const status = v.appointment_status;
    if (status === 'Arrived' || status === 'Completed') ratesSeen++;
    if (status === 'No Show') noShows++;
    if (v.late_cancel === 1) lateCancels++;
  }

  const noShowRate = (ratesSeen + noShows) > 0
    ? Number(((noShows / (ratesSeen + noShows)) * 100).toFixed(2))
    : 0;
  const lateCancelRate = totalScheduled > 0
    ? Number(((lateCancels / totalScheduled) * 100).toFixed(2))
    : 0;

  const avgPatientsPerSession = sessionsCount > 0
    ? Number((patientsSeenExclAncillary / sessionsCount).toFixed(1))
    : 0;

  return {
    patientsSeen,
    patientsSeenExclAncillary,
    newPatients,
    newPatientPct,
    noShowRate,
    lateCancelRate,
    totalScheduled,
    sessionsCount,
    avgPatientsPerSession,
    visitBreakdown,
    ancillarySubcategories: ancillarySub,
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: providerId } = await context.params;
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

      const currentMonths = getMonthRange(year, month);
      const priorMonths = getMonthRange(year - 1, month);

      const [current, comparison] = await Promise.all([
        getProviderStats(providerId, currentMonths),
        getProviderStats(providerId, priorMonths),
      ]);

      const monthName = date.toLocaleDateString('en-US', { month: 'short' });

      return NextResponse.json({
        current,
        comparison,
        reportMonth,
        comparisonMonth: null,
        comparisonMode,
        comparisonLabel: `YTD through ${monthName} ${year} vs ${year - 1}`,
      });
    }

    const comparisonMonth = getComparisonMonth(reportMonth, comparisonMode);

    const [current, comparison] = await Promise.all([
      getProviderStats(providerId, reportMonth),
      comparisonMonth ? getProviderStats(providerId, comparisonMonth) : Promise.resolve(null),
    ]);

    return NextResponse.json({
      current,
      comparison,
      reportMonth,
      comparisonMonth,
      comparisonMode,
    });
  } catch (error) {
    console.error('Provider stats error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
