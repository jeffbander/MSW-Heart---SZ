import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// PATCH /api/providers/[id] - Update specific provider fields (e.g., work_days)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Only allow updating specific fields
    const allowedFields = ['work_days'];
    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Validate work_days if present
    if (updates.work_days) {
      if (!Array.isArray(updates.work_days)) {
        return NextResponse.json(
          { error: 'work_days must be an array' },
          { status: 400 }
        );
      }
      const validDays = [1, 2, 3, 4, 5];
      for (const day of updates.work_days) {
        if (!validDays.includes(day)) {
          return NextResponse.json(
            { error: 'work_days values must be 1-5 (Mon-Fri)' },
            { status: 400 }
          );
        }
      }
    }

    const { data, error } = await supabase
      .from('providers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating provider:', error);
    return NextResponse.json(
      { error: 'Failed to update provider' },
      { status: 500 }
    );
  }
}
