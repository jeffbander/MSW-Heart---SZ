import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface RedoRequest {
  historyId: string;
}

// POST - Redo an undone operation
export async function POST(request: Request) {
  try {
    const body: RedoRequest = await request.json();
    const { historyId } = body;

    if (!historyId) {
      return NextResponse.json(
        { error: 'historyId is required' },
        { status: 400 }
      );
    }

    // Fetch the history record
    const { data: historyRecord, error: fetchError } = await supabase
      .from('schedule_change_history')
      .select('*')
      .eq('id', historyId)
      .single();

    if (fetchError || !historyRecord) {
      return NextResponse.json(
        { error: 'History record not found' },
        { status: 404 }
      );
    }

    // Check if operation was undone
    if (!historyRecord.is_undone) {
      return NextResponse.json(
        { error: 'This operation has not been undone - cannot redo' },
        { status: 400 }
      );
    }

    const deletedAssignments: any[] = historyRecord.deleted_assignments || [];
    const redoAssignments: any[] = historyRecord.redo_assignments || [];

    // Perform the redo:
    // 1. Delete the restored assignments (assignments that were restored during undo)
    if (deletedAssignments.length > 0) {
      const idsToDelete = deletedAssignments.map(a => a.id);
      const { error: deleteError } = await supabase
        .from('schedule_assignments')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) {
        console.error('Error deleting restored assignments:', deleteError);
        // Continue anyway
      }
    }

    // 2. Re-create the original assignments
    let createdCount = 0;
    const newCreatedIds: string[] = [];

    if (redoAssignments.length > 0) {
      const { data: created, error: createError } = await supabase
        .from('schedule_assignments')
        .insert(redoAssignments)
        .select();

      if (createError) {
        console.error('Error re-creating assignments:', createError);
        return NextResponse.json(
          { error: 'Failed to re-create assignments' },
          { status: 500 }
        );
      }

      createdCount = created?.length || 0;
      newCreatedIds.push(...(created || []).map(a => a.id));
    }

    // 3. Update the history record with new created IDs
    const { error: updateError } = await supabase
      .from('schedule_change_history')
      .update({
        is_undone: false,
        is_redone: true,
        redone_at: new Date().toISOString(),
        created_assignment_ids: newCreatedIds
      })
      .eq('id', historyId);

    if (updateError) {
      console.error('Error updating history record:', updateError);
    }

    return NextResponse.json({
      success: true,
      deletedCount: deletedAssignments.length,
      createdCount,
      message: `Redo successful. Re-created ${createdCount} assignments.`
    });
  } catch (error) {
    console.error('Error performing redo:', error);
    return NextResponse.json(
      { error: 'Failed to redo operation' },
      { status: 500 }
    );
  }
}
