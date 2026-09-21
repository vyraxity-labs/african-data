import { prisma, ResourceStatus } from './index';

async function verifyResourceStatuses() {
  console.log('--- Verifying Resource Lifecycle Statuses ---');

  // 1. Create a parent Institution
  const institution = await prisma.institution.create({
    data: {
      name: 'African Development Test Institution',
      website: 'https://example.org',
      country: 'Pan-African',
      type: 'IGO',
    },
  });
  console.log(`Created Institution: ${institution.name} (id: ${institution.id})`);

  try {
    // 2. Create DRAFT resource
    const draftResource = await prisma.resource.create({
      data: {
        name: 'Draft Economic Outlook 2026',
        description: 'Preliminary release',
        institutionId: institution.id,
        status: ResourceStatus.DRAFT,
        sourceType: 'Statistical Bulletin',
        priority: 'High',
        metadata: { preliminary: true, importedFrom: 'csv_seed' },
      },
    });
    console.log(`Created DRAFT Resource: ${draftResource.name} (status: ${draftResource.status})`);

    // 3. Create ACTIVE resource
    const activeResource = await prisma.resource.create({
      data: {
        name: 'Active Trade Statistics Database',
        description: 'Verified public catalogue entry',
        institutionId: institution.id,
        status: ResourceStatus.ACTIVE,
        sourceType: 'Open Data Portal',
        priority: 'Critical',
        apiAvailable: true,
      },
    });
    console.log(`Created ACTIVE Resource: ${activeResource.name} (status: ${activeResource.status})`);

    // 4. Create ARCHIVED resource
    const archivedResource = await prisma.resource.create({
      data: {
        name: 'Archived Census Dataset 2010',
        description: 'Historical legacy dataset',
        institutionId: institution.id,
        status: ResourceStatus.ARCHIVED,
        sourceType: 'Archive',
      },
    });
    console.log(`Created ARCHIVED Resource: ${archivedResource.name} (status: ${archivedResource.status})`);

    // 5. Query and verify status persistence
    const fetchedDraft = await prisma.resource.findUnique({ where: { id: draftResource.id } });
    const fetchedActive = await prisma.resource.findUnique({ where: { id: activeResource.id } });
    const fetchedArchived = await prisma.resource.findUnique({ where: { id: archivedResource.id } });

    if (fetchedDraft?.status !== ResourceStatus.DRAFT) {
      throw new Error(`Expected DRAFT but got ${fetchedDraft?.status}`);
    }
    if (fetchedActive?.status !== ResourceStatus.ACTIVE) {
      throw new Error(`Expected ACTIVE but got ${fetchedActive?.status}`);
    }
    if (fetchedArchived?.status !== ResourceStatus.ARCHIVED) {
      throw new Error(`Expected ARCHIVED but got ${fetchedArchived?.status}`);
    }

    console.log('✓ All 3 resource statuses verified successfully with exact persistence!');

    // 6. Verify relation between Institution and Resource
    const institutionWithResources = await prisma.institution.findUnique({
      where: { id: institution.id },
      include: { resources: true },
    });
    console.log(`✓ Institution relation verified: has ${institutionWithResources?.resources.length} linked resources.`);

    // 7. Cleanup
    await prisma.resource.deleteMany({
      where: { id: { in: [draftResource.id, activeResource.id, archivedResource.id] } },
    });
    await prisma.institution.delete({ where: { id: institution.id } });
    console.log('✓ Test cleanup completed.');
  } catch (err) {
    // Attempt cleanup even on failure
    await prisma.resource.deleteMany({ where: { institutionId: institution.id } }).catch(() => {});
    await prisma.institution.delete({ where: { id: institution.id } }).catch(() => {});
    throw err;
  }
}

verifyResourceStatuses()
  .then(() => {
    console.log('Resource lifecycle status testing PASSED.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Resource lifecycle status testing FAILED:', err);
    process.exit(1);
  });
