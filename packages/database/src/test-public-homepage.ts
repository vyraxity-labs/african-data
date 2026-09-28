import { prisma, ResourceStatus } from './index';

async function verifyPublicHomepageQuery() {
  console.log('--- Testing Step 8.1 Public Homepage & Layout Queries ---');

  // 1. Verify bounded database query constraints (Never fetch all catalogue records)
  const takeLimit = 6;
  const [activeCount, instCount, linkCount, featured] = await Promise.all([
    prisma.resource.count({ where: { status: ResourceStatus.ACTIVE } }),
    prisma.institution.count(),
    prisma.resourceLink.count(),
    prisma.resource.findMany({
      where: { status: ResourceStatus.ACTIVE },
      take: takeLimit,
      orderBy: { createdAt: 'desc' },
      include: {
        institution: { select: { id: true, name: true } },
        links: { select: { id: true, url: true, linkType: true, status: true }, take: 2 },
      },
    }),
  ]);

  console.log(`✓ Active resources count: ${activeCount}`);
  console.log(`✓ Custodian institutions count: ${instCount}`);
  console.log(`✓ Attached links count: ${linkCount}`);
  console.log(`✓ Featured resources queried (bounded to max ${takeLimit}): ${featured.length} retrieved`);

  if (featured.length > takeLimit) {
    throw new Error(`Rule violation: Query returned ${featured.length} records, exceeding bound of ${takeLimit}`);
  }

  // 2. Test transient creation of active resource to verify projection
  const testPrefix = `test_pub_${Date.now()}`;
  const testInst = await prisma.institution.create({
    data: {
      name: `${testPrefix} African Statistics Bureau`,
      website: 'https://stat-africa.org',
    },
  });

  const testRes = await prisma.resource.create({
    data: {
      name: `${testPrefix} Macroeconomic Indicators 2026`,
      description: 'Comprehensive GDP and inflation datasets across Africa.',
      institutionId: testInst.id,
      status: ResourceStatus.ACTIVE,
      sourceType: 'Statistical Database',
      industry: 'Finance',
      category: 'Pan-African Source',
      countryCoverage: 'Africa (54 countries)',
      accessType: 'Free access',
      apiAvailable: true,
      priority: 'High',
      metadata: {
        normalized: {
          formats: ['CSV', 'API', 'EXCEL'],
          languages: ['en', 'fr'],
        },
      },
      links: {
        create: [
          {
            url: `https://${testPrefix}.org/api/indicators`,
            linkType: 'API',
          },
        ],
      },
    },
    include: {
      institution: true,
      links: true,
    },
  });

  console.log(`✓ Successfully created sample active resource: "${testRes.name}"`);

  // Query homepage featured items
  const homepageFeatured = await prisma.resource.findMany({
    where: { status: ResourceStatus.ACTIVE },
    take: takeLimit,
    orderBy: { createdAt: 'desc' },
    include: {
      institution: { select: { id: true, name: true } },
      links: { select: { id: true, url: true, linkType: true, status: true }, take: 2 },
    },
  });

  const found = homepageFeatured.find((r) => r.id === testRes.id);
  if (!found) {
    throw new Error('Newly created active resource not returned in homepage query');
  }
  if (!found.institution || found.institution.name !== testInst.name) {
    throw new Error('Institution relation was not resolved properly in query');
  }
  if (found.links.length === 0) {
    throw new Error('Attached links were not resolved in query');
  }

  console.log('✓ Homepage featured query properly resolved institution relation and attached links.');

  // 3. Clean up test data
  await prisma.resourceLink.deleteMany({ where: { resourceId: testRes.id } });
  await prisma.resource.delete({ where: { id: testRes.id } });
  await prisma.institution.delete({ where: { id: testInst.id } });

  console.log('✓ Cleanup completed.');
  console.log('\nAll Public Homepage & Layout tests PASSED successfully!');
}

verifyPublicHomepageQuery()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Homepage query testing failed:', err);
    process.exit(1);
  });
