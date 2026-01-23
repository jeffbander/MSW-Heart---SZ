import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

    // Get weekdays in the range (skip weekends)
    const weekdays = getWeekdaysInRange(start_date, end_date);

    if (weekdays.length === 0) {
      return NextResponse.json(
        { error: 'No weekdays in the selected date range' },
        { status: 400 }
      );
    }

    // Get the PTO service ID
    const { data: ptoService, error: serviceError } = await supabase
      .from('services')
      .select('id')
      .eq('name', 'PTO')
      .single();

    if (serviceError || !ptoService) {
      console.error('Error finding PTO service:', serviceError);
      return NextResponse.json(
        { error: 'PTO service not found' },
        { status: 500 }
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

    // 3. Create schedule_assignments for each weekday
    // Determine time blocks to create assignments for
    const timeBlocks = time_block === 'FULL' ? ['BOTH'] : [time_block];

    // Check for existing PTO assignments to avoid duplicates
    const { data: existingAssignments } = await supabase
      .from('schedule_assignments')
      .select('date, time_block')
      .eq('provider_id', provider_id)
      .eq('service_id', ptoService.id)
      .eq('is_pto', true)
      .in('date', weekdays);

    const existingSet = new Set(
      (existingAssignments || []).map(a => `${a.date}-${a.time_block}`)
    );

    const assignmentsToCreate = [];
    for (const date of weekdays) {
      for (const tb of timeBlocks) {
        const key = `${date}-${tb}`;
        if (!existingSet.has(key)) {
          assignmentsToCreate.push({
            provider_id,
            service_id: ptoService.id,
            date,
            time_block: tb,
            room_count: 0,
            is_pto: true,
            is_covering: false,
            notes: null,
          });
        }
      }
    }

    if (assignmentsToCreate.length > 0) {
      const { data: createdAssignments, error: assignmentError } = await supabase
        .from('schedule_assignments')
        .insert(assignmentsToCreate)
        .select();

      if (assignmentError) {
        console.error('Error creating schedule_assignments:', assignmentError);
      } else {
        results.schedule_assignments_created = createdAssignments?.length || 0;
      }
    }

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

// Helper to get weekdays in a date range (excludes Sat and Sun)
function getWeekdaysInRange(startDate: string, endDate: string): string[] {
  const weekdays: string[] = [];
  const current = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  while (current <= end) {
    const dayOfWeek = current.getDay();
    // Skip Saturday (6) and Sunday (0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      weekdays.push(formatLocalDate(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return weekdays;
}

// Helper to format date as YYYY-MM-DD
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
