import { prisma, ResourceStatus, LinkType } from './index';
import {
  validateCsvSecurity,
  sanitizeCsvFormulaInjection,
  parseCsv,
  normalizeCsvRecords,
  commitImport,
} from './import/index';

async function runAdminUploadTests() {
  console.log('--- Testing Step 7.5 Admin CSV Upload & Security ---');

  // Test 1: Security - File size limit
  console.log('\n[1] Testing file size limit validation...');
  const hugeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
  const sizeCheck = validateCsvSecurity(hugeBuffer, {
    fileName: 'large.csv',
    sizeBytes: hugeBuffer.length,
  });
  if (sizeCheck.isValid) {
    throw new Error('Test 1 failed: Expected rejection of >10MB file');
  }
  console.log(`✓ Excessively large file correctly rejected: "${sizeCheck.error}"`);

  // Test 2: Security - Invalid extension
  console.log('\n[2] Testing file extension validation...');
  const extCheck = validateCsvSecurity(Buffer.from('test'), {
    fileName: 'malicious.exe',
  });
  if (extCheck.isValid) {
    throw new Error('Test 2 failed: Expected rejection of .exe extension');
  }
  console.log(`✓ Non-csv extension rejected: "${extCheck.error}"`);

  // Test 3: Security - Binary file detection
  console.log('\n[3] Testing binary null-byte detection...');
  const binaryBuffer = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x00, 0x01]);
  const binaryCheck = validateCsvSecurity(binaryBuffer, { fileName: 'binary.csv' });
  if (binaryCheck.isValid) {
    throw new Error('Test 3 failed: Expected rejection of binary content with null bytes');
  }
  console.log(`✓ Binary file rejected: "${binaryCheck.error}"`);

  // Test 4: Security - CSV formula injection sanitization
  console.log('\n[4] Testing CSV formula injection sanitization...');
  const formula1 = '=cmd|"/C calc"!A0';
  const formula2 = '+2+5';
  const formula3 = '-10*5';
  const formula4 = '@SUM(A1:A10)';
  const normalText = 'Normal Text Value';

  if (!sanitizeCsvFormulaInjection(formula1).startsWith("'=")) {
    throw new Error('Test 4 failed: Formula = was not neutralized');
  }
  if (!sanitizeCsvFormulaInjection(formula2).startsWith("'+")) {
    throw new Error('Test 4 failed: Formula + was not neutralized');
  }
  if (!sanitizeCsvFormulaInjection(formula3).startsWith("'-")) {
    throw new Error('Test 4 failed: Formula - was not neutralized');
  }
  if (!sanitizeCsvFormulaInjection(formula4).startsWith("'@")) {
    throw new Error('Test 4 failed: Formula @ was not neutralized');
  }
  if (sanitizeCsvFormulaInjection(normalText) !== normalText) {
    throw new Error('Test 4 failed: Normal text was altered');
  }
  console.log('✓ All formula injection attack vectors sanitized with single-quote escaping.');

  // Test 5: End-to-end Transactional Ingestion of sample data
  console.log('\n[5] Testing transactional import pipeline with Institution resolution & Links...');
  const testPrefix = `test_ingest_${Date.now()}`;
  const uploadCsv = [
    'S/N,Source Name,Data Link,Source Website,Country / Coverage,Link Description,Source Type,Industry,Institution Name,Available Formats,Access Type,Update Frequency,Last Updated (latest data seen),Notes,Category,Data Granularity,Language,API Available,Link Status,Priority for Platform',
    `1,${testPrefix} Solar Irradiation Atlas,https://${testPrefix}.africa/solar,https://${testPrefix}.africa,Africa,High resolution continental solar irradiance data,Research,Energy,${testPrefix} African Solar Institute,"CSV, GeoTIFF, API",Free access,Monthly,2026,Key renewable dataset,Pan-African Source,Country-level,English and French,Yes,Live,High`,
    `2,${testPrefix} Mini Grid Tracker,https://${testPrefix}.africa/minigrids,https://${testPrefix}.africa,Africa,Rural mini grid deployment monitoring,Research,Energy,${testPrefix} African Solar Institute,"PDF, Excel",Free access,Annual,2026,Complements solar atlas,Pan-African Source,Country-level,English,No,Live,High`,
  ].join('\n');

  // Verify security on CSV
  const secPass = validateCsvSecurity(Buffer.from(uploadCsv), { fileName: 'upload.csv' });
  if (!secPass.isValid) {
    throw new Error(`Security check failed on valid CSV: ${secPass.error}`);
  }

  // Parse & normalize
  const parsed = parseCsv(uploadCsv);
  const normalized = normalizeCsvRecords(parsed.records);

  // Commit transaction
  const commitRes = await commitImport(normalized.records, {
    defaultStatus: ResourceStatus.ACTIVE,
    skipDuplicates: true,
  });

  if (!commitRes.success) {
    throw new Error(`Commit failed: ${JSON.stringify(commitRes.errors)}`);
  }
  if (commitRes.resourcesCreated !== 2) {
    throw new Error(`Expected 2 resources created, got ${commitRes.resourcesCreated}`);
  }
  if (commitRes.institutionsCreated !== 1) {
    throw new Error(`Expected 1 unique institution created for shared name, got ${commitRes.institutionsCreated}`);
  }
  if (commitRes.linksCreated !== 4) {
    // 2 data links + 2 distinct website links
    throw new Error(`Expected 4 links created, got ${commitRes.linksCreated}`);
  }
  console.log(`✓ Transactional import succeeded:`);
  console.log(`   - Resources Created: ${commitRes.resourcesCreated}`);
  console.log(`   - Institutions Created: ${commitRes.institutionsCreated}`);
  console.log(`   - Links Created: ${commitRes.linksCreated}`);

  // Test 6: Idempotent duplicate re-import
  console.log('\n[6] Testing re-import with duplicate detection (skipDuplicates: true)...');
  const reImportRes = await commitImport(normalized.records, {
    defaultStatus: ResourceStatus.ACTIVE,
    skipDuplicates: true,
  });
  if (reImportRes.resourcesCreated !== 0 || reImportRes.skippedDuplicates !== 2) {
    throw new Error(`Expected 0 created and 2 skipped duplicates, got ${reImportRes.resourcesCreated} created and ${reImportRes.skippedDuplicates} skipped`);
  }
  console.log(`✓ Idempotency verified: re-import safely skipped ${reImportRes.skippedDuplicates} duplicate records.`);

  // Cleanup test records
  console.log('\n[7] Cleaning up test records from database...');
  const createdResources = await prisma.resource.findMany({
    where: { name: { startsWith: testPrefix } },
    select: { id: true, institutionId: true },
  });
  const resIds = createdResources.map((r) => r.id);
  const instIds = createdResources.map((r) => r.institutionId).filter((id): id is string => Boolean(id));

  await prisma.resource.deleteMany({ where: { id: { in: resIds } } });
  if (instIds.length > 0) {
    await prisma.institution.deleteMany({ where: { id: { in: instIds } } });
  }
  console.log('✓ Cleanup completed.');

  console.log('\nAll Admin CSV Upload & Security tests PASSED successfully!');
}

runAdminUploadTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Admin upload testing failed:', err);
    process.exit(1);
  });
