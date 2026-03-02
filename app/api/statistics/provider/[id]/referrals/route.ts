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
};

interface TestingVisitRow {
  department_normalized: string;
}

interface OrderRow {
  order_category: string;
}

async function getReferralStats(providerId: string, months: string | string[]) {
  const monthArr = toMonthArray(months);

  // 1. Get total completed studies per testing department
  //    Try source_type='completed' first, fallback to no filter
  let testingVisits = await fetchAll<TestingVisitRow>(
    'stat_testing_visits',
    'department_normalized',
    { source_type: 'completed' },
    { report_month: monthArr }
  );

  if (testingVisits.length === 0) {
    testingVisits = await fetchAll<TestingVisitRow>(
      'stat_testing_visits',
      'department_normalized',
      {},
      { report_month: monthArr }
    );
  }

  // Count total studies per department, filter out 'Other'
  const totalByDept: Record<string, number> = {};
  for (const v of testingVisits) {
    const dept = v.department_normalized;
    if (!dept || dept === 'Other') continue;
    totalByDept[dept] = (totalByDept[dept] || 0) + 1;
  }

  // 2. Get this provider's referral orders
  const orders = await fetchAll<OrderRow>(
    'stat_orders',
    'order_category',
    { referring_provider_id: providerId },
    { report_month: monthArr }
  );

  // Map orders to testing departments
  const referralsByDept: Record<string, number> = {};
  for (const o of orders) {
    const dept = ORDER_CAT_TO_TESTING_DEPT[o.order_category];
    if (!dept) continue; // EKG, Monitoring, Other don't map
    referralsByDept[dept] = (referralsByDept[dept] || 0) + 1;
  }

  // 3. Build department results for all departments that have either total studies or referrals
  const allDepts = new Set([...Object.keys(totalByDept), ...Object.keys(referralsByDept)]);
  const departments = Array.from(allDepts)
    .map(department => {
      const providerReferrals = referralsByDept[department] || 0;
      const totalStudies = totalByDept[department] || 0;
      const percentage = totalStudies > 0
        ? Number(((providerReferrals / totalStudies) * 100).toFixed(1))
        : 0;
      return { department, providerReferrals, totalStudies, percentage };
    })
    .sort((a, b) => b.providerReferrals - a.providerReferrals);

  return departments;
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

      const [departments, comparisonDepartments] = await Promise.all([
        getReferralStats(providerId, currentMonths),
        getReferralStats(providerId, priorMonths),
      ]);

      const monthName = date.toLocaleDateString('en-US', { month: 'short' });

      return NextResponse.json({
        departments,
        comparisonDepartments,
        reportMonth,
        comparisonMonth: null,
        comparisonMode,
        comparisonLabel: `YTD through ${monthName} ${year} vs ${year - 1}`,
      });
    }

    const comparisonMonth = getComparisonMonth(reportMonth, comparisonMode);

    const [departments, comparisonDepartments] = await Promise.all([
      getReferralStats(providerId, reportMonth),
      comparisonMonth ? getReferralStats(providerId, comparisonMonth) : Promise.resolve(null),
    ]);

    return NextResponse.json({
      departments,
      comparisonDepartments,
      reportMonth,
      comparisonMonth,
      comparisonMode,
    });
  } catch (error) {
    console.error('Provider referrals error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
