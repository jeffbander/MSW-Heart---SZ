import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  calculatePTODays,
  isRangeNearHoliday,
  countHolidayAdjacentPTORequests,
  buildPTOWarnings
} from '@/lib/ptoCalculation';
import { PTOTimeBlock } from '@/lib/types';

// POST /api/pto-requests/validate - Validate a PTO request and return warnings
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { provider_id, start_date, end_date, time_block } = body;

    // Validate required fields
    if (!provider_id || !start_date || !end_date || !time_block) {
      return NextResponse.json(
        { error: 'Missing required fields: provider_id, start_date, end_date, time_block' },
        { status: 400 }
      );
    }

    // Fetch provider's work_days for accurate PTO calculation
    const { data: providerWorkDays } = await supabase
      .from('providers')
      .select('work_days')
      .eq('id', provider_id)
      .single();
    const workDays = providerWorkDays?.work_days || [1, 2, 3, 4, 5];

    // Calculate PTO days (excluding non-work days)
    const calculated_days = calculatePTODays(
      start_date,
      end_date,
      time_block as PTOTimeBlock,
      workDays
    );

    // Check for overlapping PTO from other providers
    // Query provider_leaves for overlapping dates
    const { data: overlappingLeaves, error: leavesError } = await supabase
      .from('provider_leaves')
      .select(`
        provider_id,
        provider:providers(id, initials, name)
      `)
      .lte('start_date', end_date)
      .gte('end_date', start_date)
      .neq('provider_id', provider_id);

    if (leavesError) {
      console.error('Error fetching overlapping leaves:', leavesError);
    }

    // Also check approved PTO requests for overlapping dates
    const { data: overlappingRequests, error: requestsError } = await supabase
      .from('pto_requests')
      .select(`
        provider_id,
        provider:providers(id, initials, name)
      `)
      .eq('status', 'approved')
      .lte('start_date', end_date)
      .gte('end_date', start_date)
      .neq('provider_id', provider_id);

    if (requestsError) {
      console.error('Error fetching overlapping requests:', requestsError);
    }

    console.log('Validation check - Overlapping leaves:', overlappingLeaves?.length || 0, 'Overlapping requests:', overlappingRequests?.length || 0);

    // Combine and deduplicate overlapping providers
    const providerMap = new Map<string, { initials: string; name: string }>();

    overlappingLeaves?.forEach((leave: any) => {
      if (leave.provider) {
        providerMap.set(leave.provider_id, {
          initials: leave.provider.initials,
          name: leave.provider.name
        });
      } else {
        console.warn('Provider join failed for leave:', leave.provider_id);
      }
    });

    overlappingRequests?.forEach((req: any) => {
      if (req.provider) {
        providerMap.set(req.provider_id, {
          initials: req.provider.initials,
          name: req.provider.name
        });
      } else {
        // Still try to get provider info if join failed
        console.warn('Provider join failed for request, provider_id:', req.provider_id);
      }
    });

    // If we found overlapping requests but provider join failed, fetch provider info separately
    const missingProviderIds = (overlappingRequests || [])
      .filter((req: any) => !req.provider && req.provider_id)
      .map((req: any) => req.provider_id);

    if (missingProviderIds.length > 0) {
      console.log('Fetching missing provider info for:', missingProviderIds);
      const { data: missingProviders } = await supabase
        .from('providers')
        .select('id, initials, name')
        .in('id', missingProviderIds);

      missingProviders?.forEach((p: any) => {
        providerMap.set(p.id, {
          initials: p.initials,
          name: p.name
        });
      });
    }

    const overlappingProviders = Array.from(providerMap.values());
    console.log('Final overlapping providers:', overlappingProviders);

    // Check holiday proximity
    const { isNear, holiday: nearbyHoliday } = isRangeNearHoliday(start_date, end_date, 7);

    // If near a holiday, count how many holiday-adjacent PTO requests this provider already has
    let holidayAdjacentCount = 0;
    if (isNear) {
      const year = new Date(start_date + 'T00:00:00').getFullYear();

      // Get approved requests for this provider this year
      const { data: providerRequests } = await supabase
        .from('pto_requests')
        .select('start_date, end_date')
        .eq('provider_id', provider_id)
        .eq('status', 'approved')
        .gte('start_date', `${year}-01-01`)
        .lte('end_date', `${year}-12-31`);

      if (providerRequests) {
        holidayAdjacentCount = countHolidayAdjacentPTORequests(providerRequests, year, 7);
      }
    }

    // Check for existing work assignments during the requested PTO period
    const { data: existingAssignments } = await supabase
      .from('schedule_assignments')
      .select(`
        id,
        date,
        time_block,
        service:services(name)
      `)
      .eq('provider_id', provider_id)
      .gte('date', start_date)
      .lte('date', end_date);

    // Filter assignments based on time_block conflict
    const conflictingAssignments = (existingAssignments || []).filter((assignment: any) => {
      // FULL PTO conflicts with any assignment
      if (time_block === 'FULL') return true;
      // AM PTO conflicts with AM or BOTH assignments
      if (time_block === 'AM' && (assignment.time_block === 'AM' || assignment.time_block === 'BOTH')) return true;
      // PM PTO conflicts with PM or BOTH assignments
      if (time_block === 'PM' && (assignment.time_block === 'PM' || assignment.time_block === 'BOTH')) return true;
      return false;
    });

    // Build warnings
    const warnings = buildPTOWarnings(
      overlappingProviders,
      holidayAdjacentCount,
      nearbyHoliday
    );

    // Add assignment conflict warnings
    if (conflictingAssignments.length > 0) {
      // Group by date for cleaner display
      const byDate = new Map<string, string[]>();
      conflictingAssignments.forEach((a: any) => {
        const serviceName = a.service?.name || 'Unknown';
        if (!byDate.has(a.date)) {
          byDate.set(a.date, []);
        }
        byDate.get(a.date)!.push(serviceName);
      });

      const dateList = Array.from(byDate.entries())
        .map(([date, services]) => `${date}: ${services.join(', ')}`)
        .join('; ');

      warnings.push({
        type: 'assignment_conflict',
        severity: 'warning',
        message: `You have existing work assignments that will need to be reassigned: ${dateList}`,
        details: {
          assignments: conflictingAssignments,
          count: conflictingAssignments.length
        }
      });
    }

    // Check PTO balance and add balance warning if needed
    const year = new Date(start_date + 'T00:00:00').getFullYear();

    // Get provider's role for default allowance
    const { data: provider } = await supabase
      .from('providers')
      .select('role')
      .eq('id', provider_id)
      .single();

    // Get annual allowance
    let annualAllowance = 20; // system default
    let carryoverDays = 0;

    // Try provider-specific config first
    const { data: providerConfig } = await supabase
      .from('provider_pto_config')
      .select('annual_allowance, carryover_days')
      .eq('provider_id', provider_id)
      .eq('year', year)
      .single();

    if (providerConfig?.annual_allowance !== null && providerConfig?.annual_allowance !== undefined) {
      annualAllowance = providerConfig.annual_allowance;
      carryoverDays = providerConfig.carryover_days || 0;
    } else if (provider?.role) {
      // Try role default
      const { data: roleDefault } = await supabase
        .from('pto_role_defaults')
        .select('annual_allowance')
        .eq('role', provider.role)
        .single();

      if (roleDefault?.annual_allowance !== null && roleDefault?.annual_allowance !== undefined) {
        annualAllowance = roleDefault.annual_allowance;
      } else {
        // Fallback to hardcoded defaults
        const defaultAllowances: Record<string, number> = {
          'Attending': 20,
          'Fellow': 15,
          'NP': 15,
          'PA': 15
        };
        annualAllowance = defaultAllowances[provider.role] || 20;
      }
      // Check for carryover even if using role default
      if (providerConfig?.carryover_days) {
        carryoverDays = providerConfig.carryover_days;
      }
    }

    const totalAvailable = annualAllowance + carryoverDays;

    // Get already used PTO days this year
    const { data: approvedRequests } = await supabase
      .from('pto_requests')
      .select('start_date, end_date, time_block')
      .eq('provider_id', provider_id)
      .eq('status', 'approved')
      .gte('start_date', `${year}-01-01`)
      .lte('end_date', `${year}-12-31`);

    let daysUsed = 0;
    for (const req of approvedRequests || []) {
      daysUsed += calculatePTODays(req.start_date, req.end_date, req.time_block as PTOTimeBlock, workDays);
    }

    const daysRemaining = totalAvailable - daysUsed;
    const daysAfterRequest = daysRemaining - calculated_days;

    // Add balance warning
    if (daysAfterRequest < 0) {
      warnings.push({
        type: 'balance_warning',
        severity: 'warning',
        message: `This request would exceed your PTO balance by ${Math.abs(daysAfterRequest)} day(s). You have ${daysRemaining} day(s) remaining.`,
        details: {
          days_remaining: daysRemaining,
          days_requested: calculated_days,
          days_after_request: daysAfterRequest,
          total_available: totalAvailable
        }
      });
    } else if (daysRemaining <= totalAvailable * 0.2) {
      // Warn if already at 80%+ usage
      warnings.push({
        type: 'balance_warning',
        severity: 'info',
        message: `After this request, you will have ${daysAfterRequest} day(s) remaining for the year.`,
        details: {
          days_remaining: daysRemaining,
          days_requested: calculated_days,
          days_after_request: daysAfterRequest,
          total_available: totalAvailable
        }
      });
    }

    return NextResponse.json({
      calculated_days,
      warnings,
      can_submit: true // Warnings don't block submission
    });
  } catch (error) {
    console.error('Error validating PTO request:', error);
    return NextResponse.json(
      { error: 'Failed to validate PTO request' },
      { status: 500 }
    );
  }
}
