import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/echo-schedule - Get assignments for date range
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = supabase
      .from('echo_schedule_assignments')
      .select(`
        *,
        echo_room:echo_rooms(*),
        echo_tech:echo_techs(*)
      `);

    if (startDate && endDate) {
      query = query
        .gte('date', startDate)
        .lte('date', endDate);
    }

    const { data, error } = await query.order('date');

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching echo schedule:', error);
    return NextResponse.json(
      { error: 'Failed to fetch echo schedule' },
      { status: 500 }
    );
  }
}

// POST /api/echo-schedule - Create an assignment
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, echo_room_id, echo_tech_id, time_block, notes } = body;

    if (!date || !echo_room_id || !echo_tech_id || !time_block) {
      return NextResponse.json(
        { error: 'Date, room, tech, and time block are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('echo_schedule_assignments')
      .insert({
        date,
        echo_room_id,
        echo_tech_id,
        time_block,
        notes: notes || null
      })
      .select(`
        *,
        echo_room:echo_rooms(*),
        echo_tech:echo_techs(*)
      `)
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'This assignment already exists' },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating echo assignment:', error);
    return NextResponse.json(
      { error: 'Failed to create assignment' },
      { status: 500 }
    );
  }
}

// PUT /api/echo-schedule - Update an assignment
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
      .from('echo_schedule_assignments')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        echo_room:echo_rooms(*),
        echo_tech:echo_techs(*)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating echo assignment:', error);
    return NextResponse.json(
      { error: 'Failed to update assignment' },
      { status: 500 }
    );
  }
}

// DELETE /api/echo-schedule - Delete an assignment
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
      .from('echo_schedule_assignments')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting echo assignment:', error);
    return NextResponse.json(
      { error: 'Failed to delete assignment' },
      { status: 500 }
    );
  }
}
