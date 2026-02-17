import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const DAY_NAMES: Record<number, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
};

// GET /api/providers/[id]/work-days-suggestion
// Analyzes past schedule_assignments (non-PTO) to infer typical work days
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get last 90 days of non-PTO schedule assignments
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const startDate = ninetyDaysAgo.toISOString().split('T')[0];

    const { data: assignments, error } = await supabase
      .from('schedule_assignments')
      .select('date')
      .eq('provider_id', id)
      .eq('is_pto', false)
      .gte('date', startDate);

    if (error) throw error;

    if (!assignments || assignments.length === 0) {
      return NextResponse.json({
        suggested_days: [1, 2, 3, 4, 5],
        suggestion_text: 'No schedule history found. Defaulting to Mon-Fri.',
        confidence: 'low',
        day_counts: {},
      });
    }

    // Count occurrences of each day of week
    const dayCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const uniqueDates = new Set<string>();

    for (const assignment of assignments) {
      if (uniqueDates.has(assignment.date)) continue;
      uniqueDates.add(assignment.date);

      const date = new Date(assignment.date + 'T00:00:00');
      const dayOfWeek = date.getDay(); // 0=Sun ... 6=Sat
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        dayCounts[dayOfWeek]++;
      }
    }

    // Total unique weeks in the 90-day period
    const totalWeeks = Math.ceil(uniqueDates.size / 5) || 1;

    // A day is considered a regular work day if the provider worked on it
    // at least 40% of the weeks sampled
    const threshold = totalWeeks * 0.4;
    const suggestedDays = Object.entries(dayCounts)
      .filter(([_, count]) => count >= threshold)
      .map(([day]) => parseInt(day))
      .sort((a, b) => a - b);

    // If no days pass threshold, default to all days that have any assignments
    const finalDays = suggestedDays.length > 0
      ? suggestedDays
      : Object.entries(dayCounts)
          .filter(([_, count]) => count > 0)
          .map(([day]) => parseInt(day))
          .sort((a, b) => a - b);

    const dayLabels = finalDays.map(d => DAY_NAMES[d]).join(', ');

    return NextResponse.json({
      suggested_days: finalDays.length > 0 ? finalDays : [1, 2, 3, 4, 5],
      suggestion_text: finalDays.length > 0
        ? `Based on schedule history: ${dayLabels}`
        : 'No clear pattern found. Defaulting to Mon-Fri.',
      confidence: suggestedDays.length > 0 ? 'high' : 'low',
      day_counts: dayCounts,
      total_unique_dates: uniqueDates.size,
    });
  } catch (error) {
    console.error('Error generating work days suggestion:', error);
    return NextResponse.json(
      { error: 'Failed to generate work days suggestion' },
      { status: 500 }
    );
  }
}
