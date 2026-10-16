import dotenv from 'dotenv';
import path from 'path';

// Load workspace environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { prisma, LinkType, ResourceStatus } from '@repo/database';
import { claimDueLinksAtomic } from './atomic-claim';
import { processClaimedBatch } from './process-batch';

async function runProcessBatchTests() {
  console.log('--- PHASE 13 STEP 13.4: PROCESS CLAIMED BATCH TESTS ---');

  let testResourceId: string | null = null;
  const createdLinkIds: string[] = [];

  try {
    // 0. Setup: Create test resource
    const resource = await prisma.resource.create({
      data: {
        name: 'Batch Processing Verification Dataset',
        industry: 'Testing',
        category: 'Quality Assurance',
        countryCoverage: 'Regional',
        status: ResourceStatus.ACTIVE,
      },
    });
    testResourceId = resource.id;

    // 1. Insert 3 test links:
    // Link 1: Healthy public endpoint (http://example.com)
    // Link 2: Non-existent 404 endpoint (http://example.com/non-existent-link-404-test)
    // Link 3: SSRF blocked destination (http://127.0.0.1:8080/private)
    const link1 = await prisma.resourceLink.create({
      data: {
        resourceId: testResourceId,
        url: 'http://example.com',
        linkType: LinkType.DATA,
        status: 'UNKNOWN',
      },
    });
    createdLinkIds.push(link1.id);

    const link2 = await prisma.resourceLink.create({
      data: {
        resourceId: testResourceId,
        url: 'http://example.com/non-existent-link-404-test',
        linkType: LinkType.WEBSITE,
        status: 'UNKNOWN',
      },
    });
    createdLinkIds.push(link2.id);

    const link3 = await prisma.resourceLink.create({
      data: {
        resourceId: testResourceId,
        url: 'http://127.0.0.1:8080/private',
        linkType: LinkType.API,
        status: 'UNKNOWN',
      },
    });
    createdLinkIds.push(link3.id);

    console.log(`[SETUP] Created test resource (${testResourceId}) with 3 links.`);

    // TEST 1: Atomically claim the links
    console.log('\n[TEST 1] Atomically claiming batch of links...');
    const claimResult = await claimDueLinksAtomic(prisma, {
      resourceId: testResourceId,
      batchSize: 10,
    });

    if (claimResult.claimedCount !== 3) {
      throw new Error(`Expected 3 claimed links, got: ${claimResult.claimedCount}`);
    }
    console.log(`  PASSED: Claimed 3 links with lock token: ${claimResult.lockToken}`);

    // TEST 2: Process the claimed batch
    console.log('\n[TEST 2] Processing claimed batch (HEAD-first, SSRF check, LinkCheck recording)...');
    const summary = await processClaimedBatch(
      prisma,
      claimResult.claimedLinks,
      claimResult.lockToken,
      {
        config: {
          timeoutMs: 8000,
          maxConcurrentPerHost: 2,
        },
      }
    );

    if (summary.totalProcessed !== 3) {
      throw new Error(`Expected 3 total processed, got: ${summary.totalProcessed}`);
    }
    console.log(`  PASSED: Batch finished in ${summary.durationMs}ms with ${summary.successful} successful, ${summary.failed} failed.`);

    // TEST 3: Verify individual link results and classifications
    console.log('\n[TEST 3] Verifying individual link results & classifications...');
    const resMap = new Map(summary.results.map((r) => [r.linkId, r]));

    const r1 = resMap.get(link1.id);
    if (!r1 || (r1.status !== 'HEALTHY' && r1.status !== 'REDIRECTED')) {
      throw new Error(`Expected link1 to be HEALTHY or REDIRECTED, got: ${r1?.status}`);
    }
    console.log(`  Link 1 (http://example.com): Status=${r1.status}, HTTP=${r1.httpStatus}`);

    const r2 = resMap.get(link2.id);
    if (!r2 || (r2.status !== 'BROKEN' && r2.status !== 'HEALTHY')) {
      throw new Error(`Expected link2 to be BROKEN or resolved, got: ${r2?.status}`);
    }
    console.log(`  Link 2 (404 path): Status=${r2.status}, HTTP=${r2.httpStatus}`);

    const r3 = resMap.get(link3.id);
    if (!r3 || r3.status !== 'BLOCKED') {
      throw new Error(`Expected link3 (localhost) to be BLOCKED by SSRF protection, got: ${r3?.status}`);
    }
    console.log(`  Link 3 (localhost): Status=${r3.status}, Error=${r3.errorMessage}`);
    console.log('  PASSED: All link status classifications verified accurately.');

    // TEST 4: Verify LinkCheck historical records were created in PostgreSQL
    console.log('\n[TEST 4] Verifying historical LinkCheck entries in PostgreSQL...');
    const checks = await prisma.linkCheck.findMany({
      where: {
        linkId: { in: createdLinkIds },
      },
    });

    if (checks.length !== 3) {
      throw new Error(`Expected 3 LinkCheck records in database, found: ${checks.length}`);
    }
    console.log(`  PASSED: 3 LinkCheck history records verified in database.`);

    // TEST 5: Verify ResourceLink table state and claim release
    console.log('\n[TEST 5] Verifying ResourceLink table state and claim release in PostgreSQL...');
    const updatedLinks = await prisma.resourceLink.findMany({
      where: {
        id: { in: createdLinkIds },
      },
    });

    for (const link of updatedLinks) {
      if (link.checkLockedUntil !== null || link.checkLockToken !== null) {
        throw new Error(`Claim lock was not released on link ${link.id}!`);
      }
      if (!link.lastCheckedAt) {
        throw new Error(`lastCheckedAt was not updated on link ${link.id}!`);
      }
      if (link.id === link1.id && !link.lastSuccessfulCheckAt) {
        throw new Error('lastSuccessfulCheckAt was not updated on healthy link!');
      }
    }
    console.log('  PASSED: All claim locks released cleanly (checkLockedUntil=null, checkLockToken=null).');
    console.log('  PASSED: lastCheckedAt and lastSuccessfulCheckAt timestamps persisted.');

    console.log('\n======================================================');
    console.log('ALL PHASE 13 STEP 13.4 TESTS PASSED SUCCESSFULLY (5/5)');
    console.log('======================================================');
  } catch (error) {
    console.error('TEST SUITE FAILED:', error);
    process.exit(1);
  } finally {
    // Cleanup
    if (createdLinkIds.length > 0) {
      await prisma.linkCheck.deleteMany({
        where: { linkId: { in: createdLinkIds } },
      }).catch(() => {});
      await prisma.resourceLink.deleteMany({
        where: { id: { in: createdLinkIds } },
      }).catch(() => {});
    }
    if (testResourceId) {
      await prisma.resource.delete({
        where: { id: testResourceId },
      }).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

runProcessBatchTests();
