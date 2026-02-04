import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET - Fetch recent change history
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const daysBack = parseInt(searchParams.get('daysBack') || '30');

    // Calculate date limit
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - daysBack);
    const limitDateStr = limitDate.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('schedule_change_history')
      .select('*')
      .gte('created_at', limitDateStr)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching change history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch change history' },
      { status: 500 }
    );
  }
}
