import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { ReportDataSource, ReportFilter } from '@/lib/types';

interface CustomReportRequest {
  dataSource: ReportDataSource;
  selectedColumns: string[];
  filters: ReportFilter[];
  startDate?: string;
  endDate?: string;
}

// Map data sources to their table names and select queries
const dataSourceConfig: Record<ReportDataSource, {
  table: string;
  selectQuery: string;
  dateField?: string;
}> = {
  schedule_assignments: {
    table: 'schedule_assignments',
    selectQuery: `
      id, date, time_block, room_count, is_pto, is_covering, notes,
      provider:providers(id, name, initials),
      service:services(id, name, time_block)
    `,
    dateField: 'date',
  },
  providers: {
    table: 'providers',
    selectQuery: 'id, name, initials, role, default_room_count, capabilities',
  },
  services: {
    table: 'services',
    selectQuery: 'id, name, time_block, requires_rooms, required_capability, show_on_main_calendar',
  },
  provider_availability_rules: {
    table: 'provider_availability_rules',
    selectQuery: `
      id, day_of_week, time_block, rule_type, enforcement, reason,
      provider:providers(id, name, initials),
      service:services(id, name)
    `,
  },
  provider_leaves: {
    table: 'provider_leaves',
    selectQuery: `
      id, start_date, end_date, leave_type, reason,
      provider:providers(id, name, initials)
    `,
    dateField: 'start_date',
  },
};

export async function POST(request: Request) {
  try {
    const body: CustomReportRequest = await request.json();
    const { dataSource, selectedColumns, filters, startDate, endDate } = body;

    if (!dataSource || !selectedColumns || selectedColumns.length === 0) {
      return NextResponse.json(
        { error: 'dataSource and selectedColumns are required' },
        { status: 400 }
      );
    }

    const config = dataSourceConfig[dataSource];
    if (!config) {
      return NextResponse.json(
        { error: 'Invalid data source' },
        { status: 400 }
      );
    }

    // Build the query
    let query = supabase
      .from(config.table)
      .select(config.selectQuery);

    // Apply date filters if applicable
    if (config.dateField && startDate) {
      query = query.gte(config.dateField, startDate);
    }
    if (config.dateField && endDate) {
      query = query.lte(config.dateField, endDate);
    }

    // Apply custom filters
    for (const filter of filters) {
      switch (filter.operator) {
        case 'eq':
          query = query.eq(filter.field, filter.value);
          break;
        case 'neq':
          query = query.neq(filter.field, filter.value);
          break;
        case 'gt':
          query = query.gt(filter.field, filter.value);
          break;
        case 'gte':
          query = query.gte(filter.field, filter.value);
          break;
        case 'lt':
          query = query.lt(filter.field, filter.value);
          break;
        case 'lte':
          query = query.lte(filter.field, filter.value);
          break;
        case 'in':
          query = query.in(filter.field, filter.value);
          break;
      }
    }

    // Add ordering
    if (config.dateField) {
      query = query.order(config.dateField, { ascending: true });
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch data' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      type: 'custom',
      dataSource,
      columns: selectedColumns,
      data: data || [],
      totalRows: data?.length || 0,
    });
  } catch (error) {
    console.error('Error generating custom report:', error);
    return NextResponse.json(
      { error: 'Failed to generate custom report' },
      { status: 500 }
    );
  }
}
