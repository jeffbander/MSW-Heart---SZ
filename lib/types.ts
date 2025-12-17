export interface Provider {
  id: string;
  name: string;
  initials: string;
  role: string;
  default_room_count: number;
  capabilities: string[];
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
  | 'pto-summary';

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

export type Report =
  | GeneralStatsReport
  | ProviderWorkloadReport
  | ServiceCoverageReport
  | RoomUtilizationReport
  | PTOSummaryReport;

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
