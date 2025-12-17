import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isHoliday, isInpatientService } from '@/lib/holidays';

// Helper to get week start (Sunday) for a date
function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = date.getDay();
  date.setDate(date.getDate() - dayOfWeek);
  return date.toISOString().split('T')[0];
}

// Helper to get all weeks between start and end dates
function getWeeks(startDate: string, endDate: string): { start: string; end: string }[] {
  const weeks: { start: string; end: string }[] = [];
  const current = new Date(getWeekStart(startDate) + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  while (current <= end) {
    const weekStart = current.toISOString().split('T')[0];
    current.setDate(current.getDate() + 6);
    const weekEnd = current.toISOString().split('T')[0];

    weeks.push({ start: weekStart, end: weekEnd });

    current.setDate(current.getDate() + 1);
  }

  return weeks;
}

// POST - Apply alternating templates to date range
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { templates, pattern, startDate, endDate, options } = body;

    if (!templates || !Array.isArray(templates) || templates.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 templates are required for alternating' },
        { status: 400 }
      );
    }

    if (!pattern || !Array.isArray(pattern) || pattern.length === 0) {
      return NextResponse.json(
        { error: 'Pattern array is required (e.g., [0, 1] for A-B-A-B)' },
        { status: 400 }
      );
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    const clearExisting = options?.clearExisting ?? false;
    const skipConflicts = options?.skipConflicts ?? true;

    // Validate pattern indices
    for (const idx of pattern) {
      if (idx < 0 || idx >= templates.length) {
        return NextResponse.json(
          { error: `Pattern index ${idx} is out of range (0-${templates.length - 1})` },
          { status: 400 }
        );
      }
    }

    // Fetch all template assignments
    const templateAssignmentsMap = new Map<string, any[]>();

    for (const templateId of templates) {
      const { data, error } = await supabase
        .from('template_assignments')
        .select(`
          *,
          service:services(name)
        `)
        .eq('template_id', templateId);

      if (error) throw error;
      templateAssignmentsMap.set(templateId, data || []);
    }

    // Get all weeks in range
    const weeks = getWeeks(startDate, endDate);

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
    const weekApplications: { week: string; template: string }[] = [];

    weeks.forEach((week, weekIndex) => {
      // Determine which template to use for this week
      const patternIndex = weekIndex % pattern.length;
      const templateIndex = pattern[patternIndex];
      const templateId = templates[templateIndex];
      const templateAssignments = templateAssignmentsMap.get(templateId) || [];

      weekApplications.push({
        week: week.start,
        template: templateId,
      });

      // Group template assignments by day_of_week
      const assignmentsByDay = new Map<number, any[]>();
      templateAssignments.forEach((ta) => {
        const existing = assignmentsByDay.get(ta.day_of_week) || [];
        existing.push(ta);
        assignmentsByDay.set(ta.day_of_week, existing);
      });

      // Generate dates for this week
      const weekStart = new Date(week.start + 'T00:00:00');
      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];

        // Skip dates outside the requested range
        if (dateStr < startDate || dateStr > endDate) continue;

        const dayOfWeek = date.getDay();
        const dayAssignments = assignmentsByDay.get(dayOfWeek) || [];

        for (const ta of dayAssignments) {
          // Check holiday restrictions
          const holiday = isHoliday(dateStr);
          if (holiday && !isInpatientService(ta.service?.name || '')) {
            holidayConflicts.push(`${dateStr}: ${holiday.name} (${ta.service?.name || 'Unknown'})`);
            continue;
          }

          assignmentsToCreate.push({
            date: dateStr,
            service_id: ta.service_id,
            provider_id: ta.provider_id,
            time_block: ta.time_block,
            room_count: ta.room_count,
            is_pto: ta.is_pto,
            notes: ta.notes,
          });
        }
      }
    });

    if (assignmentsToCreate.length === 0) {
      return NextResponse.json({
        success: true,
        created: 0,
        skipped: skipped.length,
        holidayConflicts,
        weekApplications,
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
        weekApplications,
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
      weekApplications,
      data,
    });
  } catch (error) {
    console.error('Error applying alternating templates:', error);
    return NextResponse.json(
      { error: 'Failed to apply alternating templates' },
      { status: 500 }
    );
  }
}
