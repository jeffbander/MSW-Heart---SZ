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

const VISIT_CATEGORIES = ['New Patient', 'Follow Up', 'Leqvio', 'Research', 'Video Visit', 'Annual Well Visit', 'Ancillary'];

interface ProviderRow {
  id: string;
  name: string;
  initials: string;
}

interface CompletedVisitRow {
  primary_provider_id: string;
  visit_type_category: string;
}

interface RateVisitRow {
  primary_provider_id: string;
  appointment_status: string;
  late_cancel: number;
  visit_type_category?: string;
}

interface OrderRow {
  ordering_provider_id: string;
  referring_provider_id: string;
}

interface AssignmentRow {
  provider_id: string;
  date: string;
}

interface ProviderMetrics {
  id: string;
  name: string;
  initials: string;
  patientsSeenExclAncillary: number;
  newPatientPct: number;
  noShowRate: number;
  lateCancelRate: number;
  sessionsCount: number;
  avgPatientsPerSession: number;
  totalOrders: number;
  totalReferrals: number;
}

interface AverageMetrics {
  patientsSeenExclAncillary: number;
  newPatientPct: number;
  noShowRate: number;
  lateCancelRate: number;
  sessionsCount: number;
  avgPatientsPerSession: number;
  totalOrders: number;
  totalReferrals: number;
}

interface ComparisonResult {
  providers: ProviderMetrics[];
  averages: AverageMetrics;
}

async function buildComparisonData(months: string | string[]): Promise<ComparisonResult> {
  const monthArr = toMonthArray(months);

  // 1. Get all providers
  const { data: providers, error: provError } = await supabase
    .from('providers')
    .select('id, name, initials')
    .order('name');
  if (provError || !providers) throw new Error('Failed to fetch providers');
  const typedProviders = providers as ProviderRow[];

  // 2. Fetch ALL completed office visits for these months (bulk)
  let completedVisits = await fetchAll<CompletedVisitRow>(
    'stat_office_visits',
    'primary_provider_id, visit_type_category',
    { source_type: 'completed' },
    { report_month: monthArr }
  );

  // 3. Fetch ALL all_statuses office visits for rates (bulk)
  let rateVisits = await fetchAll<RateVisitRow>(
    'stat_office_visits',
    'primary_provider_id, appointment_status, late_cancel, visit_type_category',
    { source_type: 'all_statuses' },
    { report_month: monthArr }
  );
  // Fallback: if no all_statuses rows, try without source_type filter
  if (rateVisits.length === 0) {
    rateVisits = await fetchAll<RateVisitRow>(
      'stat_office_visits',
      'primary_provider_id, appointment_status, late_cancel, visit_type_category',
      {},
      { report_month: monthArr }
    );
  }

  // If no completed source data, derive completed visits from all_statuses
  // (Completed + Arrived = seen)
  if (completedVisits.length === 0 && rateVisits.length > 0) {
    completedVisits = rateVisits
      .filter(v => v.appointment_status === 'Completed' || v.appointment_status === 'Arrived')
      .map(v => ({
        primary_provider_id: v.primary_provider_id,
        visit_type_category: (v as any).visit_type_category || 'Unknown',
      }));
  }

  // 4. Fetch ALL orders
  const orders = await fetchAll<OrderRow>(
    'stat_orders',
    'ordering_provider_id, referring_provider_id',
    {},
    { report_month: monthArr }
  );

  // 5. Get Rooms AM/PM service IDs and fetch sessions
  const { data: services } = await supabase
    .from('services')
    .select('id')
    .in('name', ['Rooms AM', 'Rooms PM']);
  const serviceIds = (services || []).map((s: { id: string }) => s.id);

  const sessionsByProvider: Record<string, Set<string>> = {};
  if (serviceIds.length > 0) {
    const sorted = [...monthArr].sort();
    const firstMonth = sorted[0];
    const lastMonth = sorted[sorted.length - 1];
    const endDate = new Date(lastMonth + 'T00:00:00');
    endDate.setMonth(endDate.getMonth() + 1);

    const { data: assignments } = await supabase
      .from('schedule_assignments')
      .select('provider_id, date')
      .in('service_id', serviceIds)
      .gte('date', firstMonth)
      .lt('date', endDate.toISOString().split('T')[0]);

    for (const a of (assignments || []) as AssignmentRow[]) {
      if (!sessionsByProvider[a.provider_id]) sessionsByProvider[a.provider_id] = new Set();
      sessionsByProvider[a.provider_id].add(a.date);
    }
  }

  // 6. Group data by provider
  const providerData: ProviderMetrics[] = typedProviders.map((p) => {
    // Completed visits for this provider
    const myCompleted = completedVisits.filter((v) => v.primary_provider_id === p.id);
    const patientsSeenExclAncillary = myCompleted.filter((v) => v.visit_type_category !== 'Ancillary').length;
    const newPatients = myCompleted.filter((v) => v.visit_type_category === 'New Patient').length;
    const totalSeenFromBreakdown = myCompleted.filter((v) => VISIT_CATEGORIES.includes(v.visit_type_category || '')).length;
    const newPatientPct = totalSeenFromBreakdown > 0 ? Number(((newPatients / totalSeenFromBreakdown) * 100).toFixed(1)) : 0;

    // Rate visits for this provider
    const myRateVisits = rateVisits.filter((v) => v.primary_provider_id === p.id);
    const seen = myRateVisits.filter((v) => v.appointment_status === 'Arrived' || v.appointment_status === 'Completed').length;
    const noShows = myRateVisits.filter((v) => v.appointment_status === 'No Show').length;
    const lateCancels = myRateVisits.filter((v) => v.late_cancel === 1).length;
    const noShowRate = (seen + noShows) > 0 ? Number(((noShows / (seen + noShows)) * 100).toFixed(2)) : 0;
    const lateCancelRate = myRateVisits.length > 0 ? Number(((lateCancels / myRateVisits.length) * 100).toFixed(2)) : 0;

    // Sessions
    const sessionsCount = sessionsByProvider[p.id]?.size || 0;
    const avgPatientsPerSession = sessionsCount > 0 ? Number((patientsSeenExclAncillary / sessionsCount).toFixed(1)) : 0;

    // Orders
    const totalOrders = orders.filter((o) => o.ordering_provider_id === p.id).length;
    const totalReferrals = orders.filter((o) => o.referring_provider_id === p.id).length;

    return {
      id: p.id,
      name: p.name,
      initials: p.initials,
      patientsSeenExclAncillary,
      newPatientPct,
      noShowRate,
      lateCancelRate,
      sessionsCount,
      avgPatientsPerSession,
      totalOrders,
      totalReferrals,
    };
  });

  // 7. Compute averages (only for providers with data)
  const withData = providerData.filter((p) => p.patientsSeenExclAncillary > 0);
  const count = withData.length || 1;
  const averages: AverageMetrics = {
    patientsSeenExclAncillary: Number((withData.reduce((s, p) => s + p.patientsSeenExclAncillary, 0) / count).toFixed(1)),
    newPatientPct: Number((withData.reduce((s, p) => s + p.newPatientPct, 0) / count).toFixed(1)),
    noShowRate: Number((withData.reduce((s, p) => s + p.noShowRate, 0) / count).toFixed(2)),
    lateCancelRate: Number((withData.reduce((s, p) => s + p.lateCancelRate, 0) / count).toFixed(2)),
    sessionsCount: Number((withData.reduce((s, p) => s + p.sessionsCount, 0) / count).toFixed(1)),
    avgPatientsPerSession: Number((withData.reduce((s, p) => s + p.avgPatientsPerSession, 0) / count).toFixed(1)),
    totalOrders: Number((withData.reduce((s, p) => s + p.totalOrders, 0) / count).toFixed(1)),
    totalReferrals: Number((withData.reduce((s, p) => s + p.totalReferrals, 0) / count).toFixed(1)),
  };

  return { providers: providerData, averages };
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
      const currentMonths = getMonthRange(year, month);
      const priorMonths = getMonthRange(year - 1, month);

      const [current, comparison] = await Promise.all([
        buildComparisonData(currentMonths),
        buildComparisonData(priorMonths),
      ]);

      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      return NextResponse.json({
        ...current,
        comparison: comparison.providers,
        comparisonAverages: comparison.averages,
        reportMonth,
        comparisonMonth: null,
        comparisonMode,
        comparisonLabel: `YTD through ${monthName} ${year} vs ${year - 1}`,
      });
    }

    const comparisonMonth = getComparisonMonth(reportMonth, comparisonMode);
    const [current, comparison] = await Promise.all([
      buildComparisonData(reportMonth),
      comparisonMonth ? buildComparisonData(comparisonMonth) : Promise.resolve(null),
    ]);

    return NextResponse.json({
      ...current,
      comparison: comparison?.providers || null,
      comparisonAverages: comparison?.averages || null,
      reportMonth,
      comparisonMonth,
      comparisonMode,
    });
  } catch (error) {
    console.error('Provider comparison error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
