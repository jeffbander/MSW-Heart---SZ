import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET - Fetch all leaves (optionally filtered by date range)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = supabase
      .from('provider_leaves')
      .select('*, provider:providers(id, name, initials)')
      .order('start_date', { ascending: true });

    // If date range provided, filter to leaves that overlap with the range
    if (startDate && endDate) {
      // A leave overlaps with the range if:
      // leave.start_date <= endDate AND leave.end_date >= startDate
      query = query
        .lte('start_date', endDate)
        .gte('end_date', startDate);
    }

    const { data, error } = await query;

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching leaves:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaves' },
      { status: 500 }
    );
  }
}
