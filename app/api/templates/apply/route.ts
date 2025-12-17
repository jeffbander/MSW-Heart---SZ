import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isHoliday, isInpatientService } from '@/lib/holidays';

// Helper to get all dates between start and end (inclusive)
function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

// POST - Apply template to date range
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { templateId, startDate, endDate, options } = body;

    if (!templateId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'templateId, startDate, and endDate are required' },
        { status: 400 }
      );
    }

    const clearExisting = options?.clearExisting ?? false;
    const skipConflicts = options?.skipConflicts ?? true;

    // Fetch template assignments
    const { data: templateAssignments, error: templateError } = await supabase
      .from('template_assignments')
      .select(`
        *,
        service:services(name)
      `)
      .eq('template_id', templateId);

    if (templateError) throw templateError;

    if (!templateAssignments || templateAssignments.length === 0) {
      return NextResponse.json(
        { error: 'Template has no assignments' },
        { status: 400 }
      );
    }

    // Get all dates in range
    const dates = getDateRange(startDate, endDate);

    // Group template assignments by day_of_week
    const assignmentsByDay = new Map<number, typeof templateAssignments>();
    templateAssignments.forEach((ta) => {
      const existing = assignmentsByDay.get(ta.day_of_week) || [];
      existing.push(ta);
      assignmentsByDay.set(ta.day_of_week, existing);
    });

    // If clearExisting, delete all assignments in the date range first
    if (clearExisting) {
      const { error: deleteError } = await supabase
        .from('schedule_assignments')
        .delete()
        .gte('date', startDate)
        .lte('date', endDate);

      if (deleteError) throw deleteError;
    }

    // Build assignments to create
    const assignmentsToCreate: any[] = [];
    const skipped: string[] = [];
    const holidayConflicts: string[] = [];

    for (const date of dates) {
      const dateObj = new Date(date + 'T00:00:00');
      const dayOfWeek = dateObj.getDay();
      const dayAssignments = assignmentsByDay.get(dayOfWeek) || [];

      for (const ta of dayAssignments) {
        // Check holiday restrictions
        const holiday = isHoliday(date);
        if (holiday && !isInpatientService(ta.service?.name || '')) {
          holidayConflicts.push(`${date}: ${holiday.name} (${ta.service?.name || 'Unknown'})`);
          continue;
        }

        assignmentsToCreate.push({
          date,
          service_id: ta.service_id,
          provider_id: ta.provider_id,
          time_block: ta.time_block,
          room_count: ta.room_count,
          is_pto: ta.is_pto,
          notes: ta.notes,
        });
      }
    }

    if (assignmentsToCreate.length === 0) {
      return NextResponse.json({
        success: true,
        created: 0,
        skipped: skipped.length,
        holidayConflicts,
        message: 'No assignments to create',
      });
    }

    // If not clearing existing and skipConflicts, check for existing assignments
    let finalAssignments = assignmentsToCreate;

    if (!clearExisting && skipConflicts) {
      // Get existing assignments in range
      const { data: existingAssignments } = await supabase
        .from('schedule_assignments')
        .select('date, service_id, time_block')
        .gte('date', startDate)
        .lte('date', endDate);

      const existingSet = new Set(
        (existingAssignments || []).map(
          (a) => `${a.date}|${a.service_id}|${a.time_block}`
        )
      );

      finalAssignments = assignmentsToCreate.filter((a) => {
        const key = `${a.date}|${a.service_id}|${a.time_block}`;
        if (existingSet.has(key)) {
          skipped.push(key);
          return false;
        }
        return true;
      });
    }

    if (finalAssignments.length === 0) {
      return NextResponse.json({
        success: true,
        created: 0,
        skipped: skipped.length,
        holidayConflicts,
        message: 'All assignments already exist',
      });
    }

    // Insert assignments
    const { data, error: insertError } = await supabase
      .from('schedule_assignments')
      .insert(finalAssignments)
      .select(`
        *,
        service:services(*),
        provider:providers(*)
      `);

    if (insertError) throw insertError;

    return NextResponse.json({
      success: true,
      created: data?.length || 0,
      skipped: skipped.length,
      holidayConflicts,
      data,
    });
  } catch (error) {
    console.error('Error applying template:', error);
    return NextResponse.json(
      { error: 'Failed to apply template' },
      { status: 500 }
    );
  }
}
