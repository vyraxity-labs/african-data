import dotenv from 'dotenv';
import path from 'path';

// Load workspace environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { prisma, LinkType, ResourceStatus } from '@repo/database';
import { claimDueLinksAtomic, releaseLinkClaim } from './atomic-claim';

async function runAtomicClaimTests() {
  console.log('--- PHASE 13 STEP 13.3: ATOMIC JOB CLAIMING TESTS ---');

  let testResourceId: string | null = null;
  const createdLinkIds: string[] = [];

  try {
    // 0. Setup: Create test resource
    const resource = await prisma.resource.create({
      data: {
        name: 'Atomic Job Claiming Verification Dataset',
        industry: 'Test',
        category: 'Test',
        countryCoverage: 'Regional',
        status: ResourceStatus.ACTIVE,
      },
    });
    testResourceId = resource.id;

    // Create 4 due test links
    for (let i = 1; i <= 4; i++) {
      const link = await prisma.resourceLink.create({
        data: {
          resourceId: testResourceId,
          url: `https://example.org/atomic-link-${i}`,
          linkType: LinkType.DATA,
          lastCheckedAt: null,
          checkLockedUntil: null,
          checkLockToken: null,
        },
      });
      createdLinkIds.push(link.id);
    }
    console.log(`[SETUP] Inserted 4 test links for resource: ${testResourceId}`);

    // TEST 1: Worker A claims batch of 2 links
    console.log('\n[TEST 1] Worker A claims batch of 2 links with FOR UPDATE SKIP LOCKED...');
    const claimWorkerA = await claimDueLinksAtomic(prisma, {
      resourceId: testResourceId,
      batchSize: 2,
      lockDurationMs: 60000, // 1 min lock
    });

    if (claimWorkerA.claimedCount !== 2) {
      throw new Error(`Expected Worker A to claim 2 links, got: ${claimWorkerA.claimedCount}`);
    }

    const workerAIds = new Set(claimWorkerA.claimedLinks.map((l) => l.id));
    console.log(`  PASSED: Worker A claimed ${claimWorkerA.claimedCount} links with token: ${claimWorkerA.lockToken}`);

    // Verify row lock fields in DB
    const lockedRows = await prisma.resourceLink.findMany({
      where: { id: { in: Array.from(workerAIds) } },
    });
    for (const row of lockedRows) {
      if (row.checkLockToken !== claimWorkerA.lockToken || !row.checkLockedUntil) {
        throw new Error('Lock token or expiration was not persisted to database row.');
      }
    }
    console.log('  PASSED: Database rows accurately updated with checkLockToken and checkLockedUntil.');

    // TEST 2: Concurrent Worker B attempts to claim — must SKIP rows claimed by Worker A
    console.log('\n[TEST 2] Worker B concurrently claims links (Must skip Worker A locked rows)...');
    const claimWorkerB = await claimDueLinksAtomic(prisma, {
      resourceId: testResourceId,
      batchSize: 2,
      lockDurationMs: 60000,
    });

    if (claimWorkerB.claimedCount !== 2) {
      throw new Error(`Expected Worker B to claim remaining 2 links, got: ${claimWorkerB.claimedCount}`);
    }

    // Verify NO overlap between Worker A and Worker B
    for (const bLink of claimWorkerB.claimedLinks) {
      if (workerAIds.has(bLink.id)) {
        throw new Error(`Race condition! Worker B claimed link ${bLink.id} already locked by Worker A!`);
      }
    }
    console.log(`  PASSED: Worker B claimed 2 distinct links without race condition or collision.`);

    // TEST 3: Worker C attempts to claim when all 4 are locked -> gets 0 rows
    console.log('\n[TEST 3] Worker C attempts to claim when all links are locked (Zero rows returned)...');
    const claimWorkerC = await claimDueLinksAtomic(prisma, {
      resourceId: testResourceId,
      batchSize: 2,
    });

    if (claimWorkerC.claimedCount !== 0) {
      throw new Error(`Expected Worker C to get 0 rows, got: ${claimWorkerC.claimedCount}`);
    }
    console.log('  PASSED: Worker C correctly received 0 links (no double processing).');

    // TEST 4: Worker A releases claim
    console.log('\n[TEST 4] Worker A releases its claimed locks...');
    const releaseResA = await releaseLinkClaim(
      prisma,
      Array.from(workerAIds),
      claimWorkerA.lockToken
    );

    if (releaseResA.releasedCount !== 2) {
      throw new Error(`Expected release count 2, got: ${releaseResA.releasedCount}`);
    }

    // Verify Worker A rows are now unlocked
    const unlockedRows = await prisma.resourceLink.findMany({
      where: { id: { in: Array.from(workerAIds) } },
    });
    for (const row of unlockedRows) {
      if (row.checkLockToken !== null || row.checkLockedUntil !== null) {
        throw new Error('Row lock fields were not cleared upon release.');
      }
    }
    console.log('  PASSED: Worker A locks released cleanly.');

    // TEST 5: Worker D can now claim the released links
    console.log('\n[TEST 5] Worker D claims the links newly released by Worker A...');
    const claimWorkerD = await claimDueLinksAtomic(prisma, {
      resourceId: testResourceId,
      batchSize: 2,
    });

    if (claimWorkerD.claimedCount !== 2) {
      throw new Error(`Expected Worker D to claim the 2 released links, got: ${claimWorkerD.claimedCount}`);
    }
    console.log('  PASSED: Released links immediately reclaimed by next worker.');

    console.log('\n======================================================');
    console.log('ALL PHASE 13 STEP 13.3 TESTS PASSED SUCCESSFULLY (5/5)');
    console.log('======================================================');
  } catch (error) {
    console.error('TEST SUITE FAILED:', error);
    process.exit(1);
  } finally {
    // Cleanup
    if (createdLinkIds.length > 0) {
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

runAtomicClaimTests();
