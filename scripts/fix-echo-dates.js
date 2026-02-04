/**
 * Fix Echo Dates Migration Script
 *
 * This script fixes dates that were shifted backward by 1 day
 * due to the toISOString() UTC conversion bug.
 *
 * Usage: node scripts/fix-echo-dates.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to add 1 day to a date string
function addOneDay(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function fixEchoPTO() {
  console.log('\n=== Fixing echo_pto dates ===\n');

  // Fetch all PTO entries for January 2026
  const { data: ptoEntries, error: fetchError } = await supabase
    .from('echo_pto')
    .select('*, echo_tech:echo_techs(name)')
    .gte('date', '2026-01-01')
    .lte('date', '2026-01-31')
    .order('date');

  if (fetchError) {
    console.error('Error fetching PTO entries:', fetchError);
    return;
  }

  console.log(`Found ${ptoEntries.length} PTO entries to fix:\n`);

  for (const entry of ptoEntries) {
    const oldDate = entry.date;
    const newDate = addOneDay(oldDate);
    const techName = entry.echo_tech?.name || 'Unknown';

    console.log(`  ${techName}: ${oldDate} -> ${newDate} (${entry.time_block}) ${entry.reason || ''}`);

    // Update the entry
    const { error: updateError } = await supabase
      .from('echo_pto')
      .update({ date: newDate })
      .eq('id', entry.id);

    if (updateError) {
      console.error(`    ERROR updating: ${updateError.message}`);
    }
  }

  console.log('\nPTO entries updated!');
}

async function fixEchoScheduleAssignments() {
  console.log('\n=== Fixing echo_schedule_assignments dates ===\n');

  // Fetch all schedule assignments for January 2026
  const { data: assignments, error: fetchError } = await supabase
    .from('echo_schedule_assignments')
    .select('*, echo_tech:echo_techs(name), echo_room:echo_rooms(short_name)')
    .gte('date', '2026-01-01')
    .lte('date', '2026-01-31')
    .order('date');

  if (fetchError) {
    console.error('Error fetching assignments:', fetchError);
    return;
  }

  console.log(`Found ${assignments.length} assignments to fix...\n`);

  let updated = 0;
  let errors = 0;

  for (const assignment of assignments) {
    const oldDate = assignment.date;
    const newDate = addOneDay(oldDate);

    // Update the entry
    const { error: updateError } = await supabase
      .from('echo_schedule_assignments')
      .update({ date: newDate })
      .eq('id', assignment.id);

    if (updateError) {
      // Might fail due to unique constraint if the new date already has an entry
      if (updateError.code === '23505') {
        // Delete the duplicate and try again, or skip
        console.log(`  Skipping duplicate: ${assignment.echo_room?.short_name} on ${newDate}`);
      } else {
        console.error(`  ERROR: ${updateError.message}`);
      }
      errors++;
    } else {
      updated++;
    }
  }

  console.log(`\nAssignments updated: ${updated}, Errors/Skipped: ${errors}`);
}

async function verifyKarinaPTO() {
  console.log('\n=== Verifying Karina PTO dates ===\n');

  const { data: karinaPTO, error } = await supabase
    .from('echo_pto')
    .select('*, echo_tech:echo_techs(name)')
    .gte('date', '2026-01-01')
    .lte('date', '2026-01-31')
    .order('date');

  if (error) {
    console.error('Error:', error);
    return;
  }

  const karinaDays = karinaPTO.filter(p => p.echo_tech?.name === 'Karina');

  console.log('Karina PTO entries:');
  for (const entry of karinaDays) {
    const date = new Date(entry.date + 'T00:00:00');
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    console.log(`  ${entry.date} (${days[date.getDay()]}) - ${entry.time_block} - ${entry.reason || ''}`);
  }
}

async function main() {
  console.log('========================================');
  console.log('  Echo Dates Migration Script');
  console.log('========================================');

  // Fix PTO entries
  await fixEchoPTO();

  // Fix schedule assignments
  await fixEchoScheduleAssignments();

  // Verify the fix
  await verifyKarinaPTO();

  console.log('\n========================================');
  console.log('  Migration Complete!');
  console.log('========================================\n');
}

main().catch(console.error);
