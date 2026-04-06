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
  referring_provider_name: string;
  referring_provider_id: string | null;
  order_category: string;
}

interface CompletedTestingRow {
  department_normalized: string;
}

interface AllStatusTestingRow {
  department_normalized: string;
  appointment_status: string;
}

interface ProviderRow {
  id: string;
  name: string;
}

interface ProviderReferralCount {
  name: string;
  count: number;
  isInternal: boolean;
  percentage: number;
}

interface DeptReferrals {
  department: string;
  totalStudies: number;
  internalProviders: ProviderReferralCount[];
  outsideProviders: ProviderReferralCount[];
  outsideTotal: number;
  outsidePercentage: number;
}

async function getReferralsByDepartment(months: string | string[]): Promise<DeptReferrals[]> {
  const monthArr = toMonthArray(months);

  // Get internal provider names
  const { data: providers } = await supabase
    .from('providers')
    .select('id, name');
  const internalNames = new Set((providers || []).map((p: ProviderRow) => p.name));
  const internalIds = new Set((providers || []).map((p: ProviderRow) => p.id));

  // Get total completed studies per department — use whichever source is higher
  // (completed source undercounts Echo Lab)
  const completedVisits = await fetchAll<CompletedTestingRow>(
    'stat_testing_visits',
    'department_normalized',
    { source_type: 'completed' },
    { report_month: monthArr }
  );

  const completedSourceByDept: Record<string, number> = {};
  for (const v of completedVisits) {
    const dept = v.department_normalized;
    if (!dept || dept === 'Other') continue;
    completedSourceByDept[dept] = (completedSourceByDept[dept] || 0) + 1;
  }

  const allStatusVisits = await fetchAll<AllStatusTestingRow>(
    'stat_testing_visits',
    'department_normalized, appointment_status',
    { source_type: 'all_statuses' },
    { report_month: monthArr }
  );

  const allStatusCompletedByDept: Record<string, number> = {};
  for (const v of allStatusVisits) {
    const dept = v.department_normalized;
    if (!dept || dept === 'Other') continue;
    if (v.appointment_status === 'Completed' || v.appointment_status === 'Arrived') {
      allStatusCompletedByDept[dept] = (allStatusCompletedByDept[dept] || 0) + 1;
    }
  }

  // Use whichever count is higher per department
  const totalByDept: Record<string, number> = {};
  const allDeptKeys = new Set([...Object.keys(completedSourceByDept), ...Object.keys(allStatusCompletedByDept)]);
  for (const dept of allDeptKeys) {
    totalByDept[dept] = Math.max(completedSourceByDept[dept] || 0, allStatusCompletedByDept[dept] || 0);
  }

  // Get all orders with referring provider info
  const orders = await fetchAll<OrderRow>(
    'stat_orders',
    'referring_provider_name, referring_provider_id, order_category',
    {},
    { report_month: monthArr }
  );

  // Group referrals by testing department -> provider
  const deptMap: Record<string, Record<string, { count: number; isInternal: boolean }>> = {};

  for (const o of orders) {
    if (!o.referring_provider_name) continue;
    const dept = ORDER_CAT_TO_TESTING_DEPT[o.order_category];
    if (!dept) continue;

    if (!deptMap[dept]) deptMap[dept] = {};

    const provName = o.referring_provider_name;
    const isInternal = o.referring_provider_id
      ? internalIds.has(o.referring_provider_id)
      : internalNames.has(provName);

    if (!deptMap[dept][provName]) {
      deptMap[dept][provName] = { count: 0, isInternal };
    }
    deptMap[dept][provName].count++;
  }

  // Build result — always include all known departments
  const DEPT_ORDER = ['CVI Echo', 'Echo Lab (4th Floor)', 'Vascular', 'Nuclear', 'EP', 'CT', 'Cardio Vein'];
  const results: DeptReferrals[] = [];
  const allDepts = new Set([...DEPT_ORDER, ...Object.keys(deptMap), ...Object.keys(totalByDept)]);

  const buildDeptResult = (dept: string): DeptReferrals | null => {
    if (dept === 'Other') return null;
    const providerMap = deptMap[dept] || {};
    const totalStudies = totalByDept[dept] || 0;

    const internal: ProviderReferralCount[] = [];
    const outside: ProviderReferralCount[] = [];

    for (const [name, data] of Object.entries(providerMap)) {
      const percentage = totalStudies > 0
        ? Number(((data.count / totalStudies) * 100).toFixed(1))
        : 0;
      const entry = { name, count: data.count, isInternal: data.isInternal, percentage };
      if (data.isInternal) internal.push(entry);
      else outside.push(entry);
    }

    internal.sort((a, b) => b.count - a.count);
    outside.sort((a, b) => b.count - a.count);

    const outsideTotal = outside.reduce((s, p) => s + p.count, 0);
    const outsidePercentage = totalStudies > 0
      ? Number(((outsideTotal / totalStudies) * 100).toFixed(1))
      : 0;

    return {
      department: dept,
      totalStudies,
      internalProviders: internal,
      outsideProviders: outside,
      outsideTotal,
      outsidePercentage,
    };
  };

  // Preferred order first
  for (const dept of DEPT_ORDER) {
    if (!allDepts.has(dept)) continue;
    const result = buildDeptResult(dept);
    if (result) results.push(result);
    allDepts.delete(dept);
  }

  // Any remaining departments
  for (const dept of allDepts) {
    const result = buildDeptResult(dept);
    if (result) results.push(result);
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
        getReferralsByDepartment(currentMonths),
        getReferralsByDepartment(priorMonths),
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
      getReferralsByDepartment(reportMonth),
      comparisonMonth ? getReferralsByDepartment(comparisonMonth) : Promise.resolve(null),
    ]);

    return NextResponse.json({
      departments: current,
      comparison,
      reportMonth,
      comparisonMonth,
      comparisonMode,
    });
  } catch (error) {
    console.error('Testing referrals-by-department error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
