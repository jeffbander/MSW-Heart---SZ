/**
 * Final Echo Dates Correction Script
 *
 * This script corrects remaining date issues based on the CSV reference.
 *
 * Usage: node scripts/fix-echo-dates-final.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Final corrections based on CSV comparison
const FINAL_CORRECTIONS = [
  // Linda: 1/3 (Sat) should be 1/2 (Fri)
  { techName: 'Linda', wrong: '2026-01-03', correct: '2026-01-02' },
  // Lisa sick: 1/7 (Wed) should be 1/8 (Thu)
  { techName: 'Lisa', wrong: '2026-01-07', correct: '2026-01-08' },
  // Linda: 1/13 (Tue) should be 1/12 (Mon)
  { techName: 'Linda', wrong: '2026-01-13', correct: '2026-01-12' },
];

// Missing entries to add
const MISSING_ENTRIES = [
  // Tomy should also be off on Thu 1/29
  { techName: 'Tomy', date: '2026-01-29', timeBlocks: ['AM', 'PM'], reason: '' },
];

async function applyFinalCorrections() {
  console.log('\n=== Applying final corrections ===\n');

  for (const correction of FINAL_CORRECTIONS) {
    // Get tech ID
    const { data: tech } = await supabase
      .from('echo_techs')
      .select('id')
      .eq('name', correction.techName)
      .single();

    if (!tech) {
      console.log(`Tech not found: ${correction.techName}`);
      continue;
    }

    console.log(`Fixing ${correction.techName}: ${correction.wrong} -> ${correction.correct}`);

    for (const timeBlock of ['AM', 'PM']) {
      // First try to update
      const { error } = await supabase
        .from('echo_pto')
        .update({ date: correction.correct })
        .eq('echo_tech_id', tech.id)
        .eq('date', correction.wrong)
        .eq('time_block', timeBlock);

      if (error) {
        if (error.code === '23505') {
          // Already exists at correct date, delete the wrong one
          console.log(`  Deleting duplicate ${timeBlock} entry at ${correction.wrong}`);
          await supabase
            .from('echo_pto')
            .delete()
            .eq('echo_tech_id', tech.id)
            .eq('date', correction.wrong)
            .eq('time_block', timeBlock);
        } else {
          console.log(`  Error (${timeBlock}): ${error.message}`);
        }
      }
    }
  }
}

async function addMissingEntries() {
  console.log('\n=== Adding missing entries ===\n');

  for (const entry of MISSING_ENTRIES) {
    const { data: tech } = await supabase
      .from('echo_techs')
      .select('id')
      .eq('name', entry.techName)
      .single();

    if (!tech) {
      console.log(`Tech not found: ${entry.techName}`);
      continue;
    }

    for (const timeBlock of entry.timeBlocks) {
      console.log(`Adding ${entry.techName} PTO: ${entry.date} ${timeBlock}`);

      const { error } = await supabase
        .from('echo_pto')
        .insert({
          echo_tech_id: tech.id,
          date: entry.date,
          time_block: timeBlock,
          reason: entry.reason
        });

      if (error) {
        if (error.code === '23505') {
          console.log(`  Already exists`);
        } else {
          console.log(`  Error: ${error.message}`);
        }
      }
    }
  }
}

async function verifyAgainstCSV() {
  console.log('\n=== Verifying against CSV reference ===\n');

  // Expected PTO from CSV
  const expected = {
    '2026-01-02': ['Linda'],           // Fri 1/2
    '2026-01-07': ['Karina'],          // Wed 1/7 - Karina off
    '2026-01-08': ['Lisa'],            // Thu 1/8 - Lisa sick
    '2026-01-09': ['Lisa'],            // Fri 1/9 - Lisa
    '2026-01-12': ['Linda'],           // Mon 1/12 - Linda
    '2026-01-15': ['Wendy'],           // Thu 1/15 - Wendy
    '2026-01-16': ['Wendy', 'Karina'], // Fri 1/16 - Wendy, Karina
    '2026-01-21': ['Karina'],          // Wed 1/21 - Karina
    '2026-01-28': ['Karina', 'Tomy'],  // Wed 1/28 - Karina, Tomy
    '2026-01-29': ['Tomy'],            // Thu 1/29 - Tomy
    '2026-01-30': ['Tomy'],            // Fri 1/30 - Tomy
  };

  const { data: ptoEntries } = await supabase
    .from('echo_pto')
    .select('*, echo_tech:echo_techs(name)')
    .gte('date', '2026-01-01')
    .lte('date', '2026-01-31')
    .order('date');

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Group by date
  const actual = {};
  for (const entry of ptoEntries) {
    if (!actual[entry.date]) actual[entry.date] = new Set();
    actual[entry.date].add(entry.echo_tech?.name);
  }

  console.log('Date         | Day | Expected         | Actual           | Status');
  console.log('-------------|-----|------------------|------------------|-------');

  const allDates = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  for (const date of [...allDates].sort()) {
    const d = new Date(date + 'T00:00:00');
    const dayName = days[d.getDay()];
    const exp = expected[date] ? expected[date].sort().join(', ') : '-';
    const act = actual[date] ? [...actual[date]].sort().join(', ') : '-';
    const status = exp === act ? '✓' : '✗';
    console.log(`${date} | ${dayName} | ${exp.padEnd(16)} | ${act.padEnd(16)} | ${status}`);
  }
}

async function main() {
  console.log('========================================');
  console.log('  Final Echo Dates Correction');
  console.log('========================================');

  await applyFinalCorrections();
  await addMissingEntries();
  await verifyAgainstCSV();

  console.log('\n========================================');
  console.log('  Done!');
  console.log('========================================\n');
}

main().catch(console.error);
