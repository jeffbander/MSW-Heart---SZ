import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET - Fetch day metadata for a date range
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = supabase
      .from('day_metadata')
      .select('*')
      .order('date', { ascending: true });

    if (startDate && endDate) {
      query = query
        .gte('date', startDate)
        .lte('date', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching day metadata:', error);
    return NextResponse.json(
      { error: 'Failed to fetch day metadata' },
      { status: 500 }
    );
  }
}

// POST - Create or update day metadata (upsert)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, time_block, chp_room_in_use, chp_room_note, extra_room_available, extra_room_note, day_note } = body;

    if (!date || !time_block) {
      return NextResponse.json(
        { error: 'date and time_block are required' },
        { status: 400 }
      );
    }

    // Upsert - insert or update if exists
    const { data, error } = await supabase
      .from('day_metadata')
      .upsert(
        {
          date,
          time_block,
          chp_room_in_use: chp_room_in_use || false,
          chp_room_note: chp_room_note || null,
          extra_room_available: extra_room_available || false,
          extra_room_note: extra_room_note || null,
          day_note: day_note || null,
        },
        { onConflict: 'date,time_block' }
      )
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error saving day metadata:', error);
    return NextResponse.json(
      { error: 'Failed to save day metadata' },
      { status: 500 }
    );
  }
}

// DELETE - Remove day metadata
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('day_metadata')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting day metadata:', error);
    return NextResponse.json(
      { error: 'Failed to delete day metadata' },
      { status: 500 }
    );
  }
}
