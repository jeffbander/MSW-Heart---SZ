import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isHoliday, isInpatientService } from '@/lib/holidays';
import { checkProviderAvailability } from '@/lib/availability';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = supabase
      .from('schedule_assignments')
      .select(`
        id,
        date,
        service_id,
        provider_id,
        time_block,
        room_count,
        is_pto,
        is_covering,
        notes,
        created_at,
        service:services(*),
        provider:providers(*)
      `);

    if (startDate && endDate) {
      query = query
        .gte('date', startDate)
        .lte('date', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching assignments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assignments' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Creating assignment with body:', JSON.stringify(body, null, 2));

    // Check if date is a holiday (allow inpatient services only)
    const holiday = isHoliday(body.date);
    if (holiday) {
      // Get service to check if it's inpatient
      const { data: service } = await supabase
        .from('services')
        .select('name')
        .eq('id', body.service_id)
        .single();

      if (!service || !isInpatientService(service.name)) {
        return NextResponse.json(
          { error: `Cannot schedule on ${holiday.name}. Only Inpatient services (Consults, Burgundy) are allowed on holidays.` },
          { status: 400 }
        );
      }
    }

    // Check for PTO conflicts (time-block specific - allows half-day PTO)
    const timeBlocksToCheck = body.time_block === 'BOTH'
      ? ['AM', 'PM', 'BOTH']
      : [body.time_block, 'BOTH'];

    const { data: existingAssignments } = await supabase
      .from('schedule_assignments')
      .select('*, service:services(name)')
      .eq('provider_id', body.provider_id)
      .eq('date', body.date)
      .in('time_block', timeBlocksToCheck);

    const hasPTO = existingAssignments?.some(
      (a: any) => a.is_pto || a.service?.name === 'PTO'
    );
    const isNewPTO = body.is_pto;

    if (hasPTO && !isNewPTO) {
      return NextResponse.json(
        { error: 'Provider has PTO for this time block and cannot be assigned work' },
        { status: 400 }
      );
    }

    if (isNewPTO && existingAssignments?.some((a: any) => !a.is_pto && a.service?.name !== 'PTO')) {
      return NextResponse.json(
        { error: 'Provider has work assignments for this time block. Remove them before assigning PTO.' },
        { status: 400 }
      );
    }

    // Check availability rules (skip if force_override is set)
    if (!body.force_override) {
      const availabilityCheck = await checkProviderAvailability(
        body.provider_id,
        body.service_id,
        body.date,
        body.time_block
      );

      if (!availabilityCheck.allowed) {
        if (availabilityCheck.enforcement === 'hard') {
          return NextResponse.json(
            {
              error: `Provider availability conflict: ${availabilityCheck.reason}`,
              type: 'availability_hard_block'
            },
            { status: 400 }
          );
        }
        // For 'warn' enforcement, we still create but include warning in response
        // Frontend will have already shown confirmation dialog
      }
    }

    const { data, error } = await supabase
      .from('schedule_assignments')
      .insert(body)
      .select(`
        id,
        date,
        service_id,
        provider_id,
        time_block,
        room_count,
        is_pto,
        is_covering,
        notes,
        created_at
      `);

    if (error) throw error;

    console.log('Created assignment result:', JSON.stringify(data, null, 2));
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating assignment:', error);
    return NextResponse.json(
      { error: 'Failed to create assignment' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Assignment ID is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('schedule_assignments')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        service:services(*),
        provider:providers(*)
      `)
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating assignment:', error);
    return NextResponse.json(
      { error: 'Failed to update assignment' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Assignment ID is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('schedule_assignments')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        service:services(*),
        provider:providers(*)
      `)
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error patching assignment:', error);
    return NextResponse.json(
      { error: 'Failed to update assignment' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Assignment ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('schedule_assignments')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting assignment:', error);
    return NextResponse.json(
      { error: 'Failed to delete assignment' },
      { status: 500 }
    );
  }
}
