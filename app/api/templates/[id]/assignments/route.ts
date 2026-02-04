import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET - Get all assignments for a template
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabase
      .from('template_assignments')
      .select(`
        *,
        service:services(*),
        provider:providers(*)
      `)
      .eq('template_id', id)
      .order('day_of_week', { ascending: true })
      .order('time_block', { ascending: true });

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

// POST - Add assignment(s) to template
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Support both single assignment and array
    const assignments = Array.isArray(body) ? body : [body];

    // Add template_id to each assignment
    const assignmentsWithTemplateId = assignments.map((a) => ({
      template_id: id,
      day_of_week: a.day_of_week,
      service_id: a.service_id,
      provider_id: a.provider_id,
      time_block: a.time_block,
      room_count: a.room_count || 0,
      is_pto: a.is_pto || false,
      notes: a.notes || null,
    }));

    const { data, error } = await supabase
      .from('template_assignments')
      .insert(assignmentsWithTemplateId)
      .select(`
        *,
        service:services(*),
        provider:providers(*)
      `);

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error adding template assignments:', error);
    return NextResponse.json(
      { error: 'Failed to add template assignments' },
      { status: 500 }
    );
  }
}

// PUT - Replace all assignments for a template (bulk update)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { assignments } = body;

    if (!assignments || !Array.isArray(assignments)) {
      return NextResponse.json(
        { error: 'Assignments array is required' },
        { status: 400 }
      );
    }

    // Delete all existing assignments for this template
    const { error: deleteError } = await supabase
      .from('template_assignments')
      .delete()
      .eq('template_id', id);

    if (deleteError) throw deleteError;

    // Insert new assignments
    if (assignments.length > 0) {
      const assignmentsWithTemplateId = assignments.map((a) => ({
        template_id: id,
        day_of_week: a.day_of_week,
        service_id: a.service_id,
        provider_id: a.provider_id,
        time_block: a.time_block,
        room_count: a.room_count || 0,
        is_pto: a.is_pto || false,
        notes: a.notes || null,
      }));

      const { data, error: insertError } = await supabase
        .from('template_assignments')
        .insert(assignmentsWithTemplateId)
        .select(`
          *,
          service:services(*),
          provider:providers(*)
        `);

      if (insertError) throw insertError;

      return NextResponse.json({
        success: true,
        replaced: assignments.length,
        data,
      });
    }

    return NextResponse.json({
      success: true,
      replaced: 0,
      data: [],
    });
  } catch (error) {
    console.error('Error replacing template assignments:', error);
    return NextResponse.json(
      { error: 'Failed to replace template assignments' },
      { status: 500 }
    );
  }
}

// DELETE - Remove specific assignment(s) from template
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get('assignmentId');

    if (assignmentId) {
      // Delete specific assignment
      const { error } = await supabase
        .from('template_assignments')
        .delete()
        .eq('id', assignmentId)
        .eq('template_id', id);

      if (error) throw error;

      return NextResponse.json({ success: true, deleted: 1 });
    }

    // If no assignmentId, delete all assignments for this template
    const { error } = await supabase
      .from('template_assignments')
      .delete()
      .eq('template_id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, deletedAll: true });
  } catch (error) {
    console.error('Error deleting template assignments:', error);
    return NextResponse.json(
      { error: 'Failed to delete template assignments' },
      { status: 500 }
    );
  }
}
