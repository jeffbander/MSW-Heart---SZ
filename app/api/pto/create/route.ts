import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  createPTOScheduleAssignments,
  getProviderWorkdays,
} from '@/lib/ptoScheduleAssignments';

// POST /api/pto/create - Create PTO in all related tables
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      provider_id,
      start_date,
      end_date,
      time_block = 'FULL', // 'AM', 'PM', or 'FULL'
      leave_type = 'vacation',
      reason,
    } = body;

    // Validate required fields
    if (!provider_id || !start_date || !end_date) {
      return NextResponse.json(
        { error: 'provider_id, start_date, and end_date are required' },
        { status: 400 }
      );
    }

    // Validate date range
    const startDateObj = new Date(start_date + 'T00:00:00');
    const endDateObj = new Date(end_date + 'T00:00:00');
    if (startDateObj > endDateObj) {
      return NextResponse.json(
        { error: 'Start date must be before or equal to end date' },
        { status: 400 }
      );
    }

    // Get provider's work days in range
    const weekdays = await getProviderWorkdays(provider_id, start_date, end_date);

    if (weekdays.length === 0) {
      return NextResponse.json(
        { error: 'No work days in the selected date range' },
        { status: 400 }
      );
    }

    const results = {
      pto_request_created: false,
      provider_leave_created: false,
      schedule_assignments_created: 0,
      dates_processed: weekdays,
    };

    // 1. Create pto_request (auto-approved since this is admin action)
    const { data: ptoRequest, error: requestError } = await supabase
      .from('pto_requests')
      .insert({
        provider_id,
        start_date,
        end_date,
        leave_type,
        time_block: time_block === 'FULL' ? 'FULL' : time_block,
        reason: reason || null,
        status: 'approved',
        requested_by: 'admin',
        reviewed_at: new Date().toISOString(),
        reviewed_by_admin_name: 'Auto-approved (calendar entry)',
      })
      .select()
      .single();

    if (requestError) {
      console.error('Error creating pto_request:', requestError);
    } else {
      results.pto_request_created = true;
    }

    // 2. Create provider_leave
    const { error: leaveError } = await supabase
      .from('provider_leaves')
      .insert({
        provider_id,
        start_date,
        end_date,
        leave_type,
        reason: reason || null,
      });

    if (leaveError) {
      console.error('Error creating provider_leave:', leaveError);
    } else {
      results.provider_leave_created = true;
    }

    // 3. Create schedule_assignments using shared utility
    const assignmentResult = await createPTOScheduleAssignments({
      provider_id,
      start_date,
      end_date,
      time_block,
    });

    results.schedule_assignments_created = assignmentResult.created;

    return NextResponse.json({
      success: true,
      message: 'PTO created successfully',
      ...results,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating PTO:', error);
    return NextResponse.json(
      { error: 'Failed to create PTO' },
      { status: 500 }
    );
  }
}
