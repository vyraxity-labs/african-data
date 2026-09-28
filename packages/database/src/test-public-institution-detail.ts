import { prisma, ResourceStatus, LinkType, Prisma } from './index';

async function verifyPublicInstitutionDetail() {
  console.log('--- Testing Step 8.4 Public Institution Detail & Associated Resources ---');

  const testPrefix = `test_inst_detail_${Date.now()}`;

  // 1. Setup target test institution
  const targetInst = await prisma.institution.create({
    data: {
      name: `${testPrefix} African Meteorological & Climate Centre`,
      website: `https://${testPrefix}.climate-centre.org`,
      description: 'Pan-African climate observatory and seasonal forecasting institution.',
      type: 'Regional Scientific Body',
      country: 'Kenya',
    },
  });

  // Setup secondary institution to verify isolation
  const otherInst = await prisma.institution.create({
    data: {
      name: `${testPrefix} Unrelated Ministry of Mines`,
      country: 'Zambia',
    },
  });

  // 2. Setup 3 active resources for target institution
  const r1 = await prisma.resource.create({
    data: {
      name: `${testPrefix} Horn of Africa Drought Risk Model`,
      description: 'Precipitation anomaly maps and early warning indicators.',
      status: ResourceStatus.ACTIVE,
      industry: 'Climate',
      category: 'Regional Body',
      countryCoverage: 'East Africa',
      accessType: 'Open access',
      apiAvailable: true,
      institutionId: targetInst.id,
      links: {
        create: [
          { url: `https://${testPrefix}.climate-centre.org/data/drought.json`, linkType: LinkType.API },
        ],
      },
    },
  });

  const r2 = await prisma.resource.create({
    data: {
      name: `${testPrefix} Sahel Rainfall Seasonal Prediction Grid`,
      description: 'High-resolution seasonal rainfall outlook ensembles.',
      status: ResourceStatus.ACTIVE,
      industry: 'Climate',
      category: 'Regional Body',
      countryCoverage: 'Sahel',
      accessType: 'Open access',
      apiAvailable: false,
      institutionId: targetInst.id,
      links: {
        create: [
          { url: `https://${testPrefix}.climate-centre.org/portal`, linkType: LinkType.WEBSITE },
        ],
      },
    },
  });

  const r3 = await prisma.resource.create({
    data: {
      name: `${testPrefix} Lake Victoria Basin Flood Warning Datasets`,
      description: 'Hydrological sensor readings and lake level telemetry.',
      status: ResourceStatus.ACTIVE,
      industry: 'Climate',
      category: 'Regional Body',
      countryCoverage: 'East Africa',
      accessType: 'Registration required',
      apiAvailable: true,
      institutionId: targetInst.id,
    },
  });

  // 3. Setup DRAFT and ARCHIVED resources for target institution (must NEVER leak)
  const rDraft = await prisma.resource.create({
    data: {
      name: `${testPrefix} Unpublished Sensor Calibration Data`,
      status: ResourceStatus.DRAFT,
      institutionId: targetInst.id,
    },
  });

  const rArchived = await prisma.resource.create({
    data: {
      name: `${testPrefix} Deprecated Forecast Run 2012`,
      status: ResourceStatus.ARCHIVED,
      institutionId: targetInst.id,
    },
  });

  // 4. Setup active resource for other institution (must NOT appear in target institution's list)
  const rOther = await prisma.resource.create({
    data: {
      name: `${testPrefix} Copper Belt Mineral Cadastre`,
      status: ResourceStatus.ACTIVE,
      institutionId: otherInst.id,
    },
  });

  try {
    console.log('✓ Test fixtures created.');

    // --- TEST 1: Retrieve Institution Profile ---
    console.log('\n[Test 1] Retrieving institution profile by ID...');
    const instRecord = await prisma.institution.findUnique({
      where: { id: targetInst.id },
    });

    if (!instRecord) {
      throw new Error(`Failed to retrieve target institution ${targetInst.id}`);
    }

    if (
      instRecord.name !== targetInst.name ||
      instRecord.country !== 'Kenya' ||
      instRecord.type !== 'Regional Scientific Body'
    ) {
      throw new Error('Institution field values mismatch');
    }
    console.log('✓ Institution record successfully retrieved with full metadata.');

    // --- TEST 2: Active Resources Count & Strict Status Isolation ---
    console.log('\n[Test 2] Verifying associated active resource count and draft/archived isolation...');
    const where: Prisma.ResourceWhereInput = {
      institutionId: targetInst.id,
      status: ResourceStatus.ACTIVE,
    };

    const count = await prisma.resource.count({ where });
    if (count !== 3) {
      throw new Error(`Expected exactly 3 active resources for target institution, got ${count}`);
    }

    const allAssociated = await prisma.resource.findMany({ where });
    const hasDraft = allAssociated.some((r) => r.id === rDraft.id);
    const hasArchived = allAssociated.some((r) => r.id === rArchived.id);
    const hasOtherInst = allAssociated.some((r) => r.id === rOther.id);

    if (hasDraft || hasArchived) {
      throw new Error('DRAFT or ARCHIVED resources leaked into institution catalogue!');
    }
    if (hasOtherInst) {
      throw new Error('Resource from another institution leaked into target institution catalogue!');
    }
    console.log('✓ Count and status isolation strictly verified.');

    // --- TEST 3: Server-side Pagination ---
    console.log('\n[Test 3] Verifying server-side pagination (take/skip bounds)...');
    const pageSize = 2;

    const page1 = await prisma.resource.findMany({
      where,
      skip: 0,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        links: {
          select: { id: true, url: true, linkType: true, status: true },
          take: 3,
        },
      },
    });

    if (page1.length !== 2) {
      throw new Error(`Expected page 1 to return pageSize=2 items, got ${page1.length}`);
    }

    const page2 = await prisma.resource.findMany({
      where,
      skip: pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        links: {
          select: { id: true, url: true, linkType: true, status: true },
          take: 3,
        },
      },
    });

    if (page2.length !== 1) {
      throw new Error(`Expected page 2 to return remaining 1 item, got ${page2.length}`);
    }

    // Verify disjoint sets
    const page1Ids = page1.map((r) => r.id);
    if (page1Ids.includes(page2[0]?.id || '')) {
      throw new Error('Overlap detected between page 1 and page 2 results');
    }
    console.log('✓ Server-side pagination bounds strictly enforced without record overlap.');

    // --- TEST 4: Non-existent Institution ID ---
    console.log('\n[Test 4] Verifying non-existent institution ID returns null...');
    const nonExistent = await prisma.institution.findUnique({
      where: { id: 'non_existent_inst_id_xyz' },
    });
    if (nonExistent !== null) {
      throw new Error('Non-existent ID did not return null');
    }
    console.log('✓ Non-existent ID returns null (triggers notFound()).');

    console.log('\n=======================================================');
    console.log('Step 8.4 Institution Detail & Resource Association Verified!');
    console.log('=======================================================');
  } finally {
    // Teardown test fixtures
    await prisma.resourceLink.deleteMany({
      where: { resource: { name: { startsWith: testPrefix } } },
    });
    await prisma.resource.deleteMany({
      where: { name: { startsWith: testPrefix } },
    });
    await prisma.institution.deleteMany({
      where: { name: { startsWith: testPrefix } },
    });
    console.log('✓ Test fixtures cleanly removed.');
  }
}

verifyPublicInstitutionDetail()
  .catch((err) => {
    console.error('Test failed with error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
