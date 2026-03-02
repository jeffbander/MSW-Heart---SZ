import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/statistics/months - Get distinct months that have data
export async function GET() {
  try {
    // Use RPC to get distinct months efficiently instead of fetching all rows
    const { data, error } = await supabase.rpc('get_stat_months');

    if (error) {
      // Fallback: if RPC doesn't exist, query start_date/end_date from uploads
      const { data: uploads } = await supabase
        .from('stat_uploads')
        .select('report_type, report_month, status')
        .eq('status', 'completed');

      if (!uploads || uploads.length === 0) {
        return NextResponse.json({ months: [] });
      }

      // Use the upload metadata to generate month ranges
      // For now, query a small sample to find min/max months
      const { data: minMax } = await supabase
        .from('stat_office_visits')
        .select('report_month')
        .order('report_month', { ascending: true })
        .limit(1);

      const { data: maxData } = await supabase
        .from('stat_office_visits')
        .select('report_month')
        .order('report_month', { ascending: false })
        .limit(1);

      if (!minMax?.[0] || !maxData?.[0]) {
        return NextResponse.json({ months: [] });
      }

      // Generate all months between min and max
      const months: string[] = [];
      const start = new Date(minMax[0].report_month + 'T00:00:00');
      const end = new Date(maxData[0].report_month + 'T00:00:00');
      const cursor = new Date(end);
      while (cursor >= start) {
        months.push(cursor.toISOString().split('T')[0]);
        cursor.setMonth(cursor.getMonth() - 1);
      }

      return NextResponse.json({ months });
    }

    const months = (data || []).map((r: { report_month: string }) => r.report_month);
    return NextResponse.json({ months });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
