import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const VISIT_TYPE_MERGE: Record<string, string> = {
  'TRANSTHORACIC ECHO': 'Echo',
  'ECHO': 'Echo',
  'ECHOCARDIOGRAM LIMITED': 'Echo',
};

function normalizeVisitType(vt: string): string {
  return VISIT_TYPE_MERGE[vt] || vt;
}

function buildMonthArray(year1: number, year2: number, startMonth: number, endMonth: number): string[] {
  const months: string[] = [];
  for (let m = startMonth; m <= endMonth; m++) {
    months.push(`${year1}-${String(m).padStart(2, '0')}-01`);
    months.push(`${year2}-${String(m).padStart(2, '0')}-01`);
  }
  return months;
}

function getMonthNum(reportMonth: string): number {
  return new Date(reportMonth + 'T00:00:00').getMonth() + 1;
}

function getYear(reportMonth: string): number {
  return new Date(reportMonth + 'T00:00:00').getFullYear();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year1 = parseInt(searchParams.get('year1') || '');
    const year2 = parseInt(searchParams.get('year2') || '');
    const startMonth = parseInt(searchParams.get('startMonth') || '1');
    const endMonth = parseInt(searchParams.get('endMonth') || '12');

    if (!year1 || !year2 || startMonth < 1 || endMonth > 12 || startMonth > endMonth) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const allMonths = buildMonthArray(year1, year2, startMonth, endMonth);
    const monthNums: number[] = [];
    for (let m = startMonth; m <= endMonth; m++) monthNums.push(m);

    // Use RPC aggregate functions (created in yoy-aggregate-functions.sql)
    // These do GROUP BY in the database, returning ~50-100 rows instead of 250K+

    // Fire all queries in parallel
    const [officeRes, completedRes, allStatusRes] = await Promise.all([
      supabase.rpc('yoy_office_visits', { month_list: allMonths }),
      supabase.rpc('yoy_testing_completed', { month_list: allMonths }),
      supabase.rpc('yoy_testing_all_statuses', { month_list: allMonths }),
    ]);

    // --- Office Visits ---
    let officeAgg = officeRes.data;
    if (officeRes.error) {
      console.error('yoy_office_visits error:', officeRes.error);
      return NextResponse.json({ error: 'Office query failed: ' + officeRes.error.message }, { status: 500 });
    }

    // Fallback if no all_statuses data
    if (!officeAgg || officeAgg.length === 0) {
      const fb = await supabase.rpc('yoy_office_visits_fallback', { month_list: allMonths });
      if (fb.error) {
        return NextResponse.json({ error: 'Office fallback failed: ' + fb.error.message }, { status: 500 });
      }
      officeAgg = fb.data || [];
    }

    const officeData: Record<string, Record<number, { year1: number; year2: number }>> = {};
    for (const row of officeAgg) {
      const cat = row.visit_type_category || 'Other';
      const monthNum = getMonthNum(row.report_month);
      const rowYear = getYear(row.report_month);

      if (!officeData[cat]) officeData[cat] = {};
      if (!officeData[cat][monthNum]) officeData[cat][monthNum] = { year1: 0, year2: 0 };

      if (rowYear === year1) officeData[cat][monthNum].year1 = Number(row.cnt);
      else if (rowYear === year2) officeData[cat][monthNum].year2 = Number(row.cnt);
    }

    // --- Testing Visits ---
    if (completedRes.error) {
      console.error('yoy_testing_completed error:', completedRes.error);
      return NextResponse.json({ error: 'Testing completed failed: ' + completedRes.error.message }, { status: 500 });
    }

    let allStatusData = allStatusRes.data || [];
    if (allStatusRes.error || allStatusData.length === 0) {
      const fb = await supabase.rpc('yoy_testing_fallback', { month_list: allMonths });
      if (fb.error) {
        return NextResponse.json({ error: 'Testing fallback failed: ' + fb.error.message }, { status: 500 });
      }
      allStatusData = fb.data || [];
    }

    // Build per-source aggregation
    type SourceAgg = Record<string, Record<number, Record<number, { count: number; visitTypes: Record<string, number> }>>>;

    function buildSourceAgg(rows: Array<{ department_normalized: string; visit_type: string; report_month: string; cnt: number }>): SourceAgg {
      const agg: SourceAgg = {};
      for (const row of rows) {
        const dept = row.department_normalized;
        const monthNum = getMonthNum(row.report_month);
        const rowYear = getYear(row.report_month);
        const vt = normalizeVisitType(row.visit_type);
        const cnt = Number(row.cnt);

        if (!agg[dept]) agg[dept] = {};
        if (!agg[dept][monthNum]) agg[dept][monthNum] = {};
        if (!agg[dept][monthNum][rowYear]) agg[dept][monthNum][rowYear] = { count: 0, visitTypes: {} };

        agg[dept][monthNum][rowYear].count += cnt;
        agg[dept][monthNum][rowYear].visitTypes[vt] = (agg[dept][monthNum][rowYear].visitTypes[vt] || 0) + cnt;
      }
      return agg;
    }

    const completedSource = buildSourceAgg(completedRes.data || []);
    const allStatusSource = buildSourceAgg(allStatusData);

    // Merge: use higher count per (dept, month, year)
    const allDepts = new Set([...Object.keys(completedSource), ...Object.keys(allStatusSource)]);
    const testingResult: Record<string, {
      totals: Record<number, { year1: number; year2: number }>;
      visitTypes: Record<string, Record<number, { year1: number; year2: number }>>;
    }> = {};

    for (const dept of allDepts) {
      testingResult[dept] = { totals: {}, visitTypes: {} };

      for (const monthNum of monthNums) {
        for (const yr of [year1, year2]) {
          const compSrc = completedSource[dept]?.[monthNum]?.[yr] || { count: 0, visitTypes: {} };
          const allSrc = allStatusSource[dept]?.[monthNum]?.[yr] || { count: 0, visitTypes: {} };
          const best = compSrc.count >= allSrc.count ? compSrc : allSrc;

          const yearKey = yr === year1 ? 'year1' : 'year2';

          if (!testingResult[dept].totals[monthNum]) testingResult[dept].totals[monthNum] = { year1: 0, year2: 0 };
          testingResult[dept].totals[monthNum][yearKey] = best.count;

          for (const [vt, count] of Object.entries(best.visitTypes)) {
            if (!testingResult[dept].visitTypes[vt]) testingResult[dept].visitTypes[vt] = {};
            if (!testingResult[dept].visitTypes[vt][monthNum]) testingResult[dept].visitTypes[vt][monthNum] = { year1: 0, year2: 0 };
            testingResult[dept].visitTypes[vt][monthNum][yearKey] = count;
          }
        }
      }
    }

    return NextResponse.json({
      officeVisits: officeData,
      testingVisits: testingResult,
      year1,
      year2,
      months: monthNums,
    });
  } catch (error) {
    console.error('Year-over-year error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
