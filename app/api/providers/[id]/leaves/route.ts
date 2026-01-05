import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET - Fetch all leaves for a provider
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabase
      .from('provider_leaves')
      .select('*')
      .eq('provider_id', id)
      .order('start_date', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching provider leaves:', error);
    return NextResponse.json(
      { error: 'Failed to fetch provider leaves' },
      { status: 500 }
    );
  }
}

// POST - Create a new leave for a provider
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { start_date, end_date, leave_type, reason } = body;

    if (!start_date || !end_date || !leave_type) {
      return NextResponse.json(
        { error: 'start_date, end_date, and leave_type are required' },
        { status: 400 }
      );
    }

    // Validate date range
    if (new Date(start_date) > new Date(end_date)) {
      return NextResponse.json(
        { error: 'start_date must be before or equal to end_date' },
        { status: 400 }
      );
    }

    // Validate leave_type
    const validTypes = ['maternity', 'vacation', 'medical', 'personal', 'conference', 'other'];
    if (!validTypes.includes(leave_type)) {
      return NextResponse.json(
        { error: 'Invalid leave_type' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('provider_leaves')
      .insert({
        provider_id: id,
        start_date,
        end_date,
        leave_type,
        reason: reason || null
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating provider leave:', error);
    return NextResponse.json(
      { error: 'Failed to create provider leave' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a specific leave
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const leaveId = searchParams.get('leaveId');

    if (!leaveId) {
      return NextResponse.json(
        { error: 'leaveId is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('provider_leaves')
      .delete()
      .eq('id', leaveId)
      .eq('provider_id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting provider leave:', error);
    return NextResponse.json(
      { error: 'Failed to delete provider leave' },
      { status: 500 }
    );
  }
}
