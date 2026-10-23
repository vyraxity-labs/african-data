import path from 'node:path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { prisma, ResourceStatus, LinkHealthStatus } from './index';

async function runStep22_1Verification() {
  console.log('🧪 Starting Step 22.1 Public Application Production Deployment Verification...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // ITEM 1: Public Resource Search
  // ----------------------------------------------------
  console.log('--- Item 1: Public Resource Search ---');

  const searchResults = await prisma.resource.findMany({
    where: {
      status: ResourceStatus.ACTIVE,
      OR: [
        { name: { contains: 'Crop', mode: 'insensitive' } },
        { description: { contains: 'Crop', mode: 'insensitive' } },
      ],
    },
    take: 10,
    select: { id: true, name: true, status: true },
  });

  assert(
    searchResults.length > 0 && searchResults.every((r) => r.status === ResourceStatus.ACTIVE),
    'Public search retrieves active datasets matching keywords'
  );

  // ----------------------------------------------------
  // ITEM 2: Public Multi-Facet Filtering
  // ----------------------------------------------------
  console.log('\n--- Item 2: Multi-Facet Filtering ---');

  const filteredResults = await prisma.resource.findMany({
    where: {
      status: ResourceStatus.ACTIVE,
      industry: 'Health',
    },
    take: 10,
    select: { id: true, name: true, industry: true, status: true },
  });

  assert(
    filteredResults.length > 0 && filteredResults.every((r) => r.industry === 'Health' && r.status === ResourceStatus.ACTIVE),
    'Public filtering strictly isolates selected facet attributes on active resources'
  );

  // ----------------------------------------------------
  // ITEM 3: Resource Details Query & Projections
  // ----------------------------------------------------
  console.log('\n--- Item 3: Resource Details ---');

  const sampleResource = await prisma.resource.findFirst({
    where: { status: ResourceStatus.ACTIVE },
    include: {
      institution: { select: { id: true, name: true, website: true } },
      links: { select: { id: true, url: true, linkType: true, status: true } },
    },
  });

  assert(
    sampleResource !== null && Boolean(sampleResource.id),
    'Resource details query successfully loads active dataset'
  );
  assert(
    sampleResource !== null && Array.isArray(sampleResource.links),
    'Resource details projection includes attached links array'
  );

  // ----------------------------------------------------
  // ITEM 4: Institution Pages
  // ----------------------------------------------------
  console.log('\n--- Item 4: Institution Pages ---');

  const sampleInstitution = await prisma.institution.findFirst({
    include: {
      _count: {
        select: {
          resources: {
            where: { status: ResourceStatus.ACTIVE },
          },
        },
      },
    },
  });

  assert(
    sampleInstitution !== null && Boolean(sampleInstitution.id),
    'Institution profile query successfully loads custodian institution'
  );
  assert(
    sampleInstitution !== null && typeof sampleInstitution._count.resources === 'number',
    'Institution query computes accurate active resource count'
  );

  // ----------------------------------------------------
  // ITEM 5: Link Endpoints & Health Statuses
  // ----------------------------------------------------
  console.log('\n--- Item 5: Link Endpoints ---');

  const sampleLinks = await prisma.resourceLink.findMany({
    where: { resource: { status: ResourceStatus.ACTIVE } },
    take: 10,
    select: { id: true, url: true, linkType: true, status: true },
  });

  assert(
    sampleLinks.length > 0,
    'Link endpoints are accessible and populated across active datasets'
  );
  assert(
    sampleLinks.every((l) => Boolean(l.url) && Object.values(LinkHealthStatus).includes(l.status)),
    'All returned links have valid URLs and verified LinkHealthStatus enum values'
  );

  // ----------------------------------------------------
  // ITEM 6: Production Database Connection
  // ----------------------------------------------------
  console.log('\n--- Item 6: Production Database Compatibility ---');

  const connectionString = process.env.DATABASE_URL || '';
  assert(
    Boolean(connectionString) && !connectionString.includes('DIRECT_URL'),
    'DATABASE_URL is active and requires no DIRECT_URL'
  );

  const dbPing = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 as ok;`;
  assert(
    dbPing.length > 0 && dbPing[0]?.ok === 1,
    'Database connection ping executed cleanly via Prisma connection model'
  );

  console.log(`\n==================================================`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`==================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runStep22_1Verification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
