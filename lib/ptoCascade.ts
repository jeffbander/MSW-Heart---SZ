import { supabase } from '@/lib/supabase';

export interface CascadeResult {
  pto_requests_updated: number;
  provider_leaves_updated: number;
}

/**
 * Cascade-deletes PTO-related records (pto_requests and provider_leaves)
 * for a given provider and date. Handles single-day and multi-day ranges:
 *  - Single-day → delete the record
 *  - Date is the start → shift start_date forward to next weekday
 *  - Date is the end → shift end_date back to previous weekday
 *  - Date in the middle → no-op (would require splitting, not supported)
 */
export async function cascadePTODeletion(
  providerId: string,
  date: string
): Promise<CascadeResult> {
  const results: CascadeResult = {
    pto_requests_updated: 0,
    provider_leaves_updated: 0,
  };

  // 1. Handle matching pto_requests
  const { data: matchingRequests, error: requestFetchError } = await supabase
    .from('pto_requests')
    .select('*')
    .eq('provider_id', providerId)
    .lte('start_date', date)
    .gte('end_date', date);

  if (requestFetchError) {
    console.error('Error fetching pto_requests:', requestFetchError);
  } else if (matchingRequests && matchingRequests.length > 0) {
    for (const req of matchingRequests) {
      const isSingleDay = req.start_date === req.end_date;
      const isStartDate = req.start_date === date;
      const isEndDate = req.end_date === date;

      if (isSingleDay) {
        await supabase.from('pto_requests').delete().eq('id', req.id);
        results.pto_requests_updated++;
      } else if (isStartDate) {
        const nextDate = getNextWeekday(date);
        await supabase
          .from('pto_requests')
          .update({ start_date: nextDate, updated_at: new Date().toISOString() })
          .eq('id', req.id);
        results.pto_requests_updated++;
      } else if (isEndDate) {
        const prevDate = getPreviousWeekday(date);
        await supabase
          .from('pto_requests')
          .update({ end_date: prevDate, updated_at: new Date().toISOString() })
          .eq('id', req.id);
        results.pto_requests_updated++;
      }
      // Middle dates: no-op (would require splitting)
    }
  }

  // 2. Handle matching provider_leaves
  const { data: matchingLeaves, error: leaveFetchError } = await supabase
    .from('provider_leaves')
    .select('*')
    .eq('provider_id', providerId)
    .lte('start_date', date)
    .gte('end_date', date);

  if (leaveFetchError) {
    console.error('Error fetching provider_leaves:', leaveFetchError);
  } else if (matchingLeaves && matchingLeaves.length > 0) {
    for (const leave of matchingLeaves) {
      const isSingleDay = leave.start_date === leave.end_date;
      const isStartDate = leave.start_date === date;
      const isEndDate = leave.end_date === date;

      if (isSingleDay) {
        await supabase.from('provider_leaves').delete().eq('id', leave.id);
        results.provider_leaves_updated++;
      } else if (isStartDate) {
        const nextDate = getNextWeekday(date);
        await supabase
          .from('provider_leaves')
          .update({ start_date: nextDate })
          .eq('id', leave.id);
        results.provider_leaves_updated++;
      } else if (isEndDate) {
        const prevDate = getPreviousWeekday(date);
        await supabase
          .from('provider_leaves')
          .update({ end_date: prevDate })
          .eq('id', leave.id);
        results.provider_leaves_updated++;
      }
    }
  }

  return results;
}

/** Get next weekday after a date (skips weekends) */
export function getNextWeekday(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + 1);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  return formatLocalDate(date);
}

/** Get previous weekday before a date (skips weekends) */
export function getPreviousWeekday(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() - 1);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() - 1);
  }
  return formatLocalDate(date);
}

/** Format date as YYYY-MM-DD */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
