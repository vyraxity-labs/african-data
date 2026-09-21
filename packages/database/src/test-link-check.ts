import { prisma, LinkType, LinkHealthStatus, ResourceStatus } from './index';

async function verifyLinkCheckHistory() {
  console.log('--- Verifying LinkCheck History (Append-only / No Overwrite) ---');

  // 1. Create Institution and Resource
  const institution = await prisma.institution.create({
    data: {
      name: 'Central Bank of Nigeria',
      country: 'Nigeria',
      type: 'Central Bank',
    },
  });

  const resource = await prisma.resource.create({
    data: {
      name: 'CBN Daily Exchange Rates Portal',
      description: 'Official exchange rates published daily by the Central Bank of Nigeria',
      institutionId: institution.id,
      status: ResourceStatus.ACTIVE,
      category: 'Finance',
      sourceType: 'API',
    },
  });

  // 2. Create ResourceLink
  const link = await prisma.resourceLink.create({
    data: {
      resourceId: resource.id,
      linkType: LinkType.API,
      url: 'https://api.cbn.gov.ng/rates/daily',
      status: LinkHealthStatus.UNKNOWN,
    },
  });
  console.log(`Created ResourceLink: ${link.url} (id: ${link.id})`);

  try {
    // 3. Simulate sequential health checks across time
    const check1Time = new Date(Date.now() - 3600 * 1000 * 24); // 24 hours ago
    const check1 = await prisma.linkCheck.create({
      data: {
        linkId: link.id,
        checkedAt: check1Time,
        status: LinkHealthStatus.HEALTHY,
        httpStatus: 200,
        responseTimeMs: 230,
        finalUrl: 'https://api.cbn.gov.ng/rates/daily',
      },
    });
    console.log(`Check 1 recorded: ${check1.checkedAt.toISOString()} - Status: ${check1.status} (${check1.responseTimeMs}ms)`);

    const check2Time = new Date(Date.now() - 3600 * 1000 * 12); // 12 hours ago
    const check2 = await prisma.linkCheck.create({
      data: {
        linkId: link.id,
        checkedAt: check2Time,
        status: LinkHealthStatus.SERVER_ERROR,
        httpStatus: 503,
        responseTimeMs: 1540,
        errorType: 'ServiceUnavailable',
        errorMessage: 'HTTP 503 Backend Service Unavailable',
      },
    });
    console.log(`Check 2 recorded: ${check2.checkedAt.toISOString()} - Status: ${check2.status} (Error: ${check2.errorMessage})`);

    const check3Time = new Date(); // now
    const check3 = await prisma.linkCheck.create({
      data: {
        linkId: link.id,
        checkedAt: check3Time,
        status: LinkHealthStatus.HEALTHY,
        httpStatus: 200,
        responseTimeMs: 195,
        finalUrl: 'https://api.cbn.gov.ng/rates/daily',
      },
    });
    console.log(`Check 3 recorded: ${check3.checkedAt.toISOString()} - Status: ${check3.status} (${check3.responseTimeMs}ms)`);

    // 4. Update the parent ResourceLink with current status (while preserving history)
    const updatedLink = await prisma.resourceLink.update({
      where: { id: link.id },
      data: {
        status: check3.status,
        httpStatus: check3.httpStatus,
        finalUrl: check3.finalUrl,
        lastCheckedAt: check3.checkedAt,
        lastSuccessfulCheckAt: check3.checkedAt,
        responseTimeMs: check3.responseTimeMs,
        errorMessage: null,
      },
      include: {
        checks: {
          orderBy: { checkedAt: 'asc' },
        },
      },
    });

    console.log(`Updated ResourceLink summary status: ${updatedLink.status}, lastChecked: ${updatedLink.lastCheckedAt?.toISOString()}`);
    console.log(`Total historical LinkCheck records preserved: ${updatedLink.checks.length}`);

    // 5. Assertions to guarantee previous check records were never overwritten
    if (updatedLink.checks.length !== 3) {
      throw new Error(`Expected 3 historical checks, but found ${updatedLink.checks.length}`);
    }

    const checkIds = updatedLink.checks.map((c) => c.id);
    if (!checkIds.includes(check1.id) || !checkIds.includes(check2.id) || !checkIds.includes(check3.id)) {
      throw new Error('Historical check record IDs do not match the expected created records!');
    }

    const firstCheck = updatedLink.checks[0];
    const secondCheck = updatedLink.checks[1];
    const thirdCheck = updatedLink.checks[2];

    // Verify historical statuses remained intact
    if (
      !firstCheck ||
      !secondCheck ||
      !thirdCheck ||
      firstCheck.status !== LinkHealthStatus.HEALTHY ||
      secondCheck.status !== LinkHealthStatus.SERVER_ERROR ||
      thirdCheck.status !== LinkHealthStatus.HEALTHY
    ) {
      throw new Error('Historical check statuses were modified or overwritten!');
    }

    console.log('✓ All 3 historical LinkCheck records are completely intact and ordered chronologically!');

    // 6. Test cascade deletion
    await prisma.resource.delete({ where: { id: resource.id } });
    const orphanChecks = await prisma.linkCheck.findMany({ where: { linkId: link.id } });
    if (orphanChecks.length !== 0) {
      throw new Error(`Expected 0 checks after cascade deletion, but found ${orphanChecks.length}`);
    }
    console.log('✓ Cascade deletion verified: deleting Resource cleanly removed all attached LinkChecks.');

    // Cleanup institution
    await prisma.institution.delete({ where: { id: institution.id } });
    console.log('✓ Test cleanup completed.');
  } catch (err) {
    await prisma.linkCheck.deleteMany({ where: { linkId: link.id } }).catch(() => {});
    await prisma.resourceLink.deleteMany({ where: { resourceId: resource.id } }).catch(() => {});
    await prisma.resource.delete({ where: { id: resource.id } }).catch(() => {});
    await prisma.institution.delete({ where: { id: institution.id } }).catch(() => {});
    throw err;
  }
}

verifyLinkCheckHistory()
  .then(() => {
    console.log('LinkCheck history testing PASSED.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('LinkCheck history testing FAILED:', err);
    process.exit(1);
  });
