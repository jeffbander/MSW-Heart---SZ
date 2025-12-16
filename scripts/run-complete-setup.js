const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!supabaseUrl) {
  console.error('❌ Error: Missing Supabase URL in .env.local');
  process.exit(1);
}

// Extract project ID from URL
const projectId = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

console.log('\n🚀 CARDIOLOGY SCHEDULER - COMPLETE DATABASE SETUP\n');
console.log('=' .repeat(70));
console.log('\n📋 This will set up your database with:\n');
console.log('   ✓ 3 tables: providers, services, schedule_assignments');
console.log('   ✓ 32 providers with capabilities');
console.log('   ✓ 25 services (17 main calendar + 8 provider-only)\n');
console.log('=' .repeat(70));

try {
  // Read the SQL file
  const sqlPath = path.join(__dirname, 'complete-setup.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('\n✅ SQL file loaded successfully!\n');
  console.log('📍 INSTRUCTIONS:\n');
  console.log('1. Open the Supabase SQL Editor:');

  if (projectId) {
    console.log(`   🔗 https://supabase.com/dashboard/project/${projectId}/sql/new\n`);
  } else {
    console.log(`   🔗 ${supabaseUrl}/dashboard (navigate to SQL Editor)\n`);
  }

  console.log('2. Copy the SQL from: scripts/complete-setup.sql');
  console.log('   OR copy it from the output below\n');
  console.log('3. Paste into the SQL Editor\n');
  console.log('4. Click "Run" (or press Ctrl+Enter)\n');
  console.log('5. Verify the success message at the bottom\n');
  console.log('=' .repeat(70));
  console.log('\n📄 SQL CONTENT:\n');
  console.log('=' .repeat(70));
  console.log(sql);
  console.log('=' .repeat(70));
  console.log('\n✅ After running the SQL, your database will be ready!');
  console.log('\n💡 TIP: You can verify by checking:');
  console.log('   - Table Editor → should see 3 tables');
  console.log('   - providers table → should have 32 rows');
  console.log('   - services table → should have 25 rows\n');

} catch (error) {
  console.error('❌ Error reading SQL file:', error.message);
  console.error('\nMake sure complete-setup.sql exists in the scripts directory.');
  process.exit(1);
}
