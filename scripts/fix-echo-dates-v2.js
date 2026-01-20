/**
 * Fix Echo Dates Migration Script v2
 *
 * This script corrects specific dates based on the CSV reference data.
 * It fixes entries that were incorrectly shifted in the previous migration.
 *
 * Usage: node scripts/fix-echo-dates-v2.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Correct PTO dates based on CSV reference
// Format: { techName: [{ wrong: 'YYYY-MM-DD', correct: 'YYYY-MM-DD', reason: '...' }] }
const PTO_CORRECTIONS = {
  'Karina': [
    // 1/17 (Saturday) should be 1/16 (Friday) - was over-corrected
    { wrong: '2026-01-17', correct: '2026-01-16', reason: 'off' },
    // 1/29 (Thursday) should be 1/28 (Wednesday) - was over-corrected
    { wrong: '2026-01-29', correct: '2026-01-28', reason: 'off' },
  ],
  'Tomy': [
    // Need to check Tomy's dates from CSV
    // Wed 1/28: "Karina (off), Tomy" - Tomy off
    // Thu 1/29: "Tomy" - Tomy off
    // Fri 1/30: "Tomy" - Tomy off
    // The migrations shifted these forward, so:
    // 1/29 should be 1/28, 1/30 should be 1/29, 1/31 should be 1/30
    { wrong: '2026-01-29', correct: '2026-01-28', reason: '' },
    { wrong: '2026-01-30', correct: '2026-01-29', reason: '' },
    { wrong: '2026-01-31', correct: '2026-01-30', reason: '' },
  ],
  'Wendy': [
    // Thu 1/15: "Wendy" off
    // Fri 1/16: "Wendy, Karina (Off)" - Wendy off
    // The migration shifted 1/15->1/16 and 1/16->1/17
    // So 1/17 should be 1/16 (Wendy)
    { wrong: '2026-01-17', correct: '2026-01-16', reason: '' },
  ]
};

async function fixPTOCorrections() {
  console.log('\n=== Fixing PTO date corrections ===\n');

  for (const [techName, corrections] of Object.entries(PTO_CORRECTIONS)) {
    // Get tech ID
    const { data: tech } = await supabase
      .from('echo_techs')
      .select('id')
      .eq('name', techName)
      .single();

    if (!tech) {
      console.log(`Tech not found: ${techName}`);
      continue;
    }

    for (const correction of corrections) {
      console.log(`Fixing ${techName}: ${correction.wrong} -> ${correction.correct}`);

      // Update both AM and PM entries
      for (const timeBlock of ['AM', 'PM']) {
        const { error } = await supabase
          .from('echo_pto')
          .update({ date: correction.correct })
          .eq('echo_tech_id', tech.id)
          .eq('date', correction.wrong)
          .eq('time_block', timeBlock);

        if (error) {
          if (error.code === '23505') {
            // Already exists at correct date, delete the wrong one
            console.log(`  Deleting duplicate ${timeBlock} entry`);
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
}

async function verifyAllPTO() {
  console.log('\n=== Verifying all PTO entries ===\n');

  const { data: ptoEntries } = await supabase
    .from('echo_pto')
    .select('*, echo_tech:echo_techs(name)')
    .gte('date', '2026-01-01')
    .lte('date', '2026-01-31')
    .order('date');

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Group by date
  const byDate = {};
  for (const entry of ptoEntries) {
    if (!byDate[entry.date]) byDate[entry.date] = [];
    byDate[entry.date].push(entry);
  }

  for (const [date, entries] of Object.entries(byDate).sort()) {
    const d = new Date(date + 'T00:00:00');
    const dayName = days[d.getDay()];
    const names = [...new Set(entries.map(e => e.echo_tech?.name))].join(', ');
    const reasons = [...new Set(entries.map(e => e.reason).filter(Boolean))].join(', ');
    console.log(`${date} (${dayName}): ${names}${reasons ? ` - ${reasons}` : ''}`);
  }
}

async function main() {
  console.log('========================================');
  console.log('  Echo Dates Correction Script v2');
  console.log('========================================');

  await fixPTOCorrections();
  await verifyAllPTO();

  console.log('\n========================================');
  console.log('  Corrections Complete!');
  console.log('========================================\n');
}

main().catch(console.error);
