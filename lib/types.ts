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
