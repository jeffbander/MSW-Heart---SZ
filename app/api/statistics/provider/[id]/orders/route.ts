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

interface OrderRow {
  order_category: string;
  order_description: string;
}

function groupOrders(orders: { order_category: string; order_description: string }[]) {
  const categoryMap: Record<string, { count: number; orders: Record<string, number> }> = {};

  for (const o of orders) {
    const cat = o.order_category || 'Other';
    if (!categoryMap[cat]) categoryMap[cat] = { count: 0, orders: {} };
    categoryMap[cat].count++;
    const desc = o.order_description || 'Unknown';
    categoryMap[cat].orders[desc] = (categoryMap[cat].orders[desc] || 0) + 1;
  }

  // Sort categories: preferred order first, then remaining by count
  const PREFERRED_ORDER = [
    'Echo', 'Stress Echo', 'Nuclear', 'Vascular', 'CT/CTA', 'EP', 'Monitoring', 'EKG', 'Other',
  ];

  return Object.entries(categoryMap)
    .sort(([catA, dataA], [catB, dataB]) => {
      const idxA = PREFERRED_ORDER.indexOf(catA);
      const idxB = PREFERRED_ORDER.indexOf(catB);
      // Both in preferred list: sort by preferred order
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      // Only one in preferred list: it comes first
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      // Neither in preferred list: sort by count descending
      return dataB.count - dataA.count;
    })
    .map(([category, data]) => ({
      category,
      count: data.count,
      orders: Object.entries(data.orders)
        .sort(([, a], [, b]) => b - a)
        .map(([description, count]) => ({ description, count })),
    }));
}

async function getOrdersForProvider(providerId: string, months: string | string[]) {
  const monthArr = toMonthArray(months);
  const orders = await fetchAll<OrderRow>(
    'stat_orders',
    'order_category, order_description',
    { ordering_provider_id: providerId },
    { report_month: monthArr }
  );
  return groupOrders(orders);
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

      const [categories, comparisonCategories] = await Promise.all([
        getOrdersForProvider(providerId, currentMonths),
        getOrdersForProvider(providerId, priorMonths),
      ]);

      const monthName = date.toLocaleDateString('en-US', { month: 'short' });

      return NextResponse.json({
        categories,
        comparisonCategories,
        reportMonth,
        comparisonMonth: null,
        comparisonMode,
        comparisonLabel: `YTD through ${monthName} ${year} vs ${year - 1}`,
      });
    }

    const comparisonMonth = getComparisonMonth(reportMonth, comparisonMode);

    const [categories, comparisonCategories] = await Promise.all([
      getOrdersForProvider(providerId, reportMonth),
      comparisonMonth ? getOrdersForProvider(providerId, comparisonMonth) : Promise.resolve(null),
    ]);

    return NextResponse.json({
      categories,
      comparisonCategories,
      reportMonth,
      comparisonMonth,
      comparisonMode,
    });
  } catch (error) {
    console.error('Provider orders error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
