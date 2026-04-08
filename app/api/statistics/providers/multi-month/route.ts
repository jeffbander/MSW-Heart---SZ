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

const VISIT_CATEGORIES = ['New Patient', 'Follow Up', 'Leqvio', 'Research', 'Video Visit', 'Annual Well Visit', 'Ancillary'];

interface ProviderRow { id: string; name: string; initials: string; }
interface CompletedVisitRow { primary_provider_id: string; visit_type_category: string; report_month: string; }
interface RateVisitRow { primary_provider_id: string; appointment_status: string; late_cancel: number; report_month: string; visit_type_category?: string; }
interface OrderRow { ordering_provider_id: string; report_month: string; }

interface MonthMetrics {
  patientsSeenExclAncillary: number;
  newPatientPct: number;
  noShowRate: number;
  lateCancelRate: number;
  totalOrders: number;
  sessionsCount: number;
  avgPatientsPerSession: number;
}

interface AssignmentRow { provider_id: string; date: string; }

// GET /api/statistics/providers/multi-month?startMonth=2026-01-01&endMonth=2026-03-01
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startMonth = searchParams.get('startMonth');
    const endMonth = searchParams.get('endMonth');

    if (!startMonth || !endMonth) {
      return NextResponse.json({ error: 'startMonth and endMonth required' }, { status: 400 });
    }

    // Build month arrays for current period and prior year
    const months: string[] = [];
    const cursor = new Date(startMonth + 'T00:00:00');
    const end = new Date(endMonth + 'T00:00:00');
    while (cursor <= end) {
      months.push(cursor.toISOString().split('T')[0]);
      cursor.setMonth(cursor.getMonth() + 1);
    }

    // Build prior year months
    const priorMonths = months.map(m => {
      const d = new Date(m + 'T00:00:00');
      d.setFullYear(d.getFullYear() - 1);
      return d.toISOString().split('T')[0];
    });

    const allMonths = [...months, ...priorMonths];

    // Get providers
    const { data: providers } = await supabase.from('providers').select('id, name, initials').order('name');
    const typedProviders = (providers || []) as ProviderRow[];

    // Fetch all data for both years in one go
    let [completedVisits, rateVisits, orders] = await Promise.all([
      fetchAll<CompletedVisitRow>(
        'stat_office_visits',
        'primary_provider_id, visit_type_category, report_month',
        { source_type: 'completed' },
        { report_month: allMonths }
      ),
      fetchAll<RateVisitRow>(
        'stat_office_visits',
        'primary_provider_id, appointment_status, late_cancel, report_month, visit_type_category',
        { source_type: 'all_statuses' },
        { report_month: allMonths }
      ).then(async rows => {
        if (rows.length === 0) {
          return fetchAll<RateVisitRow>(
            'stat_office_visits',
            'primary_provider_id, appointment_status, late_cancel, report_month, visit_type_category',
            {},
            { report_month: allMonths }
          );
        }
        return rows;
      }),
      fetchAll<OrderRow>(
        'stat_orders',
        'ordering_provider_id, report_month',
        {},
        { report_month: allMonths }
      ),
    ]);

    // Fetch sessions (Rooms AM/PM assignments)
    const { data: services } = await supabase
      .from('services')
      .select('id')
      .in('name', ['Rooms AM', 'Rooms PM']);
    const serviceIds = (services || []).map((s: { id: string }) => s.id);

    // Build sessions map: provider -> month -> Set of dates
    const sessionsMap: Record<string, Record<string, Set<string>>> = {};
    if (serviceIds.length > 0) {
      const sorted = [...allMonths].sort();
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
        // Determine which month this date belongs to
        const d = new Date(a.date + 'T00:00:00');
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
        if (!sessionsMap[a.provider_id]) sessionsMap[a.provider_id] = {};
        if (!sessionsMap[a.provider_id][monthKey]) sessionsMap[a.provider_id][monthKey] = new Set();
        sessionsMap[a.provider_id][monthKey].add(a.date);
      }
    }

    // For months with no completed source, derive from all_statuses (Completed + Arrived)
    // Check per-month: if a specific month has 0 completed rows, supplement from rateVisits
    for (const m of allMonths) {
      const hasCompleted = completedVisits.some(v => v.report_month === m);
      if (!hasCompleted) {
        const derived = rateVisits
          .filter(v => v.report_month === m && (v.appointment_status === 'Completed' || v.appointment_status === 'Arrived'))
          .map(v => ({
            primary_provider_id: v.primary_provider_id,
            visit_type_category: (v as any).visit_type_category || 'Unknown',
            report_month: m,
          }));
        completedVisits.push(...derived);
      }
    }

    // Build per-provider, per-month metrics
    function buildMetrics(provId: string, monthList: string[]): Record<string, MonthMetrics> {
      const result: Record<string, MonthMetrics> = {};
      for (const m of monthList) {
        const myCompleted = completedVisits.filter(v => v.primary_provider_id === provId && v.report_month === m);
        const patientsSeenExclAncillary = myCompleted.filter(v => v.visit_type_category !== 'Ancillary').length;
        const newPatients = myCompleted.filter(v => v.visit_type_category === 'New Patient').length;
        const totalSeen = myCompleted.filter(v => VISIT_CATEGORIES.includes(v.visit_type_category || '')).length;
        const newPatientPct = totalSeen > 0 ? Number(((newPatients / totalSeen) * 100).toFixed(1)) : 0;

        const myRate = rateVisits.filter(v => v.primary_provider_id === provId && v.report_month === m);
        const seen = myRate.filter(v => v.appointment_status === 'Arrived' || v.appointment_status === 'Completed').length;
        const noShows = myRate.filter(v => v.appointment_status === 'No Show').length;
        const lateCancels = myRate.filter(v => v.late_cancel === 1).length;
        const noShowRate = (seen + noShows) > 0 ? Number(((noShows / (seen + noShows)) * 100).toFixed(1)) : 0;
        const lateCancelRate = myRate.length > 0 ? Number(((lateCancels / myRate.length) * 100).toFixed(1)) : 0;

        const totalOrders = orders.filter(o => o.ordering_provider_id === provId && o.report_month === m).length;

        const sessionsCount = sessionsMap[provId]?.[m]?.size || 0;
        const avgPatientsPerSession = sessionsCount > 0 ? Number((patientsSeenExclAncillary / sessionsCount).toFixed(1)) : 0;

        result[m] = { patientsSeenExclAncillary, newPatientPct, noShowRate, lateCancelRate, totalOrders, sessionsCount, avgPatientsPerSession };
      }
      return result;
    }

    const providerResults = typedProviders.map(p => ({
      id: p.id,
      name: p.name,
      initials: p.initials,
      months: buildMetrics(p.id, months),
      priorYearMonths: buildMetrics(p.id, priorMonths),
    }));

    // Only include providers that have data in at least one month
    const filtered = providerResults.filter(p =>
      Object.values(p.months).some(m => m.patientsSeenExclAncillary > 0) ||
      Object.values(p.priorYearMonths).some(m => m.patientsSeenExclAncillary > 0)
    );

    return NextResponse.json({
      providers: filtered,
      months,
      priorMonths,
    });
  } catch (error) {
    console.error('Multi-month provider error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
