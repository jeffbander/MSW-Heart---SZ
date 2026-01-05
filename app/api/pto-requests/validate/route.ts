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

    // Calculate PTO days (excluding weekends and holidays)
    const calculated_days = calculatePTODays(
      start_date,
      end_date,
      time_block as PTOTimeBlock
    );

    // Check for overlapping PTO from other providers
    // Query provider_leaves for overlapping dates
    const { data: overlappingLeaves } = await supabase
      .from('provider_leaves')
      .select(`
        provider_id,
        provider:providers(id, initials, name)
      `)
      .lte('start_date', end_date)
      .gte('end_date', start_date)
      .neq('provider_id', provider_id);

    // Also check approved PTO requests for overlapping dates
    const { data: overlappingRequests } = await supabase
      .from('pto_requests')
      .select(`
        provider_id,
        provider:providers(id, initials, name)
      `)
      .eq('status', 'approved')
      .lte('start_date', end_date)
      .gte('end_date', start_date)
      .neq('provider_id', provider_id);

    // Combine and deduplicate overlapping providers
    const providerMap = new Map<string, { initials: string; name: string }>();

    overlappingLeaves?.forEach((leave: any) => {
      if (leave.provider) {
        providerMap.set(leave.provider_id, {
          initials: leave.provider.initials,
          name: leave.provider.name
        });
      }
    });

    overlappingRequests?.forEach((req: any) => {
      if (req.provider) {
        providerMap.set(req.provider_id, {
          initials: req.provider.initials,
          name: req.provider.name
        });
      }
    });

    const overlappingProviders = Array.from(providerMap.values());

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

    // Build warnings
    const warnings = buildPTOWarnings(
      overlappingProviders,
      holidayAdjacentCount,
      nearbyHoliday
    );

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
