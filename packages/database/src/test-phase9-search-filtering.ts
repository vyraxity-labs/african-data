import { prisma, ResourceStatus, Prisma } from './index';

async function verifyPhase9SearchAndFiltering() {
  console.log('--- Testing Phase 9 Comprehensive Search and Filtering (PostgreSQL) ---');

  const testPrefix = `test_p9_${Date.now()}`;

  // 1. Setup institution
  const inst = await prisma.institution.create({
    data: {
      name: `${testPrefix} African Data Consortium`,
      country: 'South Africa',
    },
  });

  // 2. Setup diverse resource fixtures testing all filter dimensions
  const r1 = await prisma.resource.create({
    data: {
      name: `${testPrefix} West Africa Cocoa Yield Microdata`,
      description: 'Farm-level survey microdata covering cocoa harvest volumes in Ghana and Cote d Ivoire.',
      notes: 'Contains GPS coordinate clusters for all cooperative aggregators.',
      status: ResourceStatus.ACTIVE,
      industry: 'Agriculture',
      category: 'Commodity Monitor',
      countryCoverage: 'West Africa',
      sourceType: 'Microdata Survey',
      accessType: 'Open access',
      apiAvailable: true,
      language: 'English, French',
      dataGranularity: 'Farm / Micro-level',
      priority: 'High',
      institutionId: inst.id,
    },
  });

  const r2 = await prisma.resource.create({
    data: {
      name: `${testPrefix} East African Community Tariff Schedules`,
      description: 'Common external tariffs, rules of origin declarations, and sensitive goods listings.',
      notes: 'Official gazette schedules harmonized across partner states.',
      status: ResourceStatus.ACTIVE,
      industry: 'Trade',
      category: 'Regional Treaty',
      countryCoverage: 'East Africa',
      sourceType: 'Legal Tariff Schedule',
      accessType: 'Restricted access',
      apiAvailable: false,
      language: 'English',
      dataGranularity: 'Tariff Line (HS6)',
      priority: 'Medium',
      institutionId: inst.id,
    },
  });

  const r3 = await prisma.resource.create({
    data: {
      name: `${testPrefix} Pan-African Renewable Mini-Grid Registry`,
      description: 'Solar mini-grid installations, capacity ratings, and battery storage metrics.',
      notes: 'Updated bi-annually with national utility data.',
      status: ResourceStatus.ACTIVE,
      industry: 'Energy',
      category: 'Infrastructure Registry',
      countryCoverage: 'Pan-African',
      sourceType: 'Geospatial Registry',
      accessType: 'Open access',
      apiAvailable: true,
      language: 'English, French, Portuguese',
      dataGranularity: 'Site / Facility-level',
      priority: 'High',
      institutionId: inst.id,
    },
  });

  // Draft and archived items to ensure status isolation
  const rDraft = await prisma.resource.create({
    data: {
      name: `${testPrefix} Unpublished Agricultural Pilot Survey`,
      status: ResourceStatus.DRAFT,
      industry: 'Agriculture',
      countryCoverage: 'West Africa',
      sourceType: 'Microdata Survey',
      language: 'English',
      dataGranularity: 'Farm / Micro-level',
      institutionId: inst.id,
    },
  });

  const rArchived = await prisma.resource.create({
    data: {
      name: `${testPrefix} Outdated East African Tariff 2005`,
      status: ResourceStatus.ARCHIVED,
      industry: 'Trade',
      countryCoverage: 'East Africa',
      sourceType: 'Legal Tariff Schedule',
      language: 'English',
      dataGranularity: 'Tariff Line (HS6)',
      institutionId: inst.id,
    },
  });

  try {
    console.log('✓ Test fixtures initialized.');

    // --- TEST 1: Keyword search across name, description, notes ---
    console.log('\n[Test 1] Testing keyword search (q)...');
    const searchByName = await prisma.resource.findMany({
      where: {
        status: ResourceStatus.ACTIVE,
        name: { startsWith: testPrefix },
        OR: [
          { name: { contains: 'COCOA', mode: 'insensitive' } },
          { description: { contains: 'COCOA', mode: 'insensitive' } },
          { notes: { contains: 'COCOA', mode: 'insensitive' } },
        ],
      },
    });
    if (searchByName.length !== 1 || searchByName[0]?.id !== r1.id) {
      throw new Error('Search failed to match keyword in name');
    }

    const searchByNotes = await prisma.resource.findMany({
      where: {
        status: ResourceStatus.ACTIVE,
        name: { startsWith: testPrefix },
        OR: [
          { name: { contains: 'cooperative aggregators', mode: 'insensitive' } },
          { description: { contains: 'cooperative aggregators', mode: 'insensitive' } },
          { notes: { contains: 'cooperative aggregators', mode: 'insensitive' } },
        ],
      },
    });
    if (searchByNotes.length !== 1 || searchByNotes[0]?.id !== r1.id) {
      throw new Error('Search failed to match keyword in notes');
    }
    console.log('✓ Multi-field case-insensitive search verified.');

    // --- TEST 2: Pagination ---
    console.log('\n[Test 2] Testing server-side pagination...');
    const page1 = await prisma.resource.findMany({
      where: { status: ResourceStatus.ACTIVE, name: { startsWith: testPrefix } },
      skip: 0,
      take: 2,
      orderBy: { name: 'asc' },
    });
    const page2 = await prisma.resource.findMany({
      where: { status: ResourceStatus.ACTIVE, name: { startsWith: testPrefix } },
      skip: 2,
      take: 2,
      orderBy: { name: 'asc' },
    });
    if (page1.length !== 2 || page2.length !== 1) {
      throw new Error(`Pagination counts mismatch: page1=${page1.length}, page2=${page2.length}`);
    }
    console.log('✓ Server-side pagination bounds verified.');

    // --- TEST 3: Sorting ---
    console.log('\n[Test 3] Testing sorting...');
    const ascOrder = await prisma.resource.findMany({
      where: { status: ResourceStatus.ACTIVE, name: { startsWith: testPrefix } },
      orderBy: { name: 'asc' },
    });
    const descOrder = await prisma.resource.findMany({
      where: { status: ResourceStatus.ACTIVE, name: { startsWith: testPrefix } },
      orderBy: { name: 'desc' },
    });
    if (ascOrder[0]?.id !== descOrder[descOrder.length - 1]?.id) {
      throw new Error('Sort inversion failed between asc and desc');
    }
    console.log('✓ Sorting verified.');

    // --- TEST 4: Industry filter ---
    console.log('\n[Test 4] Testing industry filter...');
    const industryRes = await prisma.resource.findMany({
      where: { status: ResourceStatus.ACTIVE, name: { startsWith: testPrefix }, industry: 'Agriculture' },
    });
    if (industryRes.length !== 1 || industryRes[0]?.id !== r1.id) {
      throw new Error('Industry filter failed');
    }
    console.log('✓ Industry filter verified.');

    // --- TEST 5: Category filter ---
    console.log('\n[Test 5] Testing category filter...');
    const categoryRes = await prisma.resource.findMany({
      where: { status: ResourceStatus.ACTIVE, name: { startsWith: testPrefix }, category: 'Regional Treaty' },
    });
    if (categoryRes.length !== 1 || categoryRes[0]?.id !== r2.id) {
      throw new Error('Category filter failed');
    }
    console.log('✓ Category filter verified.');

    // --- TEST 6: Country / Coverage filter ---
    console.log('\n[Test 6] Testing country/coverage filter...');
    const coverageRes = await prisma.resource.findMany({
      where: { status: ResourceStatus.ACTIVE, name: { startsWith: testPrefix }, countryCoverage: 'West Africa' },
    });
    if (coverageRes.length !== 1 || coverageRes[0]?.id !== r1.id) {
      throw new Error('Country/coverage filter failed');
    }
    console.log('✓ Country/coverage filter verified.');

    // --- TEST 7: Source type filter ---
    console.log('\n[Test 7] Testing source type filter...');
    const sourceTypeRes = await prisma.resource.findMany({
      where: { status: ResourceStatus.ACTIVE, name: { startsWith: testPrefix }, sourceType: 'Microdata Survey' },
    });
    if (sourceTypeRes.length !== 1 || sourceTypeRes[0]?.id !== r1.id) {
      throw new Error('Source type filter failed');
    }
    console.log('✓ Source type filter verified.');

    // --- TEST 8: Access type filter ---
    console.log('\n[Test 8] Testing access type filter...');
    const accessRes = await prisma.resource.findMany({
      where: { status: ResourceStatus.ACTIVE, name: { startsWith: testPrefix }, accessType: 'Open access' },
    });
    if (accessRes.length !== 2) {
      throw new Error(`Access type filter failed: expected 2, got ${accessRes.length}`);
    }
    console.log('✓ Access type filter verified.');

    // --- TEST 9: API availability filter ---
    console.log('\n[Test 9] Testing API availability filter...');
    const apiRes = await prisma.resource.findMany({
      where: { status: ResourceStatus.ACTIVE, name: { startsWith: testPrefix }, apiAvailable: true },
    });
    if (apiRes.length !== 2) {
      throw new Error(`API availability filter failed: expected 2, got ${apiRes.length}`);
    }
    console.log('✓ API availability filter verified.');

    // --- TEST 10: Language filter ---
    console.log('\n[Test 10] Testing language filter...');
    const langRes = await prisma.resource.findMany({
      where: { status: ResourceStatus.ACTIVE, name: { startsWith: testPrefix }, language: 'English' },
    });
    if (langRes.length !== 1 || langRes[0]?.id !== r2.id) {
      throw new Error('Language filter failed');
    }
    console.log('✓ Language filter verified.');

    // --- TEST 11: Data granularity filter ---
    console.log('\n[Test 11] Testing data granularity filter...');
    const granRes = await prisma.resource.findMany({
      where: { status: ResourceStatus.ACTIVE, name: { startsWith: testPrefix }, dataGranularity: 'Tariff Line (HS6)' },
    });
    if (granRes.length !== 1 || granRes[0]?.id !== r2.id) {
      throw new Error('Data granularity filter failed');
    }
    console.log('✓ Data granularity filter verified.');

    // --- TEST 12: Combined multi-facet search ---
    console.log('\n[Test 12] Testing multi-facet combination...');
    const combinedRes = await prisma.resource.findMany({
      where: {
        status: ResourceStatus.ACTIVE,
        name: { startsWith: testPrefix },
        industry: 'Agriculture',
        countryCoverage: 'West Africa',
        apiAvailable: true,
        sourceType: 'Microdata Survey',
        accessType: 'Open access',
        dataGranularity: 'Farm / Micro-level',
      },
    });
    if (combinedRes.length !== 1 || combinedRes[0]?.id !== r1.id) {
      throw new Error('Combined multi-facet search failed to locate single target record');
    }
    console.log('✓ Multi-facet filter combination verified.');

    // --- TEST 13: Strict isolation (no DRAFT or ARCHIVED records) ---
    console.log('\n[Test 13] Verifying DRAFT and ARCHIVED isolation under filtering...');
    const allFiltered = await prisma.resource.findMany({
      where: {
        status: ResourceStatus.ACTIVE,
        name: { startsWith: testPrefix },
        countryCoverage: { in: ['West Africa', 'East Africa'] },
      },
    });
    const leakedDraft = allFiltered.some((r) => r.id === rDraft.id);
    const leakedArchived = allFiltered.some((r) => r.id === rArchived.id);
    if (leakedDraft || leakedArchived) {
      throw new Error('DRAFT or ARCHIVED resources leaked into filtered queries!');
    }
    console.log('✓ Strict publication isolation maintained across all filters.');

    console.log('\n=======================================================');
    console.log('Phase 9 Search & Filtering Suite Verified Successfully!');
    console.log('=======================================================');
  } finally {
    // Teardown test fixtures
    await prisma.resource.deleteMany({
      where: { name: { startsWith: testPrefix } },
    });
    await prisma.institution.delete({
      where: { id: inst.id },
    });
    console.log('✓ Test fixtures cleanly removed.');
  }
}

verifyPhase9SearchAndFiltering()
  .catch((err) => {
    console.error('Test failed with error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
