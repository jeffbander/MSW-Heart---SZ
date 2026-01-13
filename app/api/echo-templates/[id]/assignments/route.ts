import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/echo-templates/[id]/assignments - Get template assignments
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabase
      .from('echo_template_assignments')
      .select(`
        *,
        echo_room:echo_rooms(*),
        echo_tech:echo_techs(*)
      `)
      .eq('template_id', id)
      .order('day_of_week')
      .order('time_block');

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching template assignments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch template assignments' },
      { status: 500 }
    );
  }
}

// POST /api/echo-templates/[id]/assignments - Add assignment(s) to template
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Support both single assignment and array of assignments
    const assignments = Array.isArray(body) ? body : [body];

    const insertData = assignments.map(a => ({
      template_id: id,
      day_of_week: a.day_of_week,
      echo_room_id: a.echo_room_id,
      echo_tech_id: a.echo_tech_id,
      time_block: a.time_block,
      notes: a.notes || null
    }));

    const { data, error } = await supabase
      .from('echo_template_assignments')
      .insert(insertData)
      .select(`
        *,
        echo_room:echo_rooms(*),
        echo_tech:echo_techs(*)
      `);

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'This assignment already exists in the template' },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error adding template assignment:', error);
    return NextResponse.json(
      { error: 'Failed to add template assignment' },
      { status: 500 }
    );
  }
}

// PUT /api/echo-templates/[id]/assignments - Replace all assignments
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { assignments } = body;

    // Delete existing assignments
    await supabase
      .from('echo_template_assignments')
      .delete()
      .eq('template_id', id);

    // Insert new assignments if any
    if (assignments && assignments.length > 0) {
      const insertData = assignments.map((a: { day_of_week: number; echo_room_id: string; echo_tech_id: string; time_block: string; notes?: string }) => ({
        template_id: id,
        day_of_week: a.day_of_week,
        echo_room_id: a.echo_room_id,
        echo_tech_id: a.echo_tech_id,
        time_block: a.time_block,
        notes: a.notes || null
      }));

      const { error } = await supabase
        .from('echo_template_assignments')
        .insert(insertData);

      if (error) throw error;
    }

    // Return updated assignments
    const { data, error } = await supabase
      .from('echo_template_assignments')
      .select(`
        *,
        echo_room:echo_rooms(*),
        echo_tech:echo_techs(*)
      `)
      .eq('template_id', id)
      .order('day_of_week')
      .order('time_block');

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error replacing template assignments:', error);
    return NextResponse.json(
      { error: 'Failed to replace template assignments' },
      { status: 500 }
    );
  }
}

// DELETE /api/echo-templates/[id]/assignments - Remove assignment
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get('assignmentId');

    if (!assignmentId) {
      return NextResponse.json(
        { error: 'Assignment ID is required' },
        { status: 400 }
      );
    }

    const { id } = await params;

    const { error } = await supabase
      .from('echo_template_assignments')
      .delete()
      .eq('id', assignmentId)
      .eq('template_id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting template assignment:', error);
    return NextResponse.json(
      { error: 'Failed to delete template assignment' },
      { status: 500 }
    );
  }
}
