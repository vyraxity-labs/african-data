import fs from 'node:fs';
import path from 'node:path';
import { prisma } from './client';
import { generateImportPreview } from './import/validate-import';

async function runImportPreviewTests() {
  console.log('--- Testing Step 7.4 Import Preview ---');

  // Verify baseline database record counts
  const initialResourceCount = await prisma.resource.count();
  const initialLinkCount = await prisma.resourceLink.count();
  console.log(`Baseline DB state: ${initialResourceCount} resources, ${initialLinkCount} links.`);

  // Test 1: Mock CSV with intentional anomalies
  console.log('\n[1] Testing mock CSV with duplicates, invalid URLs, missing fields, and unknown values...');
  const mockCsv = [
    'S/N,Source Name,Data Link,Source Website,Country / Coverage,Link Description,Source Type,Industry,Institution Name,Available Formats,Access Type,Update Frequency,Last Updated (latest data seen),Notes,Category,Data Granularity,Language,API Available,Link Status,Priority for Platform',
    // Row 2: Valid
    '1,Bank of Ghana Open Data,https://bog.gov.gh/data,https://bog.gov.gh,Ghana,Central bank data,Central Bank,Finance,Bank of Ghana,CSV,Free access,Monthly,2026,None,National,Country-level,English,No,Live,High',
    // Row 3: Duplicate URL of Row 2
    '2,Bank of Ghana Clone,https://bog.gov.gh/data,https://bog.gov.gh,Ghana,Duplicate entry,Central Bank,Finance,Bank of Ghana,CSV,Free access,Monthly,2026,None,National,Country-level,English,No,Live,High',
    // Row 4: Invalid URL
    '3,Invalid Site,not-a-valid-url,https://valid.com,Nigeria,Invalid url test,NGO,General,Test Org,PDF,Free access,Annual,2026,None,National,Country-level,English,No,Live,High',
    // Row 5: Missing required field (Source Name)
    '4,,https://example.org/missing-name,https://example.org,Kenya,Missing name test,Gov,Health,MOH,CSV,Free access,Annual,2026,None,National,Country-level,English,No,Live,High',
    // Row 6: Unknown values (Format and Coverage)
    '5,Future African AI,https://future-ai.africa,https://future-ai.africa,Quantum Zone,AI datasets,Private,Tech,Future Labs,HOLOGRAPHIC_STREAM,Free access,Continuous,2026,None,Pan-African,Country-level,English,No,Live,High',
  ].join('\n');

  const mockReport = await generateImportPreview(mockCsv, { checkDatabaseDuplicates: false });

  console.log('Mock CSV Preview Summary:');
  console.log(mockReport.formattedSummary);

  if (mockReport.totalRows !== 5) {
    throw new Error(`Expected 5 total rows, got ${mockReport.totalRows}`);
  }
  if (mockReport.potentialDuplicatesCount !== 1) {
    throw new Error(`Expected 1 potential duplicate, got ${mockReport.potentialDuplicatesCount}`);
  }
  if (mockReport.invalidUrlsCount !== 1) {
    throw new Error(`Expected 1 invalid URL, got ${mockReport.invalidUrlsCount}`);
  }
  if (mockReport.missingFieldsCount !== 1) {
    throw new Error(`Expected 1 missing field, got ${mockReport.missingFieldsCount}`);
  }
  if (mockReport.unknownValuesCount !== 2) {
    throw new Error(`Expected 2 unknown values (format & coverage), got ${mockReport.unknownValuesCount}`);
  }
  if (mockReport.validCount !== 2) {
    throw new Error(`Expected 2 valid rows (row 2 and row 6), got ${mockReport.validCount}`);
  }
  console.log('✓ Mock CSV validation counts strictly verified!');

  // Test 2: Preview development sample fixture
  console.log('\n[2] Testing import preview on sample development fixture (fixtures/sample-data-sources.csv)...');
  const fixturePath = path.resolve(__dirname, '../../../fixtures/sample-data-sources.csv');
  const fixtureContent = fs.readFileSync(fixturePath, 'utf-8');
  const fixtureReport = await generateImportPreview(fixtureContent, { checkDatabaseDuplicates: false });

  console.log('Sample Fixture Preview:');
  console.log(fixtureReport.formattedSummary);

  if (fixtureReport.totalRows !== 10) {
    throw new Error(`Expected 10 total rows for fixture, got ${fixtureReport.totalRows}`);
  }
  if (fixtureReport.validCount !== 10) {
    throw new Error(`Expected all 10 fixture rows to be valid, got ${fixtureReport.validCount}`);
  }
  console.log('✓ Sample development fixture preview verified (10/10 valid).');

  // Test 3: Preview full production dataset (african_csv_data.csv)
  console.log('\n[3] Testing import preview on production dataset (african_csv_data.csv)...');
  const prodCsvPath = path.resolve(__dirname, '../../../african_csv_data.csv');
  if (fs.existsSync(prodCsvPath)) {
    const prodContent = fs.readFileSync(prodCsvPath, 'utf-8');
    const prodReport = await generateImportPreview(prodContent, { checkDatabaseDuplicates: false });

    console.log('\nProduction Dataset Preview Report:');
    console.log('====================================');
    console.log(prodReport.formattedSummary);
    console.log('====================================');

    if (prodReport.totalRows !== 120) {
      throw new Error(`Expected 120 total rows for production dataset, got ${prodReport.totalRows}`);
    }
    if (prodReport.invalidUrlsCount !== 0) {
      throw new Error(`Expected 0 invalid URLs in production dataset, got ${prodReport.invalidUrlsCount}`);
    }
  }

  // Test 4: STRICT GUARANTEE VERIFICATION - Verify zero database writes occurred
  console.log('\n[4] Verifying ZERO database writes occurred during preview...');
  const afterResourceCount = await prisma.resource.count();
  const afterLinkCount = await prisma.resourceLink.count();

  if (afterResourceCount !== initialResourceCount) {
    throw new Error(`DATABASE WRITE DETECTED! Resource count changed from ${initialResourceCount} to ${afterResourceCount}`);
  }
  if (afterLinkCount !== initialLinkCount) {
    throw new Error(`DATABASE WRITE DETECTED! Link count changed from ${initialLinkCount} to ${afterLinkCount}`);
  }
  console.log(`✓ Absolute zero database writes verified: Resource count=${afterResourceCount}, Link count=${afterLinkCount}.`);

  console.log('\nAll Import Preview tests PASSED successfully!');
}

runImportPreviewTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Import preview testing failed:', err);
    process.exit(1);
  });
