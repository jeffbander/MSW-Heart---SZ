import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isHoliday, isInpatientService } from '@/lib/holidays';
import { checkBulkAvailability } from '@/lib/availability';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { assignments } = body;

    if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
      return NextResponse.json(
        { error: 'Assignments array is required' },
        { status: 400 }
      );
    }

    // Check for holiday conflicts (allow inpatient services only)
    const holidayConflicts: string[] = [];
    for (const assignment of assignments) {
      const holiday = isHoliday(assignment.date);
      if (holiday) {
        // Get service to check if it's inpatient
        const { data: service } = await supabase
          .from('services')
          .select('name')
          .eq('id', assignment.service_id)
          .single();

        if (!service || !isInpatientService(service.name)) {
          holidayConflicts.push(`${assignment.date}: ${holiday.name} (${service?.name || 'Unknown service'})`);
        }
      }
    }

    if (holidayConflicts.length > 0) {
      return NextResponse.json(
        { error: 'Cannot schedule non-inpatient services on holidays', conflicts: holidayConflicts },
        { status: 400 }
      );
    }

    // Get unique provider+date combinations to check for conflicts
    const providerDatePairs = new Set<string>();
    assignments.forEach((a: any) => {
      providerDatePairs.add(`${a.provider_id}|${a.date}`);
    });

    // Fetch existing assignments for all relevant provider+date combos
    const existingAssignmentsMap = new Map<string, any[]>();

    for (const pair of providerDatePairs) {
      const [providerId, date] = pair.split('|');
      const { data: existing } = await supabase
        .from('schedule_assignments')
        .select('*, service:services(name)')
        .eq('provider_id', providerId)
        .eq('date', date);

      existingAssignmentsMap.set(pair, existing || []);
    }

    // Validate each assignment for PTO conflicts
    const conflicts: string[] = [];

    for (const assignment of assignments) {
      const key = `${assignment.provider_id}|${assignment.date}`;
      const existingForProviderDate = existingAssignmentsMap.get(key) || [];

      // Determine time blocks to check
      const timeBlocksToCheck = assignment.time_block === 'BOTH'
        ? ['AM', 'PM', 'BOTH']
        : [assignment.time_block, 'BOTH'];

      const relevantExisting = existingForProviderDate.filter(
        (e: any) => timeBlocksToCheck.includes(e.time_block)
      );

      const hasPTO = relevantExisting.some(
        (a: any) => a.is_pto || a.service?.name === 'PTO'
      );
      const isNewPTO = assignment.is_pto;

      if (hasPTO && !isNewPTO) {
        conflicts.push(`Provider has PTO on ${assignment.date} (${assignment.time_block}) and cannot be assigned work`);
      }

      // Allow PTO even with work overlap — frontend will highlight the conflict
    }

    if (conflicts.length > 0) {
      return NextResponse.json(
        { error: 'PTO conflicts detected', conflicts },
        { status: 400 }
      );
    }

    // Check availability rules (skip if force_override is set)
    if (!body.force_override) {
      const availabilityResult = await checkBulkAvailability(assignments);

      if (availabilityResult.hardBlocks.length > 0) {
        return NextResponse.json(
          {
            error: 'Provider availability conflicts detected',
            type: 'availability_hard_block',
            hardBlocks: availabilityResult.hardBlocks,
            warnings: availabilityResult.warnings
          },
          { status: 400 }
        );
      }

      // If only warnings exist, include them in response but proceed
      if (availabilityResult.warnings.length > 0 && !body.acknowledged_warnings) {
        return NextResponse.json(
          {
            error: 'Provider availability warnings',
            type: 'availability_warning',
            warnings: availabilityResult.warnings,
            requiresConfirmation: true
          },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabase
      .from('schedule_assignments')
      .insert(assignments)
      .select(`
        *,
        service:services(*),
        provider:providers(*)
      `);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      created: data?.length || 0,
      data
    });
  } catch (error) {
    console.error('Error bulk creating assignments:', error);
    return NextResponse.json(
      { error: 'Failed to create assignments' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Assignment IDs array is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('schedule_assignments')
      .delete()
      .in('id', ids);

    if (error) throw error;

    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (error) {
    console.error('Error bulk deleting assignments:', error);
    return NextResponse.json(
      { error: 'Failed to delete assignments' },
      { status: 500 }
    );
  }
}
