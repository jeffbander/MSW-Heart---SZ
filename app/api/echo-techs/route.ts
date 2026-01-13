import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/echo-techs - List all echo techs
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('echo_techs')
      .select('*')
      .order('name');

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching echo techs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch echo techs' },
      { status: 500 }
    );
  }
}

// POST /api/echo-techs - Create a new echo tech
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, initials, capacity_per_half_day } = body;

    if (!name || !initials) {
      return NextResponse.json(
        { error: 'Name and initials are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('echo_techs')
      .insert({
        name,
        initials,
        capacity_per_half_day: capacity_per_half_day || 5,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'An echo tech with these initials already exists' },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating echo tech:', error);
    return NextResponse.json(
      { error: 'Failed to create echo tech' },
      { status: 500 }
    );
  }
}

// PUT /api/echo-techs - Update an echo tech
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Echo tech ID is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('echo_techs')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating echo tech:', error);
    return NextResponse.json(
      { error: 'Failed to update echo tech' },
      { status: 500 }
    );
  }
}

// DELETE /api/echo-techs - Delete an echo tech
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Echo tech ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('echo_techs')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting echo tech:', error);
    return NextResponse.json(
      { error: 'Failed to delete echo tech' },
      { status: 500 }
    );
  }
}
