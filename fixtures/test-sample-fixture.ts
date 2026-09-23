import fs from 'node:fs';
import path from 'node:path';

const EXPECTED_HEADERS = [
  'S/N',
  'Source Name',
  'Data Link',
  'Source Website',
  'Country / Coverage',
  'Link Description',
  'Source Type',
  'Industry',
  'Institution Name',
  'Available Formats',
  'Access Type',
  'Update Frequency',
  'Last Updated (latest data seen)',
  'Notes',
  'Category',
  'Data Granularity',
  'Language',
  'API Available',
  'Link Status',
  'Priority for Platform',
];

/**
 * Standard RFC 4180 compliant CSV line tokenizer
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(currentField);
      currentField = '';
    } else {
      currentField += char;
    }
  }

  fields.push(currentField);
  return fields;
}

function verifyFixtureFile(filePath: string) {
  console.log(`Checking fixture at: ${filePath}`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Fixture file not found at ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error(`Fixture file must contain a header and at least one data row`);
  }

  // 1. Verify headers
  const firstLine = lines[0];
  if (!firstLine) {
    throw new Error('Fixture file is missing header row');
  }
  const headers = parseCsvLine(firstLine);
  if (headers.length !== EXPECTED_HEADERS.length) {
    throw new Error(
      `Expected ${EXPECTED_HEADERS.length} columns in header, but got ${headers.length}`
    );
  }

  for (let i = 0; i < EXPECTED_HEADERS.length; i++) {
    if (headers[i] !== EXPECTED_HEADERS[i]) {
      throw new Error(`Header mismatch at column ${i}: expected "${EXPECTED_HEADERS[i]}", got "${headers[i]}"`);
    }
  }
  console.log(`✓ Headers verified: ${headers.length} exact matching columns.`);

  // 2. Verify data rows
  const dataRows = lines.slice(1).map((line, idx) => {
    const parsed = parseCsvLine(line);
    if (parsed.length !== EXPECTED_HEADERS.length) {
      throw new Error(
        `Row ${idx + 2} has ${parsed.length} fields; expected ${EXPECTED_HEADERS.length}`
      );
    }
    return parsed;
  });

  console.log(`✓ Verified ${dataRows.length} representative data rows without parsing errors.`);

  // 3. Verify representative cases
  const formatsWithCommas = dataRows.some((row) => row[9]?.includes(','));
  if (!formatsWithCommas) {
    throw new Error('Expected at least one row with comma-separated Available Formats in quotes');
  }
  console.log('✓ Quoted values with embedded commas verified.');

  const hasApiYes = dataRows.some((row) => row[17] === 'Yes');
  const hasApiNo = dataRows.some((row) => row[17] === 'No');
  if (!hasApiYes || !hasApiNo) {
    throw new Error('Fixture must contain representative rows for both API Available = Yes and No');
  }
  console.log('✓ API Available variations (Yes / No) verified.');

  const hasHighPriority = dataRows.some((row) => row[19] === 'High');
  const hasMediumHighPriority = dataRows.some((row) => row[19] === 'Medium-High');
  if (!hasHighPriority || !hasMediumHighPriority) {
    throw new Error('Fixture must contain representative priority variations');
  }
  console.log('✓ Priority variations (High / Medium-High) verified.');

  const accessTypes = new Set(dataRows.map((row) => row[10]));
  if (accessTypes.size < 3) {
    throw new Error('Fixture must include varied access types');
  }
  console.log(`✓ Access type variations verified: ${Array.from(accessTypes).join(', ')}.`);
}

async function run() {
  console.log('--- Verifying Step 7.1 Sample CSV Fixture ---');

  const rootFixture = path.resolve(__dirname, 'sample-data-sources.csv');
  const dbFixture = path.resolve(__dirname, '../packages/database/fixtures/sample-data-sources.csv');

  verifyFixtureFile(rootFixture);
  verifyFixtureFile(dbFixture);

  console.log('All sample CSV fixture checks PASSED.');
}

run().catch((err) => {
  console.error('Fixture verification failed:', err);
  process.exit(1);
});
