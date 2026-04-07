import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isHoliday } from '@/lib/holidays';

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface PTORow {
  id: string;
  provider_id: string;
  start_date: string;
  end_date: string;
  time_block: 'AM' | 'PM' | 'FULL';
  leave_type: string;
  status: string;
  provider: {
    id: string;
    name: string;
    initials: string;
    work_days: number[];
  } | {
    id: string;
    name: string;
    initials: string;
    work_days: number[];
  }[];
}

interface DayEntry {
  date: string;
  value: number; // 1 or 0.5
  completed: boolean; // past date = completed, future = planned
  leaveType: string;
}

function getWorkDaysPerMonth(
  startDate: string,
  endDate: string,
  timeBlock: 'AM' | 'PM' | 'FULL',
  workDays: number[],
  leaveType: string,
  today: string
): DayEntry[] {
  const entries: DayEntry[] = [];
  const current = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const dateStr = formatLocalDate(current);

    const isWorkDay = workDays.length > 0
      ? workDays.includes(dayOfWeek)
      : (dayOfWeek !== 0 && dayOfWeek !== 6);

    if (isWorkDay && !isHoliday(dateStr)) {
      entries.push({
        date: dateStr,
        value: timeBlock === 'FULL' ? 1 : 0.5,
        completed: dateStr <= today,
        leaveType,
      });
    }
    current.setDate(current.getDate() + 1);
  }
  return entries;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const providerId = searchParams.get('providerId'); // optional filter

    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    const today = formatLocalDate(new Date());

    // Fetch approved PTO requests for the year
    let query = supabase
      .from('pto_requests')
      .select('id, provider_id, start_date, end_date, time_block, leave_type, status, provider:providers!inner(id, name, initials, work_days)')
      .eq('status', 'approved')
      .lte('start_date', yearEnd)
      .gte('end_date', yearStart);

    if (providerId) {
      query = query.eq('provider_id', providerId);
    }

    const { data: requests, error } = await query;
    if (error) throw new Error(error.message);

    // Also fetch providers with no PTO for complete list
    let provQuery = supabase.from('providers').select('id, name, initials, work_days').order('name');
    if (providerId) {
      provQuery = provQuery.eq('id', providerId);
    }
    const { data: allProviders } = await provQuery;

    interface DayDetail {
      date: string;
      value: number;
      completed: boolean;
      leaveType: string;
      timeBlock: string;
    }

    // Build per-provider monthly breakdown
    const providerMap: Record<string, {
      id: string;
      name: string;
      initials: string;
      months: Record<string, { completed: number; planned: number; days: DayDetail[] }>;
    }> = {};

    const initMonths = () => {
      const months: Record<string, { completed: number; planned: number; days: DayDetail[] }> = {};
      for (let m = 1; m <= 12; m++) {
        const key = String(m).padStart(2, '0');
        months[key] = { completed: 0, planned: 0, days: [] };
      }
      return months;
    };

    // Initialize all providers
    for (const p of allProviders || []) {
      providerMap[p.id] = {
        id: p.id,
        name: p.name,
        initials: p.initials,
        months: initMonths(),
      };
    }

    // Process each PTO request
    for (const req of (requests || []) as PTORow[]) {
      const provider = Array.isArray(req.provider) ? req.provider[0] : req.provider;
      if (!provider) continue;

      if (!providerMap[provider.id]) {
        providerMap[provider.id] = {
          id: provider.id,
          name: provider.name,
          initials: provider.initials,
          months: initMonths(),
        };
      }

      // Clamp to year boundaries
      const clampedStart = req.start_date < yearStart ? yearStart : req.start_date;
      const clampedEnd = req.end_date > yearEnd ? yearEnd : req.end_date;

      const entries = getWorkDaysPerMonth(
        clampedStart,
        clampedEnd,
        req.time_block,
        provider.work_days || [],
        req.leave_type,
        today
      );

      for (const entry of entries) {
        const month = entry.date.substring(5, 7);
        const bucket = providerMap[provider.id].months[month];
        if (entry.completed) {
          bucket.completed += entry.value;
        } else {
          bucket.planned += entry.value;
        }
        bucket.days.push({
          date: entry.date,
          value: entry.value,
          completed: entry.completed,
          leaveType: entry.leaveType,
          timeBlock: req.time_block,
        });
      }
    }

    // Build sorted result
    const providers = Object.values(providerMap)
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ year, today, providers });
  } catch (error) {
    console.error('PTO report error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
