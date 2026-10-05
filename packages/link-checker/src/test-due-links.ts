import dotenv from 'dotenv';
import path from 'path';

// Load workspace environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { prisma, LinkType, ResourceStatus } from '@repo/database';
import { buildDueLinksWhereInput, queryDueLinks } from './due-links';

async function runDueLinksTests() {
  console.log('--- PHASE 13 STEP 13.2: DETERMINE LINKS DUE FOR CHECKING TESTS ---');

  let testResourceId: string | null = null;
  const createdLinkIds: string[] = [];

  try {
    // 0. Setup: Create test resource
    const resource = await prisma.resource.create({
      data: {
        name: 'Due Link Query Verification Dataset',
        industry: 'Test',
        category: 'Test',
        countryCoverage: 'Regional',
        status: ResourceStatus.ACTIVE,
      },
    });
    testResourceId = resource.id;

    const now = new Date();
    const intervalMs = 24 * 60 * 60 * 1000; // 24 hours
    const staleDate = new Date(now.getTime() - 48 * 60 * 60 * 1000); // 48 hours ago (ELIGIBLE)
    const freshDate = new Date(now.getTime() - 1 * 60 * 60 * 1000); // 1 hour ago (INELIGIBLE)

    // TEST 1: Build where input logic verification
    console.log('\n[TEST 1] Verifying buildDueLinksWhereInput query structure...');
    const { where, cutoffDate } = buildDueLinksWhereInput({ now, checkIntervalMs: intervalMs });

    if (where.OR.length !== 2) {
      throw new Error('Expected OR clause with 2 conditions (null and lte cutoffDate).');
    }
    if (where.OR[0].lastCheckedAt !== null) {
      throw new Error('Expected first condition to check lastCheckedAt is null.');
    }
    console.log(`  PASSED: Query builder produces valid indexed where condition with cutoff: ${cutoffDate.toISOString()}`);

    // TEST 2: Create fixture links in PostgreSQL:
    // Link A: never checked (lastCheckedAt = null) -> ELIGIBLE
    // Link B: checked 48 hours ago -> ELIGIBLE
    // Link C: checked 1 hour ago -> INELIGIBLE (fresh)
    console.log('\n[TEST 2] Inserting test links into PostgreSQL...');
    const linkA = await prisma.resourceLink.create({
      data: {
        resourceId: testResourceId,
        url: 'https://example.org/never-checked',
        linkType: LinkType.DATA,
        lastCheckedAt: null,
      },
    });
    createdLinkIds.push(linkA.id);

    const linkB = await prisma.resourceLink.create({
      data: {
        resourceId: testResourceId,
        url: 'https://example.org/stale-checked',
        linkType: LinkType.WEBSITE,
        lastCheckedAt: staleDate,
      },
    });
    createdLinkIds.push(linkB.id);

    const linkC = await prisma.resourceLink.create({
      data: {
        resourceId: testResourceId,
        url: 'https://example.org/fresh-checked',
        linkType: LinkType.API,
        lastCheckedAt: freshDate,
      },
    });
    createdLinkIds.push(linkC.id);

    console.log('  PASSED: 3 test links inserted (never-checked, stale 48h, fresh 1h).');

    // TEST 3: Execute queryDueLinks against PostgreSQL
    console.log('\n[TEST 3] Querying due links from database...');
    const result = await queryDueLinks(prisma, {
      resourceId: testResourceId,
      now,
      checkIntervalMs: intervalMs,
      batchSize: 10,
    });

    const foundIds = new Set(result.dueLinks.map((l) => l.id));

    // Verify Link A (null) is returned
    if (!foundIds.has(linkA.id)) {
      throw new Error('Expected never-checked link to be eligible.');
    }

    // Verify Link B (stale 48h) is returned
    if (!foundIds.has(linkB.id)) {
      throw new Error('Expected stale link (48h ago) to be eligible.');
    }

    // Verify Link C (fresh 1h) is NOT returned
    if (foundIds.has(linkC.id)) {
      throw new Error('Fresh link (checked 1h ago) was incorrectly returned as eligible!');
    }

    console.log(`  PASSED: Due links identified correctly (never-checked and stale returned, fresh excluded).`);

    // TEST 4: Bounded query restriction (Never load every link into memory)
    console.log('\n[TEST 4] Verifying batch size bounds (take: 1)...');
    const boundedResult = await queryDueLinks(prisma, {
      resourceId: testResourceId,
      now,
      checkIntervalMs: intervalMs,
      batchSize: 1,
    });

    if (boundedResult.dueLinks.length !== 1) {
      throw new Error(`Expected exactly 1 link due to batchSize=1, got: ${boundedResult.dueLinks.length}`);
    }
    console.log('  PASSED: Query is strictly bounded to batchSize limit.');

    console.log('\n======================================================');
    console.log('ALL PHASE 13 STEP 13.2 TESTS PASSED SUCCESSFULLY (4/4)');
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

runDueLinksTests();
