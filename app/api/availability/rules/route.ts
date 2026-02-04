import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET - Fetch all availability rules (for client-side filtering in suggestions)
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('provider_availability_rules')
      .select('*');

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching availability rules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch availability rules' },
      { status: 500 }
    );
  }
}
