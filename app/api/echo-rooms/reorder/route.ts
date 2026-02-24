import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireTestingAccess, isAuthError } from '@/lib/auth';

// POST /api/echo-rooms/reorder - Update display order for multiple rooms
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireTestingAccess(request);
    if (isAuthError(authResult)) return authResult;
    const body = await request.json();
    const { roomIds } = body;

    if (!roomIds || !Array.isArray(roomIds)) {
      return NextResponse.json(
        { error: 'roomIds array is required' },
        { status: 400 }
      );
    }

    // Update each room's display_order based on its position in the array
    const updates = roomIds.map((id: string, index: number) => ({
      id,
      display_order: index
    }));

    // Perform batch update
    for (const update of updates) {
      const { error } = await supabase
        .from('echo_rooms')
        .update({ display_order: update.display_order })
        .eq('id', update.id);

      if (error) {
        console.error(`Error updating room ${update.id}:`, error);
        throw error;
      }
    }

    return NextResponse.json({ success: true, updated: roomIds.length });
  } catch (error) {
    console.error('Error reordering echo rooms:', error);
    return NextResponse.json(
      { error: 'Failed to reorder echo rooms' },
      { status: 500 }
    );
  }
}
