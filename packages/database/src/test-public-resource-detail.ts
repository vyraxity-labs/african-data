import { prisma, ResourceStatus, LinkType, LinkHealthStatus } from './index';

async function verifyPublicResourceDetail() {
  console.log('--- Testing Step 8.3 Public Resource Detail Query & Relations ---');

  const testPrefix = `test_res_detail_${Date.now()}`;

  // 1. Setup test institution
  const inst = await prisma.institution.create({
    data: {
      name: `${testPrefix} Regional Development Bank`,
      website: `https://${testPrefix}.bank.org`,
      description: 'Multilateral development institution supporting African infrastructural projects.',
      type: 'Multilateral Financial Institution',
      country: 'Ivory Coast',
    },
  });

  // 2. Setup an active resource with multiple links and metadata
  const activeResource = await prisma.resource.create({
    data: {
      name: `${testPrefix} Infrastructure Finance & Sovereign Debt Tracker`,
      description: 'Detailed financial flows, sovereign debt issuances, and project finance contracts.',
      notes: 'Verified against ministry of finance gazettes and central bank circulars.',
      status: ResourceStatus.ACTIVE,
      industry: 'Finance',
      category: 'Pan-African Source',
      countryCoverage: 'Africa (54 countries)',
      accessType: 'Open access',
      apiAvailable: true,
      priority: 'High',
      sourceType: 'Statistical Database',
      language: 'English, French',
      dataGranularity: 'Project / Country level',
      updateFrequency: 'Quarterly',
      metadata: {
        normalized: {
          formats: ['CSV', 'JSON', 'API', 'XLSX'],
          languages: ['en', 'fr'],
        },
      },
      institutionId: inst.id,
      links: {
        create: [
          {
            url: `https://${testPrefix}.bank.org/portal`,
            linkType: LinkType.WEBSITE,
            status: LinkHealthStatus.HEALTHY,
            httpStatus: 200,
            responseTimeMs: 120,
            lastCheckedAt: new Date(),
          },
          {
            url: `https://${testPrefix}.bank.org/api/v2/debt`,
            linkType: LinkType.API,
            status: LinkHealthStatus.HEALTHY,
            httpStatus: 200,
            responseTimeMs: 85,
            lastCheckedAt: new Date(),
          },
          {
            url: `https://${testPrefix}.bank.org/downloads/bulk.zip`,
            linkType: LinkType.DOWNLOAD,
            status: LinkHealthStatus.REDIRECTED,
            httpStatus: 301,
            responseTimeMs: 210,
            lastCheckedAt: new Date(),
          },
        ],
      },
    },
  });

  // 3. Setup a draft resource and an archived resource
  const draftResource = await prisma.resource.create({
    data: {
      name: `${testPrefix} Unpublished Microcensus Prototype`,
      status: ResourceStatus.DRAFT,
      institutionId: inst.id,
    },
  });

  const archivedResource = await prisma.resource.create({
    data: {
      name: `${testPrefix} Deprecated Structural Adjustment Archive 1990`,
      status: ResourceStatus.ARCHIVED,
      institutionId: inst.id,
    },
  });

  try {
    console.log('✓ Test fixtures created.');

    // --- TEST 1: Retrieve Active Resource by ID with Full Relations ---
    console.log('\n[Test 1] Retrieving active resource by ID with institution & links...');
    const result = await prisma.resource.findUnique({
      where: {
        id: activeResource.id,
        status: ResourceStatus.ACTIVE,
      },
      include: {
        institution: {
          select: {
            id: true,
            name: true,
            website: true,
            description: true,
            type: true,
            country: true,
          },
        },
        links: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!result) {
      throw new Error(`Active resource ${activeResource.id} could not be retrieved`);
    }

    if (result.name !== activeResource.name) {
      throw new Error(`Name mismatch: expected ${activeResource.name}, got ${result.name}`);
    }

    if (!result.institution || result.institution.id !== inst.id) {
      throw new Error('Institution relation failed to resolve properly');
    }

    if (result.institution.name !== inst.name || result.institution.country !== 'Ivory Coast') {
      throw new Error('Institution metadata fields did not match expected values');
    }

    if (!result.links || result.links.length !== 3) {
      throw new Error(`Expected 3 attached links, got ${result.links?.length}`);
    }

    // Verify ordering and fields
    const [link1, link2, link3] = result.links;
    if (link1?.linkType !== LinkType.WEBSITE || link1.status !== LinkHealthStatus.HEALTHY) {
      throw new Error('First link properties mismatch');
    }
    if (link2?.linkType !== LinkType.API || link2.httpStatus !== 200) {
      throw new Error('Second link properties mismatch');
    }
    if (link3?.linkType !== LinkType.DOWNLOAD || link3.status !== LinkHealthStatus.REDIRECTED) {
      throw new Error('Third link properties mismatch');
    }
    console.log('✓ Active resource retrieved with accurate institution and ordered links.');

    // --- TEST 2: Verify Metadata Formats Extraction ---
    console.log('\n[Test 2] Verifying metadata JSON formats extraction...');
    const rawMeta = result.metadata as Record<string, unknown> | null;
    const normalizedMeta = rawMeta?.['normalized'] as Record<string, unknown> | undefined;
    const formats = normalizedMeta?.['formats'] as string[];

    if (!Array.isArray(formats) || formats.length !== 4 || !formats.includes('CSV') || !formats.includes('API')) {
      throw new Error(`Formats array extraction failed: ${JSON.stringify(formats)}`);
    }
    console.log(`✓ Formats extracted cleanly: ${formats.join(', ')}`);

    // --- TEST 3: Verify DRAFT Resource is NOT Retrievable in Public Detail ---
    console.log('\n[Test 3] Verifying DRAFT resource returns null in public query...');
    const draftResult = await prisma.resource.findUnique({
      where: {
        id: draftResource.id,
        status: ResourceStatus.ACTIVE,
      },
    });

    if (draftResult !== null) {
      throw new Error('DRAFT resource was unexpectedly returned by public detail query!');
    }
    console.log('✓ DRAFT resource correctly returns null (triggers notFound()).');

    // --- TEST 4: Verify ARCHIVED Resource is NOT Retrievable in Public Detail ---
    console.log('\n[Test 4] Verifying ARCHIVED resource returns null in public query...');
    const archivedResult = await prisma.resource.findUnique({
      where: {
        id: archivedResource.id,
        status: ResourceStatus.ACTIVE,
      },
    });

    if (archivedResult !== null) {
      throw new Error('ARCHIVED resource was unexpectedly returned by public detail query!');
    }
    console.log('✓ ARCHIVED resource correctly returns null (triggers notFound()).');

    // --- TEST 5: Verify Non-existent Resource Returns Null ---
    console.log('\n[Test 5] Verifying non-existent ID returns null...');
    const nonExistentResult = await prisma.resource.findUnique({
      where: {
        id: 'non_existent_cuid_test_123',
        status: ResourceStatus.ACTIVE,
      },
    });

    if (nonExistentResult !== null) {
      throw new Error('Non-existent ID query did not return null');
    }
    console.log('✓ Non-existent ID query returns null.');

    console.log('\n=======================================================');
    console.log('Step 8.3 Resource Detail Queries & Projections Verified!');
    console.log('=======================================================');
  } finally {
    // Teardown test fixtures
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

verifyPublicResourceDetail()
  .catch((err) => {
    console.error('Test failed with error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
