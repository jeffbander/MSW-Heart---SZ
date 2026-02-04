const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Error: Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function setupDatabase() {
  console.log('🚀 Starting database setup...\n');

  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'setup-database.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 SQL file loaded successfully');
    console.log('⚠️  NOTE: You need to run this SQL in the Supabase SQL Editor');
    console.log('🔗 Go to: https://supabase.com/dashboard/project/kmsejdzutpoulsegnoqe/sql/new\n');
    console.log('📋 Copy and paste the following SQL:\n');
    console.log('=' .repeat(60));
    console.log(sql);
    console.log('=' .repeat(60));
    console.log('\n✅ Instructions:');
    console.log('1. Go to your Supabase project dashboard');
    console.log('2. Click on "SQL Editor" in the left sidebar');
    console.log('3. Click "New Query"');
    console.log('4. Copy the SQL above and paste it into the editor');
    console.log('5. Click "Run" to execute');
    console.log('\nAlternatively, the SQL is saved in: scripts/setup-database.sql');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

setupDatabase();
