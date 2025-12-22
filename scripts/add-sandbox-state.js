const fs = require('fs');
const file = 'app/components/MainCalendar.tsx';
let content = fs.readFileSync(file, 'utf8');

// Normalize to LF
content = content.replace(/\r\n/g, '\n');

const oldStr = `const [pickerDate, setPickerDate] = useState(new Date());

  // Provider View filters`;

const newStr = `const [pickerDate, setPickerDate] = useState(new Date());

  // Sandbox mode
  const [sandboxMode, setSandboxMode] = useState(false);
  const [sandboxSessionId, setSandboxSessionId] = useState<string | null>(null);

  // Provider View filters`;

if (content.includes(oldStr)) {
  content = content.replace(oldStr, newStr);
  // Convert back to CRLF for Windows
  content = content.replace(/\n/g, '\r\n');
  fs.writeFileSync(file, content);
  console.log('Sandbox state added successfully');
} else {
  console.log('Pattern not found');
  console.log('Looking for pickerDate...');
  const idx = content.indexOf('pickerDate');
  if (idx > -1) {
    console.log('Context:', content.substring(idx - 50, idx + 100));
  }
}
