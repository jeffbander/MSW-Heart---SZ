import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isCompletedStatus, categorizeFinClass, type FinClassCategory } from '@/lib/statistics';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const view = searchParams.get('view');
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : null;
  const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null;
  const providerId = searchParams.get('providerId');
  const providerName = searchParams.get('providerName');

  try {
    switch (view) {
      case 'uploads':
        return await getUploads();
      case 'practice':
        return await getPracticeDashboard(year, month);
      case 'provider':
        return await getProviderScorecard(year, month, providerId, providerName);
      case 'provider-list':
        return await getProviderList();
      case 'testing':
        return await getTestingView(year, month);
      case 'testing-v2':
        return await getTestingDashboardV2(year, month);
      case 'orders':
        return await getOrdersData(year, month);
      case 'orders_by_provider':
        return await getOrdersByProvider(year, month);
      case 'provider_scorecard':
        return await getProviderScorecardV2();
      case 'all-providers':
        return await getAllProvidersSummary(year, month);
      case 'multi-month':
        return await getMultiMonthData(year);
      case 'historical':
        return await getHistoricalData();
      case 'available-months':
      case 'available_months':
        return await getAvailableMonthsV2();
      default:
        return NextResponse.json({ error: 'Invalid view parameter' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Statistics data error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await supabase.from('stats_orders_monthly').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('stats_department_monthly').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('stats_testing_visits').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('stats_provider_monthly').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('stats_uploads').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    return NextResponse.json({ success: true, message: 'All stats data cleared' });
  } catch (error: any) {
    console.error('Statistics delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function getUploads() {
  const { data, error } = await supabase
    .from('stats_uploads')
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: false });

  if (error) throw error;
  return NextResponse.json(data);
}

async function getAvailableMonths() {
  // Get distinct year-month combinations from provider monthly data
  const { data: cviMonths } = await supabase
    .from('stats_provider_monthly')
    .select('year, month')
    .order('year', { ascending: false })
    .order('month', { ascending: false });

  const { data: testingMonths } = await supabase
    .from('stats_department_monthly')
    .select('year, month')
    .order('year', { ascending: false })
    .order('month', { ascending: false });

  // Deduplicate
  const cviSet = new Set((cviMonths || []).map((m: any) => `${m.year}-${m.month}`));
  const testingSet = new Set((testingMonths || []).map((m: any) => `${m.year}-${m.month}`));

  const allMonths = new Set([...cviSet, ...testingSet]);
  const sorted = Array.from(allMonths)
    .map((m) => {
      const [y, mo] = m.split('-').map(Number);
      return { year: y, month: mo };
    })
    .sort((a, b) => b.year - a.year || b.month - a.month);

  return NextResponse.json({
    cviMonths: Array.from(cviSet).sort().reverse(),
    testingMonths: Array.from(testingSet).sort().reverse(),
    allMonths: sorted,
  });
}

async function getPracticeDashboard(year: number | null, month: number | null) {
  let query = supabase.from('stats_provider_monthly').select('*');

  if (year) query = query.eq('year', year);
  if (month) query = query.eq('month', month);

  const { data: providerData, error } = await query;
  if (error) throw error;

  // Also get testing data
  let testingQuery = supabase.from('stats_department_monthly').select('*');
  if (year) testingQuery = testingQuery.eq('year', year);
  if (month) testingQuery = testingQuery.eq('month', month);

  const { data: testingData } = await testingQuery;

  // Aggregate across all providers for practice-level view
  const monthlyAgg = new Map<string, any>();

  for (const row of providerData || []) {
    const key = `${row.year}-${row.month}`;
    if (!monthlyAgg.has(key)) {
      monthlyAgg.set(key, {
        year: row.year,
        month: row.month,
        cviCompleted: 0,
        cviNoShow: 0,
        cviCanceled: 0,
        cviLateCanceled: 0,
        cviScheduled: 0,
        cviLeftWithoutSeen: 0,
        newPatient: 0,
        followUp: 0,
        followUpExtended: 0,
        leqvioVisit: 0,
        research: 0,
        videoVisit: 0,
        telehealth: 0,
        bloodDraw: 0,
        deviceCheck: 0,
        ekg: 0,
        eventMonitor: 0,
        echocardiogramLimited: 0,
        payerCommercial: 0,
        payerMedicareMedicaid: 0,
        payerSelfPay: 0,
        payerInternational: 0,
      });
    }
    const agg = monthlyAgg.get(key);
    agg.cviCompleted += row.total_completed;
    agg.cviNoShow += row.total_no_show;
    agg.cviCanceled += row.total_canceled;
    agg.cviLateCanceled += row.total_late_cancel;
    agg.cviScheduled += row.total_scheduled;
    agg.cviLeftWithoutSeen += row.total_left_without_seen;
    agg.newPatient += row.new_patient;
    agg.followUp += row.follow_up;
    agg.followUpExtended += row.follow_up_extended;
    agg.leqvioVisit += row.leqvio_visit;
    agg.research += row.research;
    agg.videoVisit += row.video_visit;
    agg.telehealth += row.telehealth;
    agg.bloodDraw += row.blood_draw;
    agg.deviceCheck += row.device_check;
    agg.ekg += row.ekg;
    agg.eventMonitor += row.event_monitor;
    agg.echocardiogramLimited += row.echocardiogram_limited;
    agg.payerCommercial += row.payer_commercial;
    agg.payerMedicareMedicaid += row.payer_medicare_medicaid;
    agg.payerSelfPay += row.payer_self_pay;
    agg.payerInternational += row.payer_international;
  }

  // Add computed rates
  const practiceMonthly = Array.from(monthlyAgg.values()).map((m) => {
    const clinicalCompleted = m.newPatient + m.followUp + m.followUpExtended + m.leqvioVisit + m.research + m.videoVisit + m.telehealth;
    return {
      ...m,
      clinicalCompleted,
      noShowRate: m.cviScheduled > 0 ? (m.cviNoShow / m.cviScheduled) * 100 : 0,
      lateCancelRate: m.cviScheduled > 0 ? (m.cviLateCanceled / m.cviScheduled) * 100 : 0,
      newPatientPct: clinicalCompleted > 0 ? (m.newPatient / clinicalCompleted) * 100 : 0,
    };
  });

  // Sort by year, month
  practiceMonthly.sort((a, b) => a.year - b.year || a.month - b.month);

  return NextResponse.json({
    practiceMonthly,
    testingMonthly: testingData || [],
  });
}

async function getProviderScorecard(
  year: number | null,
  month: number | null,
  providerId: string | null,
  providerName: string | null
) {
  let query = supabase.from('stats_provider_monthly').select('*');

  if (providerId) {
    query = query.eq('provider_id', providerId);
  } else if (providerName) {
    query = query.eq('provider_name', providerName);
  }

  if (year) query = query.eq('year', year);
  if (month) query = query.eq('month', month);

  const { data, error } = await query.order('year').order('month');
  if (error) throw error;

  // Get session data from schedule_assignments
  let sessions: any[] = [];
  if (providerId) {
    // Find the "Rooms AM" and "Rooms PM" service IDs
    const { data: services } = await supabase
      .from('services')
      .select('id, name')
      .or('name.ilike.%rooms am%,name.ilike.%rooms pm%');

    const roomServiceIds = (services || []).map((s: any) => s.id);

    if (roomServiceIds.length > 0) {
      let sessQuery = supabase
        .from('schedule_assignments')
        .select('date, time_block')
        .eq('provider_id', providerId)
        .eq('is_pto', false)
        .in('service_id', roomServiceIds);

      if (year) {
        const startDate = `${year}-${String(month || 1).padStart(2, '0')}-01`;
        const endMonth = month || 12;
        const endDate = `${year}-${String(endMonth).padStart(2, '0')}-31`;
        sessQuery = sessQuery.gte('date', startDate).lte('date', endDate);
      }

      const { data: sessData } = await sessQuery;
      sessions = sessData || [];
    }
  }

  // Fetch orders data for referrals & orders breakdown
  let referralsByTestType: { testType: string; referred: number; completed: number; orders: number }[] = [];

  if (providerId || providerName) {
    let ordQuery = supabase.from('stats_orders_monthly').select('*');
    if (year) ordQuery = ordQuery.eq('year', year);
    if (month) ordQuery = ordQuery.eq('month', month);

    const { data: allOrders } = await ordQuery;

    // Get provider display name for matching against referring_providers JSON
    let provDisplayName = '';
    if (providerId) {
      const { data: provInfo } = await supabase
        .from('providers')
        .select('name, epic_name')
        .eq('id', providerId)
        .single();
      provDisplayName = provInfo?.name || '';
    }

    // Build aggregation: { testType -> { referred, completed, orders } }
    const testTypeMap = new Map<string, { referred: number; completed: number; orders: number }>();

    for (const order of allOrders || []) {
      const testType = order.order_type || 'Unknown';

      if (!testTypeMap.has(testType)) {
        testTypeMap.set(testType, { referred: 0, completed: 0, orders: 0 });
      }
      const entry = testTypeMap.get(testType)!;

      // Check if this provider is the referring provider
      const refProviders: Record<string, number> = order.referring_providers || {};
      for (const [refName, count] of Object.entries(refProviders)) {
        const refLower = refName.toLowerCase();
        const provLower = provDisplayName.toLowerCase();
        const provParts = provLower.split(' ').filter(Boolean);
        // Match if referring provider name contains all parts of the provider name
        if (provParts.length >= 2 && provParts.every(part => refLower.includes(part))) {
          entry.referred += count;
          // Estimate completed based on the order's completion rate
          if (order.total_orders > 0) {
            entry.completed += Math.round((count * order.completed_orders) / order.total_orders);
          }
        }
      }

      // Check if this provider placed the orders (by provider_id or name match)
      const isOrderer = providerId
        ? order.provider_id === providerId
        : order.ordering_provider?.toLowerCase().includes(providerName?.toLowerCase() || '');
      if (isOrderer) {
        entry.orders += order.total_orders;
      }
    }

    referralsByTestType = Array.from(testTypeMap.entries())
      .map(([testType, data]) => ({ testType, ...data }))
      .filter(r => r.referred > 0 || r.orders > 0)
      .sort((a, b) => (b.referred + b.orders) - (a.referred + a.orders));
  }

  return NextResponse.json({
    providerData: data || [],
    sessions,
    sessionCount: sessions.length,
    referralsByTestType,
  });
}

async function getProviderList() {
  // Get active providers with stats data
  const { data: providers } = await supabase
    .from('providers')
    .select('id, name, initials, role, epic_name')
    .order('name');

  return NextResponse.json(providers || []);
}

// ============================================
// VIEW: testing
// Groups stats_testing_visits by department → test_type → month
// ============================================
async function getTestingView(year: number | null, month: number | null) {
  // Query from aggregated stats_department_monthly (one row per dept/test_type/month)
  // instead of row-level stats_testing_visits (which hits Supabase 1000 row default limit)
  let query = supabase.from('stats_department_monthly').select('*');
  if (year) query = query.eq('year', year);
  if (month) query = query.eq('month', month);
  const { data: rows, error } = await query;
  if (error) throw error;

  const monthsSet = new Set<string>();

  // dept → testType → monthKey → data
  const departments: Record<string, Record<string, Record<string, any>>> = {};

  for (const r of rows || []) {
    const dept = r.department_label || r.department || 'Unknown';
    const testType = r.test_type || 'Other';
    const monthKey = `${r.year}-${String(r.month).padStart(2, '0')}`;
    monthsSet.add(monthKey);

    if (!departments[dept]) departments[dept] = {};
    if (!departments[dept][testType]) departments[dept][testType] = {};

    const scheduled = r.total_scheduled || 0;
    const completed = r.total_completed || 0;
    const noShow = r.total_no_show || 0;

    // Convert payer counts to percentages
    const totalPayer = (r.payer_commercial || 0) + (r.payer_medicare_medicaid || 0) +
      (r.payer_self_pay || 0) + (r.payer_international || 0);
    const finClassPct: Record<string, number> = {};
    if (totalPayer > 0) {
      if (r.payer_commercial) finClassPct['commercial'] = Math.round((r.payer_commercial / totalPayer) * 1000) / 10;
      if (r.payer_medicare_medicaid) finClassPct['medicare_medicaid'] = Math.round((r.payer_medicare_medicaid / totalPayer) * 1000) / 10;
      if (r.payer_self_pay) finClassPct['self_pay'] = Math.round((r.payer_self_pay / totalPayer) * 1000) / 10;
      if (r.payer_international) finClassPct['international'] = Math.round((r.payer_international / totalPayer) * 1000) / 10;
    }

    // Parse referring_providers JSONB
    const refProvidersRaw = r.referring_providers || {};
    const referringProviders = Object.entries(refProvidersRaw)
      .map(([name, count]) => ({ name, count: count as number }))
      .sort((a, b) => b.count - a.count);

    departments[dept][testType][monthKey] = {
      completed,
      noShow,
      scheduled,
      noShowRate: scheduled > 0 ? Math.round((noShow / scheduled) * 1000) / 10 : 0,
      finClassPct,
      referringProviders,
    };
  }

  const availableMonths = Array.from(monthsSet).sort().reverse();
  return NextResponse.json({ departments, availableMonths });
}

async function getTestingDashboardV2(year: number | null, month: number | null) {
  // Check if the new table exists by doing a lightweight query
  const { error: tableCheck } = await supabase.from('stats_testing_visits').select('id').limit(0);
  if (tableCheck) {
    // Table doesn't exist yet - return empty departments
    return NextResponse.json({ departments: [], year, month, fallback: true });
  }

  // Build date filters
  const startDate = year && month
    ? `${year}-${String(month).padStart(2, '0')}-01`
    : year ? `${year}-01-01` : null;
  const endDate = year && month
    ? `${year}-${String(month).padStart(2, '0')}-31`
    : year ? `${year}-12-31` : null;

  // Prior year for YoY
  const priorYear = year ? year - 1 : null;
  const priorStartDate = priorYear && month
    ? `${priorYear}-${String(month).padStart(2, '0')}-01`
    : priorYear ? `${priorYear}-01-01` : null;
  const priorEndDate = priorYear && month
    ? `${priorYear}-${String(month).padStart(2, '0')}-31`
    : priorYear ? `${priorYear}-12-31` : null;

  // Fetch current period visits
  let query = supabase.from('stats_testing_visits').select('*');
  if (startDate && endDate) {
    query = query.gte('visit_date', startDate).lte('visit_date', endDate);
  } else if (year) {
    query = query.eq('year', year);
    if (month) query = query.eq('month', month);
  }
  const { data: visits, error } = await query;
  if (error) throw error;

  // Fetch prior year visits for YoY
  let priorVisits: any[] = [];
  if (priorStartDate && priorEndDate) {
    const { data: pv } = await supabase
      .from('stats_testing_visits')
      .select('*')
      .gte('visit_date', priorStartDate)
      .lte('visit_date', priorEndDate);
    priorVisits = pv || [];
  }

  const isCompleted = (s: string) => {
    const st = s.toLowerCase().trim();
    return st === 'comp' || st === 'completed' || st === 'arrived' || st === 'completed [2]' || st === 'arrived [6]';
  };
  const isNoShow = (s: string) => s.toLowerCase().trim() === 'no show';

  // Aggregate current period by department
  const deptMap = new Map<string, any>();
  (visits || []).forEach((v: any) => {
    const dept = v.department;
    if (!deptMap.has(dept)) {
      deptMap.set(dept, { department: dept, completed: 0, noShow: 0, scheduled: 0, testTypes: new Map() });
    }
    const d = deptMap.get(dept)!;
    d.scheduled++;
    if (isCompleted(v.appointment_status)) {
      d.completed++;
      // Test type level
      const tt = v.test_type || 'Other';
      if (!d.testTypes.has(tt)) {
        d.testTypes.set(tt, { testType: tt, completed: 0, noShow: 0, scheduled: 0, finClasses: {}, referringProviders: {} });
      }
      const t = d.testTypes.get(tt)!;
      t.completed++;
      t.scheduled++;
      // Fin class
      const fc = v.fin_class_category || v.fin_class || 'other';
      t.finClasses[fc] = (t.finClasses[fc] || 0) + 1;
      // Referring provider
      if (v.referring_provider) {
        t.referringProviders[v.referring_provider] = (t.referringProviders[v.referring_provider] || 0) + 1;
      }
    } else if (isNoShow(v.appointment_status)) {
      d.noShow++;
      const tt = v.test_type || 'Other';
      if (!d.testTypes.has(tt)) {
        d.testTypes.set(tt, { testType: tt, completed: 0, noShow: 0, scheduled: 0, finClasses: {}, referringProviders: {} });
      }
      const t = d.testTypes.get(tt)!;
      t.noShow++;
      t.scheduled++;
    } else {
      // Canceled, left, etc - still count as scheduled for test type
      const tt = v.test_type || 'Other';
      if (!d.testTypes.has(tt)) {
        d.testTypes.set(tt, { testType: tt, completed: 0, noShow: 0, scheduled: 0, finClasses: {}, referringProviders: {} });
      }
      d.testTypes.get(tt)!.scheduled++;
    }
  });

  // Aggregate prior year by department + test type
  const priorDeptMap = new Map<string, any>();
  priorVisits.forEach((v: any) => {
    const dept = v.department;
    if (!priorDeptMap.has(dept)) {
      priorDeptMap.set(dept, { completed: 0, noShow: 0, scheduled: 0, testTypes: new Map() });
    }
    const d = priorDeptMap.get(dept)!;
    d.scheduled++;
    if (isCompleted(v.appointment_status)) {
      d.completed++;
      const tt = v.test_type || 'Other';
      if (!d.testTypes.has(tt)) d.testTypes.set(tt, { completed: 0, noShow: 0, scheduled: 0 });
      d.testTypes.get(tt)!.completed++;
      d.testTypes.get(tt)!.scheduled++;
    } else if (isNoShow(v.appointment_status)) {
      d.noShow++;
      const tt = v.test_type || 'Other';
      if (!d.testTypes.has(tt)) d.testTypes.set(tt, { completed: 0, noShow: 0, scheduled: 0 });
      d.testTypes.get(tt)!.noShow++;
      d.testTypes.get(tt)!.scheduled++;
    } else {
      const tt = v.test_type || 'Other';
      if (!d.testTypes.has(tt)) d.testTypes.set(tt, { completed: 0, noShow: 0, scheduled: 0 });
      d.testTypes.get(tt)!.scheduled++;
    }
  });

  // Build response
  const departments = Array.from(deptMap.entries())
    .map(([dept, data]) => {
      const prior = priorDeptMap.get(dept);
      const testTypes = (Array.from(data.testTypes.entries()) as [string, any][])
        .map(([tt, ttData]: [string, any]) => {
          const priorTT = prior?.testTypes?.get(tt);
          // Sort referring providers by count desc
          const refProviders = Object.entries(ttData.referringProviders)
            .map(([name, count]) => ({ name, count: count as number }))
            .sort((a, b) => b.count - a.count);
          return {
            testType: tt,
            completed: ttData.completed,
            noShow: ttData.noShow,
            scheduled: ttData.scheduled,
            finClasses: ttData.finClasses,
            referringProviders: refProviders,
            prior: priorTT ? { completed: priorTT.completed, noShow: priorTT.noShow, scheduled: priorTT.scheduled } : null,
          };
        })
        .sort((a, b) => b.completed - a.completed);

      return {
        department: dept,
        completed: data.completed,
        noShow: data.noShow,
        scheduled: data.scheduled,
        testTypes,
        prior: prior ? { completed: prior.completed, noShow: prior.noShow, scheduled: prior.scheduled } : null,
      };
    })
    .sort((a, b) => b.completed - a.completed);

  return NextResponse.json({ departments, year, month });
}

async function getOrdersData(year: number | null, month: number | null) {
  let query = supabase.from('stats_orders_monthly').select('*');
  if (year) query = query.eq('year', year);
  if (month) query = query.eq('month', month);

  const { data, error } = await query;
  if (error) throw error;

  return NextResponse.json(data || []);
}

// ============================================
// VIEW: orders_by_provider
// Groups stats_orders_monthly by provider → order_type → month
// Filters to is_internal = true only
// ============================================
async function getOrdersByProvider(year: number | null, month: number | null) {
  let query = supabase.from('stats_orders_monthly').select('*').eq('is_internal', true);
  if (year) query = query.eq('year', year);
  if (month) query = query.eq('month', month);

  const { data: orders, error } = await query;
  if (error) throw error;

  // provider → orderType → monthKey → { totalOrders, completedOrders }
  const tree: Record<string, {
    providerId: string | null;
    providerName: string;
    orderTypes: Record<string, Record<string, { totalOrders: number; completedOrders: number }>>;
  }> = {};

  for (const o of orders || []) {
    const provKey = o.provider_id || o.ordering_provider;
    const provName = o.ordering_provider;
    const orderType = o.order_type || 'Unknown';
    const monthKey = `${o.year}-${String(o.month).padStart(2, '0')}`;

    if (!tree[provKey]) {
      tree[provKey] = { providerId: o.provider_id, providerName: provName, orderTypes: {} };
    }
    if (!tree[provKey].orderTypes[orderType]) {
      tree[provKey].orderTypes[orderType] = {};
    }
    if (!tree[provKey].orderTypes[orderType][monthKey]) {
      tree[provKey].orderTypes[orderType][monthKey] = { totalOrders: 0, completedOrders: 0 };
    }

    const bucket = tree[provKey].orderTypes[orderType][monthKey];
    bucket.totalOrders += o.total_orders || 0;
    bucket.completedOrders += o.completed_orders || 0;
  }

  // Convert to array
  const providers = Object.values(tree)
    .map((p) => ({
      providerId: p.providerId,
      providerName: p.providerName,
      orderTypes: Object.entries(p.orderTypes).map(([orderType, months]) => ({
        orderType,
        months,
        total: Object.values(months).reduce((s, m) => s + m.totalOrders, 0),
      })).sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => {
      const aTotal = a.orderTypes.reduce((s, ot) => s + ot.total, 0);
      const bTotal = b.orderTypes.reduce((s, ot) => s + ot.total, 0);
      return bTotal - aTotal;
    });

  return NextResponse.json({ providers });
}

async function getAllProvidersSummary(year: number | null, month: number | null) {
  let query = supabase.from('stats_provider_monthly').select('*');
  if (year) query = query.eq('year', year);
  if (month) query = query.eq('month', month);

  const { data: providerRows, error } = await query;
  if (error) throw error;

  // Get "Rooms AM" / "Rooms PM" service IDs for session counting
  const { data: services } = await supabase
    .from('services')
    .select('id, name')
    .or('name.ilike.%rooms am%,name.ilike.%rooms pm%');
  const roomServiceIds = (services || []).map((s: any) => s.id);

  // Build date range for schedule_assignments query
  let startDate: string | null = null;
  let endDate: string | null = null;
  if (year) {
    const sm = month || 1;
    const em = month || 12;
    startDate = `${year}-${String(sm).padStart(2, '0')}-01`;
    endDate = `${year}-${String(em).padStart(2, '0')}-31`;
  }

  // Get all schedule assignments for session counting
  let sessionsMap = new Map<string, number>();
  if (roomServiceIds.length > 0) {
    let sessQuery = supabase
      .from('schedule_assignments')
      .select('provider_id, date, time_block')
      .eq('is_pto', false)
      .in('service_id', roomServiceIds);

    if (startDate && endDate) {
      sessQuery = sessQuery.gte('date', startDate).lte('date', endDate);
    }

    const { data: sessData } = await sessQuery;
    (sessData || []).forEach((s: any) => {
      sessionsMap.set(s.provider_id, (sessionsMap.get(s.provider_id) || 0) + 1);
    });
  }

  // Group by provider
  const providerMap = new Map<string, any>();
  for (const row of providerRows || []) {
    const key = row.provider_id || row.provider_name;
    if (!providerMap.has(key)) {
      providerMap.set(key, {
        providerId: row.provider_id,
        providerName: row.provider_display_name || row.provider_name,
        isHistorical: row.is_historical,
        completed: 0,
        scheduled: 0,
        noShow: 0,
        lateCanceled: 0,
        newPatient: 0,
        followUp: 0,
        followUpExtended: 0,
        leqvioVisit: 0,
        research: 0,
        videoVisit: 0,
        telehealth: 0,
        bloodDraw: 0,
        deviceCheck: 0,
        ekg: 0,
        eventMonitor: 0,
        payerCommercial: 0,
        payerMedicareMedicaid: 0,
        payerSelfPay: 0,
        payerInternational: 0,
      });
    }
    const p = providerMap.get(key)!;
    p.completed += row.total_completed;
    p.scheduled += row.total_scheduled;
    p.noShow += row.total_no_show;
    p.lateCanceled += row.total_late_cancel;
    p.newPatient += row.new_patient;
    p.followUp += row.follow_up;
    p.followUpExtended += row.follow_up_extended;
    p.leqvioVisit += row.leqvio_visit;
    p.research += row.research;
    p.videoVisit += row.video_visit;
    p.telehealth += row.telehealth;
    p.bloodDraw += row.blood_draw;
    p.deviceCheck += row.device_check;
    p.ekg += row.ekg;
    p.eventMonitor += row.event_monitor;
    p.payerCommercial += row.payer_commercial;
    p.payerMedicareMedicaid += row.payer_medicare_medicaid;
    p.payerSelfPay += row.payer_self_pay;
    p.payerInternational += row.payer_international;
  }

  // Compute rates and session info
  const summaries = Array.from(providerMap.values()).map((p) => {
    const sessionCount = p.providerId ? (sessionsMap.get(p.providerId) || 0) : 0;
    const clinicalTotal = p.newPatient + p.followUp + p.followUpExtended + p.leqvioVisit + p.research + p.videoVisit + p.telehealth;
    return {
      ...p,
      noShowRate: p.scheduled > 0 ? (p.noShow / p.scheduled) * 100 : 0,
      lateCancelRate: p.scheduled > 0 ? (p.lateCanceled / p.scheduled) * 100 : 0,
      newPatientPct: clinicalTotal > 0 ? (p.newPatient / clinicalTotal) * 100 : 0,
      sessionCount,
      avgPerSession: sessionCount > 0 ? parseFloat((p.completed / sessionCount).toFixed(1)) : 0,
    };
  });

  // Sort by completed desc
  summaries.sort((a, b) => b.completed - a.completed);

  return NextResponse.json(summaries);
}

async function getMultiMonthData(year: number | null) {
  if (!year) {
    return NextResponse.json({ error: 'Year parameter required for multi-month view' }, { status: 400 });
  }

  // Current year provider data
  const { data: currentProvData, error } = await supabase
    .from('stats_provider_monthly')
    .select('*')
    .eq('year', year);
  if (error) throw error;

  // Prior year provider data
  const { data: priorProvData } = await supabase
    .from('stats_provider_monthly')
    .select('*')
    .eq('year', year - 1);

  // Testing data (current + prior)
  const { data: currentTestData } = await supabase
    .from('stats_department_monthly')
    .select('*')
    .eq('year', year);
  const { data: priorTestData } = await supabase
    .from('stats_department_monthly')
    .select('*')
    .eq('year', year - 1);

  // Orders data (current + prior)
  const { data: currentOrdData } = await supabase
    .from('stats_orders_monthly')
    .select('*')
    .eq('year', year);
  const { data: priorOrdData } = await supabase
    .from('stats_orders_monthly')
    .select('*')
    .eq('year', year - 1);

  // Provider roles from providers table
  const { data: providersList } = await supabase
    .from('providers')
    .select('id, name, role');
  const roleMap = new Map<string, string>();
  (providersList || []).forEach((p: any) => roleMap.set(p.id, p.role));

  // Session data (Rooms AM/PM services)
  const { data: services } = await supabase
    .from('services')
    .select('id, name')
    .or('name.ilike.%rooms am%,name.ilike.%rooms pm%');
  const roomIds = (services || []).map((s: any) => s.id);

  const buildSessionMap = async (yr: number) => {
    const map = new Map<string, number>();
    if (roomIds.length === 0) return map;
    const { data: sess } = await supabase
      .from('schedule_assignments')
      .select('provider_id, date')
      .eq('is_pto', false)
      .in('service_id', roomIds)
      .gte('date', `${yr}-01-01`)
      .lte('date', `${yr}-12-31`);
    (sess || []).forEach((s: any) => {
      const mo = parseInt(s.date.split('-')[1]);
      const key = `${s.provider_id}-${mo}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  };

  const currentSessMap = await buildSessionMap(year);
  const priorSessMap = await buildSessionMap(year - 1);

  // Build 12-month array from raw data
  const buildMonthsArray = (
    provData: any[], testData: any[], ordData: any[], sessMap: Map<string, number>
  ) => {
    const result = [];
    for (let mo = 1; mo <= 12; mo++) {
      const mProv = provData.filter((r: any) => r.month === mo);
      const mTest = testData.filter((r: any) => r.month === mo);
      const mOrd = ordData.filter((r: any) => r.month === mo);

      let completed = 0, scheduled = 0, noShow = 0, lateCanceled = 0;
      let newPatient = 0, followUp = 0, followUpExtended = 0, leqvioVisit = 0;
      let research = 0, videoVisit = 0, telehealth = 0;
      let bloodDraw = 0, deviceCheck = 0, ekg = 0, eventMonitor = 0;
      let payerCommercial = 0, payerMedicareMedicaid = 0, payerSelfPay = 0, payerInternational = 0;

      const provAgg = new Map<string, any>();
      for (const r of mProv) {
        completed += r.total_completed;
        scheduled += r.total_scheduled;
        noShow += r.total_no_show;
        lateCanceled += r.total_late_cancel;
        newPatient += r.new_patient;
        followUp += r.follow_up;
        followUpExtended += r.follow_up_extended;
        leqvioVisit += r.leqvio_visit;
        research += r.research;
        videoVisit += r.video_visit;
        telehealth += r.telehealth;
        bloodDraw += r.blood_draw;
        deviceCheck += r.device_check;
        ekg += r.ekg;
        eventMonitor += r.event_monitor;
        payerCommercial += r.payer_commercial;
        payerMedicareMedicaid += r.payer_medicare_medicaid;
        payerSelfPay += r.payer_self_pay;
        payerInternational += r.payer_international;

        const pk = r.provider_id || r.provider_name;
        if (!provAgg.has(pk)) {
          provAgg.set(pk, {
            providerId: r.provider_id,
            providerName: r.provider_display_name || r.provider_name,
            role: r.provider_id ? (roleMap.get(r.provider_id) || 'unknown') : 'historical',
            completed: 0, scheduled: 0, noShow: 0, lateCanceled: 0,
            newPatient: 0, followUp: 0, followUpExtended: 0, leqvioVisit: 0,
            research: 0, videoVisit: 0, telehealth: 0,
            bloodDraw: 0, deviceCheck: 0, ekg: 0, eventMonitor: 0,
            payerCommercial: 0, payerMedicareMedicaid: 0, payerSelfPay: 0, payerInternational: 0,
            sessions: 0,
          });
        }
        const pa = provAgg.get(pk)!;
        pa.completed += r.total_completed;
        pa.scheduled += r.total_scheduled;
        pa.noShow += r.total_no_show;
        pa.lateCanceled += r.total_late_cancel;
        pa.newPatient += r.new_patient;
        pa.followUp += r.follow_up;
        pa.followUpExtended += r.follow_up_extended;
        pa.leqvioVisit += r.leqvio_visit;
        pa.research += r.research;
        pa.videoVisit += r.video_visit;
        pa.telehealth += r.telehealth;
        pa.bloodDraw += r.blood_draw;
        pa.deviceCheck += r.device_check;
        pa.ekg += r.ekg;
        pa.eventMonitor += r.event_monitor;
        pa.payerCommercial += r.payer_commercial;
        pa.payerMedicareMedicaid += r.payer_medicare_medicaid;
        pa.payerSelfPay += r.payer_self_pay;
        pa.payerInternational += r.payer_international;
      }

      // Attach session counts per provider
      let totalSessions = 0;
      for (const [, pa] of provAgg) {
        if (pa.providerId) {
          pa.sessions = sessMap.get(`${pa.providerId}-${mo}`) || 0;
          totalSessions += pa.sessions;
        }
      }

      result.push({
        month: mo,
        completed, scheduled, noShow, lateCanceled,
        newPatient, followUp, followUpExtended, leqvioVisit,
        research, videoVisit, telehealth,
        bloodDraw, deviceCheck, ekg, eventMonitor,
        payerCommercial, payerMedicareMedicaid, payerSelfPay, payerInternational,
        sessions: totalSessions,
        testingCompleted: mTest.reduce((s: number, r: any) => s + r.total_completed, 0),
        totalOrders: mOrd.reduce((s: number, r: any) => s + r.total_orders, 0),
        providers: Array.from(provAgg.values()),
      });
    }
    return result;
  };

  const currentMonths = buildMonthsArray(
    currentProvData || [], currentTestData || [], currentOrdData || [], currentSessMap
  );
  // Only build prior year if data exists
  const priorMonths = (priorProvData?.length || 0) > 0
    ? buildMonthsArray(priorProvData || [], priorTestData || [], priorOrdData || [], priorSessMap)
    : [];

  return NextResponse.json({
    year,
    months: currentMonths,
    priorYearMonths: priorMonths,
  });
}

async function getHistoricalData() {
  // Get all provider data (active + historical) — no year filter for full cross-year picture
  const { data: providerData, error } = await supabase
    .from('stats_provider_monthly')
    .select('*')
    .order('year')
    .order('month');
  if (error) throw error;

  // Get all testing data
  const { data: testingData } = await supabase
    .from('stats_department_monthly')
    .select('*')
    .order('year')
    .order('month');

  // Get available years
  const years = new Set<number>();
  providerData?.forEach((r: any) => years.add(r.year));
  testingData?.forEach((r: any) => years.add(r.year));

  return NextResponse.json({
    providerData: providerData || [],
    testingData: testingData || [],
    availableYears: Array.from(years).sort((a, b) => b - a),
  });
}

// ============================================
// VIEW: provider_scorecard
// Returns array of providers with monthlyData keyed by "YYYY-MM"
// ============================================
async function getProviderScorecardV2() {
  // 1. All provider monthly stats
  const { data: provRows, error: provErr } = await supabase
    .from('stats_provider_monthly')
    .select('*')
    .order('year')
    .order('month');
  if (provErr) throw provErr;
  // 2. Provider metadata — index by both id and epic_name (uppercased) for matching
  const { data: providersList } = await supabase
    .from('providers')
    .select('id, name, initials, role, epic_name');
  const providerMetaById = new Map<string, { id: string; name: string; role: string; initials: string; epicName: string }>();
  const providerMetaByEpic = new Map<string, { id: string; name: string; role: string; initials: string; epicName: string }>();
  for (const p of providersList || []) {
    const meta = { id: p.id, name: p.name, role: p.role, initials: p.initials, epicName: p.epic_name || '' };
    providerMetaById.set(p.id, meta);
    if (p.epic_name) providerMetaByEpic.set(p.epic_name.toUpperCase(), meta);
  }
  // Historical providers
  const { data: historicalList } = await supabase
    .from('stats_historical_providers')
    .select('epic_name, display_name, role');
  const historicalByEpic = new Map<string, { displayName: string; role: string }>();
  for (const h of historicalList || []) {
    if (h.epic_name) historicalByEpic.set(h.epic_name.toUpperCase(), { displayName: h.display_name, role: h.role });
  }

  // 3. Session data (Rooms AM/PM)
  const { data: services } = await supabase
    .from('services')
    .select('id, name')
    .or('name.ilike.%rooms am%,name.ilike.%rooms pm%');
  const roomIds = (services || []).map((s: any) => s.id);

  // Build sessions by provider-month (count unique dates, not rows)
  const sessionsByProvMonth = new Map<string, number>();
  if (roomIds.length > 0) {
    const { data: sessData } = await supabase
      .from('schedule_assignments')
      .select('provider_id, date')
      .eq('is_pto', false)
      .in('service_id', roomIds);
    // Group by provider_id + month, counting unique dates
    const provMonthDates = new Map<string, Set<string>>();
    for (const s of sessData || []) {
      const d = new Date(s.date);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const pmKey = `${s.provider_id}-${monthKey}`;
      if (!provMonthDates.has(pmKey)) provMonthDates.set(pmKey, new Set());
      provMonthDates.get(pmKey)!.add(s.date);
    }
    for (const [key, dates] of provMonthDates) {
      sessionsByProvMonth.set(key, dates.size);
    }
  }

  // 4. Testing department data for testsReferred
  const { data: testingDeptData } = await supabase
    .from('stats_department_monthly')
    .select('year, month, referring_providers');

  // Build a map: providerNameLower → monthKey → totalReferred
  const testsReferredMap = new Map<string, Map<string, number>>();
  for (const row of testingDeptData || []) {
    const refProviders: Record<string, number> = row.referring_providers || {};
    const monthKey = `${row.year}-${String(row.month).padStart(2, '0')}`;
    for (const [refName, count] of Object.entries(refProviders)) {
      const refLower = refName.toLowerCase().trim();
      if (!testsReferredMap.has(refLower)) testsReferredMap.set(refLower, new Map());
      const monthMap = testsReferredMap.get(refLower)!;
      monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + (count as number));
    }
  }

  // 5. Orders data for ordersPlaced
  const { data: ordersData } = await supabase
    .from('stats_orders_monthly')
    .select('year, month, provider_id, ordering_provider, total_orders, is_internal');

  // provId → monthKey → totalOrders
  const ordersPlacedMap = new Map<string, Map<string, number>>();
  for (const o of ordersData || []) {
    const key = o.provider_id || o.ordering_provider;
    if (!key) continue;
    const monthKey = `${o.year}-${String(o.month).padStart(2, '0')}`;
    if (!ordersPlacedMap.has(key)) ordersPlacedMap.set(key, new Map());
    const mMap = ordersPlacedMap.get(key)!;
    mMap.set(monthKey, (mMap.get(monthKey) || 0) + (o.total_orders || 0));
  }

  // 6. Build provider → monthlyData
  const provMap = new Map<string, {
    providerId: string | null;
    name: string;
    role: string;
    initials: string;
    monthlyData: Record<string, any>;
  }>();

  // Build name-based lookup: "first last" → meta (from display names stripped of IDs)
  const providerMetaByName = new Map<string, { id: string; name: string; role: string; initials: string; epicName: string }>();
  for (const p of providersList || []) {
    const meta = providerMetaById.get(p.id)!;
    // Index by lowercase "first last"
    const nameLower = p.name.toLowerCase().trim();
    providerMetaByName.set(nameLower, meta);
    // Also index by "last, first" format
    const parts = nameLower.split(' ');
    if (parts.length >= 2) {
      providerMetaByName.set(`${parts[parts.length - 1]}, ${parts[0]}`, meta);
    }
  }

  for (const row of provRows || []) {
    // Try to match: by provider_id, then by epic_name, then by display_name (stripped of [id])
    const epicKey = (row.provider_name || '').toUpperCase();
    const metaById = row.provider_id ? providerMetaById.get(row.provider_id) : null;
    const metaByEpic = !metaById ? providerMetaByEpic.get(epicKey) : null;
    // Try matching display name stripped of bracketed ID: "Patrick Lam [170847]" → "patrick lam"
    const displayName = (row.provider_display_name || row.provider_name || '').replace(/\s*\[.*?\]\s*$/, '').trim().toLowerCase();
    const metaByName = !metaById && !metaByEpic ? providerMetaByName.get(displayName) : null;
    const meta = metaById || metaByEpic || metaByName || null;
    const hist = !meta ? historicalByEpic.get(epicKey) : null;

    // Use provider_id as key if available, otherwise use matched provider id, otherwise provider_name
    const key = row.provider_id || meta?.id || row.provider_name;
    if (!provMap.has(key)) {
      provMap.set(key, {
        providerId: row.provider_id || meta?.id || null,
        name: meta?.name || hist?.displayName || displayName || row.provider_name,
        role: meta?.role || hist?.role || (row.is_historical ? 'historical' : 'unknown'),
        initials: meta?.initials || '',
        monthlyData: {},
      });
    }

    const monthKey = `${row.year}-${String(row.month).padStart(2, '0')}`;
    const p = provMap.get(key)!;

    // Session count for this provider-month (unique dates)
    const provId = row.provider_id || meta?.id;
    const sessions = provId
      ? (sessionsByProvMonth.get(`${provId}-${monthKey}`) || 0)
      : Math.max(1, Math.round((row.total_completed || 0) / 8)); // fallback estimate

    const completed = row.total_completed || 0;
    const scheduled = row.total_scheduled || 0;
    const noShow = row.total_no_show || 0;
    const totalPayer = (row.payer_commercial || 0) + (row.payer_medicare_medicaid || 0)
      + (row.payer_self_pay || 0) + (row.payer_international || 0);

    // Look up testsReferred: match by provider name parts against referring_providers keys
    let testsReferred = 0;
    const provNameLower = (p.name || '').toLowerCase().trim();
    const nameParts = provNameLower.split(' ').filter(Boolean);
    if (nameParts.length >= 2) {
      for (const [refLower, monthMap] of testsReferredMap) {
        if (nameParts.every(part => refLower.includes(part))) {
          testsReferred += monthMap.get(monthKey) || 0;
        }
      }
    }

    // Look up ordersPlaced
    let ordersPlaced = 0;
    if (provId && ordersPlacedMap.has(provId)) {
      ordersPlaced = ordersPlacedMap.get(provId)!.get(monthKey) || 0;
    }

    p.monthlyData[monthKey] = {
      sessions,
      completed,
      patientsPerSession: sessions > 0 ? Math.round((completed / sessions) * 10) / 10 : 0,
      noShowRate: scheduled > 0 ? Math.round((noShow / scheduled) * 1000) / 10 : 0,
      visitTypes: {
        followUp: (row.follow_up || 0) + (row.follow_up_extended || 0),
        newPatient: row.new_patient || 0,
        videoVisit: row.video_visit || 0,
        telehealth: row.telehealth || 0,
      },
      finClassPct: {
        commercial: totalPayer > 0 ? Math.round(((row.payer_commercial || 0) / totalPayer) * 1000) / 10 : 0,
        medicareMedicaid: totalPayer > 0 ? Math.round(((row.payer_medicare_medicaid || 0) / totalPayer) * 1000) / 10 : 0,
        selfPay: totalPayer > 0 ? Math.round(((row.payer_self_pay || 0) / totalPayer) * 1000) / 10 : 0,
        international: totalPayer > 0 ? Math.round(((row.payer_international || 0) / totalPayer) * 1000) / 10 : 0,
      },
      testsReferred,
      ordersPlaced,
    };
  }

  const providers = Array.from(provMap.values())
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ providers });
}

// ============================================
// VIEW: available_months
// Returns sorted array of all months with data as "YYYY-MM" strings
// ============================================
async function getAvailableMonthsV2() {
  const { data: cviMonths } = await supabase
    .from('stats_provider_monthly')
    .select('year, month');

  const { data: testingMonths } = await supabase
    .from('stats_department_monthly')
    .select('year, month');

  const { data: ordersMonths } = await supabase
    .from('stats_orders_monthly')
    .select('year, month');

  const allSet = new Set<string>();
  for (const row of [...(cviMonths || []), ...(testingMonths || []), ...(ordersMonths || [])]) {
    allSet.add(`${row.year}-${String(row.month).padStart(2, '0')}`);
  }

  const sorted = Array.from(allSet).sort().reverse();
  return NextResponse.json(sorted);
}
