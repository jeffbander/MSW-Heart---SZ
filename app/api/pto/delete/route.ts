import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { cascadePTODeletion } from '@/lib/ptoCascade';

// DELETE /api/pto/delete - Delete PTO from all related tables
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get('providerId');
    const date = searchParams.get('date');
    const timeBlock = searchParams.get('timeBlock');

    if (!providerId || !date) {
      return NextResponse.json(
        { error: 'providerId and date are required' },
        { status: 400 }
      );
    }

    const results = {
      schedule_assignments_deleted: 0,
      pto_requests_updated: 0,
      provider_leaves_updated: 0,
    };

    // 1. Delete from schedule_assignments where is_pto=true
    const timeBlockFilter = timeBlock && timeBlock !== 'BOTH'
      ? [timeBlock, 'BOTH']
      : ['AM', 'PM', 'BOTH'];

    const { data: deletedAssignments, error: assignmentError } = await supabase
      .from('schedule_assignments')
      .delete()
      .eq('provider_id', providerId)
      .eq('date', date)
      .in('time_block', timeBlockFilter)
      .eq('is_pto', true)
      .select();

    if (assignmentError) {
      console.error('Error deleting schedule_assignments:', assignmentError);
    } else {
      results.schedule_assignments_deleted = deletedAssignments?.length || 0;
    }

    // 2. Cascade-delete pto_requests and provider_leaves
    const cascadeResult = await cascadePTODeletion(providerId, date);
    results.pto_requests_updated = cascadeResult.pto_requests_updated;
    results.provider_leaves_updated = cascadeResult.provider_leaves_updated;

    return NextResponse.json({
      success: true,
      message: 'PTO deleted successfully',
      ...results,
    });
  } catch (error) {
    console.error('Error deleting PTO:', error);
    return NextResponse.json(
      { error: 'Failed to delete PTO' },
      { status: 500 }
    );
  }
}
