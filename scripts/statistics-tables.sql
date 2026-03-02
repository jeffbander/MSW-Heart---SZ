-- Statistics Dashboard - Phase 1: Table Creation
-- Run this in Supabase SQL Editor
-- Creates: stat_uploads, stat_office_visits, stat_testing_visits, stat_orders

-- ============================================
-- 1. stat_uploads - Upload metadata & history
-- ============================================
CREATE TABLE IF NOT EXISTS stat_uploads (
  id BIGSERIAL PRIMARY KEY,
  report_type VARCHAR(50) NOT NULL,  -- 'office_visits', 'testing_visits', 'orders'
  report_month DATE NOT NULL,
  file_name VARCHAR(255),
  row_count INT,
  uploaded_by TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'processing',  -- 'processing', 'completed', 'failed'
  error_message TEXT,

  -- Prevent duplicate uploads for same month/report type
  UNIQUE(report_type, report_month)
);

CREATE INDEX IF NOT EXISTS idx_stat_uploads_report_month ON stat_uploads(report_month);
CREATE INDEX IF NOT EXISTS idx_stat_uploads_report_type ON stat_uploads(report_type);
CREATE INDEX IF NOT EXISTS idx_stat_uploads_uploaded_by ON stat_uploads(uploaded_by);

-- ============================================
-- 2. stat_office_visits - Parsed office visit records
-- ============================================
CREATE TABLE IF NOT EXISTS stat_office_visits (
  id BIGSERIAL PRIMARY KEY,
  upload_id BIGINT NOT NULL REFERENCES stat_uploads(id) ON DELETE CASCADE,
  report_month DATE NOT NULL,
  start_date DATE,
  end_date DATE,
  visit_date DATE NOT NULL,
  appointment_time TEXT,
  patient_name VARCHAR(255),
  mrn VARCHAR(50),
  appointment_status VARCHAR(50),
  primary_provider_name VARCHAR(255),
  primary_provider_id UUID REFERENCES providers(id),
  visit_type_category VARCHAR(100),
  visit_type_raw VARCHAR(255),
  primary_payer VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sov_report_month ON stat_office_visits(report_month);
CREATE INDEX IF NOT EXISTS idx_sov_provider_id ON stat_office_visits(primary_provider_id);
CREATE INDEX IF NOT EXISTS idx_sov_visit_type_category ON stat_office_visits(visit_type_category);
CREATE INDEX IF NOT EXISTS idx_sov_appointment_status ON stat_office_visits(appointment_status);
CREATE INDEX IF NOT EXISTS idx_sov_payer ON stat_office_visits(primary_payer);
CREATE INDEX IF NOT EXISTS idx_sov_upload_id ON stat_office_visits(upload_id);

-- ============================================
-- 3. stat_testing_visits - Parsed testing visit records
-- ============================================
CREATE TABLE IF NOT EXISTS stat_testing_visits (
  id BIGSERIAL PRIMARY KEY,
  upload_id BIGINT NOT NULL REFERENCES stat_uploads(id) ON DELETE CASCADE,
  report_month DATE NOT NULL,
  start_date DATE,
  end_date DATE,
  appointment_time TEXT,
  patient_name VARCHAR(255),
  mrn VARCHAR(50),
  appointment_status VARCHAR(50),
  department VARCHAR(255),
  department_normalized VARCHAR(100),
  visit_type VARCHAR(255),
  late_cancel SMALLINT DEFAULT 0,
  primary_payer VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stv_report_month ON stat_testing_visits(report_month);
CREATE INDEX IF NOT EXISTS idx_stv_department ON stat_testing_visits(department_normalized);
CREATE INDEX IF NOT EXISTS idx_stv_visit_type ON stat_testing_visits(visit_type);
CREATE INDEX IF NOT EXISTS idx_stv_appointment_status ON stat_testing_visits(appointment_status);
CREATE INDEX IF NOT EXISTS idx_stv_payer ON stat_testing_visits(primary_payer);
CREATE INDEX IF NOT EXISTS idx_stv_late_cancel ON stat_testing_visits(late_cancel);
CREATE INDEX IF NOT EXISTS idx_stv_upload_id ON stat_testing_visits(upload_id);

-- ============================================
-- 4. stat_orders - Parsed order records
-- ============================================
CREATE TABLE IF NOT EXISTS stat_orders (
  id BIGSERIAL PRIMARY KEY,
  upload_id BIGINT NOT NULL REFERENCES stat_uploads(id) ON DELETE CASCADE,
  report_month DATE NOT NULL,
  visit_date DATE,
  mrn VARCHAR(50),
  patient_name VARCHAR(255),
  provider_resource_name VARCHAR(255),
  ordering_provider_name VARCHAR(255),
  ordering_provider_id UUID REFERENCES providers(id),
  referring_provider_name VARCHAR(255),
  referring_provider_id UUID REFERENCES providers(id),
  order_id VARCHAR(100),
  order_description VARCHAR(500),
  order_category VARCHAR(100),
  order_date DATE,
  order_status VARCHAR(50),
  appt_status VARCHAR(50),
  department VARCHAR(255),
  coverage VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_so_report_month ON stat_orders(report_month);
CREATE INDEX IF NOT EXISTS idx_so_ordering_provider_id ON stat_orders(ordering_provider_id);
CREATE INDEX IF NOT EXISTS idx_so_referring_provider_id ON stat_orders(referring_provider_id);
CREATE INDEX IF NOT EXISTS idx_so_order_category ON stat_orders(order_category);
CREATE INDEX IF NOT EXISTS idx_so_department ON stat_orders(department);
CREATE INDEX IF NOT EXISTS idx_so_upload_id ON stat_orders(upload_id);
