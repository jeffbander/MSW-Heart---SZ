import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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
      utilizationMap.set(key, {
        date: assignment.date,
        timeBlock: assignment.time_block,
        totalRooms: 0,
        maxRooms: 14,
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
