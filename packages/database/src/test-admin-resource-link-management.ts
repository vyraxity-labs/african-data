import dotenv from 'dotenv';
import path from 'path';

// Load workspace environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { prisma, LinkType, ResourceStatus } from './index';
import { normalizeUrl } from '@repo/validation';

async function runAdminResourceLinkManagementTests() {
  console.log('--- PHASE 11 STEP 11.3: ADMIN RESOURCE LINK MANAGEMENT TESTS ---');

  let testResourceId: string | null = null;
  let createdLinkId: string | null = null;

  try {
    // 0. Setup: Create test resource
    const resource = await prisma.resource.create({
      data: {
        name: 'Bank of Uganda Inflation Reports & Exchange Rates',
        industry: 'Finance',
        category: 'Macroeconomics',
        countryCoverage: 'Uganda',
        status: ResourceStatus.ACTIVE,
      },
    });
    testResourceId = resource.id;
    console.log(`[SETUP] Created test resource: ${testResourceId}`);

    // TEST 1: Add new ResourceLink with URL normalization
    console.log('\n[TEST 1] Adding ResourceLink with URL normalization...');
    const rawUrl = '  HTTPS://WWW.BOU.OR.UG/bouwebsite/BOU-HOME/  ';
    const normalizedUrl = normalizeUrl(rawUrl);

    if (normalizedUrl !== 'https://www.bou.or.ug/bouwebsite/BOU-HOME') {
      throw new Error(`Normalization error: expected https://www.bou.or.ug/bouwebsite/BOU-HOME, got ${normalizedUrl}`);
    }

    const newLink = await prisma.resourceLink.create({
      data: {
        resourceId: testResourceId,
        url: normalizedUrl,
        linkType: LinkType.WEBSITE,
        status: 'UNKNOWN',
      },
    });
    createdLinkId = newLink.id;

    if (!newLink.id || newLink.url !== 'https://www.bou.or.ug/bouwebsite/BOU-HOME' || newLink.linkType !== LinkType.WEBSITE) {
      throw new Error('Failed to create normalized ResourceLink record.');
    }
    console.log(`  PASSED: ResourceLink created with ID ${newLink.id} and type ${newLink.linkType}`);

    // TEST 2: Prevent duplicate URL on the same resource
    console.log('\n[TEST 2] Verifying duplicate URL prevention on the same dataset...');
    const existingCheck = await prisma.resourceLink.findFirst({
      where: {
        resourceId: testResourceId,
        url: normalizedUrl,
      },
    });

    if (!existingCheck || existingCheck.id !== createdLinkId) {
      throw new Error('Duplicate check failed to detect existing endpoint URL.');
    }
    console.log('  PASSED: Detected existing URL on dataset to prevent duplicates.');

    // TEST 3: Update ResourceLink URL and LinkType
    console.log('\n[TEST 3] Updating ResourceLink endpoint URL and type...');
    const updatedUrl = 'https://www.bou.or.ug/bouwebsite/Statistics/Statistics.html';
    const updatedLink = await prisma.resourceLink.update({
      where: { id: createdLinkId },
      data: {
        url: updatedUrl,
        linkType: LinkType.DATA,
      },
    });

    if (updatedLink.url !== updatedUrl || updatedLink.linkType !== LinkType.DATA) {
      throw new Error('Failed to update ResourceLink attributes.');
    }
    console.log(`  PASSED: ResourceLink successfully updated to ${updatedLink.linkType} and ${updatedLink.url}`);

    // TEST 4: Link Health Check Association
    console.log('\n[TEST 4] Associating LinkCheck verification log with ResourceLink...');
    const checkLog = await prisma.linkCheck.create({
      data: {
        linkId: createdLinkId,
        status: 'HEALTHY',
        httpStatus: 200,
        responseTimeMs: 245,
      },
    });

    // Update parent link health status
    await prisma.resourceLink.update({
      where: { id: createdLinkId },
      data: {
        status: 'HEALTHY',
        httpStatus: 200,
        lastCheckedAt: checkLog.checkedAt,
        lastSuccessfulCheckAt: checkLog.checkedAt,
        responseTimeMs: 245,
      },
    });

    const linkWithChecks = await prisma.resourceLink.findUnique({
      where: { id: createdLinkId },
      include: {
        checks: true,
      },
    });

    if (!linkWithChecks || linkWithChecks.checks.length !== 1 || linkWithChecks.status !== 'HEALTHY') {
      throw new Error('Failed to verify LinkCheck association with ResourceLink.');
    }
    console.log(`  PASSED: LinkCheck attached and ResourceLink reflects HEALTHY status with HTTP 200.`);

    // TEST 5: Public Dataset Resolves Attached Endpoints
    console.log('\n[TEST 5] Verifying public dataset query includes attached endpoints and health status...');
    const publicResourceWithLinks = await prisma.resource.findUnique({
      where: { id: testResourceId },
      include: {
        links: {
          select: { id: true, url: true, linkType: true, status: true },
        },
      },
    });

    if (!publicResourceWithLinks || publicResourceWithLinks.links.length !== 1 || publicResourceWithLinks.links[0]?.status !== 'HEALTHY') {
      throw new Error('Public dataset lookup failed to resolve attached links.');
    }
    console.log('  PASSED: Public dataset query successfully retrieves attached endpoints and health badges.');

    // TEST 6: Atomic Deletion of Link & Historical Checks
    console.log('\n[TEST 6] Deleting ResourceLink and verifying cascade removal of check history...');
    await prisma.$transaction(async (tx) => {
      await tx.linkCheck.deleteMany({
        where: { linkId: createdLinkId! },
      });
      await tx.resourceLink.delete({
        where: { id: createdLinkId! },
      });
    });

    const checkLinkDeleted = await prisma.resourceLink.findUnique({
      where: { id: createdLinkId },
    });
    const checkLogsRemaining = await prisma.linkCheck.count({
      where: { linkId: createdLinkId },
    });

    if (checkLinkDeleted !== null || checkLogsRemaining !== 0) {
      throw new Error('ResourceLink or LinkCheck records still exist after deletion.');
    }
    createdLinkId = null;
    console.log('  PASSED: ResourceLink and associated LinkCheck records completely deleted.');

    console.log('\n======================================================');
    console.log('ALL PHASE 11 STEP 11.3 TESTS PASSED SUCCESSFULLY (6/6)');
    console.log('======================================================');
  } catch (error) {
    console.error('TEST SUITE FAILED:', error);
    process.exit(1);
  } finally {
    if (createdLinkId) {
      await prisma.resourceLink.delete({ where: { id: createdLinkId } }).catch(() => {});
    }
    if (testResourceId) {
      await prisma.resource.delete({ where: { id: testResourceId } }).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

runAdminResourceLinkManagementTests();
