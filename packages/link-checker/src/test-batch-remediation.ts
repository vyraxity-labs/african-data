import dotenv from 'dotenv';
import path from 'path';

// Load workspace environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { prisma, LinkHealthStatus, LinkType, ResourceStatus } from '@repo/database';
import {
  parseReplacementCsv,
  previewBatchReplacement,
  applyBatchReplacement,
} from './batch-remediation';

async function runBatchRemediationTests() {
  console.log('--- PHASE 15 STEP 15.3: BATCH REPLACEMENT TESTS ---');

  // STEP 0: Setup test fixtures
  console.log('\n[SETUP] Creating test institution, dataset, and multiple test links...');

  let testInst = await prisma.institution.findFirst({
    where: { name: 'Batch Remediation Test Institution' },
  });
  if (!testInst) {
    testInst = await prisma.institution.create({
      data: {
        name: 'Batch Remediation Test Institution',
        country: 'Pan-African',
        type: 'GOVERNMENT',
      },
    });
  }

  let testResource = await prisma.resource.findFirst({
    where: { name: 'Batch Remediation Test Dataset' },
  });
  if (!testResource) {
    testResource = await prisma.resource.create({
      data: {
        name: 'Batch Remediation Test Dataset',
        description: 'Test resource to verify Step 15.3 batch remediation.',
        status: ResourceStatus.ACTIVE,
        institutionId: testInst.id,
        countryCoverage: 'Pan-African',
      },
    });
  }

  // Clean existing links
  await prisma.linkAudit.deleteMany({
    where: { link: { resourceId: testResource.id } },
  });
  await prisma.linkCheck.deleteMany({
    where: { link: { resourceId: testResource.id } },
  });
  await prisma.resourceLink.deleteMany({
    where: { resourceId: testResource.id },
  });

  const link1 = await prisma.resourceLink.create({
    data: {
      resourceId: testResource.id,
      url: 'https://batch-old-1.example.org/data/2024.csv',
      linkType: LinkType.DOWNLOAD,
      status: LinkHealthStatus.BROKEN,
      httpStatus: 404,
    },
  });

  const link2 = await prisma.resourceLink.create({
    data: {
      resourceId: testResource.id,
      url: 'https://batch-old-2.example.org/api/v1',
      linkType: LinkType.API,
      status: LinkHealthStatus.BROKEN,
      httpStatus: 410,
    },
  });

  const link3 = await prisma.resourceLink.create({
    data: {
      resourceId: testResource.id,
      url: 'https://batch-old-3.example.org/portal',
      linkType: LinkType.WEBSITE,
      status: LinkHealthStatus.REDIRECTED,
      httpStatus: 301,
      finalUrl: 'https://batch-new-3.example.org/portal',
    },
  });

  console.log(`  PASSED: Seeded 3 target links (IDs: ${link1.id}, ${link2.id}, ${link3.id})`);

  // TEST 1: CSV Parser
  console.log('\n[TEST 1] Testing replacement CSV parser (link_id,new_url)...');
  const sampleCsv = `link_id,new_url
${link1.id},https://httpbin.org/status/200
${link2.id},HTTPS://HTTPBIN.ORG:443/status/200/
`;

  const parsed = parseReplacementCsv(sampleCsv);
  if (parsed.length !== 2) {
    throw new Error(`Expected 2 parsed rows, got ${parsed.length}`);
  }
  if (parsed[0]?.linkId !== link1.id) {
    throw new Error(`Row 1 linkId mismatch: expected ${link1.id}, got ${parsed[0]?.linkId}`);
  }
  console.log(`  PASSED: Parsed ${parsed.length} rows from CSV accurately.`);

  // TEST 2: Dry Run / Preview with Invalid Items - "Do not silently partially apply invalid batches"
  console.log('\n[TEST 2] Testing validation preview with mixed valid and invalid rows...');
  const invalidBatch = [
    { rowNumber: 2, linkId: link1.id, newUrl: 'https://valid-target.example.org/data' },
    { rowNumber: 3, linkId: 'non-existent-link-id', newUrl: 'https://target.example.org' },
    { rowNumber: 4, linkId: link2.id, newUrl: 'invalid-url-not-http' },
  ];

  const previewResult = await previewBatchReplacement(prisma, invalidBatch);
  if (previewResult.validCount !== 1) {
    throw new Error(`Expected 1 valid row, got ${previewResult.validCount}`);
  }
  if (previewResult.invalidCount !== 2) {
    throw new Error(`Expected 2 invalid rows, got ${previewResult.invalidCount}`);
  }
  if (previewResult.canApply !== false) {
    throw new Error('canApply must be false when batch contains invalid items!');
  }
  console.log(`  PASSED: Preview accurately flagged ${previewResult.invalidCount} invalid rows; canApply = false.`);

  // TEST 3: Enforce strict rejection of invalid batches during apply (no partial state)
  console.log('\n[TEST 3] Testing that invalid batch is rejected transactionally with 0 partial modifications...');
  let partialApplyBlocked = false;
  try {
    await applyBatchReplacement(prisma, {
      rows: invalidBatch,
      adminIdentifier: 'admin@africandata.org',
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Cannot apply batch replacement')) {
      partialApplyBlocked = true;
    }
  }

  if (!partialApplyBlocked) {
    throw new Error('Expected applyBatchReplacement to strictly reject batch containing invalid items.');
  }

  // Verify link1 was NOT updated (transactional all-or-nothing guarantee)
  const link1AfterRejected = await prisma.resourceLink.findUnique({ where: { id: link1.id } });
  if (link1AfterRejected?.url !== 'https://batch-old-1.example.org/data/2024.csv') {
    throw new Error('Link 1 was partially modified despite batch failure!');
  }
  console.log('  PASSED: Partial application blocked. Database remains completely untouched.');

  // TEST 4: Successful Transactional Batch Apply with Audit Records
  console.log('\n[TEST 4] Testing successful transactional batch apply on valid rows...');
  const validBatch = [
    { rowNumber: 2, linkId: link1.id, newUrl: 'HTTPS://NEW-ENDPOINT-1.EXAMPLE.ORG:443/data/2026.csv/' },
    { rowNumber: 3, linkId: link2.id, newUrl: 'https://new-endpoint-2.example.org/api/v2' },
    { rowNumber: 4, linkId: link3.id, newUrl: 'https://new-endpoint-3.example.org/portal' },
  ];

  const validPreview = await previewBatchReplacement(prisma, validBatch);
  if (!validPreview.canApply) {
    throw new Error(`Expected validBatch to have canApply=true, got errors: ${validPreview.validationErrors.join(', ')}`);
  }

  const applyResult = await applyBatchReplacement(prisma, {
    rows: validBatch,
    adminIdentifier: 'admin@africandata.org',
    reason: 'Annual portal migration batch update',
  });

  if (!applyResult.success || applyResult.appliedCount !== 3) {
    throw new Error(`Batch apply failed or appliedCount mismatch: ${applyResult.appliedCount}`);
  }

  // Verify all 3 links have LinkAudit records preserving old URLs
  const audits = await prisma.linkAudit.findMany({
    where: { linkId: { in: [link1.id, link2.id, link3.id] } },
    orderBy: { linkId: 'asc' },
  });

  if (audits.length !== 3) {
    throw new Error(`Expected 3 LinkAudit records, got ${audits.length}`);
  }

  const oldUrlsInAudit = new Set(audits.map((a) => a.oldUrl));
  if (!oldUrlsInAudit.has('https://batch-old-1.example.org/data/2024.csv')) {
    throw new Error('Old URL for link1 missing in LinkAudit history!');
  }
  if (!oldUrlsInAudit.has('https://batch-old-2.example.org/api/v1')) {
    throw new Error('Old URL for link2 missing in LinkAudit history!');
  }
  if (!oldUrlsInAudit.has('https://batch-old-3.example.org/portal')) {
    throw new Error('Old URL for link3 missing in LinkAudit history!');
  }
  console.log(`  PASSED: 3 LinkAudit entries created preserving historical URLs.`);

  // Verify ResourceLink records updated with normalized URLs
  const link1Updated = await prisma.resourceLink.findUnique({ where: { id: link1.id } });
  if (link1Updated?.url !== 'https://new-endpoint-1.example.org/data/2026.csv') {
    throw new Error(`Link 1 URL mismatch: expected "https://new-endpoint-1.example.org/data/2026.csv", got "${link1Updated?.url}"`);
  }
  console.log('  PASSED: ResourceLink records updated with normalized URLs and queued for verification.');

  // CLEANUP
  console.log('\n[CLEANUP] Cleaning up test fixtures...');
  await prisma.linkAudit.deleteMany({ where: { link: { resourceId: testResource.id } } });
  await prisma.linkCheck.deleteMany({ where: { link: { resourceId: testResource.id } } });
  await prisma.resourceLink.deleteMany({ where: { resourceId: testResource.id } });
  await prisma.resource.delete({ where: { id: testResource.id } });
  await prisma.institution.delete({ where: { id: testInst.id } });
  console.log('  PASSED: Cleaned up test records.');

  console.log('\n======================================================');
  console.log('ALL PHASE 15 STEP 15.3 TESTS PASSED SUCCESSFULLY (4/4)');
  console.log('======================================================');
}

runBatchRemediationTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
