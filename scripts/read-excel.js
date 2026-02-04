const XLSX = require('xlsx');
const path = require('path');

// Read the Excel file
const filePath = 'C:\\Users\\zakows01\\Downloads\\Providers sheet for MSW Heart.xlsx';
const workbook = XLSX.readFile(filePath);

// Get the first sheet
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

// Convert to JSON
const data = XLSX.utils.sheet_to_json(sheet);

console.log('Sheet Name:', sheetName);
console.log('\nTotal Rows:', data.length);
console.log('\nColumn Names:', Object.keys(data[0] || {}));
console.log('\nFirst 3 rows:');
console.log(JSON.stringify(data.slice(0, 3), null, 2));
