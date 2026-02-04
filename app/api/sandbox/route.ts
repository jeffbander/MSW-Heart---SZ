import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET - Fetch sandbox assignments for the active session
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    let query = supabase
      .from('sandbox_assignments')
      .select(`
        *,
        service:services(*),
        provider:providers(*)
      `)
      .eq('sandbox_session_id', sessionId);

    if (startDate && endDate) {
      query = query.gte('date', startDate).lte('date', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching sandbox assignments:', error);
    return NextResponse.json({ error: 'Failed to fetch sandbox assignments' }, { status: 500 });
  }
}

// POST - Create a sandbox assignment or start a new sandbox session
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // If creating a new session
    if (body.action === 'create_session') {
      const { data, error } = await supabase
        .from('sandbox_sessions')
        .insert({ name: body.name || 'Untitled Sandbox', is_active: true })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data, { status: 201 });
    }

    // If copying live schedule to sandbox
    if (body.action === 'copy_from_live') {
      const { sessionId, startDate, endDate } = body;

      // Fetch live assignments
      const { data: liveAssignments, error: fetchError } = await supabase
        .from('schedule_assignments')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      if (fetchError) throw fetchError;

      // Copy to sandbox
      if (liveAssignments && liveAssignments.length > 0) {
        const sandboxAssignments = liveAssignments.map(a => ({
          sandbox_session_id: sessionId,
          date: a.date,
          service_id: a.service_id,
          provider_id: a.provider_id,
          time_block: a.time_block,
          room_count: a.room_count,
          is_pto: a.is_pto,
          notes: a.notes,
          source_assignment_id: a.id,
          change_type: null // Initially unchanged from live
        }));

        const { error: insertError } = await supabase
          .from('sandbox_assignments')
          .insert(sandboxAssignments);

        if (insertError) throw insertError;
      }

      return NextResponse.json({ success: true, copied: liveAssignments?.length || 0 });
    }

    // Regular sandbox assignment creation
    const { sandbox_session_id, date, service_id, provider_id, time_block, room_count, is_pto, notes } = body;

    const { data, error } = await supabase
      .from('sandbox_assignments')
      .insert({
        sandbox_session_id,
        date,
        service_id,
        provider_id,
        time_block,
        room_count: room_count || 0,
        is_pto: is_pto || false,
        notes,
        change_type: 'added'
      })
      .select(`
        *,
        service:services(*),
        provider:providers(*)
      `)
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating sandbox assignment:', error);
    return NextResponse.json({ error: 'Failed to create sandbox assignment' }, { status: 500 });
  }
}

// PUT - Update a sandbox assignment
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Assignment ID required' }, { status: 400 });
    }

    // Mark as modified if it came from live
    if (updates.source_assignment_id) {
      updates.change_type = 'modified';
    }

    const { data, error } = await supabase
      .from('sandbox_assignments')
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
    console.error('Error updating sandbox assignment:', error);
    return NextResponse.json({ error: 'Failed to update sandbox assignment' }, { status: 500 });
  }
}

// DELETE - Delete a sandbox assignment or session
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const sessionId = searchParams.get('sessionId');

    if (sessionId) {
      // Delete entire sandbox session
      const { error } = await supabase
        .from('sandbox_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (id) {
      const { error } = await supabase
        .from('sandbox_assignments')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'ID or session ID required' }, { status: 400 });
  } catch (error) {
    console.error('Error deleting sandbox assignment:', error);
    return NextResponse.json({ error: 'Failed to delete sandbox assignment' }, { status: 500 });
  }
}
