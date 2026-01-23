import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface UndoRequest {
  historyId: string;
  force?: boolean; // If true, skip concurrent edit check
}

interface ConflictInfo {
  id: string;
  date: string;
  time_block: string;
  provider_name?: string;
  service_name?: string;
  change_type: 'modified' | 'deleted' | 'added';
  details?: string;
}

// POST - Undo an operation
export async function POST(request: Request) {
  try {
    const body: UndoRequest = await request.json();
    const { historyId, force = false } = body;

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

    // Check if already undone
    if (historyRecord.is_undone) {
      return NextResponse.json(
        { error: 'This operation has already been undone' },
        { status: 400 }
      );
    }

    const createdIds: string[] = historyRecord.created_assignment_ids || [];
    const deletedAssignments: any[] = historyRecord.deleted_assignments || [];

    // Check for concurrent edits unless force=true
    if (!force && createdIds.length > 0) {
      // Fetch current state of created assignments
      const { data: currentAssignments } = await supabase
        .from('schedule_assignments')
        .select(`
          *,
          service:services(name),
          provider:providers(name, initials)
        `)
        .in('id', createdIds);

      const currentMap = new Map((currentAssignments || []).map(a => [a.id, a]));
      const conflicts: ConflictInfo[] = [];

      // Check which assignments have been deleted
      for (const id of createdIds) {
        if (!currentMap.has(id)) {
          conflicts.push({
            id,
            date: 'Unknown',
            time_block: 'Unknown',
            change_type: 'deleted',
            details: 'Assignment was manually deleted'
          });
        }
      }

      // Check for new assignments in the date range that weren't created by this operation
      const { data: rangeAssignments } = await supabase
        .from('schedule_assignments')
        .select(`
          id,
          date,
          time_block,
          service:services(name),
          provider:providers(name, initials)
        `)
        .gte('date', historyRecord.affected_date_start)
        .lte('date', historyRecord.affected_date_end);

      const createdIdSet = new Set(createdIds);
      const restoredIdSet = new Set(deletedAssignments.map(a => a.id));

      for (const assignment of (rangeAssignments || []) as any[]) {
        // If this assignment wasn't created by the operation and wasn't previously deleted
        if (!createdIdSet.has(assignment.id) && !restoredIdSet.has(assignment.id)) {
          // This is a new assignment added after the operation
          conflicts.push({
            id: assignment.id,
            date: assignment.date,
            time_block: assignment.time_block,
            provider_name: assignment.provider?.name || assignment.provider?.initials,
            service_name: assignment.service?.name,
            change_type: 'added',
            details: 'New assignment added since operation'
          });
        }
      }

      // If conflicts found, return them for confirmation
      if (conflicts.length > 0) {
        return NextResponse.json({
          requiresConfirmation: true,
          conflicts,
          message: `${conflicts.length} change(s) detected since this operation. Undoing will overwrite these changes.`
        });
      }
    }

    // Perform the undo:
    // 1. Delete the created assignments
    if (createdIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('schedule_assignments')
        .delete()
        .in('id', createdIds);

      if (deleteError) {
        console.error('Error deleting created assignments:', deleteError);
        // Continue anyway - some may have been manually deleted
      }
    }

    // 2. Restore deleted assignments (if any)
    let restoredCount = 0;
    if (deletedAssignments.length > 0) {
      // Remove id and created_at to let database regenerate them
      // Actually, we want to restore with original IDs if possible for redo
      const assignmentsToRestore = deletedAssignments.map(a => ({
        id: a.id,
        date: a.date,
        service_id: a.service_id,
        provider_id: a.provider_id,
        time_block: a.time_block,
        room_count: a.room_count,
        is_pto: a.is_pto,
        is_covering: a.is_covering,
        notes: a.notes
      }));

      const { data: restored, error: restoreError } = await supabase
        .from('schedule_assignments')
        .upsert(assignmentsToRestore, { onConflict: 'id' })
        .select();

      if (restoreError) {
        console.error('Error restoring deleted assignments:', restoreError);
      } else {
        restoredCount = restored?.length || 0;
      }
    }

    // 3. Update the history record
    const { error: updateError } = await supabase
      .from('schedule_change_history')
      .update({
        is_undone: true,
        undone_at: new Date().toISOString(),
        is_redone: false,
        redone_at: null
      })
      .eq('id', historyId);

    if (updateError) {
      console.error('Error updating history record:', updateError);
    }

    return NextResponse.json({
      success: true,
      deletedCount: createdIds.length,
      restoredCount,
      message: `Undo successful. Deleted ${createdIds.length} assignments, restored ${restoredCount} assignments.`
    });
  } catch (error) {
    console.error('Error performing undo:', error);
    return NextResponse.json(
      { error: 'Failed to undo operation' },
      { status: 500 }
    );
  }
}
