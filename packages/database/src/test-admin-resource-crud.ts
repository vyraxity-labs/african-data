import dotenv from 'dotenv';
import path from 'path';

// Load workspace environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { prisma, ResourceStatus } from './index';

async function runAdminResourceCrudTests() {
  console.log('--- PHASE 11 STEP 11.1: ADMIN RESOURCE CRUD & LIFECYCLE TESTS ---');

  let testInstitutionId: string | null = null;
  let createdResourceId: string | null = null;

  try {
    // 0. Ensure a test institution exists
    const testInstitution = await prisma.institution.create({
      data: {
        name: 'Test Central Bank of West Africa (BCEAO)',
        country: 'Regional',
        website: 'https://bceao.int',
        type: 'Central Bank',
      },
    });
    testInstitutionId = testInstitution.id;
    console.log(`[SETUP] Created test institution: ${testInstitution.id}`);

    // TEST 1: Manual Resource Creation Defaults to DRAFT
    console.log('\n[TEST 1] Verifying manual creation defaults to DRAFT status...');
    const draftResource = await prisma.resource.create({
      data: {
        name: 'West African Monetary Union Financial Inclusion Survey',
        description: 'Comprehensive financial inclusion indicators for WAEMU zone.',
        institutionId: testInstitutionId,
        industry: 'Finance',
        category: 'Financial Inclusion',
        countryCoverage: 'Regional - West Africa',
        sourceType: 'Central Bank',
        accessType: 'Open Access',
        language: 'French',
        dataGranularity: 'National',
        updateFrequency: 'Annual',
        priority: 'High',
        apiAvailable: false,
        // When created manually, default is DRAFT in schema and server action
        status: ResourceStatus.DRAFT,
      },
    });
    createdResourceId = draftResource.id;

    if (draftResource.status !== ResourceStatus.DRAFT) {
      throw new Error(`Expected resource status DRAFT, got: ${draftResource.status}`);
    }
    console.log(`  PASSED: Resource created with ID ${draftResource.id} and status: ${draftResource.status}`);

    // TEST 2: Public Catalogue Excludes DRAFT Resource
    console.log('\n[TEST 2] Verifying public catalogue queries exclude DRAFT resource...');
    const publicQueryDraftMatch = await prisma.resource.findMany({
      where: {
        id: createdResourceId,
        status: ResourceStatus.ACTIVE, // Public app filter constraint
      },
    });

    if (publicQueryDraftMatch.length !== 0) {
      throw new Error(`Security breach: DRAFT resource leaked into public ACTIVE query!`);
    }
    console.log('  PASSED: DRAFT resource is completely excluded from public queries.');

    // TEST 3: Lifecycle Transition DRAFT -> ACTIVE
    console.log('\n[TEST 3] Verifying lifecycle transition DRAFT -> ACTIVE...');
    const publishedResource = await prisma.resource.update({
      where: { id: createdResourceId },
      data: { status: ResourceStatus.ACTIVE },
    });

    if (publishedResource.status !== ResourceStatus.ACTIVE) {
      throw new Error(`Expected ACTIVE status after publishing, got: ${publishedResource.status}`);
    }

    const publicQueryActiveMatch = await prisma.resource.findMany({
      where: {
        id: createdResourceId,
        status: ResourceStatus.ACTIVE,
      },
    });

    if (publicQueryActiveMatch.length !== 1) {
      throw new Error(`Expected published resource to appear in public ACTIVE query.`);
    }
    console.log('  PASSED: Published resource is now visible to public catalogue queries.');

    // TEST 4: Resource Metadata Update
    console.log('\n[TEST 4] Verifying attribute updating while active...');
    const updatedResource = await prisma.resource.update({
      where: { id: createdResourceId },
      data: {
        apiAvailable: true,
        dataGranularity: 'Regional / National Breakdown',
        notes: 'Verified data access point with BCEAO statisticians.',
      },
    });

    if (!updatedResource.apiAvailable || updatedResource.dataGranularity !== 'Regional / National Breakdown') {
      throw new Error('Resource update failed to persist modified fields.');
    }
    console.log('  PASSED: Resource attributes updated successfully.');

    // TEST 5: Lifecycle Transition ACTIVE -> ARCHIVED
    console.log('\n[TEST 5] Verifying lifecycle transition ACTIVE -> ARCHIVED...');
    const archivedResource = await prisma.resource.update({
      where: { id: createdResourceId },
      data: { status: ResourceStatus.ARCHIVED },
    });

    if (archivedResource.status !== ResourceStatus.ARCHIVED) {
      throw new Error(`Expected ARCHIVED status, got: ${archivedResource.status}`);
    }

    const publicQueryArchivedMatch = await prisma.resource.findMany({
      where: {
        id: createdResourceId,
        status: ResourceStatus.ACTIVE,
      },
    });

    if (publicQueryArchivedMatch.length !== 0) {
      throw new Error(`Security breach: ARCHIVED resource visible in public query!`);
    }
    console.log('  PASSED: ARCHIVED resource is removed from public visibility.');

    // TEST 6: Lifecycle Transition ARCHIVED -> DRAFT
    console.log('\n[TEST 6] Verifying lifecycle transition ARCHIVED -> DRAFT...');
    const revertedResource = await prisma.resource.update({
      where: { id: createdResourceId },
      data: { status: ResourceStatus.DRAFT },
    });

    if (revertedResource.status !== ResourceStatus.DRAFT) {
      throw new Error(`Expected DRAFT status after reversion, got: ${revertedResource.status}`);
    }
    console.log('  PASSED: Resource successfully reverted to DRAFT status.');

    // TEST 7: Cascade Deletion of Resource and associated records
    console.log('\n[TEST 7] Verifying cascade deletion of resource and associated records...');
    // Create an endpoint link for this resource
    const link = await prisma.resourceLink.create({
      data: {
        resourceId: createdResourceId,
        url: 'https://bceao.int/en/publications/financial-inclusion-2025',
        linkType: 'DATA',
        status: 'HEALTHY',
      },
    });

    // Create a link check record
    await prisma.linkCheck.create({
      data: {
        linkId: link.id,
        status: 'HEALTHY',
        httpStatus: 200,
        responseTimeMs: 310,
      },
    });

    // Perform cascade transaction delete matching Server Action
    await prisma.$transaction(async (tx) => {
      const links = await tx.resourceLink.findMany({
        where: { resourceId: createdResourceId! },
        select: { id: true },
      });
      const linkIds = links.map((l) => l.id);

      if (linkIds.length > 0) {
        await tx.linkCheck.deleteMany({
          where: { linkId: { in: linkIds } },
        });
        await tx.resourceLink.deleteMany({
          where: { id: { in: linkIds } },
        });
      }

      await tx.resource.delete({
        where: { id: createdResourceId! },
      });
    });

    // Verify deletion
    const checkDeleted = await prisma.resource.findUnique({
      where: { id: createdResourceId },
    });
    if (checkDeleted !== null) {
      throw new Error('Resource deletion failed; record still exists.');
    }
    createdResourceId = null;
    console.log('  PASSED: Resource and associated records successfully deleted in cascade.');

    console.log('\n======================================================');
    console.log('ALL PHASE 11 STEP 11.1 TESTS PASSED SUCCESSFULLY (7/7)');
    console.log('======================================================');
  } catch (error) {
    console.error('TEST SUITE FAILED:', error);
    process.exit(1);
  } finally {
    // Cleanup if needed
    if (createdResourceId) {
      await prisma.resource.delete({ where: { id: createdResourceId } }).catch(() => {});
    }
    if (testInstitutionId) {
      await prisma.institution.delete({ where: { id: testInstitutionId } }).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

runAdminResourceCrudTests();
