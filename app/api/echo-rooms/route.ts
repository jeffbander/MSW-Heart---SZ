import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/echo-rooms - List all echo rooms
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('echo_rooms')
      .select('*')
      .order('display_order');

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching echo rooms:', error);
    return NextResponse.json(
      { error: 'Failed to fetch echo rooms' },
      { status: 500 }
    );
  }
}

// POST /api/echo-rooms - Create a new echo room
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { category, name, short_name, capacity_type, display_order } = body;

    if (!category || !name) {
      return NextResponse.json(
        { error: 'Category and name are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('echo_rooms')
      .insert({
        category,
        name,
        short_name: short_name || null,
        capacity_type: capacity_type || null,
        display_order: display_order || 0,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating echo room:', error);
    return NextResponse.json(
      { error: 'Failed to create echo room' },
      { status: 500 }
    );
  }
}

// PUT /api/echo-rooms - Update an echo room
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Echo room ID is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('echo_rooms')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating echo room:', error);
    return NextResponse.json(
      { error: 'Failed to update echo room' },
      { status: 500 }
    );
  }
}

// DELETE /api/echo-rooms - Delete an echo room
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Echo room ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('echo_rooms')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting echo room:', error);
    return NextResponse.json(
      { error: 'Failed to delete echo room' },
      { status: 500 }
    );
  }
}
