import * as XLSX from 'xlsx';

// ── Report Type Detection ──

export type ReportType = 'visits' | 'orders' | 'historical';

const VISITS_HEADERS = ['Provider/Resource', 'MRN', 'Patient', 'Visit Date', 'Time', 'Dept',
  'Referring Provider', 'Prov/Res Type', 'Appt Notes', 'Visit Type'];

const ORDERS_HEADERS = ['Provider/Resource', 'ORD: Patient Contact Department', 'Visit Date',
  'MRN', 'Patient', 'Coverage', 'APPT STATUS', 'Order ID', 'Order Description'];

export function detectReportType(buffer: ArrayBuffer): ReportType {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetNames = workbook.SheetNames;

  // Historical files have multiple year-based sheets
  if (sheetNames.some(n => /CVI\s+\d{4}/i.test(n) || /Brodsky\s+\d{4}/i.test(n))) {
    return 'historical';
  }

  const sheet = workbook.Sheets[sheetNames[0]];
  const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  if (rawData.length < 1) return 'visits'; // fallback

  const header = rawData[0].map(h => String(h || '').trim());

  // Check for orders-specific columns
  if (header.some(h => h === 'Order ID' || h === 'Order Description' || h === 'ORD: Patient Contact Department')) {
    return 'orders';
  }

  return 'visits';
}

// ── Types ──

export interface ParsedAppointment {
  provider_resource_name: string;
  mrn: string | null;
  patient_name: string | null;
  visit_date: string; // YYYY-MM-DD
  time_decimal: number | null;
  time_block: string; // 'AM' or 'PM'
  department: string;
  referring_provider: string | null;
  prov_res_type: string;
  appt_notes: string | null;
  visit_type: string | null;
  visit_type_generic: string | null;
  fin_class: string | null;
  payer: string | null;
  appt_status: string;
  visit_cosigner_required: string | null;
  appt_linked_orders: string | null;
  ordering_provider: string | null;
  authorizing_provider: string | null;
  billing_provider: string | null;
  primary_plan: string | null;
  is_new_patient: boolean;
  is_completed: boolean;
  is_no_show: boolean;
  is_cancelled: boolean;
  is_chp: boolean;
  is_virtual: boolean;
  is_internal_provider: boolean | null;
  is_provider_visit: boolean;
  test_category: string | null;
}

export interface ParseResult {
  appointments: ParsedAppointment[];
  reportMonth: string; // YYYY-MM-01
  rowCount: number;
}

// ── Column Indices ──
// Epic report columns by position (0-indexed)
const COL = {
  PROVIDER_RESOURCE_NAME: 0,
  MRN: 1,
  PATIENT_NAME: 2,
  VISIT_DATE: 3,
  TIME: 4,
  DEPARTMENT: 5,
  REFERRING_PROVIDER: 6,
  PROV_RES_TYPE: 7,
  APPT_NOTES: 8,
  VISIT_TYPE: 9,
  NEW_PATIENT_FLAG: 10,
  VISIT_TYPE_GENERIC: 11,
  FIN_CLASS: 12,
  PAYER: 13,
  APPT_STATUS: 14,
  VISIT_COSIGNER: 15,
  APPT_LINKED_ORDERS: 16,
  ORDERING_PROVIDER: 17,
  AUTHORIZING_PROVIDER: 18,
  BILLING_PROVIDER: 19,
  PRIMARY_PLAN: 20,
} as const;

// ── Hardcoded Internal Providers List ──
// These are the 33 internal providers at CVI Cardiology
const INTERNAL_PROVIDERS = new Set([
  'Asaf Rabinovitz',
  'Carlo Mannina',
  'Daniel Pugliese',
  'Davendra Mehta',
  'Himanshu Sharma',
  'Hunaina Shahab',
  'Jared Leventhal',
  'Jeffrey Bander',
  'Johanna Contreras',
  'Joshua Shatzkes',
  'Judith Goldfinger',
  'Kiruthika Balasundaram',
  'Kristen Carter',
  'Krysthel Engstrom',
  'Matthew Parker',
  'Matthew Tomey',
  'Nenad Trubelja',
  'Nicole Weiss',
  'Nina Kukar',
  'Omar Al Dhaybi',
  'Patrick Lam',
  'Paul Leis',
  'Raman Sharma',
  'Robert Kornberg',
  'Robert Leber',
  'Sanjay Sivalokanathan',
  'Susan Colpoys',
  'Swaminatha Gurudevan',
  'Victoria Kazickasa',
  'Waqas Malick',
  'Won Joon Koh',
  'Anton Camaj',
  'Vahid Namdarizandi',
]);

function isInternalProvider(providerName: string): boolean {
  // Extract name without ID bracket (e.g., "Jared Leventhal [1370695]" → "Jared Leventhal")
  const nameOnly = providerName.replace(/\s*\[.*?\]\s*$/, '').trim();
  return INTERNAL_PROVIDERS.has(nameOnly);
}

// ── Department Code to Full Name Mapping ──
const DEPARTMENT_MAP: Record<string, string> = {
  '100010THCARD': '1000 10th Ave CVI Cardiology',
  '100010THECHO': '1000 10th Ave CVI Cardiology Echo',
  'VASCULAR': '1000 10th Ave CVI Cardiology Vascular',
  'NUCLEAR': '1000 10th Ave CVI Cardiology Nuclear',
  'VEIN': '1000 10th Ave CVI Cardiology Vein',
  'MSW CARD': 'MSW 1000 10th Ave CVI Cardiology CT',
  'MSW CT': 'MSW 1000 10th Ave CVI Cardiology CT',
  '1000 10TH ECHO': '1000 10th Echo',
  '100010TH EP': '1000 10th Ave EP',
};

function mapDepartmentName(rawDept: string): string {
  const upperDept = rawDept.toUpperCase();
  for (const [code, fullName] of Object.entries(DEPARTMENT_MAP)) {
    if (upperDept.includes(code)) {
      return fullName;
    }
  }
  return rawDept;
}

// ── Ancillary Resource Visit Types ──
const ANCILLARY_VISIT_TYPES = [
  'BLOOD DRAW',
  'EKG',
  'DEVICE CHECK',
  'EVENT MONITOR',
];

// ── Test Category Mapping ──
// Maps visit_type patterns and department patterns to test categories

function classifyTestCategory(visitType: string | null, department: string): string | null {
  if (!visitType) return null;
  const vt = visitType.toUpperCase();
  const dept = department.toUpperCase();

  // Echo-related (order matters - check stress echo before plain echo)
  if (vt.includes('STRESS ECHO') || vt.includes('EXERCISE STRESS ECHO') || vt.includes('DOBUTAMINE STRESS ECHO') ||
      (vt.includes('STRESS') && vt.includes('ECHO'))) return 'Stress Echo';
  if (vt.includes('ECHOCARDIOGRAM LIMITED') || vt.includes('TRANSTHORACIC ECHO') ||
      (vt.includes('ECHO') && !vt.includes('STRESS'))) return 'Echo';
  if (vt.includes('TEE') || vt.includes('TRANSESOPHAGEAL')) return 'TEE';
  if (vt.includes('STRESS') && !vt.includes('ECHO') && !vt.includes('NUCLEAR')) return 'Stress Test';

  // Nuclear
  if (vt.includes('NUCLEAR') || vt.includes('MYOCARDIAL PERFUSION') || vt.includes('PYP')) return 'Nuclear Stress';

  // Vascular
  if (vt.includes('VASCULAR') && (vt.includes('ULTRASOUND') || vt.includes('US'))) return 'Vascular Ultrasound';
  if (vt.includes('VASCULAR')) return 'Vascular Ultrasound';

  // CT/CTA
  if (vt.includes('CALCIUM SCORE') || vt.includes('CT ANGIO') || vt.includes('CTA') ||
      (vt.includes('CT') && dept.includes('CARD'))) return 'CT Angiography';

  // Vein procedures
  if (vt.includes('VARITHENA') || vt.includes('VEIN 60') || vt.includes('VEIN PROCEDURE')) return 'Vein Procedure';

  // EP procedures
  if (vt.includes('LOOP RECORDER') || vt.includes('IMPLANTABLE LOOP')) return 'Loop Recorder';
  if (vt.includes('CARDIOVERSION')) return 'Cardioversion';
  if (vt.includes('EP STUDY') || vt.includes('ELECTROPHYSIOLOGY')) return 'EP Study';

  // Monitoring
  if (vt.includes('HOLTER')) return 'Holter Monitor';
  if (vt.includes('EVENT MONITOR')) return 'Event Monitor';

  // MRI/Cath
  if (vt.includes('CARDIAC MRI') || vt.includes('CMR')) return 'Cardiac MRI';
  if (vt.includes('RIGHT HEART') || vt.includes('RHC')) return 'Right Heart Cath';
  if (vt.includes('LEFT HEART') || vt.includes('LHC') || (vt.includes('CATH') && !vt.includes('RIGHT'))) return 'Left Heart Cath';

  return null;
}

// ── Date Conversion ──

function excelSerialToDate(serial: number): string {
  // Excel serial date: days since 1900-01-01 (with a bug for 1900-02-29)
  const utcDays = Math.floor(serial) - 25569; // offset from Excel epoch to Unix epoch
  const date = new Date(utcDays * 86400000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  // If it's a number, treat as Excel serial date
  if (typeof value === 'number') {
    return excelSerialToDate(value);
  }

  // If it's a string, try to parse it
  const str = String(value).trim();
  if (!str) return null;

  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // Try M/D/YYYY or MM/DD/YYYY
  const parts = str.split('/');
  if (parts.length === 3) {
    const month = parts[0].padStart(2, '0');
    const day = parts[1].padStart(2, '0');
    const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    return `${year}-${month}-${day}`;
  }

  return null;
}

// ── String Helpers ──

function str(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

function strRequired(value: unknown, fallback: string = ''): string {
  return str(value) ?? fallback;
}

// ── Main Parser ──

export function parseEpicReport(buffer: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Get raw data as array of arrays (no headers interpretation)
  const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  if (rawData.length < 2) {
    throw new Error('Report file appears empty or has no data rows');
  }

  // Skip header row
  const dataRows = rawData.slice(1).filter(row =>
    row && row.length > 0 && row[COL.PROVIDER_RESOURCE_NAME] !== null
  );

  // ── First Pass: Parse all rows ──
  const appointments: ParsedAppointment[] = [];

  for (const row of dataRows) {
    const providerName = strRequired(row[COL.PROVIDER_RESOURCE_NAME]);
    if (!providerName) continue;

    const visitDateRaw = row[COL.VISIT_DATE];
    const visitDate = parseDate(visitDateRaw);
    if (!visitDate) continue;

    const rawTime = row[COL.TIME];
    // Excel time should be a fraction of a day (0.0 to 1.0)
    // If value is > 1, it might be a date serial - extract just the time portion
    let timeDecimal: number | null = null;
    if (typeof rawTime === 'number' && rawTime >= 0 && rawTime < 100) {
      timeDecimal = rawTime % 1; // Get fractional part (time of day)
    }
    const timeBlock = timeDecimal !== null ? (timeDecimal < 0.5 ? 'AM' : 'PM') : 'AM';

    const rawDepartment = strRequired(row[COL.DEPARTMENT], 'UNKNOWN');
    const department = mapDepartmentName(rawDepartment);
    const provResType = strRequired(row[COL.PROV_RES_TYPE], 'Person');
    const visitType = str(row[COL.VISIT_TYPE]);
    const apptStatus = strRequired(row[COL.APPT_STATUS], '');
    const apptNotes = str(row[COL.APPT_NOTES]);
    const newPatientFlag = str(row[COL.NEW_PATIENT_FLAG]);

    // Derived booleans
    const isNewPatient = newPatientFlag === 'Yes [1]' ||
      (visitType !== null && visitType.toUpperCase().includes('NEW PATIENT'));

    const isCompleted = apptStatus === 'Comp' || apptStatus === 'Arrived';
    const isNoShow = apptStatus === 'No Show';
    const isCancelled = apptStatus === 'Can';
    const isChp = apptNotes !== null && apptNotes.toUpperCase().includes('CHP');
    const isVirtual = visitType !== null && (
      visitType.toUpperCase().includes('VIDEO VISIT') ||
      visitType.toUpperCase().includes('TELEPHONE VISIT')
    );

    // Determine if this is a provider visit (not an ancillary Resource row)
    let isProviderVisit = true;
    if (provResType === 'Resource' && visitType) {
      const vtUpper = visitType.toUpperCase();
      // Check if it matches any ancillary type
      if (ANCILLARY_VISIT_TYPES.some(a => vtUpper.includes(a))) {
        isProviderVisit = false;
      }
      // Also check for TELEPHONE that's not a TELEPHONE VISIT
      if (vtUpper.includes('TELEPHONE') && !vtUpper.includes('TELEPHONE VISIT')) {
        isProviderVisit = false;
      }
    }

    const testCategory = classifyTestCategory(visitType, department);

    appointments.push({
      provider_resource_name: providerName,
      mrn: str(row[COL.MRN]),
      patient_name: str(row[COL.PATIENT_NAME]),
      visit_date: visitDate,
      time_decimal: timeDecimal,
      time_block: timeBlock,
      department,
      referring_provider: str(row[COL.REFERRING_PROVIDER]),
      prov_res_type: provResType,
      appt_notes: apptNotes,
      visit_type: visitType,
      visit_type_generic: str(row[COL.VISIT_TYPE_GENERIC]),
      fin_class: str(row[COL.FIN_CLASS]),
      payer: str(row[COL.PAYER]),
      appt_status: apptStatus,
      visit_cosigner_required: str(row[COL.VISIT_COSIGNER]),
      appt_linked_orders: str(row[COL.APPT_LINKED_ORDERS]),
      ordering_provider: str(row[COL.ORDERING_PROVIDER]),
      authorizing_provider: str(row[COL.AUTHORIZING_PROVIDER]),
      billing_provider: str(row[COL.BILLING_PROVIDER]),
      primary_plan: str(row[COL.PRIMARY_PLAN]),
      is_new_patient: isNewPatient,
      is_completed: isCompleted,
      is_no_show: isNoShow,
      is_cancelled: isCancelled,
      is_chp: isChp,
      is_virtual: isVirtual,
      is_internal_provider: isInternalProvider(providerName),
      is_provider_visit: isProviderVisit,
      test_category: testCategory,
    });
  }

  // ── Determine Report Month ──
  // Use the most common month in the data
  const monthCounts: Record<string, number> = {};
  for (const appt of appointments) {
    const month = appt.visit_date.substring(0, 7) + '-01'; // YYYY-MM-01
    monthCounts[month] = (monthCounts[month] || 0) + 1;
  }

  let reportMonth = '';
  let maxCount = 0;
  for (const [month, count] of Object.entries(monthCounts)) {
    if (count > maxCount) {
      maxCount = count;
      reportMonth = month;
    }
  }

  return {
    appointments,
    reportMonth,
    rowCount: appointments.length,
  };
}

// ── Orders Report Types ──

export interface ParsedOrder {
  provider_resource_name: string;
  department: string | null;
  visit_date: string | null; // YYYY-MM-DD
  mrn: string | null;
  patient_name: string | null;
  coverage: string | null;
  appt_status: string | null;
  order_id: string | null;
  order_description: string | null;
  order_date: string | null; // YYYY-MM-DD
  ordering_provider: string | null;
  referring_provider: string | null;
  order_status: string | null;
  scheduling_status: string | null;
  date_of_scheduling: string | null; // YYYY-MM-DD
  appt_date: string | null; // YYYY-MM-DD
}

export interface OrdersParseResult {
  orders: ParsedOrder[];
  reportMonth: string; // YYYY-MM-01
  rowCount: number;
}

// ── Orders Column Indices ──

const ORDER_COL = {
  PROVIDER_RESOURCE_NAME: 0,
  DEPARTMENT: 1,
  VISIT_DATE: 2,
  MRN: 3,
  PATIENT_NAME: 4,
  COVERAGE: 5,
  APPT_STATUS: 6,
  ORDER_ID: 7,
  ORDER_DESCRIPTION: 8,
  ORDER_DATE: 9,
  ORDERING_PROVIDER: 10,
  REFERRING_PROVIDER: 11,
  ORDER_STATUS: 12,
  STATUS: 13,
  DATE_OF_SCHEDULING: 14,
  APPT_DATE: 15,
} as const;

// ── Orders Parser ──

export function parseOrdersReport(buffer: ArrayBuffer): OrdersParseResult {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  if (rawData.length < 2) {
    throw new Error('Orders report appears empty or has no data rows');
  }

  const dataRows = rawData.slice(1).filter(row =>
    row && row.length > 0 && row[ORDER_COL.PROVIDER_RESOURCE_NAME] !== null
  );

  const orders: ParsedOrder[] = [];

  for (const row of dataRows) {
    const providerName = strRequired(row[ORDER_COL.PROVIDER_RESOURCE_NAME]);
    if (!providerName) continue;

    orders.push({
      provider_resource_name: providerName,
      department: str(row[ORDER_COL.DEPARTMENT]),
      visit_date: parseDate(row[ORDER_COL.VISIT_DATE]),
      mrn: str(row[ORDER_COL.MRN]),
      patient_name: str(row[ORDER_COL.PATIENT_NAME]),
      coverage: str(row[ORDER_COL.COVERAGE]),
      appt_status: str(row[ORDER_COL.APPT_STATUS]),
      order_id: str(row[ORDER_COL.ORDER_ID]),
      order_description: str(row[ORDER_COL.ORDER_DESCRIPTION]),
      order_date: parseDate(row[ORDER_COL.ORDER_DATE]),
      ordering_provider: str(row[ORDER_COL.ORDERING_PROVIDER]),
      referring_provider: str(row[ORDER_COL.REFERRING_PROVIDER]),
      order_status: str(row[ORDER_COL.ORDER_STATUS]),
      scheduling_status: str(row[ORDER_COL.STATUS]),
      date_of_scheduling: parseDate(row[ORDER_COL.DATE_OF_SCHEDULING]),
      appt_date: parseDate(row[ORDER_COL.APPT_DATE]),
    });
  }

  // Determine report month from visit dates
  const monthCounts: Record<string, number> = {};
  for (const order of orders) {
    if (order.visit_date) {
      const month = order.visit_date.substring(0, 7) + '-01';
      monthCounts[month] = (monthCounts[month] || 0) + 1;
    }
  }

  let reportMonth = '';
  let maxCount = 0;
  for (const [month, count] of Object.entries(monthCounts)) {
    if (count > maxCount) {
      maxCount = count;
      reportMonth = month;
    }
  }

  return {
    orders,
    reportMonth,
    rowCount: orders.length,
  };
}

// ── Historical Data Types ──

export interface ParsedHistoricalRow {
  source_year: number;
  provider_name: string;
  month_jan: number;
  month_feb: number;
  month_mar: number;
  month_apr: number;
  month_may: number;
  month_jun: number;
  month_jul: number;
  month_aug: number;
  month_sep: number;
  month_oct: number;
  month_nov: number;
  month_dec: number;
  ytd: number;
  prior_ytd: number;
  change_num: number;
  change_pct: number | null;
  ytd_sessions: number | null;
  avg_pts_per_session: number | null;
  new_patient_pct: number | null;
  no_show_rate: number | null;
  row_type: 'provider' | 'procedure';
}

export interface HistoricalParseResult {
  rows: ParsedHistoricalRow[];
  years: number[];
  rowCount: number;
}

// Known procedure/test names for classification
const PROCEDURE_KEYWORDS = [
  'echo', 'stress', 'holter', 'vascular', 'cath', 'tee', 'monitor',
  'nuclear', 'cardio', 'ct ', 'mri', 'ep ', 'ekg', 'device',
  'ablation', 'cardioversion', 'pacemaker', 'defibrillator', 'loop',
  'total', 'ancillary', 'blood draw', 'pet', 'doppler',
];

function isProcedureRow(name: string): boolean {
  const lower = name.toLowerCase().trim();
  return PROCEDURE_KEYWORDS.some(kw => lower.includes(kw));
}

function safeNum(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : Math.round(value);
  const n = Number(value);
  return isNaN(n) ? 0 : Math.round(n);
}

function safeDecimal(value: unknown, maxAbsValue: number = 100): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && (value.includes('DIV') || value === 'N/A' || value.includes('%'))) {
    // Try to parse percentage strings like "6 %"
    const match = value.match(/^([\d.]+)\s*%?$/);
    if (match) {
      const n = parseFloat(match[1]);
      if (!isNaN(n) && Math.abs(n) <= maxAbsValue) return n / 100; // Convert to decimal
    }
    return null;
  }
  const n = typeof value === 'number' ? value : Number(value);
  if (isNaN(n)) return null;
  // Clamp values to prevent database overflow (NUMERIC(6,4) max is ~99.9999)
  if (Math.abs(n) > maxAbsValue) return null;
  return n;
}

// ── Historical Parser ──

interface HistoricalColumnMap {
  name: number;
  jan: number;
  feb: number;
  mar: number;
  apr: number;
  may: number;
  jun: number;
  jul: number;
  aug: number;
  sep: number;
  oct: number;
  nov: number;
  dec: number;
  ytd: number;
  priorYtd: number;
  changeNum: number;
  changePct: number;
  sessions: number;
  avgPts: number;
  newPatientPct: number;
  noShowRate: number;
}

function detectHistoricalColumns(headerRow: unknown[]): HistoricalColumnMap | null {
  const headers = headerRow.map(h => String(h || '').toLowerCase().trim());

  // Find name column (first column with provider/name related header or just the first column)
  let nameCol = headers.findIndex(h => h.includes('name') || h.includes('physician') || h.includes('procedure'));
  if (nameCol === -1) nameCol = 0;

  // Find month columns by name
  const findMonth = (patterns: string[]): number => {
    return headers.findIndex(h => patterns.some(p => h === p || h.startsWith(p)));
  };

  const jan = findMonth(['jan']);
  const feb = findMonth(['feb']);
  const mar = findMonth(['mar']);
  const apr = findMonth(['apr']);
  const may = findMonth(['may']);
  const jun = findMonth(['jun']);
  const jul = findMonth(['jul']);
  const aug = findMonth(['aug']);
  const sep = findMonth(['sep', 'sept']);
  const oct = findMonth(['oct']);
  const nov = findMonth(['nov']);
  const dec = findMonth(['dec']);

  // If we can't find basic month columns, this isn't a valid historical sheet
  if (jan === -1 || dec === -1) return null;

  // Find YTD column (contains current year YTD)
  const ytd = headers.findIndex(h => h.includes('ytd') && !h.includes('/') && !h.includes('prior'));

  // Find prior YTD (usually formatted as "2023/ytd" or "prior ytd" or "2019/ytd")
  const priorYtd = headers.findIndex(h =>
    (h.includes('/ytd') || h.includes('prior')) &&
    !h.includes('# change') && !h.includes('% change')
  );

  // Find change columns
  const changeNum = headers.findIndex(h => h.includes('# change') || h === 'change');
  const changePct = headers.findIndex(h => h.includes('% change'));

  // Find session columns
  const sessions = headers.findIndex(h => h.includes('session') && (h.includes('ytd') || h.includes('number')));
  const avgPts = headers.findIndex(h => h.includes('average') || h.includes('avg'));

  // Find new patient and no-show columns
  const newPatientPct = headers.findIndex(h => h.includes('new patient'));
  const noShowRate = headers.findIndex(h => h.includes('no show') || h.includes('no-show'));

  return {
    name: nameCol,
    jan: jan !== -1 ? jan : 1,
    feb: feb !== -1 ? feb : 2,
    mar: mar !== -1 ? mar : 3,
    apr: apr !== -1 ? apr : 4,
    may: may !== -1 ? may : 5,
    jun: jun !== -1 ? jun : 6,
    jul: jul !== -1 ? jul : 7,
    aug: aug !== -1 ? aug : 8,
    sep: sep !== -1 ? sep : 9,
    oct: oct !== -1 ? oct : 10,
    nov: nov !== -1 ? nov : 11,
    dec: dec !== -1 ? dec : 12,
    ytd: ytd !== -1 ? ytd : 13,
    priorYtd: priorYtd !== -1 ? priorYtd : 14,
    changeNum: changeNum !== -1 ? changeNum : 15,
    changePct: changePct !== -1 ? changePct : 16,
    sessions: sessions !== -1 ? sessions : 17,
    avgPts: avgPts !== -1 ? avgPts : 18,
    newPatientPct: newPatientPct !== -1 ? newPatientPct : -1,
    noShowRate: noShowRate !== -1 ? noShowRate : -1,
  };
}

export function parseHistoricalStats(buffer: ArrayBuffer): HistoricalParseResult {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const rows: ParsedHistoricalRow[] = [];
  const years: number[] = [];

  // Find sheets with year-based data (CVI 2024, CVI 2025, etc.)
  for (const sheetName of workbook.SheetNames) {
    const yearMatch = sheetName.match(/(?:CVI|Brodsky)\s+(\d{4})/i);
    if (!yearMatch) continue;

    // Skip duplicate/copy sheets and comparison sheets
    const lowerName = sheetName.toLowerCase();
    if (lowerName.includes('copy of')) continue;
    if (lowerName.includes('inpatient')) continue;

    const sourceYear = parseInt(yearMatch[1]);
    years.push(sourceYear);

    const sheet = workbook.Sheets[sheetName];
    const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      raw: true,
    });

    if (rawData.length < 2) continue;

    // Detect column layout from header row
    const colMap = detectHistoricalColumns(rawData[0]);
    if (!colMap) {
      console.warn(`Skipping sheet ${sheetName}: could not detect column layout`);
      continue;
    }

    // Parse data rows
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || !row[colMap.name]) continue;

      const name = String(row[colMap.name]).trim();
      if (!name || name === '') continue;

      // Skip total/summary rows
      const lowerName = name.toLowerCase();
      if (lowerName === 'total' || lowerName.startsWith('grand total')) continue;

      const rowType = isProcedureRow(name) ? 'procedure' : 'provider';

      // For percentage columns, use strict validation (max 1.0 for decimals, 100 for percentages)
      const newPatient = colMap.newPatientPct !== -1 ? safeDecimal(row[colMap.newPatientPct], 100) : null;
      const noShow = colMap.noShowRate !== -1 ? safeDecimal(row[colMap.noShowRate], 100) : null;

      rows.push({
        source_year: sourceYear,
        provider_name: name,
        month_jan: safeNum(row[colMap.jan]),
        month_feb: safeNum(row[colMap.feb]),
        month_mar: safeNum(row[colMap.mar]),
        month_apr: safeNum(row[colMap.apr]),
        month_may: safeNum(row[colMap.may]),
        month_jun: safeNum(row[colMap.jun]),
        month_jul: safeNum(row[colMap.jul]),
        month_aug: safeNum(row[colMap.aug]),
        month_sep: safeNum(row[colMap.sep]),
        month_oct: safeNum(row[colMap.oct]),
        month_nov: safeNum(row[colMap.nov]),
        month_dec: safeNum(row[colMap.dec]),
        ytd: safeNum(row[colMap.ytd]),
        prior_ytd: safeNum(row[colMap.priorYtd]),
        change_num: safeNum(row[colMap.changeNum]),
        change_pct: safeDecimal(row[colMap.changePct], 1000), // Allow large percentage changes
        ytd_sessions: colMap.sessions !== -1 ? (safeNum(row[colMap.sessions]) || null) : null,
        avg_pts_per_session: colMap.avgPts !== -1 ? safeDecimal(row[colMap.avgPts], 100) : null,
        new_patient_pct: newPatient,
        no_show_rate: noShow,
        row_type: rowType,
      });
    }
  }

  return {
    rows,
    years: [...new Set(years)].sort(),
    rowCount: rows.length,
  };
}
