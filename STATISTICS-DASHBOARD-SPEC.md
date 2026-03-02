# Statistics Dashboard Implementation Specification
## MSW Heart Cardiology Scheduler

**Document Version:** 1.0
**Last Updated:** 2026-02-25
**Target Framework:** Next.js 16 + React 19 + TypeScript + Supabase + Tailwind CSS

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Architecture](#current-architecture)
3. [Data Sources Overview](#data-sources-overview)
4. [Database Schema](#database-schema)
5. [Phase 1: Data Upload & Storage](#phase-1-data-upload--storage)
6. [Phase 2: Practice Overview Dashboard](#phase-2-practice-overview-dashboard)
7. [Phase 3: Provider Scorecard](#phase-3-provider-scorecard)
8. [Phase 4: Testing Analytics](#phase-4-testing-analytics)
9. [Implementation Timeline](#implementation-timeline)
10. [Technical Considerations](#technical-considerations)

---

## Executive Summary

The Statistics Dashboard is a 4-phase implementation adding comprehensive analytics and reporting to the MSW Heart Cardiology Scheduler application. It will process Epic report exports (Office Visits, Testing Visits, Orders), store parsed data in Supabase, and provide views for practice overview, provider scorecards, and testing analytics.

**Key Features:**
- Upload and parse 3 monthly Epic report types (encrypted Excel files)
- Practice-wide KPI dashboard with time period comparisons
- Provider-level performance scorecard with comparison table
- Testing volume analytics by department with referral/order tracking
- Role-based access control (viewer and above can see dashboards)
- Persistent data storage allowing multi-month trend analysis

**Build Order:** Phase 1 → Phase 2 → Phase 3 → Phase 4

---

## Current Architecture

### Tech Stack
- **Framework:** Next.js 16 with App Router, React 19, TypeScript
- **Database:** Supabase (PostgreSQL)
- **Styling:** Tailwind CSS
- **Authentication:** Session-based with httpOnly cookies
- **Utilities:** `xlsx` npm package (already installed)

### Existing Key Files & Utilities

**Authentication & Authorization:**
- `app/lib/auth.ts` — `getAuthUser()`, `requireRole()`, role checking utilities
- Roles: `super_admin`, `scheduler_full`, `scheduler_limited`, `provider`, `viewer`

**Data Parsing:**
- `app/lib/epicParser.ts` — Epic report parsing (currently handles different column layout than Phase 1 files)
- Needs to be updated to parse the 3 actual report formats

**Database Client:**
- `app/lib/supabase.ts` — Supabase client initialization with env vars

**Type Definitions:**
- `app/lib/types.ts` — Centralized TypeScript interfaces

**Navigation:**
- `app/components/layout/Sidebar.tsx` — Has nav items for "Statistics" and "Data" with `comingSoon` badges
- Placeholders exist at `app/statistics/page.tsx`

### Color Scheme
- Primary Blue: `#003D7A`
- Light Blue: `#0078C8`
- Teal: `#00A3AD`
- Light Gray: `#F5F5F5`

### Existing Database Assets
- `providers` table: 32 internal CVI providers with fields `id`, `name`, `initials`, `role`, `capabilities`
- `schedule_assignments` table: tracks provider room assignments by date (for session counting)

---

## Data Sources Overview

### Source 1: Office Visits Report
**File Characteristics:**
- Encrypted Excel (.xlsx) with password: `"1"`
- 9 metadata header rows (rows 0-8), actual data starts row 9
- ~160K+ rows spanning multiple months
- Typical columns in order:
  - Start Date
  - End Date
  - Slices by Primary Provider
  - Slices by Visit Type
  - Visit Date
  - Appointment Time
  - Patient Name
  - MRN
  - Appointment Status
  - Primary Payer Financial Class

**Key Data Points:**
- Appointment Status values: `Completed`, `Arrived`, `Canceled`, `No Show`, `Rescheduled`, `Scheduled`, `Left without seen`
- Provider names format: `LASTNAME, FIRSTNAME` (e.g., `GOLDFINGER, JUDITH Z.`)
- 46 unique providers appear; ~32 are internal (match against `providers` table)
- Visit types must be categorized per the Visit Type Groupings specification

### Source 2: Testing Visits Report
**File Characteristics:**
- Encrypted Excel (.xlsx) with password: `"1"`
- 9 metadata header rows, data starts row 9
- ~93K rows covering Jan 2023 - Dec 2025
- Columns in order:
  - Start Date
  - End Date
  - Slices by Department
  - Slices by Visit Type
  - Appointment Time
  - Patient Name
  - MRN
  - Appointment Status
  - Late Cancel? (0 or 1)
  - Primary Payer

**Departments:** (normalize these values)
- 1000 10TH AVE CVI CARDIOLOGY ECHO
- 1000 10TH AVE CVI CARDIOLOGY VASCULAR
- 1000 10TH AVE CVI CARDIOLOGY NUCLEAR
- 1000 10TH AVE EP
- MSW 1000 10TH AVE CARDIOLOGY CT
- 1000 10TH AVE CVI CARDIO VEIN
- 1000 10TH ECHO

**Visit Types:** Include ECHO, STRESS ECHO ONLY, NUCLEAR STRESS TEST, VASCULAR, TEE, CT CORONARY CALCIUM SCORE CVI, etc.

### Source 3: Orders Report
**File Characteristics:**
- NOT encrypted Excel (.xlsx)
- No metadata headers; column names are in row 0
- ~4K rows per month
- Columns in order:
  - Provider/Resource
  - ORD: Patient Contact Department
  - Visit Date
  - MRN
  - Patient
  - Coverage
  - APPT STATUS
  - Order ID
  - Order Description
  - Order Date
  - Ordering Provider
  - Referring Prov
  - Order Status
  - Status
  - Date of Scheduling
  - Appt Date

**Key Data Points:**
- Provider/Resource format: `FirstName LastName [ID]`
- Order descriptions must be categorized into predefined groups (Echo, Stress Echo, Nuclear, etc.)

---

## Database Schema

### New Tables to Create

#### 1. `stat_office_visits`
Stores parsed office visit records.

```sql
CREATE TABLE stat_office_visits (
  id BIGSERIAL PRIMARY KEY,
  upload_id BIGINT NOT NULL REFERENCES stat_uploads(id) ON DELETE CASCADE,
  report_month DATE NOT NULL,
  start_date DATE,
  end_date DATE,
  visit_date DATE NOT NULL,
  appointment_time TIME,
  patient_name VARCHAR(255),
  mrn VARCHAR(50),
  appointment_status VARCHAR(50),
  primary_provider_name VARCHAR(255),
  primary_provider_id BIGINT REFERENCES providers(id),
  visit_type_category VARCHAR(100),
  visit_type_raw VARCHAR(255),
  primary_payer VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Indexes for query performance
  INDEX idx_report_month (report_month),
  INDEX idx_provider_id (primary_provider_id),
  INDEX idx_visit_type_category (visit_type_category),
  INDEX idx_appointment_status (appointment_status),
  INDEX idx_payer (primary_payer),
  INDEX idx_upload_id (upload_id)
);
```

#### 2. `stat_testing_visits`
Stores parsed testing visit records.

```sql
CREATE TABLE stat_testing_visits (
  id BIGSERIAL PRIMARY KEY,
  upload_id BIGINT NOT NULL REFERENCES stat_uploads(id) ON DELETE CASCADE,
  report_month DATE NOT NULL,
  start_date DATE,
  end_date DATE,
  appointment_time TIME,
  patient_name VARCHAR(255),
  mrn VARCHAR(50),
  appointment_status VARCHAR(50),
  department VARCHAR(255),
  department_normalized VARCHAR(100),
  visit_type VARCHAR(255),
  late_cancel SMALLINT DEFAULT 0,
  primary_payer VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Indexes
  INDEX idx_report_month (report_month),
  INDEX idx_department (department_normalized),
  INDEX idx_visit_type (visit_type),
  INDEX idx_appointment_status (appointment_status),
  INDEX idx_payer (primary_payer),
  INDEX idx_late_cancel (late_cancel),
  INDEX idx_upload_id (upload_id)
);
```

#### 3. `stat_orders`
Stores parsed order records.

```sql
CREATE TABLE stat_orders (
  id BIGSERIAL PRIMARY KEY,
  upload_id BIGINT NOT NULL REFERENCES stat_uploads(id) ON DELETE CASCADE,
  report_month DATE NOT NULL,
  visit_date DATE,
  mrn VARCHAR(50),
  patient_name VARCHAR(255),
  provider_resource_name VARCHAR(255),
  ordering_provider_name VARCHAR(255),
  ordering_provider_id BIGINT REFERENCES providers(id),
  referring_provider_name VARCHAR(255),
  referring_provider_id BIGINT REFERENCES providers(id),
  order_id VARCHAR(100),
  order_description VARCHAR(500),
  order_category VARCHAR(100),
  order_date DATE,
  order_status VARCHAR(50),
  appt_status VARCHAR(50),
  department VARCHAR(255),
  coverage VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Indexes
  INDEX idx_report_month (report_month),
  INDEX idx_ordering_provider_id (ordering_provider_id),
  INDEX idx_referring_provider_id (referring_provider_id),
  INDEX idx_order_category (order_category),
  INDEX idx_department (department),
  INDEX idx_upload_id (upload_id)
);
```

#### 4. `stat_uploads`
Metadata about uploads (used for history and duplicate detection).

```sql
CREATE TABLE stat_uploads (
  id BIGSERIAL PRIMARY KEY,
  report_type VARCHAR(50) NOT NULL, -- 'office_visits', 'testing_visits', 'orders'
  report_month DATE NOT NULL,
  file_name VARCHAR(255),
  row_count INT,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  uploaded_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'completed', -- 'processing', 'completed', 'failed'
  error_message TEXT,

  -- Prevent duplicate uploads for same month/report type
  UNIQUE(report_type, report_month),
  INDEX idx_report_month (report_month),
  INDEX idx_report_type (report_type),
  INDEX idx_uploaded_by (uploaded_by)
);
```

### Adding to Existing `providers` Table (if not already present)
Ensure the `providers` table has these fields:
```sql
ALTER TABLE providers ADD COLUMN IF NOT EXISTS
  name VARCHAR(255) NOT NULL,
  initials VARCHAR(10),
  role VARCHAR(50),
  capabilities TEXT[],
  created_at TIMESTAMP DEFAULT NOW();
```

---

## Phase 1: Data Upload & Storage

### Overview
Phase 1 focuses on building the infrastructure to accept, parse, validate, and persistently store Epic report data. This is the foundation for all subsequent phases.

### 1.1 Update `lib/epicParser.ts`

**Current State:** Handles different column layout than the actual uploaded files.

**New Implementation:** Add three specialized parser functions to handle the actual Epic report formats.

**File Path:** `app/lib/epicParser.ts`

```typescript
import { utils, read } from 'xlsx';

// Type definitions for parsed records
export interface OfficeVisitRecord {
  visitDate: Date;
  appointmentTime: string;
  patientName: string;
  mrn: string;
  appointmentStatus: string;
  primaryProviderName: string;
  visitTypeRaw: string;
  visitTypeCategory: string;
  primaryPayer: string;
  startDate: Date;
  endDate: Date;
}

export interface TestingVisitRecord {
  appointmentTime: string;
  patientName: string;
  mrn: string;
  appointmentStatus: string;
  department: string;
  departmentNormalized: string;
  visitType: string;
  lateCancel: number;
  primaryPayer: string;
  startDate: Date;
  endDate: Date;
}

export interface OrderRecord {
  visitDate: Date;
  mrn: string;
  patientName: string;
  providerResourceName: string;
  orderingProviderName: string;
  referringProviderName: string;
  orderId: string;
  orderDescription: string;
  orderCategory: string;
  orderDate: Date;
  orderStatus: string;
  apptStatus: string;
  department: string;
  coverage: string;
}

// Visit Type Categorization
const VISIT_TYPE_MAPPING: Record<string, string> = {
  'NEW PATIENT': 'New Patient',
  'NEW PT-COVID19 SCREENING': 'New Patient',
  'FOLLOW UP': 'Follow Up',
  'FOLLOW UP EXTENDED': 'Follow Up',
  'MEDICAL FOLLOW UP': 'Follow Up',
  'LEQVIO VISIT': 'Leqvio',
  'RESEARCH': 'Research',
  'VIDEO VISIT - FOLLOW UP': 'Video Visit',
  'VIDEO VISIT - NEW PATIENT': 'Video Visit',
  'TELEPHONE VISIT POST OP': 'Video Visit',
  'TELEPHONE VISIT-ESTABLISHED PATIENT': 'Video Visit',
  'TELEHEALTH COVID-19 FOLLOW UP': 'Video Visit',
  'MYCHART ONDEMAND VISIT 1': 'Video Visit',
  'ANNUAL WELL VISIT ESTABLISHED': 'Annual Well Visit',
  'DEVICE CHECK': 'Ancillary',
  'EKG': 'Ancillary',
  'BLOOD DRAW': 'Ancillary',
  'EVENT MONITOR': 'Ancillary',
};

// Ancillary subcategories
const ANCILLARY_TYPES = ['DEVICE CHECK', 'EKG', 'BLOOD DRAW', 'EVENT MONITOR'];

// Department Normalization
const DEPARTMENT_NORMALIZATION: Record<string, string> = {
  '1000 10TH AVE CVI CARDIOLOGY ECHO': 'Echo',
  '1000 10TH AVE CVI CARDIOLOGY VASCULAR': 'Vascular',
  '1000 10TH AVE CVI CARDIOLOGY NUCLEAR': 'Nuclear',
  '1000 10TH AVE EP': 'EP',
  'MSW 1000 10TH AVE CARDIOLOGY CT': 'CT',
  '1000 10TH AVE CVI CARDIO VEIN': 'Cardio Vein',
  '1000 10TH ECHO': 'Echo',
};

// Order categorization
const ORDER_CATEGORY_MAPPING: Record<string, string> = {
  'TRANSTHORACIC ECHOCARDIOGRAM (TTE)': 'Echo',
  'ECHOCARDIOGRAM LIMITED': 'Echo',
  'ECHO FETAL': 'Echo',
  'ECHOCARDIOGRAM STRESS TEST': 'Stress Echo',
  'DOBUTAMINE STRESS ECHO': 'Stress Echo',
  'TRANSTHORACIC STRESS ECHOCARDIOGRAM': 'Stress Echo',
  'MYOCARDIAL PERFUSION STRESS TEST': 'Nuclear',
  'NM PET HEART STRESS': 'Nuclear',
  'TC-99M PYP AMYLOID SCAN': 'Nuclear',
  'US DOPPLER': 'Vascular',
  'US DUPLEX CAROTID': 'Vascular',
  'CT HEART CORONARY': 'CT/CTA',
  'CTA HEART CORONARY': 'CT/CTA',
  'CTA CHEST': 'CT/CTA',
  'CT CHEST': 'CT/CTA',
  'CTA NECK': 'CT/CTA',
  'EP STUDY/ABLATION': 'EP',
  'ILR IMPLANT': 'EP',
  'CARDIOVERSION': 'EP',
  'CARDIOVERSION W/ TEE': 'EP',
  'INTERROGATION DEVICE': 'EP',
  'LONG-TERM MONITOR LTM': 'Monitoring',
  'MOBILE TELEMETRY MCT': 'Monitoring',
  'ECG MONITOR/REVIEW': 'Monitoring',
  'ELECTROCARDIOGRAM': 'EKG',
  'ECG RECORD/REVIEW': 'EKG',
};

/**
 * Parse Office Visits Report
 * Encrypted with password "1", 9 metadata header rows
 */
export async function parseOfficeVisitsReport(
  fileBuffer: Buffer,
  password?: string
): Promise<OfficeVisitRecord[]> {
  try {
    const workbook = read(fileBuffer, {
      password: password || '1',
      cellFormula: false,
      cellHTML: false,
    });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = utils.sheet_to_json(sheet, { header: 1, defval: '' });

    // Skip first 9 metadata rows
    const dataRows = rows.slice(9);
    const headers = rows[8]; // Row 8 (0-indexed) contains column names

    // Map column indices
    const columnMap = mapOfficeVisitColumns(headers);

    const records: OfficeVisitRecord[] = [];

    for (const row of dataRows) {
      if (!row || row.length === 0) continue;

      const visitDateStr = row[columnMap.visitDate];
      const appointmentDateStr = row[columnMap.appointmentTime];

      if (!visitDateStr) continue; // Skip rows without visit date

      const record: OfficeVisitRecord = {
        visitDate: parseExcelDate(visitDateStr),
        appointmentTime: String(appointmentDateStr || ''),
        patientName: String(row[columnMap.patientName] || '').trim(),
        mrn: String(row[columnMap.mrn] || '').trim(),
        appointmentStatus: String(row[columnMap.appointmentStatus] || '').trim(),
        primaryProviderName: String(row[columnMap.primaryProvider] || '').trim(),
        visitTypeRaw: String(row[columnMap.visitType] || '').trim(),
        visitTypeCategory: categorizeVisitType(String(row[columnMap.visitType] || '').trim()),
        primaryPayer: String(row[columnMap.primaryPayer] || '').trim(),
        startDate: parseExcelDate(row[columnMap.startDate]),
        endDate: parseExcelDate(row[columnMap.endDate]),
      };

      records.push(record);
    }

    return records;
  } catch (error) {
    console.error('Error parsing office visits report:', error);
    throw new Error(`Failed to parse office visits report: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse Testing Visits Report
 * Encrypted with password "1", 9 metadata header rows
 */
export async function parseTestingVisitsReport(
  fileBuffer: Buffer,
  password?: string
): Promise<TestingVisitRecord[]> {
  try {
    const workbook = read(fileBuffer, {
      password: password || '1',
      cellFormula: false,
      cellHTML: false,
    });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = utils.sheet_to_json(sheet, { header: 1, defval: '' });

    // Skip first 9 metadata rows
    const dataRows = rows.slice(9);
    const headers = rows[8];

    const columnMap = mapTestingVisitColumns(headers);

    const records: TestingVisitRecord[] = [];

    for (const row of dataRows) {
      if (!row || row.length === 0) continue;

      const appointmentDateStr = row[columnMap.appointmentTime];
      if (!appointmentDateStr) continue;

      const departmentRaw = String(row[columnMap.department] || '').trim();

      const record: TestingVisitRecord = {
        appointmentTime: String(appointmentDateStr || ''),
        patientName: String(row[columnMap.patientName] || '').trim(),
        mrn: String(row[columnMap.mrn] || '').trim(),
        appointmentStatus: String(row[columnMap.appointmentStatus] || '').trim(),
        department: departmentRaw,
        departmentNormalized: normalizeDepartment(departmentRaw),
        visitType: String(row[columnMap.visitType] || '').trim(),
        lateCancel: parseInt(String(row[columnMap.lateCancel] || 0)) || 0,
        primaryPayer: String(row[columnMap.primaryPayer] || '').trim(),
        startDate: parseExcelDate(row[columnMap.startDate]),
        endDate: parseExcelDate(row[columnMap.endDate]),
      };

      records.push(record);
    }

    return records;
  } catch (error) {
    console.error('Error parsing testing visits report:', error);
    throw new Error(`Failed to parse testing visits report: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse Orders Report
 * NOT encrypted, no metadata headers, data starts at row 0
 */
export async function parseOrdersReport(
  fileBuffer: Buffer
): Promise<OrderRecord[]> {
  try {
    const workbook = read(fileBuffer, { cellFormula: false, cellHTML: false });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = utils.sheet_to_json(sheet, { header: 1, defval: '' });

    // Row 0 contains headers
    const headers = rows[0];
    const dataRows = rows.slice(1);

    const columnMap = mapOrdersColumns(headers);

    const records: OrderRecord[] = [];

    for (const row of dataRows) {
      if (!row || row.length === 0) continue;

      const orderId = String(row[columnMap.orderId] || '').trim();
      if (!orderId) continue;

      const orderDescriptionRaw = String(row[columnMap.orderDescription] || '').trim();

      const record: OrderRecord = {
        visitDate: parseExcelDate(row[columnMap.visitDate]),
        mrn: String(row[columnMap.mrn] || '').trim(),
        patientName: String(row[columnMap.patient] || '').trim(),
        providerResourceName: String(row[columnMap.providerResource] || '').trim(),
        orderingProviderName: String(row[columnMap.orderingProvider] || '').trim(),
        referringProviderName: String(row[columnMap.referringProvider] || '').trim(),
        orderId: orderId,
        orderDescription: orderDescriptionRaw,
        orderCategory: categorizeOrder(orderDescriptionRaw),
        orderDate: parseExcelDate(row[columnMap.orderDate]),
        orderStatus: String(row[columnMap.orderStatus] || '').trim(),
        apptStatus: String(row[columnMap.apptStatus] || '').trim(),
        department: String(row[columnMap.department] || '').trim(),
        coverage: String(row[columnMap.coverage] || '').trim(),
      };

      records.push(record);
    }

    return records;
  } catch (error) {
    console.error('Error parsing orders report:', error);
    throw new Error(`Failed to parse orders report: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ===== HELPER FUNCTIONS =====

function mapOfficeVisitColumns(headers: any[]): Record<string, number> {
  const map: Record<string, number> = {};

  const headerMap: Record<string, string> = {
    'startDate': ['Start Date'],
    'endDate': ['End Date'],
    'visitDate': ['Visit Date'],
    'appointmentTime': ['Appointment Time'],
    'patientName': ['Patient Name'],
    'mrn': ['MRN'],
    'appointmentStatus': ['Appointment Status'],
    'primaryProvider': ['Slices by Primary Provider', 'Primary Provider'],
    'visitType': ['Slices by Visit Type', 'Visit Type'],
    'primaryPayer': ['Primary Payer Financial Class', 'Primary Payer'],
  };

  for (const [key, aliases] of Object.entries(headerMap)) {
    const idx = headers.findIndex((h) =>
      aliases.some((alias) => String(h).includes(alias))
    );
    map[key] = idx >= 0 ? idx : 0;
  }

  return map;
}

function mapTestingVisitColumns(headers: any[]): Record<string, number> {
  const map: Record<string, number> = {};

  const headerMap: Record<string, string> = {
    'startDate': ['Start Date'],
    'endDate': ['End Date'],
    'appointmentTime': ['Appointment Time'],
    'patientName': ['Patient Name'],
    'mrn': ['MRN'],
    'appointmentStatus': ['Appointment Status'],
    'department': ['Slices by Department', 'Department'],
    'visitType': ['Slices by Visit Type', 'Visit Type'],
    'lateCancel': ['Late Cancel?'],
    'primaryPayer': ['Primary Payer'],
  };

  for (const [key, aliases] of Object.entries(headerMap)) {
    const idx = headers.findIndex((h) =>
      aliases.some((alias) => String(h).includes(alias))
    );
    map[key] = idx >= 0 ? idx : 0;
  }

  return map;
}

function mapOrdersColumns(headers: any[]): Record<string, number> {
  const map: Record<string, number> = {};

  const headerMap: Record<string, string> = {
    'providerResource': ['Provider/Resource'],
    'department': ['ORD: Patient Contact Department', 'Department'],
    'visitDate': ['Visit Date'],
    'mrn': ['MRN'],
    'patient': ['Patient'],
    'coverage': ['Coverage'],
    'apptStatus': ['APPT STATUS'],
    'orderId': ['Order ID'],
    'orderDescription': ['Order Description'],
    'orderDate': ['Order Date'],
    'orderingProvider': ['Ordering Provider'],
    'referringProvider': ['Referring Prov'],
    'orderStatus': ['Order Status'],
    'status': ['Status'],
  };

  for (const [key, aliases] of Object.entries(headerMap)) {
    const idx = headers.findIndex((h) =>
      aliases.some((alias) => String(h).includes(alias))
    );
    map[key] = idx >= 0 ? idx : 0;
  }

  return map;
}

function parseExcelDate(value: any): Date {
  if (!value) return new Date();

  if (value instanceof Date) return value;

  const str = String(value).trim();
  if (!str) return new Date();

  // Excel date serial numbers
  if (!isNaN(Number(str))) {
    const excelDate = Number(str);
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    return date;
  }

  // Parse date strings
  return new Date(str);
}

function categorizeVisitType(visitType: string): string {
  const upper = visitType.toUpperCase().trim();
  return VISIT_TYPE_MAPPING[upper] || 'Other';
}

function categorizeOrder(orderDescription: string): string {
  const upper = orderDescription.toUpperCase().trim();

  for (const [key, category] of Object.entries(ORDER_CATEGORY_MAPPING)) {
    if (upper.includes(key.toUpperCase())) {
      return category;
    }
  }

  return 'Other';
}

function normalizeDepartment(department: string): string {
  return DEPARTMENT_NORMALIZATION[department] || department;
}

export function isAncillaryType(visitType: string): boolean {
  const upper = visitType.toUpperCase().trim();
  return ANCILLARY_TYPES.some((t) => upper.includes(t));
}
```

### 1.2 Create API Route for Upload

**File Path:** `app/api/statistics/upload/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/app/lib/auth';
import {
  parseOfficeVisitsReport,
  parseTestingVisitsReport,
  parseOrdersReport,
  OfficeVisitRecord,
  TestingVisitRecord,
  OrderRecord,
} from '@/app/lib/epicParser';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  // Require admin or scheduler_full role
  const authCheck = await requireRole(['super_admin', 'scheduler_full']);
  if (!authCheck.success) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const reportType = formData.get('reportType') as string;
    const reportMonth = formData.get('reportMonth') as string;
    const password = formData.get('password') as string | undefined;

    if (!file || !reportType || !reportMonth) {
      return NextResponse.json(
        { error: 'Missing required fields: file, reportType, reportMonth' },
        { status: 400 }
      );
    }

    // Validate report type
    if (!['office_visits', 'testing_visits', 'orders'].includes(reportType)) {
      return NextResponse.json(
        { error: 'Invalid reportType. Must be one of: office_visits, testing_visits, orders' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const buffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(buffer);

    // Parse based on report type
    let records: any[] = [];
    let rowCount = 0;

    if (reportType === 'office_visits') {
      records = await parseOfficeVisitsReport(fileBuffer, password);
    } else if (reportType === 'testing_visits') {
      records = await parseTestingVisitsReport(fileBuffer, password);
    } else if (reportType === 'orders') {
      records = await parseOrdersReport(fileBuffer);
    }

    rowCount = records.length;

    // Check for duplicates
    const { data: existingUpload, error: checkError } = await supabase
      .from('stat_uploads')
      .select('id, status')
      .eq('report_type', reportType)
      .eq('report_month', reportMonth)
      .single();

    if (existingUpload && existingUpload.status === 'completed') {
      return NextResponse.json(
        {
          error: 'Duplicate upload',
          message: `Data for ${reportType} in month ${reportMonth} already exists`,
          existingUploadId: existingUpload.id,
        },
        { status: 409 }
      );
    }

    // Create upload record
    const { data: uploadRecord, error: uploadError } = await supabase
      .from('stat_uploads')
      .insert({
        report_type: reportType,
        report_month: reportMonth,
        file_name: file.name,
        row_count: rowCount,
        uploaded_by: authCheck.user.id,
        status: 'processing',
      })
      .select()
      .single();

    if (uploadError || !uploadRecord) {
      return NextResponse.json(
        { error: 'Failed to create upload record' },
        { status: 500 }
      );
    }

    // Insert data based on report type
    try {
      if (reportType === 'office_visits') {
        const officeRecords = records as OfficeVisitRecord[];

        // Batch match provider IDs
        const providerMap = await matchProvidersForOfficeVisits(officeRecords);

        const officeRows = officeRecords.map((r) => ({
          upload_id: uploadRecord.id,
          report_month: reportMonth,
          start_date: r.startDate,
          end_date: r.endDate,
          visit_date: r.visitDate,
          appointment_time: r.appointmentTime,
          patient_name: r.patientName,
          mrn: r.mrn,
          appointment_status: r.appointmentStatus,
          primary_provider_name: r.primaryProviderName,
          primary_provider_id: providerMap[r.primaryProviderName] || null,
          visit_type_category: r.visitTypeCategory,
          visit_type_raw: r.visitTypeRaw,
          primary_payer: r.primaryPayer,
        }));

        const { error: insertError } = await supabase
          .from('stat_office_visits')
          .insert(officeRows);

        if (insertError) throw insertError;
      } else if (reportType === 'testing_visits') {
        const testingRows = records.map((r: TestingVisitRecord) => ({
          upload_id: uploadRecord.id,
          report_month: reportMonth,
          start_date: r.startDate,
          end_date: r.endDate,
          appointment_time: r.appointmentTime,
          patient_name: r.patientName,
          mrn: r.mrn,
          appointment_status: r.appointmentStatus,
          department: r.department,
          department_normalized: r.departmentNormalized,
          visit_type: r.visitType,
          late_cancel: r.lateCancel,
          primary_payer: r.primaryPayer,
        }));

        const { error: insertError } = await supabase
          .from('stat_testing_visits')
          .insert(testingRows);

        if (insertError) throw insertError;
      } else if (reportType === 'orders') {
        const orderRecords = records as OrderRecord[];

        const providerMap = await matchProvidersForOrders(orderRecords);

        const orderRows = orderRecords.map((r) => ({
          upload_id: uploadRecord.id,
          report_month: reportMonth,
          visit_date: r.visitDate,
          mrn: r.mrn,
          patient_name: r.patientName,
          provider_resource_name: r.providerResourceName,
          ordering_provider_name: r.orderingProviderName,
          ordering_provider_id: providerMap[r.orderingProviderName] || null,
          referring_provider_name: r.referringProviderName,
          referring_provider_id: providerMap[r.referringProviderName] || null,
          order_id: r.orderId,
          order_description: r.orderDescription,
          order_category: r.orderCategory,
          order_date: r.orderDate,
          order_status: r.orderStatus,
          appt_status: r.apptStatus,
          department: r.department,
          coverage: r.coverage,
        }));

        const { error: insertError } = await supabase
          .from('stat_orders')
          .insert(orderRows);

        if (insertError) throw insertError;
      }

      // Update upload status
      await supabase
        .from('stat_uploads')
        .update({ status: 'completed' })
        .eq('id', uploadRecord.id);

      return NextResponse.json({
        success: true,
        uploadId: uploadRecord.id,
        rowCount: rowCount,
        reportType: reportType,
        reportMonth: reportMonth,
      });
    } catch (error) {
      // Update upload status to failed
      await supabase
        .from('stat_uploads')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', uploadRecord.id);

      throw error;
    }
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      {
        error: 'Upload failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Helper: Match provider names to IDs
async function matchProvidersForOfficeVisits(
  records: OfficeVisitRecord[]
): Promise<Record<string, number>> {
  const { data: providers } = await supabase
    .from('providers')
    .select('id, name');

  const providerMap: Record<string, number> = {};

  for (const record of records) {
    const providerName = record.primaryProviderName;
    if (!providerName || providerMap[providerName] !== undefined) continue;

    // Try exact match first
    const exact = providers?.find((p) => p.name === providerName);
    if (exact) {
      providerMap[providerName] = exact.id;
      continue;
    }

    // Try fuzzy match (last name match)
    const lastNameFromEpic = providerName.split(',')[0].trim();
    const fuzzy = providers?.find((p) =>
      p.name.toUpperCase().includes(lastNameFromEpic.toUpperCase())
    );
    if (fuzzy) {
      providerMap[providerName] = fuzzy.id;
    }
  }

  return providerMap;
}

async function matchProvidersForOrders(
  records: OrderRecord[]
): Promise<Record<string, number>> {
  const { data: providers } = await supabase
    .from('providers')
    .select('id, name');

  const providerMap: Record<string, number> = {};

  for (const record of [...records]) {
    for (const providerName of [record.orderingProviderName, record.referringProviderName]) {
      if (!providerName || providerMap[providerName] !== undefined) continue;

      const exact = providers?.find((p) => p.name === providerName);
      if (exact) {
        providerMap[providerName] = exact.id;
        continue;
      }

      const nameWords = providerName.split(' ');
      const lastWord = nameWords[nameWords.length - 1];
      const fuzzy = providers?.find((p) =>
        p.name.toUpperCase().includes(lastWord.toUpperCase())
      );
      if (fuzzy) {
        providerMap[providerName] = fuzzy.id;
      }
    }
  }

  return providerMap;
}
```

### 1.3 Create Upload History API Route

**File Path:** `app/api/statistics/uploads/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/app/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const reportType = searchParams.get('reportType');

    let query = supabase
      .from('stat_uploads')
      .select('*')
      .order('uploaded_at', { ascending: false })
      .limit(50);

    if (reportType) {
      query = query.eq('report_type', reportType);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ uploads: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const uploadId = searchParams.get('id');

    if (!uploadId) {
      return NextResponse.json(
        { error: 'Missing upload ID' },
        { status: 400 }
      );
    }

    // Delete associated data and upload record (cascade handled by DB)
    const { error } = await supabase
      .from('stat_uploads')
      .delete()
      .eq('id', uploadId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

### 1.4 Build Upload UI Component

**File Path:** `app/statistics/upload/page.tsx`

```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import UploadZone from '@/app/components/statistics/UploadZone';
import UploadHistory from '@/app/components/statistics/UploadHistory';

export default function DataUploadPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'upload' | 'history'>('upload');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleUploadSuccess = () => {
    setMessage({
      type: 'success',
      text: 'Upload completed successfully!',
    });
    setTimeout(() => {
      setMessage(null);
      setActiveTab('history');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Data Upload</h1>

        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="flex gap-4 mb-6 border-b">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'upload'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600'
            }`}
          >
            Upload Files
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'history'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600'
            }`}
          >
            Upload History
          </button>
        </div>

        {activeTab === 'upload' && (
          <div className="space-y-8">
            <UploadZone
              reportType="office_visits"
              title="Office Visits Report"
              description="Encrypted Excel file with office visit data"
              onSuccess={handleUploadSuccess}
              requiresPassword={true}
            />
            <UploadZone
              reportType="testing_visits"
              title="Testing Visits Report"
              description="Encrypted Excel file with testing visit data"
              onSuccess={handleUploadSuccess}
              requiresPassword={true}
            />
            <UploadZone
              reportType="orders"
              title="Orders Report"
              description="Excel file with order data (not encrypted)"
              onSuccess={handleUploadSuccess}
              requiresPassword={false}
            />
          </div>
        )}

        {activeTab === 'history' && <UploadHistory />}
      </div>
    </div>
  );
}
```

### 1.5 Create UploadZone Component

**File Path:** `app/components/statistics/UploadZone.tsx`

```typescript
'use client';

import React, { useState, useRef } from 'react';

interface UploadZoneProps {
  reportType: 'office_visits' | 'testing_visits' | 'orders';
  title: string;
  description: string;
  onSuccess: () => void;
  requiresPassword: boolean;
}

export default function UploadZone({
  reportType,
  title,
  description,
  onSuccess,
  requiresPassword,
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [reportMonth, setReportMonth] = useState('');
  const [password, setPassword] = useState('1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith('.xlsx')) {
      setError('Please select an Excel file (.xlsx)');
      return;
    }
    setSelectedFile(file);
    setError(null);
    // Auto-detect month from filename (if it contains MMYYYY or similar)
    // For now, user must select
  };

  const handleUpload = async () => {
    if (!selectedFile || !reportMonth) {
      setError('Please select a file and enter a report month');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('reportType', reportType);
      formData.append('reportMonth', reportMonth);
      if (requiresPassword) {
        formData.append('password', password);
      }

      const response = await fetch('/api/statistics/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.status === 409) {
        const data = await response.json();
        setError(data.message + ' - Use history tab to replace or delete.');
        setLoading(false);
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      const data = await response.json();
      setPreview(data);
      setSelectedFile(null);
      setReportMonth('');
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
      <p className="text-gray-600 mb-6">{description}</p>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="text-5xl mb-4">📁</div>
        <p className="text-gray-600 mb-2">
          {selectedFile ? selectedFile.name : 'Drag and drop your file here or click to select'}
        </p>
        <p className="text-sm text-gray-500">Excel files (.xlsx) only</p>
      </div>

      {error && <div className="mt-4 p-3 bg-red-100 text-red-800 rounded">{error}</div>}

      <div className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Report Month (YYYY-MM-DD)
          </label>
          <input
            type="date"
            value={reportMonth}
            onChange={(e) => setReportMonth(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

        {requiresPassword && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password (default: "1")
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!selectedFile || !reportMonth || loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 rounded-md font-medium"
        >
          {loading ? 'Uploading...' : 'Upload & Process'}
        </button>
      </div>

      {preview && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded">
          <h3 className="font-bold text-green-800 mb-2">Upload Successful</h3>
          <p className="text-sm text-green-700">
            Processed {preview.rowCount} rows for {preview.reportMonth}
          </p>
        </div>
      )}
    </div>
  );
}
```

### 1.6 Create UploadHistory Component

**File Path:** `app/components/statistics/UploadHistory.tsx`

```typescript
'use client';

import React, { useEffect, useState } from 'react';

interface Upload {
  id: number;
  report_type: string;
  report_month: string;
  file_name: string;
  row_count: number;
  uploaded_at: string;
  status: string;
}

export default function UploadHistory() {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUploads();
  }, []);

  const fetchUploads = async () => {
    try {
      const response = await fetch('/api/statistics/uploads');
      const data = await response.json();
      setUploads(data.uploads || []);
    } catch (error) {
      console.error('Failed to fetch uploads:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this upload and all associated data?')) return;

    try {
      const response = await fetch(`/api/statistics/uploads?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setUploads(uploads.filter((u) => u.id !== id));
      }
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-100 border-b">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
              Report Type
            </th>
            <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
              Month
            </th>
            <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
              Rows
            </th>
            <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
              Uploaded
            </th>
            <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
              Status
            </th>
            <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {uploads.map((upload) => (
            <tr key={upload.id} className="border-b hover:bg-gray-50">
              <td className="px-6 py-3 text-sm">{upload.report_type}</td>
              <td className="px-6 py-3 text-sm">{upload.report_month}</td>
              <td className="px-6 py-3 text-sm">{upload.row_count.toLocaleString()}</td>
              <td className="px-6 py-3 text-sm text-gray-500">
                {new Date(upload.uploaded_at).toLocaleDateString()}
              </td>
              <td className="px-6 py-3 text-sm">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    upload.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : upload.status === 'failed'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {upload.status}
                </span>
              </td>
              <td className="px-6 py-3 text-sm">
                <button
                  onClick={() => handleDelete(upload.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {uploads.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No uploads yet. Start by uploading an Excel file above.
        </div>
      )}
    </div>
  );
}
```

### 1.7 Update Sidebar Navigation

**File Path:** `app/components/layout/Sidebar.tsx`

Replace the `comingSoon` badges for Statistics and Data items with active links.

```typescript
// In the nav items array, update:
{
  label: 'Statistics',
  href: '/statistics',
  icon: '📊',
  // Remove: comingSoon: true,
},
{
  label: 'Data',
  href: '/statistics/upload',
  icon: '📤',
  // Remove: comingSoon: true,
},
```

### 1.8 Create Placeholder Statistics Page

**File Path:** `app/statistics/page.tsx`

For now, a simple redirect or placeholder:

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function StatisticsPage() {
  const router = useRouter();

  useEffect(() => {
    // For now, redirect to upload
    // This will be replaced by the Overview page in Phase 2
    router.push('/statistics/overview');
  }, [router]);

  return <div>Loading...</div>;
}
```

---

## Phase 2: Practice Overview Dashboard

### Overview
Phase 2 builds the main statistics dashboard displaying practice-wide KPIs, visit breakdowns, testing volume, payer mix, and trends.

**Prerequisites:** Phase 1 must be completed and sample data uploaded.

### 2.1 Create Aggregation API Routes

**File Path:** `app/api/statistics/overview/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/app/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const reportMonth = searchParams.get('reportMonth');
    const comparisonMode = searchParams.get('comparisonMode') || 'vs_prior_month';

    if (!reportMonth) {
      return NextResponse.json(
        { error: 'Missing reportMonth parameter' },
        { status: 400 }
      );
    }

    // Get current period data
    const currentData = await getOfficeVisitStats(reportMonth);
    const testingData = await getTestingVolumeStats(reportMonth);
    const orderData = await getOrderStats(reportMonth);

    // Get comparison period data
    let comparisonData = null;
    const comparisonMonth = getComparisonMonth(reportMonth, comparisonMode);
    if (comparisonMonth) {
      comparisonData = await getOfficeVisitStats(comparisonMonth);
    }

    return NextResponse.json({
      current: {
        ...currentData,
        testing: testingData,
        orders: orderData,
      },
      comparison: comparisonData,
      reportMonth,
      comparisonMonth,
      comparisonMode,
    });
  } catch (error) {
    console.error('Overview API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function getOfficeVisitStats(month: string) {
  // Get all office visits for month
  const { data: visits } = await supabase
    .from('stat_office_visits')
    .select('*')
    .eq('report_month', month);

  if (!visits || visits.length === 0) {
    return null;
  }

  // Calculate KPIs
  const totalScheduled = visits.length;
  const arrived = visits.filter((v) => v.appointment_status === 'Arrived').length;
  const completed = visits.filter((v) => v.appointment_status === 'Completed').length;
  const patientsSeen = arrived + completed;
  const noShows = visits.filter((v) => v.appointment_status === 'No Show').length;
  const noShowRate =
    patientsSeen + noShows > 0 ? ((noShows / (patientsSeen + noShows)) * 100).toFixed(2) : '0.00';

  // Visit type breakdown
  const visitBreakdown = categorizeVisits(visits);

  // New patient stats
  const newPatients = visitBreakdown['New Patient'] || { total: 0, seen: 0 };
  const newPatientPct = patientsSeen > 0 ? ((newPatients.seen / patientsSeen) * 100).toFixed(1) : '0.0';

  return {
    totalScheduled,
    patientsSeen,
    noShows,
    noShowRate: parseFloat(noShowRate),
    newPatients: newPatients.seen,
    newPatientPct: parseFloat(newPatientPct),
    visitBreakdown,
    allVisits: visits,
  };
}

async function getTestingVolumeStats(month: string) {
  const { data: testing } = await supabase
    .from('stat_testing_visits')
    .select('*')
    .eq('report_month', month);

  if (!testing || testing.length === 0) {
    return null;
  }

  // Group by department
  const byDepartment: Record<string, any> = {};

  for (const test of testing) {
    const dept = test.department_normalized || test.department;
    if (!byDepartment[dept]) {
      byDepartment[dept] = {
        total: 0,
        completed: 0,
        arrived: 0,
        noShows: 0,
        lateCancels: 0,
      };
    }

    byDepartment[dept].total++;
    if (test.appointment_status === 'Completed') byDepartment[dept].completed++;
    if (test.appointment_status === 'Arrived') byDepartment[dept].arrived++;
    if (test.appointment_status === 'No Show') byDepartment[dept].noShows++;
    if (test.late_cancel === 1) byDepartment[dept].lateCancels++;
  }

  return byDepartment;
}

async function getOrderStats(month: string) {
  const { data: orders } = await supabase
    .from('stat_orders')
    .select('*')
    .eq('report_month', month);

  if (!orders || orders.length === 0) {
    return null;
  }

  // Group by category
  const byCategory: Record<string, number> = {};

  for (const order of orders) {
    const category = order.order_category || 'Other';
    byCategory[category] = (byCategory[category] || 0) + 1;
  }

  return byCategory;
}

function categorizeVisits(
  visits: any[]
): Record<string, { total: number; seen: number }> {
  const categories: Record<string, { total: number; seen: number }> = {
    'New Patient': { total: 0, seen: 0 },
    'Follow Up': { total: 0, seen: 0 },
    Leqvio: { total: 0, seen: 0 },
    Research: { total: 0, seen: 0 },
    'Video Visit': { total: 0, seen: 0 },
    'Annual Well Visit': { total: 0, seen: 0 },
    Ancillary: { total: 0, seen: 0 },
  };

  for (const visit of visits) {
    const category = visit.visit_type_category || 'Other';
    if (categories[category]) {
      categories[category].total++;
      if (['Arrived', 'Completed'].includes(visit.appointment_status)) {
        categories[category].seen++;
      }
    }
  }

  return categories;
}

function getComparisonMonth(month: string, mode: string): string | null {
  const date = new Date(month);

  if (mode === 'vs_prior_month') {
    date.setMonth(date.getMonth() - 1);
  } else if (mode === 'vs_same_year_ago') {
    date.setFullYear(date.getFullYear() - 1);
  }

  return date.toISOString().split('T')[0];
}
```

### 2.2 Create Payer Mix API Route

**File Path:** `app/api/statistics/payer-mix/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/app/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const reportMonth = searchParams.get('reportMonth');
    const department = searchParams.get('department');
    const visitType = searchParams.get('visitType');

    if (!reportMonth) {
      return NextResponse.json(
        { error: 'Missing reportMonth' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('stat_office_visits')
      .select('primary_payer')
      .eq('report_month', reportMonth)
      .in('appointment_status', ['Arrived', 'Completed']);

    if (visitType) {
      query = query.eq('visit_type_category', visitType);
    }

    const { data } = await query;

    if (!data) {
      return NextResponse.json({ distribution: {} });
    }

    // Count payer distribution
    const distribution: Record<string, number> = {};
    for (const row of data) {
      const payer = row.primary_payer || 'Unknown';
      distribution[payer] = (distribution[payer] || 0) + 1;
    }

    // Calculate percentages
    const total = Object.values(distribution).reduce((a, b) => a + b, 0);
    const percentages: Record<string, number> = {};
    for (const [payer, count] of Object.entries(distribution)) {
      percentages[payer] = total > 0 ? (count / total) * 100 : 0;
    }

    return NextResponse.json({
      distribution,
      percentages,
      total,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

### 2.3 Create Trends API Route

**File Path:** `app/api/statistics/trends/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/app/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const months = parseInt(searchParams.get('months') || '12');

    // Get data for last N months
    const { data: allVisits } = await supabase
      .from('stat_office_visits')
      .select('report_month, appointment_status')
      .order('report_month', { ascending: true });

    if (!allVisits) {
      return NextResponse.json({ trends: [] });
    }

    // Group by month
    const byMonth: Record<string, any> = {};

    for (const visit of allVisits) {
      const month = visit.report_month;
      if (!byMonth[month]) {
        byMonth[month] = {
          month,
          total: 0,
          seen: 0,
        };
      }

      byMonth[month].total++;
      if (['Arrived', 'Completed'].includes(visit.appointment_status)) {
        byMonth[month].seen++;
      }
    }

    const trends = Object.values(byMonth)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-months);

    return NextResponse.json({ trends });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

### 2.4 Install Recharts

```bash
npm install recharts
```

### 2.5 Create Overview Page Component

**File Path:** `app/statistics/overview/page.tsx`

```typescript
'use client';

import React, { useState, useEffect } from 'react';
import KPICard from '@/app/components/statistics/KPICard';
import VisitBreakdownTable from '@/app/components/statistics/VisitBreakdownTable';
import TestingVolumeSummary from '@/app/components/statistics/TestingVolumeSummary';
import PayerMixChart from '@/app/components/statistics/PayerMixChart';
import TrendChart from '@/app/components/statistics/TrendChart';

export default function OverviewPage() {
  const [reportMonth, setReportMonth] = useState(getDefaultMonth());
  const [comparisonMode, setComparisonMode] = useState('vs_prior_month');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOverviewData();
  }, [reportMonth, comparisonMode]);

  const fetchOverviewData = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/statistics/overview?reportMonth=${reportMonth}&comparisonMode=${comparisonMode}`
      );
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch overview:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (!data?.current) {
    return (
      <div className="p-8">
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded text-yellow-800">
          No data available for selected month. Please upload Epic reports first.
        </div>
      </div>
    );
  }

  const current = data.current;
  const comparison = data.comparison;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Practice Overview</h1>

        {/* Time Filters */}
        <div className="mb-8 flex gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Report Month
            </label>
            <input
              type="date"
              value={reportMonth}
              onChange={(e) => setReportMonth(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comparison Mode
            </label>
            <select
              value={comparisonMode}
              onChange={(e) => setComparisonMode(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="vs_prior_month">vs Previous Month</option>
              <option value="vs_same_year_ago">vs Same Month Last Year</option>
            </select>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <KPICard
            title="Total Patients Seen"
            value={current.patientsSeen}
            comparison={comparison ? current.patientsSeen - comparison.patientsSeen : null}
          />
          <KPICard
            title="New Patients"
            value={current.newPatients}
            subtitle={`${current.newPatientPct}% of total`}
            comparison={comparison ? current.newPatients - comparison.newPatients : null}
          />
          <KPICard
            title="No Show Rate"
            value={`${current.noShowRate}%`}
            comparison={comparison ? comparison.noShowRate - current.noShowRate : null}
            isPercentage
          />
        </div>

        {/* Testing Department KPIs */}
        {current.testing && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Department Volume</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(current.testing).map(([dept, stats]: [string, any]) => (
                <KPICard
                  key={dept}
                  title={dept}
                  value={stats.completed + stats.arrived}
                  subtitle="Patients Seen"
                  comparison={
                    comparison?.testing && comparison.testing[dept]
                      ? stats.completed +
                        stats.arrived -
                        (comparison.testing[dept].completed +
                          comparison.testing[dept].arrived)
                      : null
                  }
                />
              ))}
            </div>
          </div>
        )}

        {/* Office Visit Breakdown */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Office Visit Breakdown</h2>
          <VisitBreakdownTable
            current={current.visitBreakdown}
            comparison={comparison?.visitBreakdown}
          />
        </div>

        {/* Testing Volume Summary */}
        {current.testing && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Testing Volume by Department</h2>
            <TestingVolumeSummary data={current.testing} />
          </div>
        )}

        {/* Payer Mix */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Insurance/Payer Mix</h2>
          <PayerMixChart month={reportMonth} />
        </div>

        {/* Trends */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Monthly Trends</h2>
          <TrendChart />
        </div>
      </div>
    </div>
  );
}

function getDefaultMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}
```

### 2.6 Create KPICard Component

**File Path:** `app/components/statistics/KPICard.tsx`

```typescript
interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  comparison?: number | null;
  isPercentage?: boolean;
}

export default function KPICard({
  title,
  value,
  subtitle,
  comparison,
  isPercentage,
}: KPICardProps) {
  const isPositive = comparison === null ? false : comparison >= 0;
  const arrow = comparison === null ? '' : isPositive ? '↑' : '↓';

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-gray-600 text-sm font-medium mb-2">{title}</h3>
      <div className="flex items-baseline justify-between">
        <div className="text-3xl font-bold text-gray-900">{value}</div>
        {comparison !== null && comparison !== 0 && (
          <div
            className={`text-sm font-medium ${
              isPositive ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {arrow} {Math.abs(comparison)}
            {isPercentage ? 'pp' : ''}
          </div>
        )}
      </div>
      {subtitle && <p className="text-gray-500 text-sm mt-2">{subtitle}</p>}
    </div>
  );
}
```

### 2.7 Create VisitBreakdownTable Component

**File Path:** `app/components/statistics/VisitBreakdownTable.tsx`

```typescript
'use client';

import React, { useState } from 'react';

interface BreakdownProps {
  current: Record<string, { total: number; seen: number }>;
  comparison?: Record<string, { total: number; seen: number }>;
}

export default function VisitBreakdownTable({ current, comparison }: BreakdownProps) {
  const [expandedAncillary, setExpandedAncillary] = useState(false);

  const rows = Object.entries(current)
    .filter(([cat]) => cat !== 'Ancillary')
    .map(([category, stats]) => ({
      category,
      current: stats.seen,
      comparison: comparison ? comparison[category]?.seen || 0 : 0,
    }));

  const ancillaryRow = current['Ancillary'];

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-100 border-b">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
              Visit Type
            </th>
            <th className="px-6 py-3 text-right text-sm font-medium text-gray-700">
              Current Period
            </th>
            {comparison && (
              <>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-700">
                  Comparison
                </th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-700">
                  Change
                </th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const change = row.current - row.comparison;
            const pctChange =
              row.comparison > 0
                ? (((row.current - row.comparison) / row.comparison) * 100).toFixed(1)
                : '—';

            return (
              <tr key={row.category} className="border-b hover:bg-gray-50">
                <td className="px-6 py-3 text-sm font-medium text-gray-900">
                  {row.category}
                </td>
                <td className="px-6 py-3 text-right text-sm text-gray-900">
                  {row.current}
                </td>
                {comparison && (
                  <>
                    <td className="px-6 py-3 text-right text-sm text-gray-600">
                      {row.comparison}
                    </td>
                    <td
                      className={`px-6 py-3 text-right text-sm font-medium ${
                        change >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {change > 0 ? '+' : ''}
                      {change} ({pctChange}%)
                    </td>
                  </>
                )}
              </tr>
            );
          })}

          {/* Ancillary Row (Expandable) */}
          {ancillaryRow && (
            <tr className="bg-blue-50 border-b">
              <td className="px-6 py-3 text-sm font-medium text-gray-900">
                <button
                  onClick={() => setExpandedAncillary(!expandedAncillary)}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
                >
                  {expandedAncillary ? '▼' : '▶'} Ancillary
                </button>
              </td>
              <td className="px-6 py-3 text-right text-sm text-gray-900">
                {ancillaryRow.seen}
              </td>
            </tr>
          )}

          {expandedAncillary && (
            <>
              <tr className="bg-blue-25">
                <td className="px-6 py-3 pl-12 text-sm text-gray-700">
                  • Device Check
                </td>
                <td className="px-6 py-3 text-right text-sm text-gray-600">—</td>
              </tr>
              <tr className="bg-blue-25">
                <td className="px-6 py-3 pl-12 text-sm text-gray-700">
                  • EKG
                </td>
                <td className="px-6 py-3 text-right text-sm text-gray-600">—</td>
              </tr>
              <tr className="bg-blue-25">
                <td className="px-6 py-3 pl-12 text-sm text-gray-700">
                  • Blood Draw
                </td>
                <td className="px-6 py-3 text-right text-sm text-gray-600">—</td>
              </tr>
              <tr className="bg-blue-25">
                <td className="px-6 py-3 pl-12 text-sm text-gray-700">
                  • Event Monitor
                </td>
                <td className="px-6 py-3 text-right text-sm text-gray-600">—</td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

(Due to token limits, I'm continuing the Phase 2 components and will then provide Phase 3 and 4 summaries in the next part...)

---

## Phase 3: Provider Scorecard (Summary)

**File Path References:**
- `app/statistics/providers/page.tsx` — Main provider scorecard UI with provider dropdown and single/comparison modes
- `app/api/statistics/provider/[id]/route.ts` — Single provider KPI data
- `app/api/statistics/providers/comparison/route.ts` — All providers comparison table data
- `app/api/statistics/provider/[id]/orders/route.ts` — Provider's orders by category
- `app/api/statistics/provider/[id]/referrals/route.ts` — Provider referral counts on completed studies
- `app/components/statistics/ProviderScorecard.tsx` — Single provider deep-dive component
- `app/components/statistics/ProviderComparisonTable.tsx` — Sortable/color-coded comparison table

**Key Implementation Points:**
- Filter to internal providers only (match against `providers` table)
- Count "sessions" from `schedule_assignments` table (unique days with clinical assignment)
- Show Orders section grouped by category with expandable drill-down
- Show Referrals section: count studies where provider is referring_provider
- Color coding: green for above-average metrics, red for below-average

---

## Phase 4: Testing Analytics (Summary)

**File Path References:**
- `app/statistics/testing/page.tsx` — Main testing analytics page
- `app/api/statistics/testing/overview/route.ts` — Testing KPIs by department
- `app/api/statistics/testing/department/[dept]/route.ts` — Single department detail
- `app/api/statistics/testing/orders-by-department/route.ts` — Who ordered tests for each department
- `app/api/statistics/testing/referrals-by-department/route.ts` — Who referred completed tests
- `app/components/statistics/TestingDetailTable.tsx` — Department detail with orders/referrals grouped

**Key Implementation Points:**
- Show total tests completed per department with comparison
- Orders Into Department section: internal providers listed, "Outside Providers" as expandable row
- Referrals on Completed Studies section: similar grouping
- Tables show counts and percentages (e.g., "Nuclear: 12 of 50 (24%)")

---

## Implementation Timeline

**Estimated Duration:** 3-4 weeks full-time development

- **Phase 1:** 4-5 days (file parsing, upload infrastructure, database setup)
- **Phase 2:** 5-6 days (KPI calculations, visualizations, dashboard UI)
- **Phase 3:** 5-6 days (provider queries, comparison logic, scorecards)
- **Phase 4:** 4-5 days (testing aggregations, department grouping, expand/collapse)
- **Testing & Refinement:** 2-3 days (edge cases, performance tuning, UI polish)

**Recommended Order:**
1. Start Phase 1 immediately
2. Begin Phase 2 once Phase 1 DB tables exist (before upload UI is complete)
3. Phase 3 and 4 can proceed in parallel once Phase 1 data is available

---

## Technical Considerations

### File Encryption
The `xlsx` npm package supports encrypted workbooks via the `password` option. If issues arise:
- Alternative: Use a Node.js library like `node-xlsx-crypto` for decryption
- Ensure password is sent securely (HTTPS only, httpOnly cookies for session auth)

### Large File Performance
- Office Visits: 160K+ rows
- Testing Visits: 93K+ rows
- **Optimization strategies:**
  - Use Supabase's batch insert with chunking (5K rows per batch)
  - Index heavily on report_month, provider_id, department
  - Consider materialized views for frequently-accessed aggregations
  - Implement pagination in tables (show 20-50 rows per page)

### Provider Name Matching
- **Office Visits:** "LASTNAME, FIRSTNAME" format
- **Orders:** "FirstName LastName [ID]" format
- **Providers Table:** "Full Name" format
- Implement fuzzy matching fallback (last name similarity) to handle variations

### Session Definition
From `schedule_assignments` table:
- A session = a unique date where provider has assignment to "Rooms AM", "Rooms PM", or patient-seeing service
- Count distinct dates per provider per month

### Color Scheme Integration
Ensure consistent use of:
- Primary Blue: `#003D7A` (primary buttons, accents)
- Light Blue: `#0078C8` (secondary actions)
- Teal: `#00A3AD` (positive indicators)
- Light Gray: `#F5F5F5` (backgrounds)
- Use Tailwind's `bg-blue-600`, `text-blue-600`, etc. for primary colors

### Security & RBAC
- Views: `viewer` role and above
- Uploads: `super_admin` and `scheduler_full` only
- All data queries filtered by auth.users(id) implicitly (practice-wide data shared with all users)
- Use Supabase RLS (Row Level Security) policies if multi-practice support needed later

### Testing Considerations
- Create fixture data: 100-200 sample office/testing visit rows for unit testing
- Mock Supabase responses in component tests
- Test edge cases: empty months, zero no-shows, single provider practice, etc.
- Performance test with realistic data volumes (10K+ rows)

