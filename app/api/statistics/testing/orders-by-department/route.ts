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

// Maps order_category to testing department
const ORDER_CAT_TO_TESTING_DEPT: Record<string, string> = {
  'Echo': 'CVI Echo',
  'Stress Echo': 'CVI Echo',
  'TEE': 'CVI Echo',
  'Nuclear': 'Nuclear',
  'Stress Test': 'Nuclear',
  'Vascular': 'Vascular',
  'CT/CTA': 'CT',
  'Cardiac MRI': 'CT',
  'EP': 'EP',
  'Device Management': 'EP',
  'EKG': 'Echo Lab (4th Floor)',
  'Monitoring': 'EP',
};

interface OrderRow {
  ordering_provider_name: string;
  ordering_provider_id: string | null;
  order_category: string;
}

interface ProviderRow {
  id: string;
  name: string;
}

interface ProviderOrderCount {
  name: string;
  count: number;
  isInternal: boolean;
}

interface DeptOrders {
  department: string;
  totalOrders: number;
  internalProviders: ProviderOrderCount[];
  outsideProviders: ProviderOrderCount[];
  outsideTotal: number;
}

async function getOrdersByDepartment(months: string | string[]): Promise<DeptOrders[]> {
  const monthArr = toMonthArray(months);

  // Get internal provider names
  const { data: providers } = await supabase
    .from('providers')
    .select('id, name');
  const internalNames = new Set((providers || []).map((p: ProviderRow) => p.name));
  const internalIds = new Set((providers || []).map((p: ProviderRow) => p.id));

  // Fetch all orders
  const orders = await fetchAll<OrderRow>(
    'stat_orders',
    'ordering_provider_name, ordering_provider_id, order_category',
    {},
    { report_month: monthArr }
  );

  // Group by testing department -> provider
  const deptMap: Record<string, Record<string, { count: number; isInternal: boolean }>> = {};

  for (const o of orders) {
    const dept = ORDER_CAT_TO_TESTING_DEPT[o.order_category];
    if (!dept) continue; // Skip categories that don't map to testing departments

    if (!deptMap[dept]) deptMap[dept] = {};

    const provName = o.ordering_provider_name || 'Unknown';
    const isInternal = o.ordering_provider_id
      ? internalIds.has(o.ordering_provider_id)
      : internalNames.has(provName);

    if (!deptMap[dept][provName]) {
      deptMap[dept][provName] = { count: 0, isInternal };
    }
    deptMap[dept][provName].count++;
  }

  // Build result
  const DEPT_ORDER = ['CVI Echo', 'Echo Lab (4th Floor)', 'Vascular', 'Nuclear', 'EP', 'CT', 'Cardio Vein'];

  const results: DeptOrders[] = [];
  const allDepts = new Set([...Object.keys(deptMap), ...DEPT_ORDER]);

  for (const dept of DEPT_ORDER) {
    if (!allDepts.has(dept)) continue;
    const providerMap = deptMap[dept] || {};

    const internal: ProviderOrderCount[] = [];
    const outside: ProviderOrderCount[] = [];

    for (const [name, data] of Object.entries(providerMap)) {
      const entry = { name, count: data.count, isInternal: data.isInternal };
      if (data.isInternal) internal.push(entry);
      else outside.push(entry);
    }

    internal.sort((a, b) => b.count - a.count);
    outside.sort((a, b) => b.count - a.count);

    const totalOrders = internal.reduce((s, p) => s + p.count, 0) + outside.reduce((s, p) => s + p.count, 0);

    results.push({
      department: dept,
      totalOrders,
      internalProviders: internal,
      outsideProviders: outside,
      outsideTotal: outside.reduce((s, p) => s + p.count, 0),
    });
  }

  // Any remaining departments not in DEPT_ORDER
  for (const dept of Object.keys(deptMap)) {
    if (DEPT_ORDER.includes(dept)) continue;
    if (dept === 'Other') continue;
    const providerMap = deptMap[dept];
    const internal: ProviderOrderCount[] = [];
    const outside: ProviderOrderCount[] = [];

    for (const [name, data] of Object.entries(providerMap)) {
      const entry = { name, count: data.count, isInternal: data.isInternal };
      if (data.isInternal) internal.push(entry);
      else outside.push(entry);
    }

    internal.sort((a, b) => b.count - a.count);
    outside.sort((a, b) => b.count - a.count);

    const totalOrders = internal.reduce((s, p) => s + p.count, 0) + outside.reduce((s, p) => s + p.count, 0);

    if (totalOrders > 0) {
      results.push({
        department: dept,
        totalOrders,
        internalProviders: internal,
        outsideProviders: outside,
        outsideTotal: outside.reduce((s, p) => s + p.count, 0),
      });
    }
  }

  return results;
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
        getOrdersByDepartment(currentMonths),
        getOrdersByDepartment(priorMonths),
      ]);

      const monthName = date.toLocaleDateString('en-US', { month: 'short' });

      return NextResponse.json({
        departments: current,
        comparison,
        reportMonth,
        comparisonMonth: null,
        comparisonMode,
        comparisonLabel: `YTD through ${monthName} ${year} vs ${year - 1}`,
      });
    }

    const comparisonMonth = getComparisonMonth(reportMonth, comparisonMode);

    const [current, comparison] = await Promise.all([
      getOrdersByDepartment(reportMonth),
      comparisonMonth ? getOrdersByDepartment(comparisonMonth) : Promise.resolve(null),
    ]);

    return NextResponse.json({
      departments: current,
      comparison,
      reportMonth,
      comparisonMonth,
      comparisonMode,
    });
  } catch (error) {
    console.error('Testing orders-by-department error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
