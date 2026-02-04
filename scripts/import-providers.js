const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
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

async function importProviders() {
  console.log('🚀 Starting provider import...\n');

  try {
    // Read the Excel file
    const filePath = 'C:\\Users\\zakows01\\Downloads\\Providers sheet for MSW Heart.xlsx';
    console.log('📄 Reading Excel file:', filePath);

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    console.log(`✅ Found ${data.length} providers in the spreadsheet\n`);

    // Transform data for database
    const providers = data.map(row => {
      // Split capabilities by comma and trim whitespace
      const capabilitiesArray = row['Capabilities']
        ? row['Capabilities'].split(',').map(cap => cap.trim())
        : [];

      // Handle allotted_rooms - convert "N/A" or non-numeric values to 0
      let allottedRooms = 0;
      if (row['Allotted Rooms'] && typeof row['Allotted Rooms'] === 'number') {
        allottedRooms = row['Allotted Rooms'];
      } else if (row['Allotted Rooms'] && !isNaN(parseInt(row['Allotted Rooms']))) {
        allottedRooms = parseInt(row['Allotted Rooms']);
      }

      return {
        initials: (row['Provider Initials '] || '').trim(), // Note the space in column name
        full_name: row['Provider Name'],
        credentials: row['Credentials'],
        allotted_rooms: allottedRooms,
        capabilities: capabilitiesArray,
        clinic_days: row['MSW Clinic Days'],
        is_active: true
      };
    });

    // Insert providers into database
    console.log('📤 Uploading providers to Supabase...\n');

    const { data: insertedData, error } = await supabase
      .from('providers')
      .insert(providers)
      .select();

    if (error) {
      console.error('❌ Error inserting providers:', error.message);
      console.error('Details:', error);
      process.exit(1);
    }

    console.log(`✅ Successfully imported ${insertedData.length} providers!\n`);

    // Display summary
    console.log('📋 Provider Summary:');
    console.log('═'.repeat(60));
    insertedData.forEach((provider, index) => {
      console.log(`${index + 1}. ${provider.initials} - ${provider.full_name}`);
      console.log(`   Credentials: ${provider.credentials}`);
      console.log(`   Rooms: ${provider.allotted_rooms}`);
      console.log(`   Clinic Days: ${provider.clinic_days}`);
      console.log(`   Capabilities: ${provider.capabilities.join(', ')}`);
      console.log('');
    });
    console.log('═'.repeat(60));
    console.log('\n🎉 Import complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

importProviders();
