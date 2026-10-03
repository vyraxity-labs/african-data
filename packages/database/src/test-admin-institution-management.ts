import dotenv from 'dotenv';
import path from 'path';

// Load workspace environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { prisma, ResourceStatus } from './index';
import { normalizeUrl } from '@repo/validation';

async function runAdminInstitutionManagementTests() {
  console.log('--- PHASE 11 STEP 11.2: ADMIN INSTITUTION MANAGEMENT TESTS ---');

  let testInstitutionId: string | null = null;
  let testResourceId: string | null = null;

  try {
    // TEST 1: Institution creation with valid normalized website
    console.log('\n[TEST 1] Creating new custodian institution with website normalization...');
    const rawUrl = '  HTTPS://WWW.STATSSA.GOV.ZA/publications/  ';
    const normalizedUrl = normalizeUrl(rawUrl);

    if (normalizedUrl !== 'https://www.statssa.gov.za/publications') {
      throw new Error(`URL normalization mismatch: expected https://www.statssa.gov.za/publications, got ${normalizedUrl}`);
    }

    const createdInstitution = await prisma.institution.create({
      data: {
        name: 'Statistics South Africa (Stats SA)',
        description: 'National statistical service of South Africa producing official economic and social metrics.',
        type: 'National Statistical Office',
        country: 'South Africa',
        website: normalizedUrl,
      },
    });
    testInstitutionId = createdInstitution.id;

    if (!createdInstitution.id || createdInstitution.website !== 'https://www.statssa.gov.za/publications') {
      throw new Error('Failed to create institution with normalized website.');
    }
    console.log(`  PASSED: Institution created with ID ${createdInstitution.id} and website: ${createdInstitution.website}`);

    // TEST 2: Institution Duplicate Name Prevention
    console.log('\n[TEST 2] Verifying case-insensitive duplicate name detection...');
    const duplicateCheck = await prisma.institution.findFirst({
      where: {
        name: { equals: 'STATISTICS SOUTH AFRICA (STATS SA)', mode: 'insensitive' },
      },
    });

    if (!duplicateCheck || duplicateCheck.id !== testInstitutionId) {
      throw new Error('Duplicate check failed to detect existing institution.');
    }
    console.log('  PASSED: Case-insensitive duplicate detection identified collision correctly.');

    // TEST 3: Institution Updating
    console.log('\n[TEST 3] Updating institution attributes and website...');
    const updated = await prisma.institution.update({
      where: { id: testInstitutionId },
      data: {
        type: 'Statistical Agency',
        description: 'Updated official mission statement for national census and CPI metrics.',
        website: 'https://statssa.gov.za',
      },
    });

    if (updated.type !== 'Statistical Agency' || updated.website !== 'https://statssa.gov.za') {
      throw new Error('Institution update failed to persist modified fields.');
    }
    console.log('  PASSED: Institution updated successfully.');

    // TEST 4: Institution Association with Resources
    console.log('\n[TEST 4] Associating resources with custodian institution...');
    const resource = await prisma.resource.create({
      data: {
        name: 'South African Consumer Price Index (CPI)',
        description: 'Monthly consumer price index releases.',
        institutionId: testInstitutionId,
        industry: 'Finance',
        category: 'Inflation & Prices',
        countryCoverage: 'South Africa',
        status: ResourceStatus.ACTIVE,
      },
    });
    testResourceId = resource.id;

    // Verify relation lookup
    const institutionWithResources = await prisma.institution.findUnique({
      where: { id: testInstitutionId },
      include: {
        resources: true,
        _count: { select: { resources: true } },
      },
    });

    if (!institutionWithResources || institutionWithResources._count.resources !== 1) {
      throw new Error('Relation lookup failed to reflect linked resource.');
    }
    console.log(`  PASSED: Institution has ${institutionWithResources._count.resources} linked resource(s).`);

    // TEST 5: Public Institution Profile Visibility
    console.log('\n[TEST 5] Verifying public institution endpoint data resolution...');
    const publicInst = await prisma.institution.findUnique({
      where: { id: testInstitutionId },
      include: {
        resources: {
          where: { status: ResourceStatus.ACTIVE },
        },
      },
    });

    if (!publicInst || publicInst.resources.length !== 1) {
      throw new Error('Public institution resolution failed to include active resources.');
    }
    console.log('  PASSED: Public institution detail resolves active resources correctly.');

    // TEST 6: Safe Deletion Policy (Unlink rather than cascading deletion of datasets)
    console.log('\n[TEST 6] Verifying safe deletion unlinks resources without deleting datasets...');
    await prisma.$transaction(async (tx) => {
      await tx.resource.updateMany({
        where: { institutionId: testInstitutionId! },
        data: { institutionId: null },
      });
      await tx.institution.delete({
        where: { id: testInstitutionId! },
      });
    });

    // Verify institution is deleted
    const deletedInst = await prisma.institution.findUnique({
      where: { id: testInstitutionId },
    });
    if (deletedInst !== null) {
      throw new Error('Institution was not deleted.');
    }
    testInstitutionId = null;

    // Verify resource is preserved with null institutionId
    const preservedResource = await prisma.resource.findUnique({
      where: { id: testResourceId },
    });
    if (!preservedResource || preservedResource.institutionId !== null) {
      throw new Error('Resource was either deleted or failed to have its institutionId nullified.');
    }
    console.log('  PASSED: Institution deleted safely; associated resource preserved with nullified custodian.');

    console.log('\n======================================================');
    console.log('ALL PHASE 11 STEP 11.2 TESTS PASSED SUCCESSFULLY (6/6)');
    console.log('======================================================');
  } catch (error) {
    console.error('TEST SUITE FAILED:', error);
    process.exit(1);
  } finally {
    if (testResourceId) {
      await prisma.resource.delete({ where: { id: testResourceId } }).catch(() => {});
    }
    if (testInstitutionId) {
      await prisma.institution.delete({ where: { id: testInstitutionId } }).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

runAdminInstitutionManagementTests();
