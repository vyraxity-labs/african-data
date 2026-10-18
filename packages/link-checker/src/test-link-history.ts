import dotenv from 'dotenv';
import path from 'path';

// Load workspace environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { prisma, LinkHealthStatus, LinkType, ResourceStatus } from '@repo/database';
import { getLinkHistory, formatHistoryDate } from './link-history';

async function runLinkHistoryTests() {
  console.log('--- RUNNING PHASE 16: LINK HISTORY TESTS ---');

  // Setup: Create test resource
  const testResource = await prisma.resource.create({
    data: {
      name: 'Phase 16 Test Dataset',
      description: 'Dataset for testing link verification history timeline',
      status: ResourceStatus.ACTIVE,
    },
  });

  // Setup: Create test resource link
  const testLink = await prisma.resourceLink.create({
    data: {
      resourceId: testResource.id,
      url: 'https://example.com/data/african-indicators.csv',
      linkType: LinkType.DATA,
      status: LinkHealthStatus.BROKEN,
      httpStatus: 404,
      responseTimeMs: 125,
      errorMessage: '404 Not Found',
    },
  });

  try {
    // Seed historical checks simulating the exact timeline from implementation guide:
    // 20 Sep: BROKEN (404)
    // 13 Sep: HEALTHY (200)
    // 06 Sep: HEALTHY (200)
    // 30 Aug: REDIRECTED (301)
    const check1 = await prisma.linkCheck.create({
      data: {
        linkId: testLink.id,
        checkedAt: new Date('2026-09-20T10:00:00.000Z'),
        status: LinkHealthStatus.BROKEN,
        httpStatus: 404,
        responseTimeMs: 120,
        finalUrl: 'https://example.com/data/african-indicators.csv',
        errorType: 'HTTP_NOT_FOUND',
        errorMessage: 'Server returned HTTP 404 Not Found',
      },
    });

    const check2 = await prisma.linkCheck.create({
      data: {
        linkId: testLink.id,
        checkedAt: new Date('2026-09-13T10:00:00.000Z'),
        status: LinkHealthStatus.HEALTHY,
        httpStatus: 200,
        responseTimeMs: 85,
        finalUrl: 'https://example.com/data/african-indicators.csv',
        errorType: null,
        errorMessage: null,
      },
    });

    const check3 = await prisma.linkCheck.create({
      data: {
        linkId: testLink.id,
        checkedAt: new Date('2026-09-06T10:00:00.000Z'),
        status: LinkHealthStatus.HEALTHY,
        httpStatus: 200,
        responseTimeMs: 92,
        finalUrl: 'https://example.com/data/african-indicators.csv',
        errorType: null,
        errorMessage: null,
      },
    });

    const check4 = await prisma.linkCheck.create({
      data: {
        linkId: testLink.id,
        checkedAt: new Date('2026-08-30T10:00:00.000Z'),
        status: LinkHealthStatus.REDIRECTED,
        httpStatus: 301,
        responseTimeMs: 110,
        finalUrl: 'https://example.com/data/african-indicators-v2.csv',
        errorType: null,
        errorMessage: 'Permanent redirect followed to destination',
      },
    });

    // Seed an audit log entry for URL replacement
    await prisma.linkAudit.create({
      data: {
        linkId: testLink.id,
        oldUrl: 'https://example.com/data/old-path.csv',
        newUrl: testLink.url,
        reason: 'Dataset endpoint updated to latest version',
        changedBy: 'admin@africandata.org',
        statusBefore: LinkHealthStatus.BROKEN,
        statusAfter: LinkHealthStatus.HEALTHY,
        createdAt: new Date('2026-08-25T14:00:00.000Z'),
      },
    });

    // TEST 1: Retrieve complete link history and verify ordering
    console.log('\n[TEST 1] Verifying getLinkHistory retrieval and descending date ordering...');
    const history = await getLinkHistory(prisma, testLink.id);
    if (!history) {
      throw new Error('Expected history object, got null');
    }
    if (history.checks.length !== 4) {
      throw new Error(`Expected 4 checks, got ${history.checks.length}`);
    }

    const [c0, c1, c2, c3] = history.checks;
    if (!c0 || !c1 || !c2 || !c3) {
      throw new Error('Expected 4 defined checks in history');
    }

    // Verify ordering: newest check (20 Sep) should be first, oldest (30 Aug) last
    if (c0.id !== check1.id) {
      throw new Error(`Expected first check to be 20 Sep (${check1.id}), got ${c0.id}`);
    }
    if (c1.id !== check2.id) {
      throw new Error(`Expected second check to be 13 Sep (${check2.id}), got ${c1.id}`);
    }
    if (c2.id !== check3.id) {
      throw new Error(`Expected third check to be 06 Sep (${check3.id}), got ${c2.id}`);
    }
    if (c3.id !== check4.id) {
      throw new Error(`Expected fourth check to be 30 Aug (${check4.id}), got ${c3.id}`);
    }
    console.log('  PASSED: Checks strictly ordered descending by checkedAt.');

    // TEST 2: Verify all 7 required display fields are properly retrieved
    console.log('\n[TEST 2] Verifying all 7 required display fields...');
    const topCheck = c0;
    if (!(topCheck.checkedAt instanceof Date)) {
      throw new Error('Field 1 (Date / checkedAt) missing or invalid');
    }
    if (topCheck.status !== LinkHealthStatus.BROKEN) {
      throw new Error(`Field 2 (Status) expected BROKEN, got ${topCheck.status}`);
    }
    if (topCheck.httpStatus !== 404) {
      throw new Error(`Field 3 (HTTP Status) expected 404, got ${topCheck.httpStatus}`);
    }
    if (topCheck.responseTimeMs !== 120) {
      throw new Error(`Field 4 (Response Time) expected 120, got ${topCheck.responseTimeMs}`);
    }
    if (topCheck.finalUrl !== 'https://example.com/data/african-indicators.csv') {
      throw new Error(`Field 5 (Final URL) expected endpoint url, got ${topCheck.finalUrl}`);
    }
    if (topCheck.errorType !== 'HTTP_NOT_FOUND') {
      throw new Error(`Field 6 (Error Type) expected HTTP_NOT_FOUND, got ${topCheck.errorType}`);
    }
    if (topCheck.errorMessage !== 'Server returned HTTP 404 Not Found') {
      throw new Error(`Field 7 (Error Message) expected 404 message, got ${topCheck.errorMessage}`);
    }
    console.log('  PASSED: All 7 required fields present and verified on LinkCheck records:');
    console.log(`    1. Date:          ${topCheck.checkedAt.toISOString()}`);
    console.log(`    2. Status:        ${topCheck.status}`);
    console.log(`    3. HTTP Code:     ${topCheck.httpStatus}`);
    console.log(`    4. Response Time: ${topCheck.responseTimeMs} ms`);
    console.log(`    5. Final URL:     ${topCheck.finalUrl}`);
    console.log(`    6. Error Type:    ${topCheck.errorType}`);
    console.log(`    7. Error Message: ${topCheck.errorMessage}`);

    // TEST 3: Verify formatHistoryDate formatting utility
    console.log('\n[TEST 3] Verifying formatHistoryDate outputs (e.g., "20 Sep")...');
    const formatted = formatHistoryDate(check1.checkedAt);
    if (!formatted.short.includes('20 Sep')) {
      throw new Error(`Expected "20 Sep", got "${formatted.short}"`);
    }
    if (!formatted.full.includes('20 Sep 2026')) {
      throw new Error(`Expected "20 Sep 2026", got "${formatted.full}"`);
    }
    console.log(`  PASSED: Date formatted as short="${formatted.short}", full="${formatted.full}", time="${formatted.time}".`);

    // TEST 4: Verify URL replacement audits are included
    console.log('\n[TEST 4] Verifying remediation audit history inclusion...');
    if (history.audits.length !== 1) {
      throw new Error(`Expected 1 audit entry, got ${history.audits.length}`);
    }
    const audit = history.audits[0];
    if (!audit || audit.oldUrl !== 'https://example.com/data/old-path.csv' || audit.newUrl !== testLink.url) {
      throw new Error(`Audit URL mismatch: ${audit?.oldUrl} -> ${audit?.newUrl}`);
    }
    if (audit.changedBy !== 'admin@africandata.org') {
      throw new Error(`Audit admin mismatch: ${audit.changedBy}`);
    }
    console.log(`  PASSED: Remediation audit found (${audit.oldUrl} -> ${audit.newUrl} by ${audit.changedBy}).`);

    // TEST 5: Verify non-existent link returns null
    console.log('\n[TEST 5] Verifying non-existent link returns null...');
    const nonExistent = await getLinkHistory(prisma, 'cuid_non_existent_12345');
    if (nonExistent !== null) {
      throw new Error(`Expected null for non-existent link, got ${JSON.stringify(nonExistent)}`);
    }
    console.log('  PASSED: Correctly returned null for non-existent link ID.');

    console.log('\n======================================================');
    console.log('✅ ALL PHASE 16 LINK HISTORY TESTS PASSED (5/5)');
    console.log('======================================================\n');
  } finally {
    // Teardown test data
    await prisma.linkAudit.deleteMany({ where: { linkId: testLink.id } });
    await prisma.linkCheck.deleteMany({ where: { linkId: testLink.id } });
    await prisma.resourceLink.deleteMany({ where: { resourceId: testResource.id } });
    await prisma.resource.deleteMany({ where: { id: testResource.id } });
  }
}

runLinkHistoryTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Link History Test failed:', err);
    process.exit(1);
  });
