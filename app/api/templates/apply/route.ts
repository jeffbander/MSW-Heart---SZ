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

// Helper to get all dates between start and end (inclusive)
function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  while (current <= end) {
    dates.push(formatLocalDate(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
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

    // Fetch template with its name
    const { data: templateData, error: templateFetchError } = await supabase
      .from('schedule_templates')
      .select('name')
      .eq('id', templateId)
      .single();

    if (templateFetchError) {
      console.error('Error fetching template:', templateFetchError);
    }

    const templateName = templateData?.name || 'Unknown Template';

    // Fetch template assignments
    const { data: templateAssignments, error: templateError } = await supabase
      .from('template_assignments')
      .select(`
        *,
        service:services(id, name),
        provider:providers(id, name, initials)
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

    // Build PTO lookup map: "providerId-date-timeBlock" -> true
    // Also handle BOTH time block - if someone has PTO for BOTH, they're unavailable for AM and PM
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

    // Group template assignments by day_of_week
    const assignmentsByDay = new Map<number, typeof templateAssignments>();
    templateAssignments.forEach((ta) => {
      const existing = assignmentsByDay.get(ta.day_of_week) || [];
      existing.push(ta);
      assignmentsByDay.set(ta.day_of_week, existing);
    });

    // Store deleted assignments for undo capability
    let deletedAssignments: any[] = [];

    // If clearExisting, capture and delete all assignments in the date range first
    if (clearExisting) {
      // First fetch existing assignments for undo
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

        // Check for PTO conflicts - skip if provider has PTO
        const ptoKey = `${ta.provider_id}-${date}-${ta.time_block}`;
        if (ptoMap.has(ptoKey)) {
          ptoConflicts.push({
            provider_id: ta.provider_id,
            provider_name: ta.provider?.name || ta.provider?.initials,
            date: date,
            time_block: ta.time_block,
            intended_service_id: ta.service_id,
            intended_service_name: ta.service?.name,
            reason: 'Provider has PTO'
          });
          continue; // Skip this assignment
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
        ptoConflicts,
        coverageNeeded: ptoConflicts.length,
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

    const { data: historyRecord, error: historyError } = await supabase
      .from('schedule_change_history')
      .insert({
        operation_type: 'template_apply',
        operation_description: `Applied "${templateName}" to ${startDate} - ${endDate}`,
        affected_date_start: startDate,
        affected_date_end: endDate,
        deleted_assignments: deletedAssignments.length > 0 ? deletedAssignments : null,
        created_assignment_ids: createdIds,
        redo_assignments: finalAssignments,
        metadata: {
          template_id: templateId,
          template_name: templateName,
          clear_existing: clearExisting,
          skip_conflicts: skipConflicts,
          pto_conflicts_count: ptoConflicts.length,
          holiday_conflicts_count: holidayConflicts.length
        }
      })
      .select()
      .single();

    if (historyError) {
      console.error('Error recording change history:', historyError);
      // Don't fail the whole operation if history recording fails
    }

    return NextResponse.json({
      success: true,
      created: data?.length || 0,
      skipped: skipped.length,
      holidayConflicts,
      ptoConflicts,
      coverageNeeded: ptoConflicts.length,
      historyId: historyRecord?.id,
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
