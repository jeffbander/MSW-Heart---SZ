import { supabase } from '@/lib/supabase';

// Helper to format date as YYYY-MM-DD
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get weekdays in a date range (skips Sat/Sun).
 * If work_days is provided, only returns days matching those day-of-week numbers.
 */
export function getWeekdaysInRange(
  startDate: string,
  endDate: string,
  work_days?: number[]
): string[] {
  const weekdays: string[] = [];
  const current = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  while (current <= end) {
    const dayOfWeek = current.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
    const isWorkDay = work_days
      ? work_days.includes(dayOfWeek)
      : (dayOfWeek !== 0 && dayOfWeek !== 6);

    if (isWorkDay) {
      weekdays.push(formatLocalDate(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return weekdays;
}

/**
 * Fetch a provider's work_days array from the database.
 * Returns the default [1,2,3,4,5] if not set.
 */
export async function getProviderWorkDays(provider_id: string): Promise<number[]> {
  const { data, error } = await supabase
    .from('providers')
    .select('work_days')
    .eq('id', provider_id)
    .single();

  if (error || !data?.work_days) {
    return [1, 2, 3, 4, 5]; // Default Mon-Fri
  }
  return data.work_days;
}

/**
 * Get the dates a provider actually works within a date range,
 * based on their work_days setting.
 */
export async function getProviderWorkdays(
  provider_id: string,
  start_date: string,
  end_date: string
): Promise<string[]> {
  const work_days = await getProviderWorkDays(provider_id);
  return getWeekdaysInRange(start_date, end_date, work_days);
}

/**
 * Create schedule_assignments with is_pto=true for each work day in the range.
 * Deduplicates against existing PTO assignments.
 */
export async function createPTOScheduleAssignments({
  provider_id,
  start_date,
  end_date,
  time_block = 'FULL',
}: {
  provider_id: string;
  start_date: string;
  end_date: string;
  time_block?: string;
}): Promise<{ created: number; error?: string }> {
  // Get provider's work days
  const workdays = await getProviderWorkdays(provider_id, start_date, end_date);

  if (workdays.length === 0) {
    return { created: 0 };
  }

  // Get the PTO service ID
  const { data: ptoService, error: serviceError } = await supabase
    .from('services')
    .select('id')
    .eq('name', 'PTO')
    .single();

  if (serviceError || !ptoService) {
    console.error('Error finding PTO service:', serviceError);
    return { created: 0, error: 'PTO service not found' };
  }

  // Determine time blocks to create
  const timeBlocks = time_block === 'FULL' ? ['BOTH'] : [time_block];

  // Check for existing PTO assignments to avoid duplicates
  const { data: existingAssignments } = await supabase
    .from('schedule_assignments')
    .select('date, time_block')
    .eq('provider_id', provider_id)
    .eq('service_id', ptoService.id)
    .eq('is_pto', true)
    .in('date', workdays);

  const existingSet = new Set(
    (existingAssignments || []).map((a: any) => `${a.date}-${a.time_block}`)
  );

  const assignmentsToCreate = [];
  for (const date of workdays) {
    for (const tb of timeBlocks) {
      const key = `${date}-${tb}`;
      if (!existingSet.has(key)) {
        assignmentsToCreate.push({
          provider_id,
          service_id: ptoService.id,
          date,
          time_block: tb,
          room_count: 0,
          is_pto: true,
          is_covering: false,
          notes: null,
        });
      }
    }
  }

  if (assignmentsToCreate.length === 0) {
    return { created: 0 };
  }

  const { data: createdAssignments, error: assignmentError } = await supabase
    .from('schedule_assignments')
    .insert(assignmentsToCreate)
    .select();

  if (assignmentError) {
    console.error('Error creating schedule_assignments:', assignmentError);
    return { created: 0, error: assignmentError.message };
  }

  return { created: createdAssignments?.length || 0 };
}

/**
 * Create an auto-approved pto_requests entry and a provider_leaves entry.
 * Used when PTO is entered through a flow that doesn't already create these records.
 */
export async function createPTORequestAndLeave({
  provider_id,
  start_date,
  end_date,
  time_block = 'FULL',
  leave_type = 'vacation',
  reason,
}: {
  provider_id: string;
  start_date: string;
  end_date: string;
  time_block?: string;
  leave_type?: string;
  reason?: string;
}): Promise<{
  pto_request_created: boolean;
  provider_leave_created: boolean;
  error?: string;
}> {
  const result = {
    pto_request_created: false,
    provider_leave_created: false,
  };

  // Create auto-approved pto_request
  const { error: requestError } = await supabase
    .from('pto_requests')
    .insert({
      provider_id,
      start_date,
      end_date,
      leave_type,
      time_block: time_block === 'BOTH' ? 'FULL' : time_block,
      reason: reason || null,
      status: 'approved',
      requested_by: 'admin',
      reviewed_at: new Date().toISOString(),
      reviewed_by_admin_name: 'Auto-approved (system sync)',
    });

  if (requestError) {
    console.error('Error creating pto_request:', requestError);
  } else {
    result.pto_request_created = true;
  }

  // Create provider_leave
  const { error: leaveError } = await supabase
    .from('provider_leaves')
    .insert({
      provider_id,
      start_date,
      end_date,
      leave_type,
      reason: reason || null,
    });

  if (leaveError) {
    console.error('Error creating provider_leave:', leaveError);
  } else {
    result.provider_leave_created = true;
  }

  return result;
}
