import { prisma, LinkType, LinkHealthStatus, ResourceStatus } from './index';

async function verifyMultipleLinkTypes() {
  console.log('--- Verifying ResourceLink with Multiple Link Types ---');

  // 1. Create an Institution
  const institution = await prisma.institution.create({
    data: {
      name: 'African Open Data Consortium',
      country: 'Kenya',
      type: 'Non-profit',
    },
  });
  console.log(`Created Institution: ${institution.name}`);

  // 2. Create a Resource
  const resource = await prisma.resource.create({
    data: {
      name: 'Kenya Agricultural Commodity Price Index',
      description: 'Daily market wholesale commodity prices across Kenyan counties',
      institutionId: institution.id,
      status: ResourceStatus.ACTIVE,
      category: 'Agriculture',
      industry: 'Commodities',
      apiAvailable: true,
    },
  });
  console.log(`Created Resource: ${resource.name} (id: ${resource.id})`);

  try {
    // 3. Create multiple links of different types for this single resource
    const linkTypesToTest: { type: LinkType; url: string; status: LinkHealthStatus }[] = [
      {
        type: LinkType.WEBSITE,
        url: 'https://opendata.go.ke/agriculture',
        status: LinkHealthStatus.HEALTHY,
      },
      {
        type: LinkType.DATA,
        url: 'https://opendata.go.ke/data/commodity-prices-2026.parquet',
        status: LinkHealthStatus.UNKNOWN,
      },
      {
        type: LinkType.API,
        url: 'https://api.opendata.go.ke/v1/agriculture/prices',
        status: LinkHealthStatus.HEALTHY,
      },
      {
        type: LinkType.DOWNLOAD,
        url: 'https://opendata.go.ke/downloads/commodity-prices-latest.csv',
        status: LinkHealthStatus.REDIRECTED,
      },
      {
        type: LinkType.DOCUMENTATION,
        url: 'https://docs.opendata.go.ke/agriculture/methodology.pdf',
        status: LinkHealthStatus.HEALTHY,
      },
      {
        type: LinkType.OTHER,
        url: 'https://github.com/kenyadata/commodity-scripts',
        status: LinkHealthStatus.UNKNOWN,
      },
    ];

    for (const item of linkTypesToTest) {
      const link = await prisma.resourceLink.create({
        data: {
          resourceId: resource.id,
          linkType: item.type,
          url: item.url,
          status: item.status,
          httpStatus: item.status === LinkHealthStatus.HEALTHY ? 200 : undefined,
          responseTimeMs: item.status === LinkHealthStatus.HEALTHY ? 142 : undefined,
        },
      });
      console.log(`  Created link [${link.linkType}] -> ${link.url} (status: ${link.status})`);
    }

    // 4. Fetch the resource with all its links
    const fetchedResource = await prisma.resource.findUnique({
      where: { id: resource.id },
      include: {
        links: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!fetchedResource) {
      throw new Error('Could not find created resource');
    }

    console.log(`Fetched resource has ${fetchedResource.links.length} attached links:`);
    const fetchedTypes = fetchedResource.links.map((l) => l.linkType);
    console.log(`Attached link types: ${fetchedTypes.join(', ')}`);

    if (fetchedResource.links.length !== linkTypesToTest.length) {
      throw new Error(`Expected ${linkTypesToTest.length} links, but found ${fetchedResource.links.length}`);
    }

    // Verify each link type is represented
    for (const item of linkTypesToTest) {
      const match = fetchedResource.links.find((l) => l.linkType === item.type && l.url === item.url);
      if (!match) {
        throw new Error(`Missing expected link with type ${item.type} and URL ${item.url}`);
      }
    }

    console.log('✓ Successfully verified that multiple distinct link types belong to a single Resource!');

    // 5. Verify Cascade Deletion (deleting Resource should delete all its ResourceLinks)
    await prisma.resource.delete({ where: { id: resource.id } });
    const remainingLinks = await prisma.resourceLink.findMany({
      where: { resourceId: resource.id },
    });
    if (remainingLinks.length !== 0) {
      throw new Error(`Expected 0 links after cascade delete, but found ${remainingLinks.length}`);
    }
    console.log('✓ Cascade deletion verified: deleting Resource automatically removed all child ResourceLinks.');

    // Cleanup institution
    await prisma.institution.delete({ where: { id: institution.id } });
    console.log('✓ Test cleanup completed.');
  } catch (err) {
    // Attempt cleanup
    await prisma.resourceLink.deleteMany({ where: { resourceId: resource.id } }).catch(() => {});
    await prisma.resource.delete({ where: { id: resource.id } }).catch(() => {});
    await prisma.institution.delete({ where: { id: institution.id } }).catch(() => {});
    throw err;
  }
}

verifyMultipleLinkTypes()
  .then(() => {
    console.log('ResourceLink multi-link testing PASSED.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('ResourceLink testing FAILED:', err);
    process.exit(1);
  });
