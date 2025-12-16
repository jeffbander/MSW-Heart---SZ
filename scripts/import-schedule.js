/**
 * Import Schedule from Excel to Supabase
 *
 * This script reads the MSW Heart schedules Excel file and imports
 * schedule assignments into the Supabase database.
 *
 * Usage: npm run import-schedule
 */

const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Excel file path - update this to your file location
const EXCEL_FILE_PATH = 'C:/Users/zakows01/Downloads/MSW Heart schedules (1).xlsx';

// Sheets to import (future months only: Dec 2025 onwards)
const SHEETS_TO_IMPORT = ['Dec25', 'Jan26', 'Feb 26', 'March 26'];

// Month/Year mapping for each sheet
const SHEET_DATE_MAP = {
  'Dec25': { year: 2025, month: 12 },
  'Jan26': { year: 2026, month: 1 },
  'Feb 26': { year: 2026, month: 2 },
  'March 26': { year: 2026, month: 3 },
};

// Provider initials aliases (map spreadsheet names to database initials)
const PROVIDER_ALIASES = {
  'SG': 'GS',  // Swaminatha Gurudevan is stored as GS in database
};

// Service mapping from spreadsheet to database
// Format: "Category / Task" -> "Database Service Name"
const SERVICE_MAPPING = {
  // PTO
  'PTO/AM': 'PTO',
  'PTO/PM': 'PTO',

  // Inpatient (Telle and Consults both map to Inpatient service)
  'Inpatient/Telle': 'Inpatient',
  'Inpatient/Consults': 'Inpatient',

  // Echo services
  'Echo lab -4/Fourth Floor': 'Fourth Floor Echo Lab',
  'Echo (TTE)/AM Testing': 'Echo TTE AM',
  'Echo (TTE)/PM Testing': 'Echo TTE PM',

  // Stress Echo
  'Stress Echo/AM Testing': 'Stress Echo AM',
  'Stress Echo/PM Testing': 'Stress Echo PM',

  // Testing
  'Testing/Nuclear': 'Nuclear Stress',
  'Testing/Supervising Nuclear': 'SKIP', // We removed this service
  'Testing/Vascular': 'Vascular',
  'Testing/CT': 'CT',
  'Testing/CMR': 'CMR',

  // Scheduled Providers (Rooms)
  'Scheduled Providers/AM': 'Rooms AM',
  'Scheduled Providers/PM': 'Rooms PM',

  // Fellows
  'Fellows/Preceptor': 'Precepting',

  // Admin
  'Admin/AM': 'Admin AM',
  'Admin/PM': 'Admin PM',

  // Video Visits, CHF, EP, Hospital at Home (under Admin/Services)
  'Admin/Video Visits': 'SKIP',
  'Admin/CHF': 'SKIP',
  'Admin/EP': 'SKIP',
  'Admin/Hospital at Home AM': 'Hospital at Home',
  'Admin/Hospital at Home PM': 'Hospital at Home',
  'Services/Video Visits': 'SKIP',
  'Services/CHF': 'SKIP',
  'Services/EP': 'SKIP',
  'Services/Hospital at Home AM': 'Hospital at Home',
  'Services/Hospital at Home PM': 'Hospital at Home',

  // CT and CMR under Echo (TTE) section
  'Echo (TTE)/CT': 'CT',
  'Echo (TTE)/CMR': 'CMR',

  // Fellows section (skip non-precepting)
  'Fellows/CHF': 'SKIP',
  'Fellows/EP': 'SKIP',
  'Fellows/Hospital at Home AM': 'SKIP',
  'Fellows/Hospital at Home PM': 'SKIP',
  'Fellows/Video Visits': 'SKIP',

  // Stray service entries (without category)
  '/CHF': 'SKIP',
  '/EP': 'SKIP',
  '/Hospital at Home AM': 'Hospital at Home',
  '/Hospital at Home PM': 'Hospital at Home',
  '/Video Visits': 'SKIP',

  // Handle when "Inpatient AM" / "Inpatient PM" appears as category or service key
  'Inpatient AM/': 'SKIP',
  'Inpatient PM/': 'SKIP',
  'Inpatient AM': 'SKIP',
  'Inpatient PM': 'SKIP',

  // Offsites - all map to Offsites AM/PM based on time
  'Offsites/Hudson Yards AM': 'Offsites AM',
  'Offsites/Hudson Yards PM': 'Offsites PM',
  'Offsites/87th Street AM': 'Offsites AM',
  'Offsites/87th Street PM': 'Offsites PM',
  'Offsites/Hotel Trades AM': 'Offsites AM',
  'Offsites/Hotel Trades PM': 'Offsites PM',
  'Offsites/Columbus Circle AM': 'Offsites AM',
  'Offsites/Columbus Circle PM': 'Offsites PM',
  'Offsites/Chelsea AM': 'Offsites AM',
  'Offsites/Chelsea PM': 'Offsites PM',
  'Offsites/World Trade Center AM': 'Offsites AM',
  'Offsites/World Trade Center PM': 'Offsites PM',
  'Offsites/Clark Lab AM': 'Offsites AM',
  'Offsites/Clark Lab PM': 'Offsites PM',
  'Offsites/Offsites AM': 'Offsites AM',
  'Offsites/Offsites PM': 'Offsites PM',

  // Services section headers/UI elements - skip
  'Services/<-- Click (+) to exapnd': 'SKIP',
  'Offsites/<-- Click (+) to exapnd': 'SKIP',
  'Category/Task/Location': 'SKIP',
  'Category/': 'SKIP',
  '/Task/Location': 'SKIP',
};

// Values to skip entirely (not real providers)
const SKIP_VALUES = [
  'N/A', 'Rad', '', null, undefined, 'N/a', 'n/a', 'NA', 'na',
  'HOLIDAY', 'Holiday', 'holiday'
];

// Patterns that indicate invalid provider values
const INVALID_PATTERNS = [
  /^\./,           // starts with period
  /\(.+\)/,        // contains parentheses (like "KE (JS)" or "NK (AR after 3:45)")
  /\s+[A-Z]{2,}$/, // ends with space + initials (like "SC PL")
];

// Stats tracking
const stats = {
  totalProcessed: 0,
  inserted: 0,
  skipped: 0,
  duplicates: 0,
  errors: [],
  missingProviders: new Set(),
  missingServices: new Set(),
  byMonth: {},
};

/**
 * Clean and validate provider initials
 */
function cleanProviderInitials(initials) {
  if (!initials) return null;

  let cleaned = initials.toString().trim();

  // Skip invalid values
  if (SKIP_VALUES.includes(cleaned)) return null;

  // Check for invalid patterns
  for (const pattern of INVALID_PATTERNS) {
    if (pattern.test(cleaned)) return null;
  }

  // Remove leading/trailing punctuation
  cleaned = cleaned.replace(/^[.,\s]+|[.,\s]+$/g, '');

  // Check again after cleaning
  if (!cleaned || SKIP_VALUES.includes(cleaned)) return null;

  // Apply aliases
  if (PROVIDER_ALIASES[cleaned]) {
    cleaned = PROVIDER_ALIASES[cleaned];
  }

  return cleaned;
}

/**
 * Parse provider initials from a cell value
 * Handles comma-separated (JB, KE, NT) and slash-separated (SG/AR)
 */
function parseProviders(cellValue) {
  if (!cellValue || SKIP_VALUES.includes(cellValue.toString().trim())) {
    return [];
  }

  const value = cellValue.toString().trim();

  // Split by comma first
  const byComma = value.split(',').map(s => s.trim()).filter(s => s);

  // Then split each by slash
  const providers = [];
  for (const part of byComma) {
    if (part.includes('/')) {
      const bySlash = part.split('/').map(s => s.trim()).filter(s => s);
      providers.push(...bySlash);
    } else {
      providers.push(part);
    }
  }

  // Clean and filter providers
  return providers
    .map(cleanProviderInitials)
    .filter(p => p !== null);
}

/**
 * Get service key from category and task
 */
function getServiceKey(category, task) {
  if (!category && !task) return null;

  const cat = category || '';
  const t = task || '';

  return `${cat}/${t}`.trim();
}

/**
 * Determine time block from task name or service
 */
function getTimeBlock(task, serviceName) {
  if (!task && !serviceName) return 'BOTH';

  const taskLower = (task || '').toLowerCase();
  const serviceLower = (serviceName || '').toLowerCase();

  if (taskLower.includes(' am') || serviceLower.includes(' am')) return 'AM';
  if (taskLower.includes(' pm') || serviceLower.includes(' pm')) return 'PM';
  if (taskLower === 'am' || serviceLower === 'am') return 'AM';
  if (taskLower === 'pm' || serviceLower === 'pm') return 'PM';
  if (taskLower === 'telle') return 'AM';
  if (taskLower === 'consults') return 'PM';

  return 'BOTH';
}

/**
 * Parse a single sheet and extract assignments
 */
function parseSheet(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    console.log(`  Sheet ${sheetName} not found`);
    return [];
  }

  const { year, month } = SHEET_DATE_MAP[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (data.length < 3) {
    console.log(`  Sheet ${sheetName} has insufficient data`);
    return [];
  }

  const assignments = [];

  // Row 2 has the dates (day numbers)
  const dateRow = data[1];

  // Build a map of column index -> date
  const columnDateMap = {};
  for (let col = 2; col < dateRow.length; col++) {
    const dayNum = dateRow[col];
    if (dayNum && typeof dayNum === 'number') {
      const date = new Date(year, month - 1, dayNum);
      columnDateMap[col] = date.toISOString().split('T')[0];
    }
  }

  // Track current category (some rows don't have category, it carries over)
  let currentCategory = '';

  // Process data rows (starting from row 3, index 2)
  for (let rowIdx = 2; rowIdx < data.length; rowIdx++) {
    const row = data[rowIdx];
    if (!row || row.length < 3) continue;

    const category = row[0] || '';
    const task = row[1] || '';

    // Update current category if provided
    if (category) {
      currentCategory = category;
    }

    // Skip certain rows
    if (task.includes('Click')) continue;
    if (task === 'Rooms Needed') continue;
    if (task.toLowerCase().includes('click')) continue;

    // Get service key
    const serviceKey = getServiceKey(currentCategory, task);
    if (!serviceKey || serviceKey === '/') continue;

    // Get mapped service name
    let serviceName = SERVICE_MAPPING[serviceKey];

    // If not found, try some fallback matching
    if (!serviceName) {
      // Try matching just the task part for offsites
      const offsiteKey = `Offsites/${task}`;
      if (SERVICE_MAPPING[offsiteKey]) {
        serviceName = SERVICE_MAPPING[offsiteKey];
      }
    }

    if (!serviceName) {
      // Only log services that aren't obviously skip-worthy
      if (!serviceKey.includes('Rooms Needed') &&
          !serviceKey.includes('Click') &&
          !serviceKey.includes('Task/Location') &&
          currentCategory !== '') {
        stats.missingServices.add(serviceKey);
      }
      continue;
    }

    // Skip services marked as SKIP
    if (serviceName === 'SKIP') continue;

    // Get time block
    const timeBlock = getTimeBlock(task, serviceName);

    // Check if this is PTO
    const isPto = serviceName === 'PTO';

    // Process each date column
    for (let col = 2; col < row.length; col++) {
      const cellValue = row[col];
      const date = columnDateMap[col];

      if (!date || !cellValue) continue;

      // Parse providers from cell
      const providers = parseProviders(cellValue);

      for (const providerInitials of providers) {
        assignments.push({
          date,
          service_name: serviceName,
          time_block: timeBlock,
          provider_initials: providerInitials,
          is_pto: isPto,
        });
      }
    }
  }

  return assignments;
}

/**
 * Load providers from database
 */
async function loadProviders() {
  const { data, error } = await supabase
    .from('providers')
    .select('id, initials, name, default_room_count');

  if (error) {
    throw new Error(`Failed to load providers: ${error.message}`);
  }

  const providerMap = {};
  for (const p of data) {
    providerMap[p.initials] = p;
  }
  return providerMap;
}

/**
 * Load services from database
 */
async function loadServices() {
  const { data, error } = await supabase
    .from('services')
    .select('id, name, requires_rooms');

  if (error) {
    throw new Error(`Failed to load services: ${error.message}`);
  }

  const serviceMap = {};
  for (const s of data) {
    serviceMap[s.name] = s;
  }
  return serviceMap;
}

/**
 * Insert assignments into database
 */
async function insertAssignments(assignments, providerMap, serviceMap) {
  const toInsert = [];
  const seenKeys = new Set();

  for (const assignment of assignments) {
    const provider = providerMap[assignment.provider_initials];
    const service = serviceMap[assignment.service_name];

    if (!provider) {
      stats.missingProviders.add(assignment.provider_initials);
      stats.skipped++;
      continue;
    }

    if (!service) {
      stats.missingServices.add(assignment.service_name);
      stats.skipped++;
      continue;
    }

    // Create a unique key to detect duplicates within our data
    const key = `${assignment.date}|${service.id}|${provider.id}|${assignment.time_block}`;
    if (seenKeys.has(key)) {
      stats.duplicates++;
      continue;
    }
    seenKeys.add(key);

    // Determine room count
    let roomCount = 0;
    if (service.requires_rooms) {
      roomCount = provider.default_room_count || 0;
    }

    toInsert.push({
      date: assignment.date,
      service_id: service.id,
      provider_id: provider.id,
      time_block: assignment.time_block,
      room_count: roomCount,
      is_pto: assignment.is_pto,
    });
  }

  console.log(`  Prepared ${toInsert.length} unique assignments for insertion`);
  console.log(`  (Filtered out ${stats.duplicates} duplicates within data)`);

  // Insert in batches of 50
  const batchSize = 50;
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < toInsert.length; i += batchSize) {
    const batch = toInsert.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(toInsert.length / batchSize);

    process.stdout.write(`  Inserting batch ${batchNum}/${totalBatches}...`);

    const { data, error } = await supabase
      .from('schedule_assignments')
      .insert(batch);

    if (error) {
      // Check if it's a duplicate error
      if (error.message.includes('duplicate') || error.code === '23505') {
        console.log(' (some duplicates, skipped)');
        // Try inserting one by one
        for (const item of batch) {
          const { error: singleError } = await supabase
            .from('schedule_assignments')
            .insert(item);

          if (!singleError) {
            successCount++;
          } else if (singleError.message.includes('duplicate') || singleError.code === '23505') {
            stats.duplicates++;
          } else {
            errorCount++;
          }
        }
      } else {
        console.log(` ERROR: ${error.message}`);
        stats.errors.push(`Batch ${batchNum}: ${error.message}`);
        errorCount += batch.length;
      }
    } else {
      console.log(' OK');
      successCount += batch.length;
    }
  }

  stats.inserted = successCount;
  stats.skipped += errorCount;
}

/**
 * Main import function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('MSW Heart Schedule Import');
  console.log('='.repeat(60));
  console.log('');

  // Check Supabase connection
  if (!supabaseUrl || !supabaseKey) {
    console.error('ERROR: Supabase credentials not found in .env.local');
    process.exit(1);
  }

  console.log('Connecting to Supabase...');

  // Load providers and services
  console.log('Loading providers from database...');
  const providerMap = await loadProviders();
  console.log(`  Found ${Object.keys(providerMap).length} providers`);
  console.log(`  Provider initials: ${Object.keys(providerMap).join(', ')}`);

  console.log('Loading services from database...');
  const serviceMap = await loadServices();
  console.log(`  Found ${Object.keys(serviceMap).length} services`);
  console.log('');

  // Read Excel file
  console.log(`Reading Excel file: ${EXCEL_FILE_PATH}`);
  const workbook = XLSX.readFile(EXCEL_FILE_PATH);
  console.log(`  Found sheets: ${workbook.SheetNames.join(', ')}`);
  console.log('');

  // Process each sheet
  const allAssignments = [];

  for (const sheetName of SHEETS_TO_IMPORT) {
    console.log(`Processing ${sheetName}...`);
    const assignments = parseSheet(workbook, sheetName);
    console.log(`  Found ${assignments.length} assignments`);

    stats.byMonth[sheetName] = assignments.length;
    allAssignments.push(...assignments);
  }

  stats.totalProcessed = allAssignments.length;
  console.log('');
  console.log(`Total assignments to import: ${allAssignments.length}`);
  console.log('');

  // Insert into database
  console.log('Inserting into database...');
  await insertAssignments(allAssignments, providerMap, serviceMap);

  // Print summary
  console.log('');
  console.log('='.repeat(60));
  console.log('IMPORT SUMMARY');
  console.log('='.repeat(60));
  console.log('');
  console.log('By Month:');
  for (const [month, count] of Object.entries(stats.byMonth)) {
    console.log(`  ${month}: ${count} assignments`);
  }
  console.log('');
  console.log(`Total Processed: ${stats.totalProcessed}`);
  console.log(`Successfully Inserted: ${stats.inserted}`);
  console.log(`Duplicates (skipped): ${stats.duplicates}`);
  console.log(`Skipped (errors/missing): ${stats.skipped}`);
  console.log('');

  if (stats.missingProviders.size > 0) {
    console.log('WARNING - Missing Providers (not in database):');
    for (const initials of stats.missingProviders) {
      console.log(`  - "${initials}"`);
    }
    console.log('');
  }

  if (stats.missingServices.size > 0) {
    console.log('WARNING - Unmapped Services:');
    for (const service of stats.missingServices) {
      console.log(`  - "${service}"`);
    }
    console.log('');
  }

  if (stats.errors.length > 0) {
    console.log('ERRORS:');
    for (const err of stats.errors) {
      console.log(`  - ${err}`);
    }
    console.log('');
  }

  console.log('='.repeat(60));
  console.log('Import complete!');
  console.log('='.repeat(60));
}

// Run the import
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
