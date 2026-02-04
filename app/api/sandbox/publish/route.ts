import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// POST - Publish sandbox changes to live schedule
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, startDate, endDate } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // Get all sandbox assignments for this session
    let query = supabase
      .from('sandbox_assignments')
      .select('*')
      .eq('sandbox_session_id', sessionId);

    if (startDate && endDate) {
      query = query.gte('date', startDate).lte('date', endDate);
    }

    const { data: sandboxAssignments, error: fetchError } = await query;

    if (fetchError) throw fetchError;

    if (!sandboxAssignments || sandboxAssignments.length === 0) {
      return NextResponse.json({ message: 'No assignments to publish' });
    }

    // Process each sandbox assignment
    let published = 0;
    let errors = [];

    for (const sa of sandboxAssignments) {
      try {
        if (sa.change_type === 'added') {
          // Insert new assignment
          const { error } = await supabase
            .from('schedule_assignments')
            .insert({
              date: sa.date,
              service_id: sa.service_id,
              provider_id: sa.provider_id,
              time_block: sa.time_block,
              room_count: sa.room_count,
              is_pto: sa.is_pto,
              notes: sa.notes
            });

          if (error) throw error;
          published++;
        } else if (sa.change_type === 'modified' && sa.source_assignment_id) {
          // Update existing assignment
          const { error } = await supabase
            .from('schedule_assignments')
            .update({
              provider_id: sa.provider_id,
              room_count: sa.room_count,
              is_pto: sa.is_pto,
              notes: sa.notes
            })
            .eq('id', sa.source_assignment_id);

          if (error) throw error;
          published++;
        } else if (sa.change_type === 'removed' && sa.source_assignment_id) {
          // Delete the assignment
          const { error } = await supabase
            .from('schedule_assignments')
            .delete()
            .eq('id', sa.source_assignment_id);

          if (error) throw error;
          published++;
        }
      } catch (err) {
        errors.push({ assignment: sa.id, error: err });
      }
    }

    // Clear the sandbox after successful publish
    if (errors.length === 0) {
      await supabase
        .from('sandbox_assignments')
        .delete()
        .eq('sandbox_session_id', sessionId);
    }

    return NextResponse.json({
      success: true,
      published,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error publishing sandbox:', error);
    return NextResponse.json({ error: 'Failed to publish sandbox' }, { status: 500 });
  }
}
