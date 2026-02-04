import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Helper to format date in local timezone
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface BulkProviderRequest {
  providerId: string;
  action: 'add' | 'remove';
  pattern: {
    type: 'all' | 'recurring';
    dayOfWeek?: number;      // 0-6 (Sunday-Saturday)
    timeBlock?: 'AM' | 'PM';
    serviceId?: string;      // Optional filter for specific service
  };
  startDate: string;
  endDate: string;
  preview?: boolean;         // If true, just return count without making changes
  roomCount?: number;        // For add operations - default room count
}

interface AffectedAssignment {
  id?: string;
  date: string;
  time_block: string;
  service_id?: string;
  service_name?: string;
  provider_id: string;
  provider_name?: string;
}

// POST - Bulk add/remove provider assignments
export async function POST(request: Request) {
  try {
    const body: BulkProviderRequest = await request.json();
    const { providerId, action, pattern, startDate, endDate, preview = false, roomCount = 0 } = body;

    // Validation
    if (!providerId) {
      return NextResponse.json(
        { error: 'providerId is required' },
        { status: 400 }
      );
    }

    if (!action || !['add', 'remove'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "add" or "remove"' },
        { status: 400 }
      );
    }

    if (!pattern?.type || !['all', 'recurring'].includes(pattern.type)) {
      return NextResponse.json(
        { error: 'pattern.type must be "all" or "recurring"' },
        { status: 400 }
      );
    }

    if (pattern.type === 'recurring' && pattern.dayOfWeek === undefined) {
      return NextResponse.json(
        { error: 'pattern.dayOfWeek is required for recurring pattern' },
        { status: 400 }
      );
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    // For add action, serviceId is required
    if (action === 'add' && !pattern.serviceId) {
      return NextResponse.json(
        { error: 'pattern.serviceId is required for add action' },
        { status: 400 }
      );
    }

    // Fetch provider info
    const { data: provider, error: providerError } = await supabase
      .from('providers')
      .select('id, name, initials')
      .eq('id', providerId)
      .single();

    if (providerError || !provider) {
      return NextResponse.json(
        { error: 'Provider not found' },
        { status: 404 }
      );
    }

    // Fetch service info if provided
    let serviceName: string | undefined;
    if (pattern.serviceId) {
      const { data: service } = await supabase
        .from('services')
        .select('name')
        .eq('id', pattern.serviceId)
        .single();
      serviceName = service?.name;
    }

    if (action === 'remove') {
      // Build query for assignments to remove
      let query = supabase
        .from('schedule_assignments')
        .select(`
          id,
          date,
          time_block,
          service_id,
          provider_id,
          service:services(name),
          provider:providers(name, initials)
        `)
        .eq('provider_id', providerId)
        .gte('date', startDate)
        .lte('date', endDate);

      // Add service filter if provided
      if (pattern.serviceId) {
        query = query.eq('service_id', pattern.serviceId);
      }

      // Add time block filter if provided
      if (pattern.timeBlock) {
        query = query.eq('time_block', pattern.timeBlock);
      }

      const { data: assignments, error: queryError } = await query;

      if (queryError) throw queryError;

      // Filter by day of week if recurring pattern
      let filteredAssignments = assignments || [];
      if (pattern.type === 'recurring' && pattern.dayOfWeek !== undefined) {
        filteredAssignments = filteredAssignments.filter(a => {
          const date = new Date(a.date + 'T00:00:00');
          return date.getDay() === pattern.dayOfWeek;
        });
      }

      const affectedCount = filteredAssignments.length;
      const affectedAssignments: AffectedAssignment[] = filteredAssignments.map((a: any) => ({
        id: a.id,
        date: a.date,
        time_block: a.time_block,
        service_id: a.service_id,
        service_name: a.service?.name,
        provider_id: a.provider_id,
        provider_name: provider.name || provider.initials
      }));

      // Preview mode - just return the count and list
      if (preview) {
        return NextResponse.json({
          preview: true,
          affectedCount,
          assignments: affectedAssignments,
          action,
          pattern,
          provider: { id: provider.id, name: provider.name, initials: provider.initials }
        });
      }

      // Actually remove the assignments
      if (affectedCount > 0) {
        const idsToDelete = filteredAssignments.map(a => a.id);

        const { error: deleteError } = await supabase
          .from('schedule_assignments')
          .delete()
          .in('id', idsToDelete);

        if (deleteError) throw deleteError;

        // Record in change history
        const patternDesc = pattern.type === 'all'
          ? 'all assignments'
          : `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][pattern.dayOfWeek!]} ${pattern.timeBlock || 'all'}`;

        const { data: historyRecord, error: historyError } = await supabase
          .from('schedule_change_history')
          .insert({
            operation_type: 'bulk_remove',
            operation_description: `Removed ${provider.name || provider.initials} from ${patternDesc}${serviceName ? ` (${serviceName})` : ''} ${startDate} - ${endDate}`,
            affected_date_start: startDate,
            affected_date_end: endDate,
            deleted_assignments: filteredAssignments,
            created_assignment_ids: [],
            redo_assignments: null,
            metadata: {
              provider_id: providerId,
              provider_name: provider.name,
              action,
              pattern,
              service_name: serviceName
            }
          })
          .select()
          .single();

        if (historyError) {
          console.error('Error recording change history:', historyError);
        }

        return NextResponse.json({
          success: true,
          removed: affectedCount,
          historyId: historyRecord?.id,
          message: `Removed ${affectedCount} assignments for ${provider.name || provider.initials}`
        });
      }

      return NextResponse.json({
        success: true,
        removed: 0,
        message: 'No matching assignments found to remove'
      });

    } else {
      // ADD action
      // Generate dates in range that match the pattern
      const datesToAdd: string[] = [];
      const current = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T00:00:00');

      while (current <= end) {
        const dayOfWeek = current.getDay();

        if (pattern.type === 'all' || dayOfWeek === pattern.dayOfWeek) {
          datesToAdd.push(formatLocalDate(current));
        }

        current.setDate(current.getDate() + 1);
      }

      // Check for existing assignments to avoid duplicates
      const timeBlocks = pattern.timeBlock ? [pattern.timeBlock] : ['AM', 'PM'];
      const assignmentsToCreate: any[] = [];
      const skipped: string[] = [];

      for (const date of datesToAdd) {
        for (const timeBlock of timeBlocks) {
          // Check if assignment already exists
          const { data: existing } = await supabase
            .from('schedule_assignments')
            .select('id')
            .eq('date', date)
            .eq('service_id', pattern.serviceId)
            .eq('time_block', timeBlock)
            .single();

          if (existing) {
            skipped.push(`${date} ${timeBlock}`);
            continue;
          }

          assignmentsToCreate.push({
            date,
            service_id: pattern.serviceId,
            provider_id: providerId,
            time_block: timeBlock,
            room_count: roomCount,
            is_pto: false
          });
        }
      }

      const affectedCount = assignmentsToCreate.length;
      const affectedAssignments: AffectedAssignment[] = assignmentsToCreate.map(a => ({
        date: a.date,
        time_block: a.time_block,
        service_id: a.service_id,
        service_name: serviceName,
        provider_id: a.provider_id,
        provider_name: provider.name || provider.initials
      }));

      // Preview mode
      if (preview) {
        return NextResponse.json({
          preview: true,
          affectedCount,
          skippedCount: skipped.length,
          assignments: affectedAssignments,
          action,
          pattern,
          provider: { id: provider.id, name: provider.name, initials: provider.initials }
        });
      }

      // Actually create the assignments
      if (assignmentsToCreate.length > 0) {
        const { data: created, error: insertError } = await supabase
          .from('schedule_assignments')
          .insert(assignmentsToCreate)
          .select();

        if (insertError) throw insertError;

        // Record in change history
        const patternDesc = pattern.type === 'all'
          ? 'all dates'
          : `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][pattern.dayOfWeek!]} ${pattern.timeBlock || 'all'}`;

        const createdIds = (created || []).map(a => a.id);

        const { data: historyRecord, error: historyError } = await supabase
          .from('schedule_change_history')
          .insert({
            operation_type: 'bulk_add',
            operation_description: `Added ${provider.name || provider.initials} to ${serviceName} ${patternDesc} ${startDate} - ${endDate}`,
            affected_date_start: startDate,
            affected_date_end: endDate,
            deleted_assignments: null,
            created_assignment_ids: createdIds,
            redo_assignments: assignmentsToCreate,
            metadata: {
              provider_id: providerId,
              provider_name: provider.name,
              action,
              pattern,
              service_id: pattern.serviceId,
              service_name: serviceName,
              room_count: roomCount
            }
          })
          .select()
          .single();

        if (historyError) {
          console.error('Error recording change history:', historyError);
        }

        return NextResponse.json({
          success: true,
          added: created?.length || 0,
          skipped: skipped.length,
          historyId: historyRecord?.id,
          message: `Added ${created?.length || 0} assignments for ${provider.name || provider.initials}`
        });
      }

      return NextResponse.json({
        success: true,
        added: 0,
        skipped: skipped.length,
        message: 'No new assignments created (all slots already filled)'
      });
    }
  } catch (error) {
    console.error('Error performing bulk provider operation:', error);
    return NextResponse.json(
      { error: 'Failed to perform bulk operation' },
      { status: 500 }
    );
  }
}
