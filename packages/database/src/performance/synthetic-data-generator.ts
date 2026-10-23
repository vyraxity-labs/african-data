import { prisma, ResourceStatus, LinkType, LinkHealthStatus } from '../index';

export const SYNTHETIC_TAG = 'PERF_BENCHMARK_SYNTHETIC';

export interface GenerationStats {
  institutionsCreated: number;
  resourcesCreated: number;
  linksCreated: number;
  durationMs: number;
}

const COUNTRIES = [
  'Nigeria',
  'Kenya',
  'South Africa',
  'Ghana',
  'Rwanda',
  'Egypt',
  'Ethiopia',
  'Morocco',
  'Uganda',
  'Senegal',
  'Tanzania',
  'Pan-African',
];

const INDUSTRIES = [
  'Health',
  'Agriculture',
  'Finance',
  'Education',
  'Environment',
  'Energy',
  'Governance',
  'Trade',
  'Demographics',
  'Telecommunications',
];

const CATEGORIES = [
  'Statistical Survey',
  'Geospatial Data',
  'Time Series',
  'Annual Report',
  'API Feed',
  'Census Data',
  'National Accounts',
  'Household Survey',
];

const ACCESS_TYPES = ['PUBLIC', 'RESTRICTED', 'COMMERCIAL', 'REGISTERED_ONLY'];
const SOURCE_TYPES = ['GOVERNMENT', 'ACADEMIC', 'INTERNATIONAL_ORG', 'CIVIL_SOCIETY', 'PRIVATE_SECTOR'];
const GRANULARITIES = ['NATIONAL', 'REGIONAL', 'MUNICIPAL', 'POINT_LOCATION', 'GRID'];
const LANGUAGES = ['English', 'French', 'Arabic', 'Portuguese', 'Swahili'];

const KEYWORDS = [
  'Epidemiology and Vaccination Tracking',
  'Annual Crop Yields and Meteorological Anomalies',
  'Central Bank Inflation Metrics and Interest Rates',
  'Primary and Secondary Literacy Rate Benchmarks',
  'Precipitation Models and Groundwater Aquifers',
  'Foreign Exchange Reserves and Liquidity Volatility',
  'Sub-National Population Density Census Grid',
  'Customs Import Tariffs and Cross-Border Logistics',
  'Solar Photovoltaic Generation and Grid Reliability',
  'Public Expenditure Tracking and Fiscal Transparency',
  'Household Income and Poverty Index Microdata',
  'Maritime Freight Volumes and Port Container Throughput',
  'Forest Canopy Loss and Deforestation Satellite Observations',
  'Mobile Broadband Coverage and Data Affordability',
  'Urban Air Quality PM2.5 Hourly Monitoring Streams',
];

/**
 * Creates 50 synthetic custodian institutions.
 */
export async function seedSyntheticInstitutions(): Promise<string[]> {
  const institutionIds: string[] = [];
  const existing = await prisma.institution.findMany({
    where: { website: { contains: 'synth-inst-' } },
    select: { id: true },
  });

  if (existing.length >= 50) {
    return existing.map((i) => i.id);
  }

  const batch = [];
  for (let i = 1; i <= 50; i++) {
    const id = `synth-inst-${String(i).padStart(4, '0')}`;
    institutionIds.push(id);
    const country = COUNTRIES[i % COUNTRIES.length]!;
    batch.push({
      id,
      name: `African Data Custodian Agency ${i} (${country})`,
      website: `https://synth-inst-${i}.gov.${country.toLowerCase().replace(/[^a-z]/g, '')}`,
      description: `Official statutory authority responsible for administrative data and statistics in ${country}.`,
      type: i % 2 === 0 ? 'GOVERNMENT_STATISTICAL_OFFICE' : 'RESEARCH_CENTRE',
      country,
    });
  }

  // Idempotently create
  for (const inst of batch) {
    await prisma.institution.upsert({
      where: { id: inst.id },
      create: inst,
      update: {},
    });
  }

  return institutionIds;
}

/**
 * Rapidly seeds 10,000 resources and 50,000 links using chunked multi-value batch inserts.
 */
export async function seedSyntheticScaleData(
  targetResources = 10000,
  linksPerResource = 5
): Promise<GenerationStats> {
  const startTime = Date.now();
  console.log(`🚀 Starting synthetic scale generation (${targetResources} resources, ${targetResources * linksPerResource} links)...`);

  // 1. Ensure institutions exist
  const institutionIds = await seedSyntheticInstitutions();

  // Check how many synthetic resources already exist
  const existingCount = await prisma.resource.count({
    where: { priority: SYNTHETIC_TAG },
  });

  if (existingCount >= targetResources) {
    const existingLinks = await prisma.resourceLink.count({
      where: { resource: { priority: SYNTHETIC_TAG } },
    });
    console.log(`ℹ️ Synthetic dataset already populated: ${existingCount} resources, ${existingLinks} links.`);
    return {
      institutionsCreated: institutionIds.length,
      resourcesCreated: existingCount,
      linksCreated: existingLinks,
      durationMs: Date.now() - startTime,
    };
  }

  const neededResources = targetResources - existingCount;
  const startIdx = existingCount + 1;
  console.log(`📦 Generating ${neededResources} new synthetic resources in batches...`);

  const RESOURCE_BATCH_SIZE = 2000;
  let totalResourcesCreated = existingCount;
  let totalLinksCreated = 0;

  for (let batchStart = 0; batchStart < neededResources; batchStart += RESOURCE_BATCH_SIZE) {
    const currentBatchSize = Math.min(RESOURCE_BATCH_SIZE, neededResources - batchStart);
    const resourceBatch = [];
    const linkBatch = [];

    const now = Date.now();

    for (let j = 0; j < currentBatchSize; j++) {
      const globalIdx = startIdx + batchStart + j;
      const resourceId = `synth-res-${String(globalIdx).padStart(7, '0')}`;
      const instId = institutionIds[globalIdx % institutionIds.length]!;
      const country = COUNTRIES[globalIdx % COUNTRIES.length]!;
      const industry = INDUSTRIES[globalIdx % INDUSTRIES.length]!;
      const category = CATEGORIES[globalIdx % CATEGORIES.length]!;
      const access = ACCESS_TYPES[globalIdx % ACCESS_TYPES.length]!;
      const source = SOURCE_TYPES[globalIdx % SOURCE_TYPES.length]!;
      const granularity = GRANULARITIES[globalIdx % GRANULARITIES.length]!;
      const language = LANGUAGES[globalIdx % LANGUAGES.length]!;
      const keyword = KEYWORDS[globalIdx % KEYWORDS.length]!;

      // 85% ACTIVE, 10% DRAFT, 5% ARCHIVED
      const statusRoll = globalIdx % 100;
      const status: ResourceStatus =
        statusRoll < 85 ? ResourceStatus.ACTIVE : statusRoll < 95 ? ResourceStatus.DRAFT : ResourceStatus.ARCHIVED;

      // Realistic date spread over the last 365 days
      const daysAgo = (globalIdx * 7) % 365;
      const createdAt = new Date(now - daysAgo * 86400000);
      const updatedAt = new Date(createdAt.getTime() + 3600000);

      resourceBatch.push({
        id: resourceId,
        name: `${country} ${keyword} [Dataset #${globalIdx}]`,
        description: `Comprehensive multi-year empirical dataset covering ${keyword.toLowerCase()} across ${country} with administrative breakdowns and metadata indicators.`,
        institutionId: instId,
        sourceType: source,
        industry,
        category,
        countryCoverage: country,
        dataGranularity: granularity,
        language,
        accessType: access,
        updateFrequency: globalIdx % 3 === 0 ? 'MONTHLY' : globalIdx % 3 === 1 ? 'ANNUAL' : 'CONTINUOUS',
        apiAvailable: globalIdx % 4 === 0,
        priority: SYNTHETIC_TAG,
        notes: `Synthetic test record generated for Phase 20 performance benchmarking. Seed #${globalIdx}`,
        status,
        createdAt,
        updatedAt,
      });

      // 5 links per resource
      for (let l = 1; l <= linksPerResource; l++) {
        const linkGlobalIdx = (globalIdx - 1) * linksPerResource + l;
        const linkId = `synth-lnk-${String(linkGlobalIdx).padStart(8, '0')}`;

        // Link types distribution
        const linkType: LinkType =
          l === 1 ? LinkType.DATA : l === 2 ? LinkType.WEBSITE : l === 3 ? LinkType.API : l === 4 ? LinkType.DOWNLOAD : LinkType.DOCUMENTATION;

        // Link health status distribution: 80% HEALTHY, 8% BROKEN, 5% REDIRECTED, 4% TIMEOUT, 3% UNKNOWN
        const healthRoll = linkGlobalIdx % 100;
        let healthStatus: LinkHealthStatus = LinkHealthStatus.HEALTHY;
        let httpStatus: number | null = 200;
        let errorMessage: string | null = null;
        let finalUrl: string | null = null;

        if (healthRoll < 80) {
          healthStatus = LinkHealthStatus.HEALTHY;
          httpStatus = 200;
        } else if (healthRoll < 88) {
          healthStatus = LinkHealthStatus.BROKEN;
          httpStatus = 404;
          errorMessage = 'HTTP 404 Not Found';
        } else if (healthRoll < 93) {
          healthStatus = LinkHealthStatus.REDIRECTED;
          httpStatus = 301;
          finalUrl = `https://portal.${country.toLowerCase().replace(/[^a-z]/g, '')}.gov/redirected/res-${globalIdx}/data`;
        } else if (healthRoll < 97) {
          healthStatus = LinkHealthStatus.TIMEOUT;
          httpStatus = null;
          errorMessage = 'Connection timed out after 5000ms';
        } else {
          healthStatus = LinkHealthStatus.UNKNOWN;
          httpStatus = null;
        }

        // Last checked timing: some recent, some > 24 hours ago, some null
        const checkDaysAgo = (linkGlobalIdx * 3) % 10;
        const lastCheckedAt =
          healthStatus === LinkHealthStatus.UNKNOWN
            ? null
            : new Date(now - checkDaysAgo * 86400000 - ((linkGlobalIdx * 17) % 86400000));

        linkBatch.push({
          id: linkId,
          resourceId,
          url: `https://data.${country.toLowerCase().replace(/[^a-z]/g, '')}.gov/endpoints/res-${globalIdx}/part-${l}.csv`,
          linkType,
          status: healthStatus,
          httpStatus,
          finalUrl,
          lastCheckedAt,
          lastSuccessfulCheckAt: healthStatus === LinkHealthStatus.HEALTHY ? lastCheckedAt : null,
          responseTimeMs: healthStatus === LinkHealthStatus.HEALTHY ? 45 + ((linkGlobalIdx * 7) % 300) : null,
          errorMessage,
          checkLockedUntil: null,
          checkLockToken: null,
          checkAttemptedAt: lastCheckedAt,
          createdAt,
          updatedAt,
        });
      }
    }

    // Insert resources
    await prisma.resource.createMany({
      data: resourceBatch,
      skipDuplicates: true,
    });
    totalResourcesCreated += resourceBatch.length;

    // Insert links in chunks of 5000
    for (let c = 0; c < linkBatch.length; c += 5000) {
      const linkChunk = linkBatch.slice(c, c + 5000);
      await prisma.resourceLink.createMany({
        data: linkChunk,
        skipDuplicates: true,
      });
      totalLinksCreated += linkChunk.length;
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  ⚡ Inserted batch: ${totalResourcesCreated}/${targetResources} resources, ${totalLinksCreated} links (${elapsed}s elapsed)...`);
  }

  const durationMs = Date.now() - startTime;
  console.log(`✅ Synthetic scale generation completed in ${(durationMs / 1000).toFixed(2)}s:`);
  console.log(`   - Institutions: ${institutionIds.length}`);
  console.log(`   - Resources:    ${totalResourcesCreated}`);
  console.log(`   - Links:        ${totalLinksCreated}`);

  return {
    institutionsCreated: institutionIds.length,
    resourcesCreated: totalResourcesCreated,
    linksCreated: totalLinksCreated,
    durationMs,
  };
}

/**
 * Cleans up all synthetic resources, links, audits, and checks created for benchmarks.
 */
export async function purgeSyntheticScaleData(): Promise<{ resourcesDeleted: number; linksDeleted: number }> {
  console.log('🧹 Purging synthetic scale data...');
  const startTime = Date.now();

  // Links cascade with resources or delete directly for speed
  const deletedLinks = await prisma.resourceLink.deleteMany({
    where: { resource: { priority: SYNTHETIC_TAG } },
  });

  const deletedResources = await prisma.resource.deleteMany({
    where: { priority: SYNTHETIC_TAG },
  });

  console.log(`✨ Purge completed in ${Date.now() - startTime}ms: ${deletedResources.count} resources, ${deletedLinks.count} links removed.`);

  return {
    resourcesDeleted: deletedResources.count,
    linksDeleted: deletedLinks.count,
  };
}
