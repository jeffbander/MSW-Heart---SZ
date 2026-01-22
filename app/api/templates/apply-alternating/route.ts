import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isHoliday, isInpatientService } from '@/lib/holidays';

// Helper to format date in local timezone (avoids UTC conversion issues)
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to get week start (Sunday) for a date
function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = date.getDay();
  date.setDate(date.getDate() - dayOfWeek);
  return formatLocalDate(date);
}

// Helper to get all weeks between start and end dates
function getWeeks(startDate: string, endDate: string): { start: string; end: string }[] {
  const weeks: { start: string; end: string }[] = [];
  const current = new Date(getWeekStart(startDate) + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  while (current <= end) {
    const weekStart = formatLocalDate(current);
    current.setDate(current.getDate() + 6);
    const weekEnd = formatLocalDate(current);

    weeks.push({ start: weekStart, end: weekEnd });

    current.setDate(current.getDate() + 1);
  }

  return weeks;
}

interface PTOConflict {
  provider_id: string;
  provider_name?: string;
  date: string;
  time_block: string;
  intended_service_id: string;
  intended_service_name?: string;
  reason: string;
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

    // Fetch all template assignments and template names
    const templateAssignmentsMap = new Map<string, any[]>();
    const templateNames: string[] = [];

    for (const templateId of templates) {
      // Fetch template name
      const { data: templateData } = await supabase
        .from('schedule_templates')
        .select('name')
        .eq('id', templateId)
        .single();

      templateNames.push(templateData?.name || 'Unknown');

      const { data, error } = await supabase
        .from('template_assignments')
        .select(`
          *,
          service:services(id, name),
          provider:providers(id, name, initials)
        `)
        .eq('template_id', templateId);

      if (error) throw error;
      templateAssignmentsMap.set(templateId, data || []);
    }

    // Fetch existing PTO assignments in the date range
    const { data: ptoAssignments, error: ptoError } = await supabase
      .from('schedule_assignments')
      .select('provider_id, date, time_block')
      .gte('date', startDate)
      .lte('date', endDate)
      .eq('is_pto', true);

    if (ptoError) {
      console.error('Error fetching PTO assignments:', ptoError);
    }

    // Build PTO lookup map
    const ptoMap = new Set<string>();
    (ptoAssignments || []).forEach(p => {
      if (p.time_block === 'BOTH') {
        ptoMap.add(`${p.provider_id}-${p.date}-AM`);
        ptoMap.add(`${p.provider_id}-${p.date}-PM`);
        ptoMap.add(`${p.provider_id}-${p.date}-BOTH`);
      } else {
        ptoMap.add(`${p.provider_id}-${p.date}-${p.time_block}`);
      }
    });

    // Get all weeks in range
    const weeks = getWeeks(startDate, endDate);

    // Store deleted assignments for undo capability
    let deletedAssignments: any[] = [];

    // If clearExisting, capture and delete all assignments in the date range first
    if (clearExisting) {
      const { data: existingToDelete } = await supabase
        .from('schedule_assignments')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      deletedAssignments = existingToDelete || [];

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
    const ptoConflicts: PTOConflict[] = [];
    const weekApplications: { week: string; template: string; templateName: string }[] = [];

    weeks.forEach((week, weekIndex) => {
      // Determine which template to use for this week
      const patternIndex = weekIndex % pattern.length;
      const templateIndex = pattern[patternIndex];
      const templateId = templates[templateIndex];
      const templateAssignments = templateAssignmentsMap.get(templateId) || [];

      weekApplications.push({
        week: week.start,
        template: templateId,
        templateName: templateNames[templateIndex],
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
        const dateStr = formatLocalDate(date);

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

          // Check for PTO conflicts - skip if provider has PTO
          const ptoKey = `${ta.provider_id}-${dateStr}-${ta.time_block}`;
          if (ptoMap.has(ptoKey)) {
            ptoConflicts.push({
              provider_id: ta.provider_id,
              provider_name: ta.provider?.name || ta.provider?.initials,
              date: dateStr,
              time_block: ta.time_block,
              intended_service_id: ta.service_id,
              intended_service_name: ta.service?.name,
              reason: 'Provider has PTO'
            });
            continue; // Skip this assignment
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
        ptoConflicts,
        coverageNeeded: ptoConflicts.length,
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
        ptoConflicts,
        coverageNeeded: ptoConflicts.length,
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

    // Record this operation in change history for undo capability
    const createdIds = (data || []).map(a => a.id);
    const templateNamesStr = templateNames.join(' / ');

    const { data: historyRecord, error: historyError } = await supabase
      .from('schedule_change_history')
      .insert({
        operation_type: 'template_apply_alternating',
        operation_description: `Applied alternating "${templateNamesStr}" to ${startDate} - ${endDate}`,
        affected_date_start: startDate,
        affected_date_end: endDate,
        deleted_assignments: deletedAssignments.length > 0 ? deletedAssignments : null,
        created_assignment_ids: createdIds,
        redo_assignments: finalAssignments,
        metadata: {
          template_ids: templates,
          template_names: templateNames,
          pattern: pattern,
          clear_existing: clearExisting,
          skip_conflicts: skipConflicts,
          pto_conflicts_count: ptoConflicts.length,
          holiday_conflicts_count: holidayConflicts.length,
          week_applications: weekApplications
        }
      })
      .select()
      .single();

    if (historyError) {
      console.error('Error recording change history:', historyError);
    }

    return NextResponse.json({
      success: true,
      created: data?.length || 0,
      skipped: skipped.length,
      holidayConflicts,
      ptoConflicts,
      coverageNeeded: ptoConflicts.length,
      weekApplications,
      historyId: historyRecord?.id,
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
