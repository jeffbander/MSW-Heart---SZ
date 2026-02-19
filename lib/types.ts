// ============================================
// RBAC / AUTH TYPES
// ============================================

export type UserRole = 'super_admin' | 'scheduler_full' | 'scheduler_limited' | 'provider' | 'viewer';

export interface AppUser {
  id: string;
  username: string;
  display_name: string;
  role: UserRole;
  provider_id: string | null;
  allowed_service_ids: string[];
  is_active: boolean;
  can_manage_testing: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// PROVIDER & SERVICE TYPES
// ============================================

export interface Provider {
  id: string;
  name: string;
  initials: string;
  role: string;
  email?: string;
  default_room_count: number;
  capabilities: string[];
  work_days: number[]; // JS day-of-week: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri
  created_at: string;
}

export interface Service {
  id: string;
  name: string;
  time_block: 'AM' | 'PM' | 'BOTH';
  requires_rooms: boolean;
  required_capability: string | null;
  show_on_main_calendar: boolean;
  created_at: string;
}

export interface ScheduleAssignment {
  id: string;
  date: string;
  service_id: string;
  provider_id: string;
  time_block: string;
  room_count: number;
  is_pto: boolean;
  is_covering: boolean;
  notes: string | null;
  created_at: string;
  service?: Service;
  provider?: Provider;
}

// Bulk Assignment Types
export interface BulkAssignmentData {
  provider_id: string;
  service_id: string;
  date: string;
  time_block: string;
  room_count: number;
  is_pto: boolean;
}

export interface BulkAssignmentRequest {
  assignments: BulkAssignmentData[];
}

export interface BulkAssignmentResponse {
  created: number;
  assignments: ScheduleAssignment[];
}

// Report Types
export type ReportType =
  | 'general-stats'
  | 'provider-workload'
  | 'service-coverage'
  | 'room-utilization'
  | 'pto-summary'
  | 'provider-rules'
  | 'custom-builder';

// Custom Report Builder Types
export type ReportDataSource =
  | 'schedule_assignments'
  | 'providers'
  | 'services'
  | 'provider_availability_rules'
  | 'provider_leaves';

export interface CustomReportConfig {
  dataSource: ReportDataSource;
  selectedColumns: string[];
  filters: ReportFilter[];
  groupBy?: string;
}

export interface ReportFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'between';
  value: any;
}

export interface ReportColumnDef {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean';
}

export interface ReportParams {
  type: ReportType;
  startDate: string;
  endDate: string;
}

export interface GeneralStatsReport {
  type: 'general-stats';
  dateRange: { startDate: string; endDate: string };
  data: {
    totalAssignments: number;
    workAssignments: number;
    ptoAssignments: number;
    totalProviders: number;
    totalServices: number;
  };
}

export interface ProviderWorkloadReport {
  type: 'provider-workload';
  dateRange: { startDate: string; endDate: string };
  data: Array<{
    provider: Provider;
    totalShifts: number;
    services: Record<string, number>;
  }>;
}

export interface ServiceCoverageReport {
  type: 'service-coverage';
  dateRange: { startDate: string; endDate: string };
  data: Array<{
    service: Service;
    assignmentCount: number;
    uniqueDates: number;
  }>;
}

export interface RoomUtilizationReport {
  type: 'room-utilization';
  dateRange: { startDate: string; endDate: string };
  data: Array<{
    date: string;
    timeBlock: string;
    totalRooms: number;
    maxRooms: number;
    unusedRooms: number;
    providers: Array<{ initials: string; rooms: number }>;
  }>;
}

export interface PTOSummaryReport {
  type: 'pto-summary';
  dateRange: { startDate: string; endDate: string };
  data: Array<{
    provider: Provider;
    totalDays: number;
    ptoDays: string[];
  }>;
}

export interface ProviderRulesReport {
  type: 'provider-rules';
  data: {
    availabilityRules: Array<{
      provider: Provider;
      rules: ProviderAvailabilityRule[];
    }>;
    leaves: ProviderLeave[];
    stats: {
      totalRules: number;
      totalAllowRules: number;
      totalBlockRules: number;
      providersWithRules: number;
      activeLeaves: number;
    };
  };
}

export interface CustomReport {
  type: 'custom';
  dataSource: ReportDataSource;
  columns: string[];
  data: any[];
  totalRows: number;
}

export type Report =
  | GeneralStatsReport
  | ProviderWorkloadReport
  | ServiceCoverageReport
  | RoomUtilizationReport
  | PTOSummaryReport
  | ProviderRulesReport
  | CustomReport;

// Template Types
export type TemplateType = 'weekly' | 'provider-leave' | 'custom';

export interface ScheduleTemplate {
  id: string;
  name: string;
  description?: string;
  type: TemplateType;
  is_global: boolean;
  owner_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  assignments?: TemplateAssignment[];
  owner?: Provider;
}

export interface TemplateAssignment {
  id: string;
  template_id: string;
  day_of_week: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  service_id: string;
  provider_id: string;
  time_block: 'AM' | 'PM' | 'BOTH';
  room_count: number;
  is_pto: boolean;
  notes?: string;
  created_at?: string;
  service?: Service;
  provider?: Provider;
}

export interface ApplyTemplateOptions {
  clearExisting: boolean;
  skipConflicts: boolean;
}

export interface ApplyTemplateRequest {
  templateId: string;
  startDate: string;
  endDate: string;
  options: ApplyTemplateOptions;
}

export interface ApplyAlternatingRequest {
  templates: string[]; // Array of template IDs
  pattern: number[]; // e.g., [0, 1] for A-B-A-B, [0, 0, 1, 1] for A-A-B-B
  startDate: string;
  endDate: string;
  options: ApplyTemplateOptions;
}

export interface CreateTemplateFromWeekRequest {
  name: string;
  description?: string;
  type?: TemplateType;
  weekStartDate: string;
  isGlobal?: boolean;
}

// Provider Availability Rules Types
export type AvailabilityRuleType = 'allow' | 'block';
export type AvailabilityEnforcement = 'hard' | 'warn';
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type TimeBlock = 'AM' | 'PM' | 'BOTH';

export interface ProviderAvailabilityRule {
  id: string;
  provider_id: string;
  service_id: string;
  day_of_week: DayOfWeek;
  time_block: TimeBlock;
  rule_type: AvailabilityRuleType;
  enforcement: AvailabilityEnforcement;
  reason: string | null;
  created_at: string;
  service?: Service;
  provider?: Provider;
}

export interface AvailabilityCheckResult {
  allowed: boolean;
  enforcement: AvailabilityEnforcement | null;
  reason: string | null;
  rule: ProviderAvailabilityRule | null;
}

export interface AvailabilityViolation {
  provider_id: string;
  provider_initials: string;
  date: string;
  time_block: string;
  service_name: string;
  enforcement: AvailabilityEnforcement;
  reason: string | null;
}

// Day Metadata Types (CHP Room, Extra Room, Day Notes)
export interface DayMetadata {
  id: string;
  date: string;
  time_block: 'AM' | 'PM' | 'DAY';
  chp_room_in_use: boolean;
  chp_room_note: string | null;
  extra_room_available: boolean;
  extra_room_note: string | null;
  day_note: string | null;
  created_at: string;
}

// Provider Leave Types
export type LeaveType = 'maternity' | 'vacation' | 'medical' | 'personal' | 'conference' | 'other';

// PTO Request Types
export type PTORequestStatus = 'pending' | 'approved' | 'denied';
export type PTOTimeBlock = 'AM' | 'PM' | 'FULL';

export interface PTORequest {
  id: string;
  provider_id: string;
  start_date: string;
  end_date: string;
  leave_type: LeaveType;
  time_block: PTOTimeBlock;
  reason: string | null;
  status: PTORequestStatus;
  requested_by: 'provider' | 'admin';
  reviewed_by_admin_name: string | null;
  reviewed_at: string | null;
  admin_comment: string | null;
  created_at: string;
  updated_at?: string;
  provider?: Provider;
}

export interface PTOValidationWarning {
  type: 'other_providers_off' | 'holiday_proximity' | 'assignment_conflict' | 'balance_warning';
  severity: 'info' | 'warning' | 'error';
  message: string;
  details?: any;
}

export interface PTOValidationResult {
  calculated_days: number;
  warnings: PTOValidationWarning[];
  can_submit: boolean;
}

export interface PTOSummary {
  provider_id: string;
  year: number;
  total_pto_days: number;
  requests_by_type: Record<string, number>;
  holidays_taken: number;
  approved_requests: PTORequest[];
}

export interface ProviderLeave {
  id: string;
  provider_id: string;
  start_date: string;
  end_date: string;
  leave_type: LeaveType;
  reason: string | null;
  created_at: string;
  provider?: Provider;
}

// ============================================
// ECHO LAB SCHEDULE TYPES
// ============================================

export interface EchoTech {
  id: string;
  name: string;
  initials: string;
  capacity_per_half_day: number;
  is_active: boolean;
  created_at: string;
}

export interface EchoRoom {
  id: string;
  category: 'CVI' | 'Fourth Floor Lab';
  name: string;
  short_name: string | null;
  capacity_type: 'vascular' | 'echo' | 'stress_echo' | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface EchoScheduleAssignment {
  id: string;
  date: string;
  echo_room_id: string;
  echo_tech_id: string;
  time_block: 'AM' | 'PM';
  notes: string | null;
  created_at: string;
  echo_room?: EchoRoom;
  echo_tech?: EchoTech;
}

export interface EchoPTO {
  id: string;
  date: string;
  echo_tech_id: string;
  time_block: 'AM' | 'PM' | 'BOTH';
  reason: string | null;
  created_at: string;
  echo_tech?: EchoTech;
}

// Echo Schedule Conflict Types
export type EchoConflictType = 'double_booked' | 'pto_conflict' | 'unassigned';

export interface EchoConflict {
  type: EchoConflictType;
  date: string;
  time_block: 'AM' | 'PM';
  echo_tech_id?: string;
  echo_room_id?: string;
  message: string;
}

// Echo Schedule Template Types
export interface EchoScheduleTemplate {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  assignments?: EchoTemplateAssignment[];
}

export interface EchoTemplateAssignment {
  id: string;
  template_id: string;
  day_of_week: number; // 0=Sunday, 6=Saturday
  echo_room_id: string;
  echo_tech_id: string;
  time_block: 'AM' | 'PM';
  notes: string | null;
  created_at: string;
  echo_room?: EchoRoom;
  echo_tech?: EchoTech;
}

// ============================================
// HOLIDAY TYPES
// ============================================

export interface Holiday {
  id: string;
  date: string;
  name: string;
  block_assignments: boolean;
  created_at: string;
}
