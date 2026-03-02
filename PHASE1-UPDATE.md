# Phase 1 Update: 5-Report Structure

## Overview

Phase 1 needs to be rebuilt to support **5 report types** instead of 3. The data model has changed based on how Epic reports are actually structured.

### The 5 Reports

| # | Report Type Key | Description | Source of Truth For | Encrypted | Rows |
|---|----------------|-------------|---------------------|-----------|------|
| 1 | `office_completed` | Office Visits - Completed (Billing/Transactions) | Patient volume counts | Yes (pw: "1") | ~90K |
| 2 | `office_all_statuses` | Office Visits - All Appointment Statuses | No-show rate, late cancel rate | Yes (pw: "1") | ~165K |
| 3 | `testing_completed` | Testing Visits - Completed (Billing/Transactions) | Testing volume counts | Yes (pw: "1") | ~52K |
| 4 | `testing_all_statuses` | Testing Visits - All Appointment Statuses | Testing no-show rate, late cancel rate | Yes (pw: "1") | ~99K |
| 5 | `orders` | Orders (1000 10th) | Orders placed, referring providers | NOT encrypted | ~4K |

### How They're Used

- **Completed reports** = billing source of truth. Use these for all patient volume counts (how many patients seen, visit type breakdowns, payer mix).
- **All statuses reports** = used to calculate no-show rate, late cancellation rate, and cancellation rate. The completed visits in these should roughly match the completed reports as a validation check.
- **Orders report** = unchanged from original spec.

---

## Column Structures (Exact)

### 1. Office Completed (`office_completed`)
- 9 metadata header rows (rows 0-8), data starts row 9 (row 10 in header=9)
- **9 columns:**
  - `Start Date` (date)
  - `End Date` (date)
  - `Slices by Primary Provider` (string, format: "LASTNAME, FIRSTNAME")
  - `Slices by Visit Type` (string)
  - `Visit Date` (date)
  - `Appointment Time` (time)
  - `Patient Name` (string)
  - `Patient MRN` (string)
  - `Primary Payer` (string — specific insurer name like "MEDICARE", "AETNA COMMERCIAL")
- **NO Appointment Status column** (all rows are completed by definition)
- **NO Late Cancel column**
- **NO Primary Payer Financial Class** (just Primary Payer)

### 2. Office All Statuses (`office_all_statuses`)
- 9 metadata header rows, data starts row 9
- **11 columns:**
  - `Start Date` (date)
  - `End Date` (date)
  - `Slices by Primary Provider` (string, format: "LASTNAME, FIRSTNAME")
  - `Slices by Visit Type` (string)
  - `Visit Date` (date)
  - `Appointment Time` (time)
  - `Patient Name` (string)
  - `Patient MRN` (string)
  - `Late Cancel?` (integer: 0 or 1)
  - `Appointment Status` (string: Arrived, Canceled, Completed, Left without seen, No Show, Rescheduled, Scheduled)
  - `Primary Payer` (string)

### 3. Testing Completed (`testing_completed`)
- 9 metadata header rows, data starts row 9
- **10 columns:**
  - `Start Date` (date)
  - `End Date` (date)
  - `Slices by Department` (string — department name)
  - `Slices by Visit Type` (string)
  - `Visit Date` (date)
  - `Appointment Time` (time)
  - `Patient Name` (string)
  - `Appointment Primary Resource` (string — e.g., "ECHO 1", "STRESS ROOM", "VASCULAR ULTRASOUND")
  - `Patient MRN` (string)
  - `Primary Payer` (string)
- **NO Appointment Status column** (all rows are completed)
- **NO Late Cancel column**

### 4. Testing All Statuses (`testing_all_statuses`)
- 9 metadata header rows, data starts row 9
- **12 columns:**
  - `Start Date` (date)
  - `End Date` (date)
  - `Slices by Department` (string)
  - `Slices by Visit Type` (string)
  - `Visit Date` (date)
  - `Appointment Time` (time)
  - `Patient Name` (string)
  - `Patient MRN` (string)
  - `Appointment Status` (string: Arrived, Canceled, Completed, Confirmed, Left without seen, No Show, Pending, Rescheduled, Scheduled)
  - `Primary Payer` (string)
  - `Late Cancel?` (integer: 0 or 1)
  - `Appointment Primary Resource` (string)

### 5. Orders (`orders`)
- **NO metadata headers** — column names are in row 0
- **NOT encrypted**
- **16 columns:** (unchanged from original spec)
  - `Provider/Resource`, `ORD: Patient Contact Department`, `Visit Date`, `MRN`, `Patient`, `Coverage`, `APPT STATUS`, `Order ID`, `Order Description`, `Order Date`, `Ordering Provider`, `Referring Prov`, `Order Status`, `Status`, `Date of Scheduling`, `Appt Date`

---

## Database Changes

### Update `stat_uploads` table
Change the `report_type` CHECK constraint to allow 5 types:
```sql
ALTER TABLE stat_uploads DROP CONSTRAINT IF EXISTS stat_uploads_report_type_check;
ALTER TABLE stat_uploads ADD CONSTRAINT stat_uploads_report_type_check
  CHECK (report_type IN ('office_completed', 'office_all_statuses', 'testing_completed', 'testing_all_statuses', 'orders'));
```

Also update the UNIQUE constraint — it should be on `(report_type, report_month)`.

### Update `stat_office_visits` table
Add a `source_type` column to distinguish between completed and all-status records:
```sql
ALTER TABLE stat_office_visits ADD COLUMN source_type VARCHAR(20) NOT NULL DEFAULT 'completed';
-- Values: 'completed' or 'all_statuses'
```

The table needs to handle BOTH completed and all-status office visit data. For completed records, `appointment_status` will be NULL (not present in file). For all-status records, it will have the status value.

Add `late_cancel` column:
```sql
ALTER TABLE stat_office_visits ADD COLUMN late_cancel SMALLINT DEFAULT 0;
```

### Update `stat_testing_visits` table
Add `source_type` column:
```sql
ALTER TABLE stat_testing_visits ADD COLUMN source_type VARCHAR(20) NOT NULL DEFAULT 'completed';
```

Add `resource` column (for Appointment Primary Resource):
```sql
ALTER TABLE stat_testing_visits ADD COLUMN resource VARCHAR(255);
```

Ensure `late_cancel` column exists (should already from original schema).

### No changes to `stat_orders` table

---

## Visit Type Categorizations

### Office Visit Categories
```
NEW_PATIENT: ['NEW PATIENT', 'NEW PT-COVID19 SCREENING']
FOLLOW_UP: ['FOLLOW UP', 'FOLLOW UP EXTENDED', 'MEDICAL FOLLOW UP', 'DISCHARGE FOLLOW UP']
VIDEO_VISIT: ['VIDEO VISIT - FOLLOW UP', 'VIDEO VISIT - NEW PATIENT', 'TELEPHONE VISIT POST OP', 'TELEPHONE VISIT-ESTABLISHED PATIENT', 'TELEHEALTH COVID-19 FOLLOW UP', 'MYCHART ONDEMAND VISIT 1']
LEQVIO: ['LEQVIO VISIT']
RESEARCH: ['RESEARCH']
ANNUAL_WELL_VISIT: ['ANNUAL WELL VISIT ESTABLISHED']
ANCILLARY: ['DEVICE CHECK', 'EKG', 'BLOOD DRAW', 'EVENT MONITOR']
EXCLUDED: ['LAB ONLY', 'ES MS MYC OPEN', 'ECHOCARDIOGRAM LIMITED', 'None of the above', 'TTVR']
```

### Testing Department Normalization
```
'1000 10TH AVE CVI CARDIOLOGY ECHO' → 'Echo'
'1000 10TH ECHO' → 'Echo'  (combine with above)
'1000 10TH AVE CVI CARDIOLOGY VASCULAR' → 'Vascular'
'1000 10TH AVE CVI CARDIOLOGY NUCLEAR' → 'Nuclear'
'1000 10TH AVE EP' → 'EP'
'MSW 1000 10TH AVE CARDIOLOGY CT' → 'CT'
'1000 10TH AVE CVI CARDIO VEIN' → 'Cardio Vein'
'None of the above' → 'Other'
```

---

## Upload UI Design

### 5 upload zones organized in 3 groups:

**Group 1: Office Visits**
Two side-by-side upload zones:
- Left: "Completed (Billing)" — `office_completed`
- Right: "All Statuses" — `office_all_statuses`

**Group 2: Testing Visits**
Two side-by-side upload zones:
- Left: "Completed (Billing)" — `testing_completed`
- Right: "All Statuses" — `testing_all_statuses`

**Group 3: Orders**
Single upload zone:
- "Orders (1000 10th)" — `orders`

Each zone shows: file name after selection, detected row count, detected date range.

A single month picker at the top applies to all uploads.

"Upload All" button processes all selected files.

---

## Calculation Logic Reference

### From Completed Reports (source of truth for volume):
- **Total Patients Seen** = count of rows in `office_completed` for the month
- **Visit Type Breakdown** = group by `visit_type_category` from `office_completed`
- **Testing Volume by Department** = group by `department_normalized` from `testing_completed`
- **Payer Mix** = group by `primary_payer` from completed reports

### From All-Status Reports (for rates):
- **No Show Rate** = No Shows / (Completed + Arrived + No Shows) from `office_all_statuses`
- **Late Cancel Rate** = rows where `late_cancel = 1` / total rows from `office_all_statuses`
- **Cancellation Rate** = Canceled / total from `office_all_statuses`
- Same calculations for testing using `testing_all_statuses`

### Validation Check:
- Count of completed rows in `office_all_statuses` should ≈ count of rows in `office_completed`
- Count of completed rows in `testing_all_statuses` should ≈ count of rows in `testing_completed`
- Show a warning in the UI if these differ by more than 5%

---

## Sample Data Files

Located in `sample-data/` directory:
- `office-completed.xlsx` — Office Completed (Billing), encrypted, pw "1"
- `office-all-statuses.xlsx` — Office All Statuses, encrypted, pw "1"
- `testing-completed.xlsx` — Testing Completed (Billing), encrypted, pw "1"
- `testing-all-statuses.xlsx` — Testing All Statuses, encrypted, pw "1"
- `orders.xlsx` — Orders, NOT encrypted
