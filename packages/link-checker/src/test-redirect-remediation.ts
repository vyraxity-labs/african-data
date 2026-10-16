import dotenv from 'dotenv';
import path from 'path';

// Load workspace environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { prisma, LinkHealthStatus, LinkType, ResourceStatus } from '@repo/database';
import { remediateRedirectLink } from './redirect-remediation';

async function runRedirectRemediationTests() {
  console.log('--- PHASE 15 STEP 15.2: REDIRECT REPLACEMENT TESTS ---');

  // STEP 0: Setup test fixture
  console.log('\n[SETUP] Creating test institution, dataset, and redirected link...');

  let testInst = await prisma.institution.findFirst({
    where: { name: 'Redirect Remediation Test Institution' },
  });
  if (!testInst) {
    testInst = await prisma.institution.create({
      data: {
        name: 'Redirect Remediation Test Institution',
        country: 'Pan-African',
        type: 'GOVERNMENT',
      },
    });
  }

  let testResource = await prisma.resource.findFirst({
    where: { name: 'Redirect Remediation Test Dataset' },
  });
  if (!testResource) {
    testResource = await prisma.resource.create({
      data: {
        name: 'Redirect Remediation Test Dataset',
        description: 'Test resource to verify Step 15.2 redirect replacement.',
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

  const oldRedirectingUrl = 'https://legacy-redirecting-domain.example.org/api/v1';
  const detectedDestination = 'https://httpbin.org/status/200';

  const redirectedLink = await prisma.resourceLink.create({
    data: {
      resourceId: testResource.id,
      url: oldRedirectingUrl,
      finalUrl: detectedDestination,
      linkType: LinkType.API,
      status: LinkHealthStatus.REDIRECTED,
      httpStatus: 301,
      lastCheckedAt: new Date(Date.now() - 3600000), // 1 hour ago
    },
  });

  console.log(`  PASSED: Seeded link with OLD → 301 → NEW ("${redirectedLink.url}" -> "${redirectedLink.finalUrl}")`);

  // TEST 1: Step 15.2 Validation & SSRF Check - Unsafe destination rejected before saving
  console.log('\n[TEST 1] Testing SSRF check on NEW: Destination resolving to private IP is blocked before saving...');
  const unsafeLink = await prisma.resourceLink.create({
    data: {
      resourceId: testResource.id,
      url: 'https://unsafe-redirector.example.org/internal',
      finalUrl: 'http://127.0.0.1:8080/admin/credentials',
      linkType: LinkType.API,
      status: LinkHealthStatus.REDIRECTED,
      httpStatus: 302,
    },
  });

  let ssrfBlocked = false;
  try {
    await remediateRedirectLink(prisma, {
      linkId: unsafeLink.id,
    });
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.includes('SSRF') || err.message.includes('restricted') || err.message.includes('private'))) {
      ssrfBlocked = true;
    }
  }

  if (!ssrfBlocked) {
    throw new Error('Expected SSRF destination to be rejected before saving.');
  }

  // Verify the unsafe link in database was NOT changed
  const unchangedUnsafe = await prisma.resourceLink.findUnique({ where: { id: unsafeLink.id } });
  if (unchangedUnsafe?.url !== 'https://unsafe-redirector.example.org/internal') {
    throw new Error('Unsafe link URL was modified in database despite SSRF error!');
  }
  console.log('  PASSED: SSRF-check NEW blocked destination; link state untouched.');

  // TEST 2: Save only if appropriate - Broken destination (404) rejected before saving
  console.log('\n[TEST 2] Testing "Save only if appropriate": 404 destination rejected...');
  const brokenDestLink = await prisma.resourceLink.create({
    data: {
      resourceId: testResource.id,
      url: 'https://redirects-to-404.example.org/dead-end',
      finalUrl: 'https://httpbin.org/status/404',
      linkType: LinkType.WEBSITE,
      status: LinkHealthStatus.REDIRECTED,
      httpStatus: 301,
    },
  });

  let brokenSaveRejected = false;
  try {
    await remediateRedirectLink(prisma, {
      linkId: brokenDestLink.id,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('not accessible')) {
      brokenSaveRejected = true;
    }
  }

  if (!brokenSaveRejected) {
    throw new Error('Expected broken (404) destination save to be rejected.');
  }

  const unchangedBroken = await prisma.resourceLink.findUnique({ where: { id: brokenDestLink.id } });
  if (unchangedBroken?.url !== 'https://redirects-to-404.example.org/dead-end') {
    throw new Error('Broken destination was incorrectly saved to database!');
  }
  console.log('  PASSED: Non-accessible destination rejected; original link preserved.');

  // TEST 3: Successful Step 15.2 Replacement (Validate NEW -> SSRF-check NEW -> Check NEW -> Save)
  console.log('\n[TEST 3] Testing successful redirect replacement using detected destination...');
  const result = await remediateRedirectLink(prisma, {
    linkId: redirectedLink.id,
    adminIdentifier: 'admin@africandata.org',
  });

  if (!result.success) {
    throw new Error('Redirect replacement failed unexpectedly.');
  }

  if (result.newUrl !== detectedDestination) {
    throw new Error(`Expected newUrl to be "${detectedDestination}", got "${result.newUrl}"`);
  }
  if (result.statusBefore !== LinkHealthStatus.REDIRECTED) {
    throw new Error(`Expected statusBefore to be REDIRECTED, got: ${result.statusBefore}`);
  }
  if (result.statusAfter !== LinkHealthStatus.HEALTHY) {
    throw new Error(`Expected statusAfter to be HEALTHY, got: ${result.statusAfter}`);
  }
  console.log(`  PASSED: Successfully replaced redirect: "${oldRedirectingUrl}" -> "${result.newUrl}" (${result.statusAfter} HTTP ${result.httpStatus})`);

  // TEST 4: Audit record strictly preserves old redirect URL in history
  console.log('\n[TEST 4] Verifying LinkAudit preserves OLD URL in history...');
  const audit = await prisma.linkAudit.findUnique({
    where: { id: result.auditId },
  });

  if (!audit) {
    throw new Error('LinkAudit record was not created.');
  }
  if (audit.oldUrl !== oldRedirectingUrl) {
    throw new Error(`Audit oldUrl mismatch: expected "${oldRedirectingUrl}", got "${audit.oldUrl}"`);
  }
  if (audit.newUrl !== detectedDestination) {
    throw new Error(`Audit newUrl mismatch: expected "${detectedDestination}", got "${audit.newUrl}"`);
  }
  if (audit.reason !== 'REDIRECT_REPLACEMENT') {
    throw new Error(`Audit reason mismatch: expected "REDIRECT_REPLACEMENT", got "${audit.reason}"`);
  }
  console.log(`  PASSED: LinkAudit record created with reason "REDIRECT_REPLACEMENT" preserving "${audit.oldUrl}".`);

  // TEST 5: Database state verification
  console.log('\n[TEST 5] Verifying ResourceLink table updated state in database...');
  const updatedLinkInDb = await prisma.resourceLink.findUnique({
    where: { id: redirectedLink.id },
  });
  if (updatedLinkInDb?.url !== detectedDestination) {
    throw new Error(`Database URL not updated: expected "${detectedDestination}", got "${updatedLinkInDb?.url}"`);
  }
  if (updatedLinkInDb?.status !== LinkHealthStatus.HEALTHY) {
    throw new Error(`Database status not updated: expected HEALTHY, got "${updatedLinkInDb?.status}"`);
  }
  console.log('  PASSED: Database updated correctly.');

  // CLEANUP
  console.log('\n[CLEANUP] Cleaning up test fixtures...');
  await prisma.linkAudit.deleteMany({ where: { link: { resourceId: testResource.id } } });
  await prisma.linkCheck.deleteMany({ where: { link: { resourceId: testResource.id } } });
  await prisma.resourceLink.deleteMany({ where: { resourceId: testResource.id } });
  await prisma.resource.delete({ where: { id: testResource.id } });
  await prisma.institution.delete({ where: { id: testInst.id } });
  console.log('  PASSED: Cleaned up test database records.');

  console.log('\n======================================================');
  console.log('ALL PHASE 15 STEP 15.2 TESTS PASSED SUCCESSFULLY (5/5)');
  console.log('======================================================');
}

runRedirectRemediationTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
