import dotenv from 'dotenv';
import path from 'path';

// Load workspace environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { prisma, LinkHealthStatus, LinkType, ResourceStatus } from '@repo/database';
import {
  detectDuplicateResources,
  getMissingFieldsReport,
  getStaleVerificationsReport,
  getResourcesWithoutLinks,
  getResourcesWithoutInstitutions,
  getResourcesNeverChecked,
  getDataQualityReport,
} from './data-quality';

async function runDataQualityTests() {
  console.log('--- RUNNING PHASE 18: DATA QUALITY TESTS ---');

  // Test setup variables
  const createdResourceIds: string[] = [];
  const createdLinkIds: string[] = [];
  let testInstId: string | null = null;

  try {
    // Setup an institution
    const testInst = await prisma.institution.create({
      data: {
        name: `Quality Test Institution ${Date.now()}`,
        country: 'Pan-African',
        type: 'REGIONAL_BODY',
      },
    });
    testInstId = testInst.id;

    // 1. Setup duplicates
    // Resource A: "African Mining Observatory"
    const resA = await prisma.resource.create({
      data: {
        name: 'African Mining Observatory',
        description: 'Comprehensive data on African mining concessions and mineral output.',
        industry: 'Mining',
        category: 'Extractive Industries',
        countryCoverage: 'Pan-African',
        sourceType: 'Public Registry',
        language: 'English',
        accessType: 'Open Data',
        updateFrequency: 'Monthly',
        status: ResourceStatus.ACTIVE,
        institutionId: testInst.id,
      },
    });
    createdResourceIds.push(resA.id);

    // Link for Resource A
    const linkA = await prisma.resourceLink.create({
      data: {
        resourceId: resA.id,
        url: 'https://mining-observatory.africa/data/portal',
        linkType: LinkType.DATA,
        status: LinkHealthStatus.HEALTHY,
        lastCheckedAt: new Date(),
      },
    });
    createdLinkIds.push(linkA.id);

    // Resource B: "African Mining Observatory" (Exact name duplicate)
    const resB = await prisma.resource.create({
      data: {
        name: 'African Mining Observatory',
        description: 'Concessions tracker copy.',
        status: ResourceStatus.DRAFT,
      },
    });
    createdResourceIds.push(resB.id);

    // Resource C: "african-mining-observatory" (Normalized name duplicate)
    const resC = await prisma.resource.create({
      data: {
        name: 'african-mining-observatory',
        description: 'Normalized match copy.',
        status: ResourceStatus.ACTIVE,
      },
    });
    createdResourceIds.push(resC.id);

    // Resource D: "Continental Minerals Portal" with same endpoint URL as Resource A
    const resD = await prisma.resource.create({
      data: {
        name: 'Continental Minerals Portal',
        description: 'Another portal pointing to same data.',
        status: ResourceStatus.ACTIVE,
      },
    });
    createdResourceIds.push(resD.id);

    const linkD = await prisma.resourceLink.create({
      data: {
        resourceId: resD.id,
        url: 'https://mining-observatory.africa/data/portal/', // Same URL (with trailing slash)
        linkType: LinkType.DATA,
        status: LinkHealthStatus.HEALTHY,
        lastCheckedAt: new Date(),
      },
    });
    createdLinkIds.push(linkD.id);

    // 2. Setup resource with missing critical fields
    const resMissing = await prisma.resource.create({
      data: {
        name: 'Incomplete Dataset',
        description: '', // Empty description
        industry: null, // Missing industry
        category: null, // Missing category
        countryCoverage: null, // Missing country
        status: ResourceStatus.DRAFT,
      },
    });
    createdResourceIds.push(resMissing.id);

    // 3. Setup resource with stale verification (> 30 days)
    const resStale = await prisma.resource.create({
      data: {
        name: 'Stale Link Resource',
        description: 'Dataset with old verification timestamp.',
        status: ResourceStatus.ACTIVE,
        institutionId: testInst.id,
      },
    });
    createdResourceIds.push(resStale.id);

    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    const linkStale = await prisma.resourceLink.create({
      data: {
        resourceId: resStale.id,
        url: 'https://example.com/stale-dataset.csv',
        linkType: LinkType.DATA,
        status: LinkHealthStatus.HEALTHY,
        lastCheckedAt: fortyDaysAgo,
      },
    });
    createdLinkIds.push(linkStale.id);

    // 4. Setup resource without links (resMissing already has 0 links)
    // 5. Setup resource without institutions (resMissing and resB have no institutionId)

    // 6. Setup link never checked
    const resNever = await prisma.resource.create({
      data: {
        name: 'Never Checked Dataset',
        description: 'Dataset with an unchecked link.',
        status: ResourceStatus.ACTIVE,
      },
    });
    createdResourceIds.push(resNever.id);

    const linkNever = await prisma.resourceLink.create({
      data: {
        resourceId: resNever.id,
        url: 'https://example.com/never-checked-link.json',
        linkType: LinkType.API,
        status: LinkHealthStatus.UNKNOWN,
        lastCheckedAt: null, // Never checked
      },
    });
    createdLinkIds.push(linkNever.id);

    // TEST 1: Duplicate Detection
    console.log('\n[TEST 1] Verifying duplicate detection...');
    const duplicates = await detectDuplicateResources(prisma);
    const hasExact = duplicates.some(
      (d) =>
        d.matchReason === 'EXACT_NAME' &&
        ((d.resourceA.id === resA.id && d.resourceB.id === resB.id) ||
          (d.resourceA.id === resB.id && d.resourceB.id === resA.id))
    );
    const hasNormalized = duplicates.some(
      (d) =>
        d.matchReason === 'NORMALIZED_NAME' &&
        ((d.resourceA.id === resA.id && d.resourceB.id === resC.id) ||
          (d.resourceA.id === resC.id && d.resourceB.id === resA.id))
    );
    const hasSharedUrl = duplicates.some(
      (d) =>
        d.matchReason === 'SHARED_ENDPOINT_URL' &&
        ((d.resourceA.id === resA.id && d.resourceB.id === resD.id) ||
          (d.resourceA.id === resD.id && d.resourceB.id === resA.id))
    );

    if (!hasExact) throw new Error('Expected exact name duplicate to be flagged');
    if (!hasNormalized) throw new Error('Expected normalized name duplicate to be flagged');
    if (!hasSharedUrl) throw new Error('Expected shared endpoint URL duplicate to be flagged');

    // Rule: "Potential duplicates should be flagged, not automatically deleted."
    const stillExistsA = await prisma.resource.findUnique({ where: { id: resA.id } });
    const stillExistsB = await prisma.resource.findUnique({ where: { id: resB.id } });
    if (!stillExistsA || !stillExistsB) {
      throw new Error('Potential duplicate was automatically deleted! Rule violated.');
    }
    console.log('  PASSED: Exact, normalized, and shared-URL duplicates flagged without deletion.');

    // TEST 2: Missing-Field Reports
    console.log('\n[TEST 2] Verifying missing-field reports...');
    const missingReports = await getMissingFieldsReport(prisma);
    const incompleteItem = missingReports.find((r) => r.id === resMissing.id);
    if (!incompleteItem) {
      throw new Error('Expected incomplete dataset to be in missing fields report');
    }
    if (!incompleteItem.missingFields.includes('description')) {
      throw new Error('Expected description to be flagged as missing');
    }
    if (!incompleteItem.missingFields.includes('industry')) {
      throw new Error('Expected industry to be flagged as missing');
    }
    if (incompleteItem.completenessPercent >= 100) {
      throw new Error(`Completeness percent invalid: ${incompleteItem.completenessPercent}`);
    }
    console.log(
      `  PASSED: Incomplete dataset identified with missing fields [${incompleteItem.missingFields.join(', ')}] (${incompleteItem.completenessPercent}% completeness).`
    );

    // TEST 3: Stale Verification Reports
    console.log('\n[TEST 3] Verifying stale verification reports (> 30 days)...');
    const staleReports = await getStaleVerificationsReport(prisma, 30);
    const staleFound = staleReports.find((s) => s.linkId === linkStale.id);
    if (!staleFound) {
      throw new Error('Expected stale link to be in stale verifications report');
    }
    if (staleFound.daysSinceCheck < 38) {
      throw new Error(`Expected at least 38 days since check, got ${staleFound.daysSinceCheck}`);
    }
    console.log(`  PASSED: Stale verification report flagged link checked ${staleFound.daysSinceCheck} days ago.`);

    // TEST 4: Resources Without Links
    console.log('\n[TEST 4] Verifying resources without links report...');
    const noLinksReports = await getResourcesWithoutLinks(prisma);
    const resNoLinksFound = noLinksReports.some((r) => r.id === resMissing.id);
    if (!resNoLinksFound) {
      throw new Error('Expected resource with 0 links to be flagged');
    }
    console.log('  PASSED: Resource without links successfully flagged.');

    // TEST 5: Resources Without Institutions
    console.log('\n[TEST 5] Verifying resources without institutions report...');
    const noInstReports = await getResourcesWithoutInstitutions(prisma);
    const resNoInstFound = noInstReports.some((r) => r.id === resMissing.id);
    if (!resNoInstFound) {
      throw new Error('Expected resource without institution to be flagged');
    }
    console.log('  PASSED: Resource without institution successfully flagged.');

    // TEST 6: Resources Never Checked
    console.log('\n[TEST 6] Verifying resources never checked report...');
    const neverCheckedReports = await getResourcesNeverChecked(prisma);
    const neverFound = neverCheckedReports.some((n) => n.linkId === linkNever.id);
    if (!neverFound) {
      throw new Error('Expected never-checked link to be in never checked report');
    }
    console.log('  PASSED: Never checked link successfully flagged.');

    // TEST 7: Aggregated Data Quality Report
    console.log('\n[TEST 7] Verifying aggregated getDataQualityReport...');
    const fullReport = await getDataQualityReport(prisma, { staleDays: 30 });
    if (fullReport.summary.duplicatesCount < 3) {
      throw new Error(`Expected at least 3 duplicate pairs, got ${fullReport.summary.duplicatesCount}`);
    }
    if (fullReport.summary.staleVerificationsCount < 1) {
      throw new Error('Expected stale count >= 1');
    }
    if (fullReport.summary.resourcesWithoutLinksCount < 1) {
      throw new Error('Expected without links count >= 1');
    }
    if (fullReport.summary.resourcesWithoutInstitutionsCount < 1) {
      throw new Error('Expected without institutions count >= 1');
    }
    if (fullReport.summary.neverCheckedCount < 1) {
      throw new Error('Expected never checked count >= 1');
    }
    if (fullReport.summary.overallHealthScore < 0 || fullReport.summary.overallHealthScore > 100) {
      throw new Error(`Health score out of bounds: ${fullReport.summary.overallHealthScore}`);
    }
    console.log(
      `  PASSED: Aggregated report compiled: Health Score = ${fullReport.summary.overallHealthScore}/100, Duplicates = ${fullReport.summary.duplicatesCount}, Missing Fields = ${fullReport.summary.missingFieldsCount}, Stale = ${fullReport.summary.staleVerificationsCount}, No Links = ${fullReport.summary.resourcesWithoutLinksCount}, No Inst = ${fullReport.summary.resourcesWithoutInstitutionsCount}, Never Checked = ${fullReport.summary.neverCheckedCount}.`
    );

    console.log('\n======================================================');
    console.log('✅ ALL PHASE 18 DATA QUALITY TESTS PASSED (7/7)');
    console.log('======================================================\n');
  } finally {
    // Teardown test fixtures
    for (const linkId of createdLinkIds) {
      await prisma.linkAudit.deleteMany({ where: { linkId } }).catch(() => {});
      await prisma.linkCheck.deleteMany({ where: { linkId } }).catch(() => {});
      await prisma.resourceLink.deleteMany({ where: { id: linkId } }).catch(() => {});
    }
    for (const resId of createdResourceIds) {
      await prisma.resource.deleteMany({ where: { id: resId } }).catch(() => {});
    }
    if (testInstId) {
      await prisma.institution.deleteMany({ where: { id: testInstId } }).catch(() => {});
    }
  }
}

runDataQualityTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Data Quality Test failed:', err);
    process.exit(1);
  });
