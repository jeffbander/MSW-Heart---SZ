import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireTestingAccess, isAuthError } from '@/lib/auth';

// GET /api/echo-pto - Get PTO entries for date range
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = supabase
      .from('echo_pto')
      .select(`
        *,
        echo_tech:echo_techs(*)
      `);

    if (startDate && endDate) {
      query = query
        .gte('date', startDate)
        .lte('date', endDate);
    }

    const { data, error } = await query.order('date');

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching echo PTO:', error);
    return NextResponse.json(
      { error: 'Failed to fetch echo PTO' },
      { status: 500 }
    );
  }
}

// POST /api/echo-pto - Create a PTO entry
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireTestingAccess(request);
    if (isAuthError(authResult)) return authResult;
    const body = await request.json();
    const { date, echo_tech_id, time_block, reason } = body;

    if (!date || !echo_tech_id || !time_block) {
      return NextResponse.json(
        { error: 'Date, tech, and time block are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('echo_pto')
      .insert({
        date,
        echo_tech_id,
        time_block,
        reason: reason || null
      })
      .select(`
        *,
        echo_tech:echo_techs(*)
      `)
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'This PTO entry already exists' },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating echo PTO:', error);
    return NextResponse.json(
      { error: 'Failed to create PTO entry' },
      { status: 500 }
    );
  }
}

// PUT /api/echo-pto - Update a PTO entry
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireTestingAccess(request);
    if (isAuthError(authResult)) return authResult;
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'PTO entry ID is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('echo_pto')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        echo_tech:echo_techs(*)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating echo PTO:', error);
    return NextResponse.json(
      { error: 'Failed to update PTO entry' },
      { status: 500 }
    );
  }
}

// DELETE /api/echo-pto - Delete a PTO entry
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireTestingAccess(request);
    if (isAuthError(authResult)) return authResult;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'PTO entry ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('echo_pto')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting echo PTO:', error);
    return NextResponse.json(
      { error: 'Failed to delete PTO entry' },
      { status: 500 }
    );
  }
}
