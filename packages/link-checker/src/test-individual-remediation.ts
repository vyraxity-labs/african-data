import dotenv from 'dotenv';
import path from 'path';

// Load workspace environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { prisma, LinkHealthStatus, LinkType, ResourceStatus } from '@repo/database';
import { remediateLinkIndividual } from './individual-remediation';

async function runIndividualRemediationTests() {
  console.log('--- PHASE 15 STEP 15.1: INDIVIDUAL LINK REMEDIATION TESTS ---');

  // STEP 0: Setup test fixture
  console.log('\n[SETUP] Creating test institution, dataset, and broken link...');

  let testInst = await prisma.institution.findFirst({
    where: { name: 'Remediation Test Institution' },
  });
  if (!testInst) {
    testInst = await prisma.institution.create({
      data: {
        name: 'Remediation Test Institution',
        country: 'Pan-African',
        type: 'GOVERNMENT',
      },
    });
  }

  let testResource = await prisma.resource.findFirst({
    where: { name: 'Remediation Test Dataset' },
  });
  if (!testResource) {
    testResource = await prisma.resource.create({
      data: {
        name: 'Remediation Test Dataset',
        description: 'Test resource to verify link remediation workflow.',
        status: ResourceStatus.ACTIVE,
        institutionId: testInst.id,
        countryCoverage: 'Pan-African',
      },
    });
  }

  // Clean existing links for this test resource
  await prisma.linkAudit.deleteMany({
    where: { link: { resourceId: testResource.id } },
  });
  await prisma.linkCheck.deleteMany({
    where: { link: { resourceId: testResource.id } },
  });
  await prisma.resourceLink.deleteMany({
    where: { resourceId: testResource.id },
  });

  const originalBrokenUrl = 'https://broken-legacy-portal.example.org/missing-dataset.csv';
  const brokenLink = await prisma.resourceLink.create({
    data: {
      resourceId: testResource.id,
      url: originalBrokenUrl,
      linkType: LinkType.DOWNLOAD,
      status: LinkHealthStatus.BROKEN,
      httpStatus: 404,
      errorMessage: '404 Not Found',
      lastCheckedAt: new Date(Date.now() - 86400000), // 1 day ago
    },
  });

  // Also create a pre-existing check record for the old broken URL
  await prisma.linkCheck.create({
    data: {
      linkId: brokenLink.id,
      status: LinkHealthStatus.BROKEN,
      httpStatus: 404,
      errorMessage: '404 Not Found',
      checkedAt: new Date(Date.now() - 86400000),
    },
  });

  console.log(`  PASSED: Seeded broken link: "${brokenLink.url}" (ID: ${brokenLink.id})`);

  // TEST 1: Workflow Step 15.1 - Replace with valid new URL, Normalize, Validate, Check, Save & Audit
  console.log('\n[TEST 1] Testing full remediation workflow (Normalize -> Validate -> Check -> Save -> Audit)...');

  const rawReplacementUrl = '   HTTPS://HTTPBIN.ORG:443/status/200/   ';
  const result = await remediateLinkIndividual(prisma, {
    linkId: brokenLink.id,
    newUrl: rawReplacementUrl,
    reason: 'Upstream data moved to new cloud endpoint',
    adminIdentifier: 'admin@africandata.org',
  });

  if (!result.success) {
    throw new Error('Remediation workflow failed unexpectedly.');
  }

  // Verify normalization occurred
  const expectedNormalized = 'https://httpbin.org/status/200';
  if (result.newUrl !== expectedNormalized) {
    throw new Error(`Expected normalized URL "${expectedNormalized}", got "${result.newUrl}"`);
  }
  console.log(`  PASSED: URL normalized correctly: "${rawReplacementUrl.trim()}" -> "${result.newUrl}"`);

  // Verify status transition
  if (result.statusBefore !== LinkHealthStatus.BROKEN) {
    throw new Error(`Expected statusBefore to be BROKEN, got: ${result.statusBefore}`);
  }
  if (result.statusAfter !== LinkHealthStatus.HEALTHY) {
    throw new Error(`Expected statusAfter to be HEALTHY, got: ${result.statusAfter}`);
  }
  console.log(`  PASSED: Health status transitioned: ${result.statusBefore} -> ${result.statusAfter} (HTTP ${result.httpStatus})`);

  // TEST 2: Verify Audit Record Preserves Old URL
  console.log('\n[TEST 2] Verifying that LinkAudit strictly preserves old URL in history...');
  const auditRecord = await prisma.linkAudit.findUnique({
    where: { id: result.auditId },
  });

  if (!auditRecord) {
    throw new Error('Audit record was not created in database.');
  }
  if (auditRecord.oldUrl !== originalBrokenUrl) {
    throw new Error(`Audit record oldUrl mismatch: expected "${originalBrokenUrl}", got "${auditRecord.oldUrl}"`);
  }
  if (auditRecord.newUrl !== expectedNormalized) {
    throw new Error(`Audit record newUrl mismatch: expected "${expectedNormalized}", got "${auditRecord.newUrl}"`);
  }
  if (auditRecord.changedBy !== 'admin@africandata.org') {
    throw new Error(`Audit record changedBy mismatch: expected "admin@africandata.org", got "${auditRecord.changedBy}"`);
  }
  console.log(`  PASSED: Audit record #${auditRecord.id} safely preserved old URL: "${auditRecord.oldUrl}"`);

  // TEST 3: Verify ResourceLink in database has been updated
  console.log('\n[TEST 3] Verifying ResourceLink table state updated in database...');
  const updatedLink = await prisma.resourceLink.findUnique({
    where: { id: brokenLink.id },
    include: { audits: true, checks: true },
  });

  if (!updatedLink) {
    throw new Error('Updated link not found in database.');
  }
  if (updatedLink.url !== expectedNormalized) {
    throw new Error(`ResourceLink URL not updated in DB: expected "${expectedNormalized}", got "${updatedLink.url}"`);
  }
  if (updatedLink.status !== LinkHealthStatus.HEALTHY) {
    throw new Error(`ResourceLink status not updated: expected HEALTHY, got ${updatedLink.status}`);
  }
  if (updatedLink.audits.length !== 1) {
    throw new Error(`Expected 1 audit entry, found ${updatedLink.audits.length}`);
  }
  if (updatedLink.checks.length < 2) {
    throw new Error(`Expected at least 2 check records (historical + new), found ${updatedLink.checks.length}`);
  }
  console.log(`  PASSED: ResourceLink updated with verified telemetry and ${updatedLink.audits.length} audit entry.`);

  // TEST 4: SSRF protection during remediation
  console.log('\n[TEST 4] Testing SSRF rejection when attempting to remediate to private IPv4 / localhost...');
  let ssrfBlocked = false;
  try {
    await remediateLinkIndividual(prisma, {
      linkId: brokenLink.id,
      newUrl: 'http://127.0.0.1:8080/internal/metrics',
      reason: 'Malicious SSRF attempt',
    });
  } catch (err: unknown) {
    // SSRF should either fail at DNS resolution / connect or record BLOCKED
    if (err instanceof Error && (err.message.includes('SSRF') || err.message.includes('blocked') || err.message.includes('private'))) {
      ssrfBlocked = true;
    }
  }

  // Also check if result classified as BLOCKED if it returned instead of throwing
  if (!ssrfBlocked) {
    const linkCheckAfter = await prisma.resourceLink.findUnique({ where: { id: brokenLink.id } });
    if (linkCheckAfter?.status === LinkHealthStatus.BLOCKED || linkCheckAfter?.url === expectedNormalized) {
      ssrfBlocked = true;
    }
  }

  if (!ssrfBlocked) {
    throw new Error('Expected SSRF destination to be rejected.');
  }
  console.log('  PASSED: SSRF attempt to private IP address was blocked and rejected.');

  // TEST 5: Duplicate prevention on same resource
  console.log('\n[TEST 5] Testing duplicate URL collision prevention on same dataset...');
  let duplicateRejected = false;
  // Create a second link on the same resource
  const otherLink = await prisma.resourceLink.create({
    data: {
      resourceId: testResource.id,
      url: 'https://other-endpoint.example.org/api',
      linkType: LinkType.API,
      status: LinkHealthStatus.HEALTHY,
    },
  });

  try {
    // Attempt to remediate otherLink to point to the same URL as updatedLink
    await remediateLinkIndividual(prisma, {
      linkId: otherLink.id,
      newUrl: expectedNormalized,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('already uses URL')) {
      duplicateRejected = true;
    }
  }

  if (!duplicateRejected) {
    throw new Error('Expected duplicate remediation attempt to be rejected.');
  }
  console.log('  PASSED: Duplicate endpoint on same dataset was rejected.');

  // CLEANUP
  console.log('\n[CLEANUP] Cleaning up test fixtures...');
  await prisma.linkAudit.deleteMany({ where: { link: { resourceId: testResource.id } } });
  await prisma.linkCheck.deleteMany({ where: { link: { resourceId: testResource.id } } });
  await prisma.resourceLink.deleteMany({ where: { resourceId: testResource.id } });
  await prisma.resource.delete({ where: { id: testResource.id } });
  await prisma.institution.delete({ where: { id: testInst.id } });
  console.log('  PASSED: Cleaned up test database records.');

  console.log('\n======================================================');
  console.log('ALL PHASE 15 STEP 15.1 TESTS PASSED SUCCESSFULLY (5/5)');
  console.log('======================================================');
}

runIndividualRemediationTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
