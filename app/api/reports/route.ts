import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isHoliday } from '@/lib/holidays';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    switch (reportType) {
      case 'provider-workload':
        return await getProviderWorkloadReport(startDate, endDate);
      case 'service-coverage':
        return await getServiceCoverageReport(startDate, endDate);
      case 'room-utilization':
        return await getRoomUtilizationReport(startDate, endDate);
      case 'pto-summary':
        return await getPTOSummaryReport(startDate, endDate);
      case 'rooms-open-monthly':
        return await getRoomsOpenMonthlyReport(startDate, endDate);
      default:
        return await getGeneralStatsReport(startDate, endDate);
    }
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}

async function getProviderWorkloadReport(startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('schedule_assignments')
    .select(`
      provider_id,
      provider:providers(id, name, initials, role),
      service:services(name)
    `)
    .gte('date', startDate)
    .lte('date', endDate)
    .eq('is_pto', false);

  if (error) throw error;

  const workloadMap = new Map();
  data?.forEach((assignment: any) => {
    const providerId = assignment.provider_id;
    if (!workloadMap.has(providerId)) {
      workloadMap.set(providerId, {
        provider: assignment.provider,
        totalShifts: 0,
        services: {}
      });
    }
    const entry = workloadMap.get(providerId);
    entry.totalShifts++;
    const serviceName = assignment.service?.name || 'Unknown';
    entry.services[serviceName] = (entry.services[serviceName] || 0) + 1;
  });

  return NextResponse.json({
    type: 'provider-workload',
    dateRange: { startDate, endDate },
    data: Array.from(workloadMap.values())
  });
}

async function getServiceCoverageReport(startDate: string, endDate: string) {
  const { data: services } = await supabase
    .from('services')
    .select('*')
    .eq('show_on_main_calendar', true);

  const { data: assignments } = await supabase
    .from('schedule_assignments')
    .select('service_id, date, time_block')
    .gte('date', startDate)
    .lte('date', endDate);

  const coverageMap = new Map();
  services?.forEach((service: any) => {
    const serviceAssignments = assignments?.filter((a: any) => a.service_id === service.id) || [];
    coverageMap.set(service.id, {
      service,
      assignmentCount: serviceAssignments.length,
      uniqueDates: [...new Set(serviceAssignments.map((a: any) => a.date))].length
    });
  });

  return NextResponse.json({
    type: 'service-coverage',
    dateRange: { startDate, endDate },
    data: Array.from(coverageMap.values())
  });
}

async function getRoomUtilizationReport(startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('schedule_assignments')
    .select(`
      date,
      time_block,
      room_count,
      provider:providers(initials)
    `)
    .gte('date', startDate)
    .lte('date', endDate)
    .gt('room_count', 0);

  if (error) throw error;

  const utilizationMap = new Map();
  data?.forEach((assignment: any) => {
    const key = `${assignment.date}-${assignment.time_block}`;
    if (!utilizationMap.has(key)) {
      // Calculate maxRooms based on day of week (Wed/Thu PM = 15, others = 14)
      const dayOfWeek = new Date(assignment.date + 'T00:00:00').getDay();
      const isExtendedDay = (dayOfWeek === 3 || dayOfWeek === 4) && assignment.time_block === 'PM';
      const maxRooms = isExtendedDay ? 15 : 14;

      utilizationMap.set(key, {
        date: assignment.date,
        timeBlock: assignment.time_block,
        totalRooms: 0,
        maxRooms,
        unusedRooms: 0,
        providers: []
      });
    }
    const entry = utilizationMap.get(key);
    entry.totalRooms += assignment.room_count;
    entry.providers.push({
      initials: assignment.provider?.initials,
      rooms: assignment.room_count
    });
  });

  // Calculate unusedRooms for each entry
  utilizationMap.forEach((entry) => {
    entry.unusedRooms = Math.max(0, entry.maxRooms - entry.totalRooms);
  });

  return NextResponse.json({
    type: 'room-utilization',
    dateRange: { startDate, endDate },
    data: Array.from(utilizationMap.values())
  });
}

async function getPTOSummaryReport(startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('schedule_assignments')
    .select(`
      date,
      provider:providers(id, name, initials)
    `)
    .gte('date', startDate)
    .lte('date', endDate)
    .eq('is_pto', true);

  if (error) throw error;

  const ptoMap = new Map();
  data?.forEach((assignment: any) => {
    const providerId = assignment.provider?.id;
    if (!ptoMap.has(providerId)) {
      ptoMap.set(providerId, {
        provider: assignment.provider,
        ptoDays: [],
        totalDays: 0
      });
    }
    const entry = ptoMap.get(providerId);
    if (!entry.ptoDays.includes(assignment.date)) {
      entry.ptoDays.push(assignment.date);
      entry.totalDays++;
    }
  });

  return NextResponse.json({
    type: 'pto-summary',
    dateRange: { startDate, endDate },
    data: Array.from(ptoMap.values())
  });
}

async function getGeneralStatsReport(startDate: string, endDate: string) {
  const { data: assignments } = await supabase
    .from('schedule_assignments')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate);

  const { data: providers } = await supabase.from('providers').select('id');
  const { data: services } = await supabase.from('services').select('id');

  const ptoCount = assignments?.filter((a: any) => a.is_pto).length || 0;
  const totalAssignments = assignments?.length || 0;

  return NextResponse.json({
    type: 'general-stats',
    dateRange: { startDate, endDate },
    data: {
      totalAssignments,
      ptoAssignments: ptoCount,
      workAssignments: totalAssignments - ptoCount,
      totalProviders: providers?.length || 0,
      totalServices: services?.length || 0
    }
  });
}

async function getRoomsOpenMonthlyReport(startDate: string, endDate: string) {
  // Get all room assignments for the date range
  const { data, error } = await supabase
    .from('schedule_assignments')
    .select('date, time_block, room_count')
    .gte('date', startDate)
    .lte('date', endDate)
    .gt('room_count', 0);

  if (error) throw error;

  // Build a map of date+timeBlock -> total rooms filled
  const filledMap = new Map<string, number>();
  data?.forEach((assignment: any) => {
    const key = `${assignment.date}-${assignment.time_block}`;
    filledMap.set(key, (filledMap.get(key) || 0) + assignment.room_count);
  });

  // Generate all weekdays in the range and calculate open rooms
  const openSlots: { date: string; dayName: string; timeBlock: string; openRooms: number }[] = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const current = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const dateStr = current.toISOString().split('T')[0];

    // Skip weekends and holidays
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isHoliday(dateStr)) {
      const dayName = dayNames[dayOfWeek];
      const month = current.getMonth() + 1;
      const day = current.getDate();
      const formattedDate = `${month}/${day}`;

      // Check AM
      const amKey = `${dateStr}-AM`;
      const amFilled = filledMap.get(amKey) || 0;
      const amTarget = 14;
      const amOpen = Math.max(0, amTarget - amFilled);
      if (amOpen > 0) {
        openSlots.push({
          date: dateStr,
          dayName: `${dayName} ${formattedDate}`,
          timeBlock: 'AM',
          openRooms: amOpen
        });
      }

      // Check PM (Wed/Thu have 15 target, others 14)
      const isExtendedDay = dayOfWeek === 3 || dayOfWeek === 4;
      const pmKey = `${dateStr}-PM`;
      const pmFilled = filledMap.get(pmKey) || 0;
      const pmTarget = isExtendedDay ? 15 : 14;
      const pmOpen = Math.max(0, pmTarget - pmFilled);
      if (pmOpen > 0) {
        openSlots.push({
          date: dateStr,
          dayName: `${dayName} ${formattedDate}`,
          timeBlock: 'PM',
          openRooms: pmOpen
        });
      }
    }

    current.setDate(current.getDate() + 1);
  }

  // Calculate total
  const totalOpenRooms = openSlots.reduce((sum, slot) => sum + slot.openRooms, 0);

  return NextResponse.json({
    type: 'rooms-open-monthly',
    dateRange: { startDate, endDate },
    data: openSlots,
    totalOpenRooms
  });
}
