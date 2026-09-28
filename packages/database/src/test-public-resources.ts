import { prisma, ResourceStatus, Prisma, LinkType } from './index';

async function verifyPublicResourcesCatalogue() {
  console.log('--- Testing Step 8.2 Public Resources Listing, Filters, Sorting & Pagination ---');

  const testPrefix = `test_res_cat_${Date.now()}`;

  // 1. Setup test institution
  const inst = await prisma.institution.create({
    data: {
      name: `${testPrefix} Research Org`,
      website: `https://${testPrefix}.org`,
    },
  });

  // 2. Setup a variety of active and non-active resources
  const r1 = await prisma.resource.create({
    data: {
      name: `${testPrefix} AfCFTA Trade Harmonization DB`,
      description: 'Comprehensive tariff schedules and customs procedures across African trade corridors.',
      notes: 'Updated bi-annually by customs working group.',
      status: ResourceStatus.ACTIVE,
      industry: 'Trade',
      category: 'Pan-African Source',
      accessType: 'Open access',
      apiAvailable: true,
      priority: 'High',
      institutionId: inst.id,
      links: {
        create: [
          { url: `https://${testPrefix}.trade.org/portal`, linkType: LinkType.WEBSITE },
          { url: `https://${testPrefix}.trade.org/api/v1`, linkType: LinkType.API },
        ],
      },
    },
  });

  const r2 = await prisma.resource.create({
    data: {
      name: `${testPrefix} Pan-African Epidemiology Observatory`,
      description: 'Surveillance data on communicable diseases across member states.',
      status: ResourceStatus.ACTIVE,
      industry: 'Health',
      category: 'National Portal',
      accessType: 'Registration required',
      apiAvailable: false,
      priority: 'Medium',
      institutionId: inst.id,
      links: {
        create: [{ url: `https://${testPrefix}.health.org/data`, linkType: LinkType.DATA }],
      },
    },
  });

  const r3 = await prisma.resource.create({
    data: {
      name: `${testPrefix} Continental Solar & Wind Irradiance Atlas`,
      description: 'Satellite-derived renewable energy potentials across the Sahara and Rift Valley.',
      status: ResourceStatus.ACTIVE,
      industry: 'Energy',
      category: 'Regional Body',
      accessType: 'Open access',
      apiAvailable: true,
      priority: 'High',
      institutionId: inst.id,
    },
  });

  // Draft and Archived resources (must NEVER appear in public queries)
  const rDraft = await prisma.resource.create({
    data: {
      name: `${testPrefix} Internal Unpublished Working Paper Data`,
      description: 'Draft notes on preliminary surveys.',
      status: ResourceStatus.DRAFT,
      industry: 'Trade',
      category: 'Pan-African Source',
      institutionId: inst.id,
    },
  });

  const rArchived = await prisma.resource.create({
    data: {
      name: `${testPrefix} Deprecated Historical Survey 1999`,
      description: 'Archived records no longer maintained.',
      status: ResourceStatus.ARCHIVED,
      industry: 'Trade',
      category: 'Pan-African Source',
      institutionId: inst.id,
    },
  });

  try {
    console.log('✓ Test fixtures created.');

    // --- TEST 1: Server-side Pagination & Bounded Retrieval ---
    console.log('\n[Test 1] Verifying bounded retrieval & pagination...');
    const pageSize = 2;
    const page1Where: Prisma.ResourceWhereInput = {
      status: ResourceStatus.ACTIVE,
      name: { startsWith: testPrefix },
    };

    const totalCount = await prisma.resource.count({ where: page1Where });
    if (totalCount !== 3) {
      throw new Error(`Expected exactly 3 active test records, got ${totalCount}`);
    }

    const page1Results = await prisma.resource.findMany({
      where: page1Where,
      skip: 0,
      take: pageSize,
      orderBy: { name: 'asc' },
    });

    if (page1Results.length !== 2) {
      throw new Error(`Expected page 1 to return pageSize=2 items, got ${page1Results.length}`);
    }

    const page2Results = await prisma.resource.findMany({
      where: page1Where,
      skip: pageSize,
      take: pageSize,
      orderBy: { name: 'asc' },
    });

    if (page2Results.length !== 1) {
      throw new Error(`Expected page 2 to return remaining 1 item, got ${page2Results.length}`);
    }

    const totalPages = Math.ceil(totalCount / pageSize);
    if (totalPages !== 2) {
      throw new Error(`Expected 2 total pages, calculated ${totalPages}`);
    }
    console.log('✓ Server-side pagination bounds strictly enforced (take/skip).');

    // --- TEST 2: Draft / Archived Isolation ---
    console.log('\n[Test 2] Verifying DRAFT and ARCHIVED isolation...');
    const publicResults = await prisma.resource.findMany({
      where: {
        status: ResourceStatus.ACTIVE,
        name: { startsWith: testPrefix },
      },
    });

    const hasDraft = publicResults.some((r) => r.id === rDraft.id);
    const hasArchived = publicResults.some((r) => r.id === rArchived.id);
    if (hasDraft || hasArchived) {
      throw new Error('DRAFT or ARCHIVED resources leaked into public catalogue query!');
    }
    console.log('✓ Public catalogue strictly excludes non-ACTIVE items.');

    // --- TEST 3: Text Search (name, description, notes) ---
    console.log('\n[Test 3] Verifying keyword search across fields (case-insensitive)...');
    // Search by note content "customs working group"
    const searchNoteResults = await prisma.resource.findMany({
      where: {
        status: ResourceStatus.ACTIVE,
        name: { startsWith: testPrefix },
        OR: [
          { name: { contains: 'CUSTOMS', mode: 'insensitive' } },
          { description: { contains: 'CUSTOMS', mode: 'insensitive' } },
          { notes: { contains: 'CUSTOMS', mode: 'insensitive' } },
        ],
      },
    });
    if (searchNoteResults.length !== 1 || searchNoteResults[0]?.id !== r1.id) {
      throw new Error('Keyword search failed to match in notes field');
    }

    // Search by partial description keyword "communicable"
    const searchDescResults = await prisma.resource.findMany({
      where: {
        status: ResourceStatus.ACTIVE,
        name: { startsWith: testPrefix },
        OR: [
          { name: { contains: 'COMMUNICABLE', mode: 'insensitive' } },
          { description: { contains: 'COMMUNICABLE', mode: 'insensitive' } },
          { notes: { contains: 'COMMUNICABLE', mode: 'insensitive' } },
        ],
      },
    });
    if (searchDescResults.length !== 1 || searchDescResults[0]?.id !== r2.id) {
      throw new Error('Keyword search failed to match in description field');
    }
    console.log('✓ Case-insensitive multi-field search matches correctly.');

    // --- TEST 4: Filtering by Industry, Category, Access, API ---
    console.log('\n[Test 4] Verifying filters (industry, category, accessType, apiAvailable)...');
    const filteredIndustry = await prisma.resource.findMany({
      where: {
        status: ResourceStatus.ACTIVE,
        name: { startsWith: testPrefix },
        industry: 'Health',
      },
    });
    if (filteredIndustry.length !== 1 || filteredIndustry[0]?.id !== r2.id) {
      throw new Error('Industry filter failed to isolate Health record');
    }

    const filteredApi = await prisma.resource.findMany({
      where: {
        status: ResourceStatus.ACTIVE,
        name: { startsWith: testPrefix },
        apiAvailable: true,
      },
    });
    if (filteredApi.length !== 2) {
      throw new Error(`Expected 2 apiAvailable=true records, got ${filteredApi.length}`);
    }

    const filteredAccess = await prisma.resource.findMany({
      where: {
        status: ResourceStatus.ACTIVE,
        name: { startsWith: testPrefix },
        accessType: 'Open access',
      },
    });
    if (filteredAccess.length !== 2) {
      throw new Error(`Expected 2 Open access records, got ${filteredAccess.length}`);
    }
    console.log('✓ Structured filters (industry, accessType, apiAvailable) operate accurately.');

    // --- TEST 5: Sorting ---
    console.log('\n[Test 5] Verifying sorting logic...');
    const sortedAsc = await prisma.resource.findMany({
      where: {
        status: ResourceStatus.ACTIVE,
        name: { startsWith: testPrefix },
      },
      orderBy: { name: 'asc' },
    });
    const sortedDesc = await prisma.resource.findMany({
      where: {
        status: ResourceStatus.ACTIVE,
        name: { startsWith: testPrefix },
      },
      orderBy: { name: 'desc' },
    });

    if (sortedAsc[0]?.id !== sortedDesc[sortedDesc.length - 1]?.id) {
      throw new Error('Sort order inversion mismatch between asc and desc');
    }
    console.log('✓ Sorting operates correctly.');

    // --- TEST 6: Relation Inclusions ---
    console.log('\n[Test 6] Verifying eager relation inclusions (institution and links)...');
    const fullResource = await prisma.resource.findUnique({
      where: { id: r1.id },
      include: {
        institution: { select: { id: true, name: true } },
        links: { select: { id: true, url: true, linkType: true, status: true } },
      },
    });

    if (!fullResource?.institution || fullResource.institution.id !== inst.id) {
      throw new Error('Failed to resolve institution relation on resource');
    }
    if (!fullResource.links || fullResource.links.length !== 2) {
      throw new Error(`Expected 2 attached links, got ${fullResource.links?.length}`);
    }
    console.log('✓ Resource eager relation loading verified.');

    console.log('\n=======================================================');
    console.log('All Public Resources Catalogue queries verified successfully!');
    console.log('=======================================================');
  } finally {
    // Cleanup test fixtures
    await prisma.resourceLink.deleteMany({
      where: { resource: { name: { startsWith: testPrefix } } },
    });
    await prisma.resource.deleteMany({
      where: { name: { startsWith: testPrefix } },
    });
    await prisma.institution.delete({
      where: { id: inst.id },
    });
    console.log('✓ Test fixtures cleanly removed.');
  }
}

verifyPublicResourcesCatalogue()
  .catch((err) => {
    console.error('Test failed with error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
