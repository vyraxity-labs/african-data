import {
  sanitizeSpreadsheetFormula,
  formatCsvCell,
  buildCsvRow,
  buildCsv,
  FORMULA_TRIGGERS,
} from './csv-sanitizer';
import { exportCatalogueToCsv, ExportableResource } from './catalogue-export';

function runCsvSanitizerTests() {
  console.log('--- RUNNING PHASE 17: CSV EXPORT & FORMULA INJECTION TESTS ---');

  // TEST 1: Values beginning with '='
  console.log("\n[TEST 1] Testing formula injection mitigation for '=' trigger...");
  const equalsFormulas = [
    '=1+1',
    '=SUM(A1:B10)',
    "=CMD|' /C calc'!A0",
    '=HYPERLINK("https://malicious.site", "Click Here")',
    '=2+5*cmd',
  ];
  for (const formula of equalsFormulas) {
    const sanitized = sanitizeSpreadsheetFormula(formula);
    if (!sanitized.startsWith("'=")) {
      throw new Error(`Failed to sanitize '=' formula: ${formula} -> ${sanitized}`);
    }
    const formattedCell = formatCsvCell(formula);
    if (!formattedCell.startsWith("\"'=") && !formattedCell.startsWith("'=")) {
      throw new Error(`CSV cell output unsafe for '${formula}': ${formattedCell}`);
    }
  }
  console.log("  PASSED: All '=' formula triggers safely prepended with single quote (').");

  // TEST 2: Values beginning with '+'
  console.log("\n[TEST 2] Testing formula injection mitigation for '+' trigger...");
  const plusFormulas = [
    '+1+1',
    '+cmd',
    '+234 801 234 5678',
    '+SUM(A1:B5)',
  ];
  for (const formula of plusFormulas) {
    const sanitized = sanitizeSpreadsheetFormula(formula);
    if (!sanitized.startsWith("'+")) {
      throw new Error(`Failed to sanitize '+' formula: ${formula} -> ${sanitized}`);
    }
  }
  console.log("  PASSED: All '+' formula triggers safely prepended with single quote (').");

  // TEST 3: Values beginning with '-'
  console.log("\n[TEST 3] Testing formula injection mitigation for '-' trigger...");
  const minusFormulas = [
    '-2+3',
    '-cmd|',
    '-10% decline in GDP',
    '-5',
  ];
  for (const formula of minusFormulas) {
    const sanitized = sanitizeSpreadsheetFormula(formula);
    if (!sanitized.startsWith("'-")) {
      throw new Error(`Failed to sanitize '-' formula: ${formula} -> ${sanitized}`);
    }
  }
  console.log("  PASSED: All '-' formula triggers safely prepended with single quote (').");

  // TEST 4: Values beginning with '@'
  console.log("\n[TEST 4] Testing formula injection mitigation for '@' trigger...");
  const atFormulas = [
    '@SUM(A1:A10)',
    '@africandata',
    '@echo off',
    '@calc.exe',
  ];
  for (const formula of atFormulas) {
    const sanitized = sanitizeSpreadsheetFormula(formula);
    if (!sanitized.startsWith("'@")) {
      throw new Error(`Failed to sanitize '@' formula: ${formula} -> ${sanitized}`);
    }
  }
  console.log("  PASSED: All '@' formula triggers safely prepended with single quote (').");

  // TEST 5: Values with leading whitespace or control characters before triggers
  console.log('\n[TEST 5] Testing leading whitespace & control characters before triggers...');
  const whitespaceTests = [
    { input: '   =1+1', expectedPrefix: "'   =" },
    { input: '  +cmd', expectedPrefix: "'  +" },
    { input: ' \t-2+3', expectedPrefix: "' \t-" },
    { input: '\t@SUM(A1)', expectedPrefix: "'\t@" },
    { input: '\r\n=calc', expectedPrefix: "'\r\n=" },
  ];
  for (const test of whitespaceTests) {
    const sanitized = sanitizeSpreadsheetFormula(test.input);
    if (!sanitized.startsWith(test.expectedPrefix)) {
      throw new Error(`Leading whitespace bypass: '${test.input}' became '${sanitized}'`);
    }
  }
  console.log('  PASSED: Leading whitespace/control character bypasses neutralized.');

  // TEST 6: Normal values remain untampered
  console.log('\n[TEST 6] Testing normal values without formula triggers...');
  const normalValues = [
    'African Development Bank',
    'https://au-afcfta.org/',
    'Pan-African Health Statistics',
    'Kenya, Nigeria, South Africa',
    '2026',
    'Free access',
    'English and French',
  ];
  for (const val of normalValues) {
    const sanitized = sanitizeSpreadsheetFormula(val);
    if (sanitized !== val) {
      throw new Error(`Normal value was mutated: '${val}' -> '${sanitized}'`);
    }
  }
  console.log('  PASSED: Normal catalogue fields are preserved without mutation.');

  // TEST 7: Already escaped values do not double-escape
  console.log('\n[TEST 7] Testing idempotency / no double-escaping...');
  const alreadyEscaped = "'=1+1";
  if (sanitizeSpreadsheetFormula(alreadyEscaped) !== alreadyEscaped) {
    throw new Error(`Double-escaped already safe value: ${sanitizeSpreadsheetFormula(alreadyEscaped)}`);
  }
  console.log('  PASSED: Idempotency confirmed.');

  // TEST 8: RFC 4180 escaping and UTF-8 BOM
  console.log('\n[TEST 8] Testing RFC 4180 CSV generation & UTF-8 BOM...');
  const testRows = [
    ['Header1', 'Header2', 'Header3'],
    ['Normal text', '=1+1', 'Contains "quotes" and, commas\nand newlines'],
  ];
  const csvDoc = buildCsv(testRows.slice(1), testRows[0]);

  // Check BOM
  if (!csvDoc.startsWith('\uFEFF')) {
    throw new Error('CSV is missing UTF-8 Byte Order Mark (\\uFEFF)');
  }

  // Check CRLF
  if (!csvDoc.includes('\r\n')) {
    throw new Error('CSV does not use RFC 4180 CRLF (\\r\\n) line endings');
  }

  // Check that the formula cell is quoted and prefixed with apostrophe
  if (!csvDoc.includes("\"'=1+1\"")) {
    throw new Error(`Formula cell not properly quoted in CSV: ${csvDoc}`);
  }

  // Check double quotes escaping
  if (!csvDoc.includes('""quotes""')) {
    throw new Error(`Double quotes not escaped in CSV: ${csvDoc}`);
  }
  console.log('  PASSED: RFC 4180 escaping and UTF-8 BOM verified.');

  // TEST 9: Full Catalogue Export with Formula Injection Attacks in Metadata
  console.log('\n[TEST 9] Testing full catalogue export with malicious payloads in fields...');
  const mockCatalogue: ExportableResource[] = [
    {
      name: '=DDE("cmd";"/C calc";"__DUMMY__")',
      description: '+cmd|"/C powershell -c calc"!A0',
      countryCoverage: '-Pan-African Regional Body',
      institution: {
        name: '@AfCFTA Secretariat',
        country: 'Ghana',
        website: 'https://au-afcfta.org/',
      },
      links: [
        {
          url: 'https://au-afcfta.org/data',
          linkType: 'DATA',
          status: 'HEALTHY',
          httpStatus: 200,
          responseTimeMs: 95,
          lastCheckedAt: new Date('2026-09-20T10:00:00Z'),
        },
      ],
      notes: '=SUM(1,2,3)',
      priority: 'High',
      status: 'ACTIVE',
    },
    {
      name: 'Safe African Dataset',
      description: 'Standard dataset description for development metrics.',
      countryCoverage: 'Kenya',
      institution: {
        name: 'Kenya National Bureau of Statistics',
        country: 'Kenya',
      },
      links: [
        {
          url: 'https://www.knbs.or.ke/',
          linkType: 'DATA',
          status: 'HEALTHY',
          httpStatus: 200,
          responseTimeMs: 140,
        },
      ],
      notes: 'No issues found',
      priority: 'High',
      status: 'ACTIVE',
    },
  ];

  const catalogueCsv = exportCatalogueToCsv(mockCatalogue);

  // Verify none of the lines start with unquoted or unescaped formula triggers
  const lines = catalogueCsv.replace(/^\uFEFF/, '').split('\r\n').filter(Boolean);
  if (lines.length !== 3) {
    // 1 header + 2 rows
    throw new Error(`Expected 3 lines, got ${lines.length}`);
  }

  // Check that malicious fields in line 2 are neutralized
  const maliciousRow = lines[1];
  if (!maliciousRow) {
    throw new Error('Expected malicious row in export');
  }

  // In line 2:
  // Name was '=DDE...', must be "'=DDE..."
  // Description was '+cmd...', must be "'+cmd..."
  // CountryCoverage was '-Pan-African...', must be "'-Pan-African..."
  // Institution Name was '@AfCFTA...', must be "'@AfCFTA..."
  // Notes was '=SUM...', must be "'=SUM..."
  if (!maliciousRow.includes("\"'=DDE(\"\"cmd\"\"")) {
    throw new Error(`Name formula was not neutralized: ${maliciousRow}`);
  }
  if (!maliciousRow.includes("\"'+cmd|\"\"/C powershell")) {
    throw new Error(`Description formula was not neutralized: ${maliciousRow}`);
  }
  if (!maliciousRow.includes("\"'-Pan-African Regional Body\"")) {
    throw new Error(`Country coverage formula was not neutralized: ${maliciousRow}`);
  }
  if (!maliciousRow.includes("\"'@AfCFTA Secretariat\"")) {
    throw new Error(`Institution formula was not neutralized: ${maliciousRow}`);
  }
  if (!maliciousRow.includes("\"'=SUM(1,2,3)\"")) {
    throw new Error(`Notes formula was not neutralized: ${maliciousRow}`);
  }

  console.log('  PASSED: Full catalogue export safely sanitized all malicious spreadsheet formula payloads.');

  console.log('\n========================================================================');
  console.log('✅ ALL PHASE 17 CSV EXPORT & FORMULA INJECTION TESTS PASSED (9/9)');
  console.log('========================================================================\n');
}

runCsvSanitizerTests();
