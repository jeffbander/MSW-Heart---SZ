import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  calculatePTODays,
  countHolidayAdjacentPTORequests
} from '@/lib/ptoCalculation';
import { PTOTimeBlock } from '@/lib/types';

// GET /api/providers/[id]/pto-summary - Get PTO summary for a provider
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

    // Verify provider exists
    const { data: provider, error: providerError } = await supabase
      .from('providers')
      .select('id, name, initials, work_days')
      .eq('id', id)
      .single();

    if (providerError) {
      if (providerError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Provider not found' },
          { status: 404 }
        );
      }
      throw providerError;
    }

    // Get all approved PTO requests for this provider this year
    const { data: approvedRequests, error: requestsError } = await supabase
      .from('pto_requests')
      .select('*')
      .eq('provider_id', id)
      .eq('status', 'approved')
      .gte('start_date', `${year}-01-01`)
      .lte('end_date', `${year}-12-31`)
      .order('start_date', { ascending: true });

    if (requestsError) throw requestsError;

    // Calculate total PTO days and breakdown by type
    const workDays = provider.work_days || [1, 2, 3, 4, 5];
    let totalPTODays = 0;
    const requestsByType: Record<string, number> = {};

    for (const req of approvedRequests || []) {
      const days = calculatePTODays(
        req.start_date,
        req.end_date,
        req.time_block as PTOTimeBlock,
        workDays
      );

      totalPTODays += days;

      const type = req.leave_type;
      requestsByType[type] = (requestsByType[type] || 0) + days;
    }

    // Count holiday-adjacent PTO requests
    const holidaysTaken = countHolidayAdjacentPTORequests(
      approvedRequests || [],
      year,
      7
    );

    return NextResponse.json({
      provider_id: id,
      provider_name: provider.name,
      provider_initials: provider.initials,
      year,
      total_pto_days: totalPTODays,
      requests_by_type: requestsByType,
      holidays_taken: holidaysTaken,
      approved_requests: approvedRequests || []
    });
  } catch (error) {
    console.error('Error fetching PTO summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch PTO summary' },
      { status: 500 }
    );
  }
}
