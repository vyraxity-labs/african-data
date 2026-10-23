import { PrismaClient } from '@repo/database';

export type DuplicateMatchReason = 'EXACT_NAME' | 'NORMALIZED_NAME' | 'SHARED_ENDPOINT_URL';

export interface DuplicateResourceRef {
  id: string;
  name: string;
  status: string;
  institutionName?: string | null;
  url?: string | null;
}

export interface DuplicatePair {
  id: string;
  resourceA: DuplicateResourceRef;
  resourceB: DuplicateResourceRef;
  matchReason: DuplicateMatchReason;
  detail: string;
}

export interface MissingFieldsItem {
  id: string;
  name: string;
  status: string;
  missingFields: string[];
  completenessPercent: number;
}

export interface StaleVerificationItem {
  linkId: string;
  resourceId: string;
  resourceName: string;
  url: string;
  lastCheckedAt: Date;
  daysSinceCheck: number;
  status: string;
}

export interface MissingLinksItem {
  id: string;
  name: string;
  status: string;
  institutionName?: string | null;
  createdAt: Date;
}

export interface MissingInstitutionItem {
  id: string;
  name: string;
  status: string;
  category?: string | null;
  createdAt: Date;
}

export interface NeverCheckedItem {
  linkId: string;
  resourceId: string;
  resourceName: string;
  url: string;
  linkType: string;
  status: string;
  createdAt: Date;
}

export interface DataQualityReport {
  summary: {
    totalResources: number;
    totalLinks: number;
    duplicatesCount: number;
    missingFieldsCount: number;
    staleVerificationsCount: number;
    resourcesWithoutLinksCount: number;
    resourcesWithoutInstitutionsCount: number;
    neverCheckedCount: number;
    overallHealthScore: number;
  };
  duplicates: DuplicatePair[];
  missingFields: MissingFieldsItem[];
  staleVerifications: StaleVerificationItem[];
  resourcesWithoutLinks: MissingLinksItem[];
  resourcesWithoutInstitutions: MissingInstitutionItem[];
  neverChecked: NeverCheckedItem[];
}

/**
 * Normalizes a resource title for duplicate detection comparison:
 * lowercase, removes non-alphanumeric characters, and trims excess whitespace.
 */
export function normalizeNameForComparison(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Normalizes a URL for comparison (removes trailing slashes and hashes).
 */
export function normalizeUrlForComparison(url: string): string {
  try {
    const parsed = new URL(url);
    let href = `${parsed.protocol}//${parsed.hostname.toLowerCase()}${parsed.pathname}`;
    if (href.endsWith('/') && href.length > 10) {
      href = href.slice(0, -1);
    }
    return href;
  } catch {
    return url.trim().toLowerCase().replace(/\/+$/, '');
  }
}

/**
 * Critical metadata fields expected for complete catalogue entries.
 */
export const CRITICAL_METADATA_FIELDS = [
  'description',
  'industry',
  'category',
  'countryCoverage',
  'sourceType',
  'language',
  'accessType',
  'updateFrequency',
] as const;

/**
 * Detects potential duplicate resources.
 * Rule: "Potential duplicates should be flagged, not automatically deleted."
 */
export async function detectDuplicateResources(prisma: PrismaClient): Promise<DuplicatePair[]> {
  const resources = await prisma.resource.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      institution: {
        select: { name: true },
      },
      links: {
        select: { url: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const duplicates: DuplicatePair[] = [];
  const seenPairs = new Set<string>();

  const getPairKey = (id1: string, id2: string) => {
    return [id1, id2].sort().join('::');
  };

  // Compare every resource with subsequent resources
  for (let i = 0; i < resources.length; i++) {
    const resA = resources[i];
    if (!resA) continue;
    const nameA = resA.name.trim();
    const normA = normalizeNameForComparison(nameA);
    const urlsA = resA.links.map((l) => normalizeUrlForComparison(l.url));

    for (let j = i + 1; j < resources.length; j++) {
      const resB = resources[j];
      if (!resB) continue;
      const pairKey = getPairKey(resA.id, resB.id);
      if (seenPairs.has(pairKey)) continue;

      const nameB = resB.name.trim();
      const normB = normalizeNameForComparison(nameB);
      const urlsB = resB.links.map((l) => normalizeUrlForComparison(l.url));

      // 1. Exact Name Match
      if (nameA.toLowerCase() === nameB.toLowerCase()) {
        seenPairs.add(pairKey);
        duplicates.push({
          id: `dup-${resA.id}-${resB.id}`,
          resourceA: {
            id: resA.id,
            name: resA.name,
            status: resA.status,
            institutionName: resA.institution?.name,
          },
          resourceB: {
            id: resB.id,
            name: resB.name,
            status: resB.status,
            institutionName: resB.institution?.name,
          },
          matchReason: 'EXACT_NAME',
          detail: `Identical dataset title (case-insensitive match): "${resA.name}"`,
        });
        continue;
      }

      // 2. Normalized Name Match (similarity after stripping non-alphanumeric)
      if (normA.length > 5 && normA === normB) {
        seenPairs.add(pairKey);
        duplicates.push({
          id: `dup-${resA.id}-${resB.id}`,
          resourceA: {
            id: resA.id,
            name: resA.name,
            status: resA.status,
            institutionName: resA.institution?.name,
          },
          resourceB: {
            id: resB.id,
            name: resB.name,
            status: resB.status,
            institutionName: resB.institution?.name,
          },
          matchReason: 'NORMALIZED_NAME',
          detail: `Normalized title match: "${resA.name}" vs "${resB.name}"`,
        });
        continue;
      }

      // 3. Shared Endpoint URL
      const sharedUrl = urlsA.find((uA) => urlsB.includes(uA));
      if (sharedUrl) {
        seenPairs.add(pairKey);
        duplicates.push({
          id: `dup-${resA.id}-${resB.id}`,
          resourceA: {
            id: resA.id,
            name: resA.name,
            status: resA.status,
            institutionName: resA.institution?.name,
            url: sharedUrl,
          },
          resourceB: {
            id: resB.id,
            name: resB.name,
            status: resB.status,
            institutionName: resB.institution?.name,
            url: sharedUrl,
          },
          matchReason: 'SHARED_ENDPOINT_URL',
          detail: `Both datasets point to the identical URL endpoint: ${sharedUrl}`,
        });
      }
    }
  }

  return duplicates;
}

/**
 * Identifies resources with missing critical metadata fields.
 */
export async function getMissingFieldsReport(prisma: PrismaClient): Promise<MissingFieldsItem[]> {
  const resources = await prisma.resource.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      description: true,
      industry: true,
      category: true,
      countryCoverage: true,
      sourceType: true,
      language: true,
      accessType: true,
      updateFrequency: true,
    },
    orderBy: { name: 'asc' },
  });

  const results: MissingFieldsItem[] = [];
  const totalFields = CRITICAL_METADATA_FIELDS.length;

  for (const res of resources) {
    const missing: string[] = [];
    for (const field of CRITICAL_METADATA_FIELDS) {
      const val = res[field as keyof typeof res];
      if (val === null || val === undefined || (typeof val === 'string' && val.trim() === '')) {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      const completenessPercent = Math.round(((totalFields - missing.length) / totalFields) * 100);
      results.push({
        id: res.id,
        name: res.name,
        status: res.status,
        missingFields: missing,
        completenessPercent,
      });
    }
  }

  // Sort by lowest completeness first
  return results.sort((a, b) => a.completenessPercent - b.completenessPercent);
}

/**
 * Identifies links whose last health verification check is older than staleDays (default: 30 days).
 */
export async function getStaleVerificationsReport(
  prisma: PrismaClient,
  staleDays = 30
): Promise<StaleVerificationItem[]> {
  const cutoffDate = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);

  const links = await prisma.resourceLink.findMany({
    where: {
      lastCheckedAt: {
        not: null,
        lt: cutoffDate,
      },
    },
    select: {
      id: true,
      url: true,
      status: true,
      lastCheckedAt: true,
      resource: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { lastCheckedAt: 'asc' },
  });

  const nowMs = Date.now();
  return links.map((link) => {
    const checkedMs = link.lastCheckedAt ? new Date(link.lastCheckedAt).getTime() : nowMs;
    const daysSinceCheck = Math.max(1, Math.floor((nowMs - checkedMs) / (24 * 60 * 60 * 1000)));

    return {
      linkId: link.id,
      resourceId: link.resource.id,
      resourceName: link.resource.name,
      url: link.url,
      lastCheckedAt: link.lastCheckedAt || new Date(),
      daysSinceCheck,
      status: link.status,
    };
  });
}

/**
 * Identifies resources that have 0 associated links.
 */
export async function getResourcesWithoutLinks(prisma: PrismaClient): Promise<MissingLinksItem[]> {
  const resources = await prisma.resource.findMany({
    where: {
      links: {
        none: {},
      },
    },
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
      institution: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return resources.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    institutionName: r.institution?.name,
    createdAt: r.createdAt,
  }));
}

/**
 * Identifies resources that have no custodian institution assigned.
 */
export async function getResourcesWithoutInstitutions(
  prisma: PrismaClient
): Promise<MissingInstitutionItem[]> {
  const resources = await prisma.resource.findMany({
    where: {
      institutionId: null,
    },
    select: {
      id: true,
      name: true,
      status: true,
      category: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return resources.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    category: r.category,
    createdAt: r.createdAt,
  }));
}

/**
 * Identifies resource links that have never been checked.
 */
export async function getResourcesNeverChecked(prisma: PrismaClient): Promise<NeverCheckedItem[]> {
  const links = await prisma.resourceLink.findMany({
    where: {
      lastCheckedAt: null,
    },
    select: {
      id: true,
      url: true,
      linkType: true,
      status: true,
      createdAt: true,
      resource: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return links.map((l) => ({
    linkId: l.id,
    resourceId: l.resource.id,
    resourceName: l.resource.name,
    url: l.url,
    linkType: l.linkType,
    status: l.status,
    createdAt: l.createdAt,
  }));
}

/**
 * Aggregates the full Phase 18 Data Quality Report across all 6 criteria:
 * 1. duplicate detection
 * 2. missing-field reports
 * 3. stale verification reports
 * 4. resources without links
 * 5. resources without institutions
 * 6. resources never checked
 */
export async function getDataQualityReport(
  prisma: PrismaClient,
  options: { staleDays?: number } = {}
): Promise<DataQualityReport> {
  const { staleDays = 30 } = options;

  const [
    totalResources,
    totalLinks,
    duplicates,
    missingFields,
    staleVerifications,
    resourcesWithoutLinks,
    resourcesWithoutInstitutions,
    neverChecked,
  ] = await Promise.all([
    prisma.resource.count(),
    prisma.resourceLink.count(),
    detectDuplicateResources(prisma),
    getMissingFieldsReport(prisma),
    getStaleVerificationsReport(prisma, staleDays),
    getResourcesWithoutLinks(prisma),
    getResourcesWithoutInstitutions(prisma),
    getResourcesNeverChecked(prisma),
  ]);

  // Compute overall data health score (0 - 100)
  // Deduct points for duplicates, missing fields, orphaned resources, and never checked links
  let score = 100;
  if (totalResources > 0) {
    const missingFieldPenalty = Math.min(30, Math.round((missingFields.length / totalResources) * 30));
    const duplicatePenalty = Math.min(20, duplicates.length * 5);
    const noLinkPenalty = Math.min(25, Math.round((resourcesWithoutLinks.length / totalResources) * 25));
    const noInstPenalty = Math.min(15, Math.round((resourcesWithoutInstitutions.length / totalResources) * 15));
    score = Math.max(0, 100 - missingFieldPenalty - duplicatePenalty - noLinkPenalty - noInstPenalty);
  }

  return {
    summary: {
      totalResources,
      totalLinks,
      duplicatesCount: duplicates.length,
      missingFieldsCount: missingFields.length,
      staleVerificationsCount: staleVerifications.length,
      resourcesWithoutLinksCount: resourcesWithoutLinks.length,
      resourcesWithoutInstitutionsCount: resourcesWithoutInstitutions.length,
      neverCheckedCount: neverChecked.length,
      overallHealthScore: score,
    },
    duplicates,
    missingFields,
    staleVerifications,
    resourcesWithoutLinks,
    resourcesWithoutInstitutions,
    neverChecked,
  };
}
