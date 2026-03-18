import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireRole, isAuthError } from '@/lib/auth';
import {
  parseStatOfficeCompleted,
  parseStatOfficeAllStatuses,
  parseStatTestingCompleted,
  parseStatTestingAllStatuses,
  parseStatOrders,
  StatOfficeVisitRecord,
  StatTestingVisitRecord,
  StatOrderRecord,
} from '@/lib/epicParser';

const BATCH_SIZE = 500;

type StatReportType =
  | 'office_completed'
  | 'office_all_statuses'
  | 'testing_completed'
  | 'testing_all_statuses'
  | 'orders';

const VALID_REPORT_TYPES: StatReportType[] = [
  'office_completed',
  'office_all_statuses',
  'testing_completed',
  'testing_all_statuses',
  'orders',
];

// POST /api/statistics/upload - Upload and parse an Epic report
export async function POST(request: NextRequest) {
  try {
    // Auth check - try to get user, fall back to anonymous for dev
    const authResult = await requireRole(request, 'super_admin', 'scheduler_full');
    let userId = 'anonymous';
    if (!isAuthError(authResult)) {
      userId = authResult.id;
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const reportType = formData.get('reportType') as string;

    if (!file || !reportType) {
      return NextResponse.json(
        { error: 'Missing required fields: file, reportType' },
        { status: 400 }
      );
    }

    if (!VALID_REPORT_TYPES.includes(reportType as StatReportType)) {
      return NextResponse.json(
        { error: `Invalid reportType. Must be one of: ${VALID_REPORT_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    if (!file.name.endsWith('.xlsx')) {
      return NextResponse.json(
        { error: 'File must be an Excel file (.xlsx)' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse based on report type FIRST (we need the records to determine month range)
    if (reportType === 'office_completed') {
      const result = await parseStatOfficeCompleted(buffer);
      await deleteOverlappingMonths(reportType, 'stat_office_visits', result.records);
      const uploadRecord = await createUploadRecord(
        reportType, result.reportMonth, file.name, result.rowCount, userId
      );
      const providerMap = await buildProviderMap();
      await insertOfficeVisits(uploadRecord.id, result.records, providerMap, 'completed');
      await markUploadComplete(uploadRecord.id);
      return NextResponse.json({
        success: true, uploadId: uploadRecord.id,
        rowCount: result.rowCount, reportType, reportMonth: result.reportMonth,
      });

    } else if (reportType === 'office_all_statuses') {
      const result = await parseStatOfficeAllStatuses(buffer);
      await deleteOverlappingMonths(reportType, 'stat_office_visits', result.records);
      const uploadRecord = await createUploadRecord(
        reportType, result.reportMonth, file.name, result.rowCount, userId
      );
      const providerMap = await buildProviderMap();
      await insertOfficeVisits(uploadRecord.id, result.records, providerMap, 'all_statuses');
      await markUploadComplete(uploadRecord.id);
      return NextResponse.json({
        success: true, uploadId: uploadRecord.id,
        rowCount: result.rowCount, reportType, reportMonth: result.reportMonth,
      });

    } else if (reportType === 'testing_completed') {
      const result = await parseStatTestingCompleted(buffer);
      await deleteOverlappingMonths(reportType, 'stat_testing_visits', result.records);
      const uploadRecord = await createUploadRecord(
        reportType, result.reportMonth, file.name, result.rowCount, userId
      );
      await insertTestingVisits(uploadRecord.id, result.records, 'completed');
      await markUploadComplete(uploadRecord.id);
      return NextResponse.json({
        success: true, uploadId: uploadRecord.id,
        rowCount: result.rowCount, reportType, reportMonth: result.reportMonth,
      });

    } else if (reportType === 'testing_all_statuses') {
      const result = await parseStatTestingAllStatuses(buffer);
      await deleteOverlappingMonths(reportType, 'stat_testing_visits', result.records);
      const uploadRecord = await createUploadRecord(
        reportType, result.reportMonth, file.name, result.rowCount, userId
      );
      await insertTestingVisits(uploadRecord.id, result.records, 'all_statuses');
      await markUploadComplete(uploadRecord.id);
      return NextResponse.json({
        success: true, uploadId: uploadRecord.id,
        rowCount: result.rowCount, reportType, reportMonth: result.reportMonth,
      });

    } else {
      // orders
      const result = parseStatOrders(arrayBuffer);
      await deleteOverlappingMonths(reportType, 'stat_orders', result.records);
      const uploadRecord = await createUploadRecord(
        reportType, result.reportMonth, file.name, result.rowCount, userId
      );
      const providerMap = await buildProviderMap();
      await insertOrders(uploadRecord.id, result.reportMonth, result.records, providerMap);
      await markUploadComplete(uploadRecord.id);
      return NextResponse.json({
        success: true, uploadId: uploadRecord.id,
        rowCount: result.rowCount, reportType, reportMonth: result.reportMonth,
      });
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

// ── Helpers ──

type RecordWithVisitDate = { visitDate?: string | null; startDate?: string | null; orderDate?: string | null };

/**
 * When re-uploading a report type, delete only the rows from existing uploads
 * that fall within the month range covered by the new file. Months not present
 * in the new file are preserved. Also cleans up any failed uploads for the type.
 */
async function deleteOverlappingMonths(
  reportType: string,
  table: 'stat_office_visits' | 'stat_testing_visits' | 'stat_orders',
  records: RecordWithVisitDate[]
) {
  // Determine unique months in the new file
  const monthSet = new Set<string>();
  for (const r of records) {
    const dateStr = r.visitDate || r.startDate || r.orderDate;
    if (dateStr && dateStr.length >= 7) {
      monthSet.add(dateStr.substring(0, 7) + '-01');
    }
  }

  if (monthSet.size === 0) return;

  const months = Array.from(monthSet);

  // Find all existing completed uploads for this report type
  const { data: existingUploads } = await supabase
    .from('stat_uploads')
    .select('id')
    .eq('report_type', reportType)
    .eq('status', 'completed');

  if (existingUploads && existingUploads.length > 0) {
    const existingIds = existingUploads.map((u: { id: number }) => u.id);

    // Delete rows from the overlapping months only
    await supabase
      .from(table)
      .delete()
      .in('upload_id', existingIds)
      .in('report_month', months);
  }

  // Clean up any failed uploads for this type
  await supabase.from('stat_uploads').delete().eq('report_type', reportType).eq('status', 'failed');
}

async function createUploadRecord(
  reportType: string,
  reportMonth: string,
  fileName: string,
  rowCount: number,
  userId: string
) {
  const { data, error } = await supabase
    .from('stat_uploads')
    .insert({
      report_type: reportType,
      report_month: reportMonth,
      file_name: fileName,
      row_count: rowCount,
      uploaded_by: userId,
      status: 'processing',
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create upload record: ${error?.message}`);
  }
  return data;
}

async function markUploadComplete(uploadId: number) {
  await supabase
    .from('stat_uploads')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', uploadId);
}

async function buildProviderMap(): Promise<Record<string, string>> {
  const { data: providers } = await supabase
    .from('providers')
    .select('id, name');

  if (!providers) return {};

  const map: Record<string, string> = {};
  for (const p of providers) {
    map[p.name.toUpperCase()] = p.id;
  }
  return map;
}

function matchProviderByName(
  epicName: string,
  providerMap: Record<string, string>
): string | null {
  if (!epicName) return null;

  const nameClean = epicName.replace(/\s*\[.*?\]\s*$/, '').trim();
  const upper = nameClean.toUpperCase();

  if (providerMap[upper] !== undefined) return providerMap[upper];

  if (upper.includes(',')) {
    const [last, firstPart] = upper.split(',').map(s => s.trim());
    const first = firstPart.split(/\s+/)[0];

    for (const [dbName, id] of Object.entries(providerMap)) {
      const dbUpper = dbName.toUpperCase();
      if (dbUpper.includes(last) && dbUpper.includes(first)) {
        return id;
      }
    }
  }

  const nameParts = upper.split(/\s+/);
  if (nameParts.length >= 2) {
    const last = nameParts[nameParts.length - 1];
    const first = nameParts[0];

    for (const [dbName, id] of Object.entries(providerMap)) {
      const dbUpper = dbName.toUpperCase();
      if (dbUpper.includes(last) && dbUpper.includes(first)) {
        return id;
      }
    }
  }

  return null;
}

async function insertOfficeVisits(
  uploadId: number,
  records: StatOfficeVisitRecord[],
  providerMap: Record<string, string>,
  sourceType: 'completed' | 'all_statuses'
) {
  const providerCache: Record<string, string | null> = {};

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const rows = batch.map((r) => {
      if (providerCache[r.primaryProviderName] === undefined) {
        providerCache[r.primaryProviderName] = matchProviderByName(r.primaryProviderName, providerMap);
      }

      return {
        upload_id: uploadId,
        report_month: r.visitDate ? r.visitDate.substring(0, 7) + '-01' : null,
        source_type: sourceType,
        start_date: r.startDate,
        end_date: r.endDate,
        visit_date: r.visitDate,
        appointment_time: r.appointmentTime || null,
        patient_name: r.patientName || null,
        mrn: r.mrn || null,
        appointment_status: r.appointmentStatus || null,
        late_cancel: r.lateCancel,
        primary_provider_name: r.primaryProviderName || null,
        primary_provider_id: providerCache[r.primaryProviderName],
        visit_type_category: r.visitTypeCategory,
        visit_type_raw: r.visitTypeRaw || null,
        primary_payer: r.primaryPayer || null,
      };
    });

    const { error } = await supabase.from('stat_office_visits').insert(rows);
    if (error) {
      await supabase
        .from('stat_uploads')
        .update({ status: 'failed', error_message: error.message })
        .eq('id', uploadId);
      throw new Error(`Failed to insert office visits batch at row ${i}: ${error.message}`);
    }
  }
}

async function insertTestingVisits(
  uploadId: number,
  records: StatTestingVisitRecord[],
  sourceType: 'completed' | 'all_statuses'
) {
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const rows = batch.map((r) => ({
      upload_id: uploadId,
      report_month: r.visitDate ? r.visitDate.substring(0, 7) + '-01' :
                    (r.startDate ? r.startDate.substring(0, 7) + '-01' : null),
      source_type: sourceType,
      start_date: r.startDate,
      end_date: r.endDate,
      visit_date: r.visitDate,
      appointment_time: r.appointmentTime || null,
      patient_name: r.patientName || null,
      mrn: r.mrn || null,
      appointment_status: r.appointmentStatus || null,
      late_cancel: r.lateCancel,
      department: r.department || null,
      department_normalized: r.departmentNormalized || null,
      visit_type: r.visitType || null,
      resource: r.resource || null,
      primary_payer: r.primaryPayer || null,
    }));

    const { error } = await supabase.from('stat_testing_visits').insert(rows);
    if (error) {
      await supabase
        .from('stat_uploads')
        .update({ status: 'failed', error_message: error.message })
        .eq('id', uploadId);
      throw new Error(`Failed to insert testing visits batch at row ${i}: ${error.message}`);
    }
  }
}

async function insertOrders(
  uploadId: number,
  reportMonth: string,
  records: StatOrderRecord[],
  providerMap: Record<string, string>
) {
  const providerCache: Record<string, string | null> = {};

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const rows = batch.map((r) => {
      if (providerCache[r.orderingProviderName] === undefined) {
        providerCache[r.orderingProviderName] = matchProviderByName(r.orderingProviderName, providerMap);
      }
      if (providerCache[r.referringProviderName] === undefined) {
        providerCache[r.referringProviderName] = matchProviderByName(r.referringProviderName, providerMap);
      }

      return {
        upload_id: uploadId,
        report_month: (r.visitDate || r.orderDate) ? (r.visitDate || r.orderDate)!.substring(0, 7) + '-01' : reportMonth,
        visit_date: r.visitDate,
        mrn: r.mrn || null,
        patient_name: r.patientName || null,
        provider_resource_name: r.providerResourceName || null,
        ordering_provider_name: r.orderingProviderName || null,
        ordering_provider_id: providerCache[r.orderingProviderName],
        referring_provider_name: r.referringProviderName || null,
        referring_provider_id: providerCache[r.referringProviderName],
        order_id: r.orderId || null,
        order_description: r.orderDescription || null,
        order_category: r.orderCategory,
        order_date: r.orderDate,
        order_status: r.orderStatus || null,
        appt_status: r.apptStatus || null,
        department: r.department || null,
        coverage: r.coverage || null,
      };
    });

    const { error } = await supabase.from('stat_orders').insert(rows);
    if (error) {
      await supabase
        .from('stat_uploads')
        .update({ status: 'failed', error_message: error.message })
        .eq('id', uploadId);
      throw new Error(`Failed to insert orders batch at row ${i}: ${error.message}`);
    }
  }
}
