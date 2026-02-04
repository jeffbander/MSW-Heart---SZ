import { ReportDataSource, ReportColumnDef } from '@/lib/types';

export const dataSourceLabels: Record<ReportDataSource, string> = {
  schedule_assignments: 'Schedule Assignments',
  providers: 'Providers',
  services: 'Services',
  provider_availability_rules: 'Availability Rules',
  provider_leaves: 'Provider Leaves',
};

export const columnDefinitions: Record<ReportDataSource, ReportColumnDef[]> = {
  schedule_assignments: [
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'provider.name', label: 'Provider', type: 'string' },
    { key: 'provider.initials', label: 'Provider Initials', type: 'string' },
    { key: 'service.name', label: 'Service', type: 'string' },
    { key: 'time_block', label: 'Time Block', type: 'string' },
    { key: 'room_count', label: 'Room Count', type: 'number' },
    { key: 'is_pto', label: 'Is PTO', type: 'boolean' },
    { key: 'is_covering', label: 'Is Covering', type: 'boolean' },
    { key: 'notes', label: 'Notes', type: 'string' },
  ],
  providers: [
    { key: 'name', label: 'Name', type: 'string' },
    { key: 'initials', label: 'Initials', type: 'string' },
    { key: 'role', label: 'Role', type: 'string' },
    { key: 'default_room_count', label: 'Default Room Count', type: 'number' },
    { key: 'capabilities', label: 'Capabilities', type: 'string' },
  ],
  services: [
    { key: 'name', label: 'Name', type: 'string' },
    { key: 'time_block', label: 'Time Block', type: 'string' },
    { key: 'requires_rooms', label: 'Requires Rooms', type: 'boolean' },
    { key: 'required_capability', label: 'Required Capability', type: 'string' },
    { key: 'show_on_main_calendar', label: 'Show on Calendar', type: 'boolean' },
  ],
  provider_availability_rules: [
    { key: 'provider.name', label: 'Provider', type: 'string' },
    { key: 'provider.initials', label: 'Provider Initials', type: 'string' },
    { key: 'service.name', label: 'Service', type: 'string' },
    { key: 'day_of_week', label: 'Day of Week', type: 'number' },
    { key: 'time_block', label: 'Time Block', type: 'string' },
    { key: 'rule_type', label: 'Rule Type', type: 'string' },
    { key: 'enforcement', label: 'Enforcement', type: 'string' },
    { key: 'reason', label: 'Reason', type: 'string' },
  ],
  provider_leaves: [
    { key: 'provider.name', label: 'Provider', type: 'string' },
    { key: 'provider.initials', label: 'Provider Initials', type: 'string' },
    { key: 'start_date', label: 'Start Date', type: 'date' },
    { key: 'end_date', label: 'End Date', type: 'date' },
    { key: 'leave_type', label: 'Leave Type', type: 'string' },
    { key: 'reason', label: 'Reason', type: 'string' },
  ],
};

export const defaultSelectedColumns: Record<ReportDataSource, string[]> = {
  schedule_assignments: ['date', 'provider.name', 'service.name', 'time_block', 'room_count'],
  providers: ['name', 'initials', 'role', 'default_room_count'],
  services: ['name', 'time_block', 'requires_rooms'],
  provider_availability_rules: ['provider.name', 'service.name', 'day_of_week', 'time_block', 'rule_type'],
  provider_leaves: ['provider.name', 'start_date', 'end_date', 'leave_type'],
};

export const dayOfWeekLabels: Record<number, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};
