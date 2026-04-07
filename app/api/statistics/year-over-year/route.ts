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

function buildMonthArray(years: number[], startMonth: number, endMonth: number): string[] {
  const months: string[] = [];
  for (let m = startMonth; m <= endMonth; m++) {
    for (const yr of years) {
      months.push(`${yr}-${String(m).padStart(2, '0')}-01`);
    }
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
    const startMonth = parseInt(searchParams.get('startMonth') || '1');
    const endMonth = parseInt(searchParams.get('endMonth') || '12');

    // Support new multi-year param OR old year1/year2 for backward compat
    let years: number[];
    const yearsParam = searchParams.get('years');
    if (yearsParam) {
      years = yearsParam.split(',').map(Number).filter(y => y > 0).sort();
    } else {
      const year1 = parseInt(searchParams.get('year1') || '');
      const year2 = parseInt(searchParams.get('year2') || '');
      if (!year1 || !year2) {
        return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
      }
      years = [year1, year2].sort();
    }

    if (years.length < 2 || years.length > 4 || startMonth < 1 || endMonth > 12 || startMonth > endMonth) {
      return NextResponse.json({ error: 'Invalid parameters. Need 2-4 years.' }, { status: 400 });
    }

    const allMonths = buildMonthArray(years, startMonth, endMonth);
    const monthNums: number[] = [];
    for (let m = startMonth; m <= endMonth; m++) monthNums.push(m);

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

    if (!officeAgg || officeAgg.length === 0) {
      const fb = await supabase.rpc('yoy_office_visits_fallback', { month_list: allMonths });
      if (fb.error) {
        return NextResponse.json({ error: 'Office fallback failed: ' + fb.error.message }, { status: 500 });
      }
      officeAgg = fb.data || [];
    }

    // Record<category, Record<month, Record<year, count>>>
    const officeData: Record<string, Record<number, Record<number, number>>> = {};
    for (const row of officeAgg) {
      const cat = row.visit_type_category || 'Other';
      const monthNum = getMonthNum(row.report_month);
      const rowYear = getYear(row.report_month);

      if (!officeData[cat]) officeData[cat] = {};
      if (!officeData[cat][monthNum]) {
        officeData[cat][monthNum] = {};
        for (const yr of years) officeData[cat][monthNum][yr] = 0;
      }

      if (years.includes(rowYear)) {
        officeData[cat][monthNum][rowYear] = Number(row.cnt);
      }
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

    // Build per-source aggregation: Record<dept, Record<month, Record<year, { count, visitTypes }>>>
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
      totals: Record<number, Record<number, number>>;
      visitTypes: Record<string, Record<number, Record<number, number>>>;
    }> = {};

    for (const dept of allDepts) {
      testingResult[dept] = { totals: {}, visitTypes: {} };

      for (const monthNum of monthNums) {
        testingResult[dept].totals[monthNum] = {};

        for (const yr of years) {
          const compSrc = completedSource[dept]?.[monthNum]?.[yr] || { count: 0, visitTypes: {} };
          const allSrc = allStatusSource[dept]?.[monthNum]?.[yr] || { count: 0, visitTypes: {} };
          const best = compSrc.count >= allSrc.count ? compSrc : allSrc;

          testingResult[dept].totals[monthNum][yr] = best.count;

          for (const [vt, count] of Object.entries(best.visitTypes)) {
            if (!testingResult[dept].visitTypes[vt]) testingResult[dept].visitTypes[vt] = {};
            if (!testingResult[dept].visitTypes[vt][monthNum]) {
              testingResult[dept].visitTypes[vt][monthNum] = {};
              for (const y of years) testingResult[dept].visitTypes[vt][monthNum][y] = 0;
            }
            testingResult[dept].visitTypes[vt][monthNum][yr] = count;
          }
        }
      }
    }

    // Backward compat: also include year1/year2 for old consumers
    return NextResponse.json({
      officeVisits: officeData,
      testingVisits: testingResult,
      years,
      year1: years[0],
      year2: years[years.length - 1],
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
