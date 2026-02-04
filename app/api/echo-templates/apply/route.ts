import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Helper to format date in local timezone (avoids UTC conversion issues)
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// POST /api/echo-templates/apply - Apply template to date range
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { templateId, startDate, endDate, fillEmptyOnly = true } = body;

    if (!templateId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Template ID, start date, and end date are required' },
        { status: 400 }
      );
    }

    // Fetch template assignments
    const { data: templateAssignments, error: templateError } = await supabase
      .from('echo_template_assignments')
      .select('*')
      .eq('template_id', templateId);

    if (templateError) throw templateError;

    if (!templateAssignments || templateAssignments.length === 0) {
      return NextResponse.json(
        { error: 'Template has no assignments' },
        { status: 400 }
      );
    }

    // Generate dates in range
    const dates: string[] = [];
    const current = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');

    while (current <= end) {
      dates.push(formatLocalDate(current));
      current.setDate(current.getDate() + 1);
    }

    // Fetch existing assignments if fillEmptyOnly
    let existingAssignments: Set<string> = new Set();
    if (fillEmptyOnly) {
      const { data: existing } = await supabase
        .from('echo_schedule_assignments')
        .select('date, echo_room_id, time_block')
        .gte('date', startDate)
        .lte('date', endDate);

      if (existing) {
        existing.forEach(a => {
          existingAssignments.add(`${a.date}-${a.echo_room_id}-${a.time_block}`);
        });
      }
    }

    // Generate assignments from template
    const newAssignments: {
      date: string;
      echo_room_id: string;
      echo_tech_id: string;
      time_block: string;
      notes: string | null;
    }[] = [];

    let skippedCount = 0;

    dates.forEach(date => {
      const dayOfWeek = new Date(date + 'T00:00:00').getDay();

      // Get template assignments for this day of week
      const dayAssignments = templateAssignments.filter(
        a => a.day_of_week === dayOfWeek
      );

      dayAssignments.forEach(ta => {
        const key = `${date}-${ta.echo_room_id}-${ta.time_block}`;

        // Skip if fillEmptyOnly and slot already has an assignment
        if (fillEmptyOnly && existingAssignments.has(key)) {
          skippedCount++;
          return;
        }

        newAssignments.push({
          date,
          echo_room_id: ta.echo_room_id,
          echo_tech_id: ta.echo_tech_id,
          time_block: ta.time_block,
          notes: ta.notes
        });
      });
    });

    // Insert new assignments
    let insertedCount = 0;
    let errorCount = 0;

    if (newAssignments.length > 0) {
      // Insert in batches to handle potential duplicates
      for (const assignment of newAssignments) {
        const { error } = await supabase
          .from('echo_schedule_assignments')
          .insert(assignment);

        if (error) {
          if (error.code === '23505') {
            // Duplicate, skip
            skippedCount++;
          } else {
            errorCount++;
            console.error('Error inserting assignment:', error);
          }
        } else {
          insertedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      inserted: insertedCount,
      skipped: skippedCount,
      errors: errorCount,
      message: `Applied template: ${insertedCount} assignments created, ${skippedCount} skipped (already filled or duplicate)`
    });
  } catch (error) {
    console.error('Error applying template:', error);
    return NextResponse.json(
      { error: 'Failed to apply template' },
      { status: 500 }
    );
  }
}
