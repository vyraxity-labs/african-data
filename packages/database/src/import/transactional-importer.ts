import { prisma, ResourceStatus, LinkType, LinkHealthStatus } from '../index';
import type { NormalizedResourceData } from './types';

export interface ImportCommitOptions {
  batchSize?: number; // default 50
  defaultStatus?: ResourceStatus; // default ACTIVE
  skipDuplicates?: boolean; // default true
}

export interface ImportCommitResult {
  success: boolean;
  totalProcessed: number;
  resourcesCreated: number;
  institutionsCreated: number;
  linksCreated: number;
  skippedDuplicates: number;
  errors: Array<{ row: number; error: string }>;
}

/**
 * Safely imports normalized CSV records into PostgreSQL using Prisma transactions.
 * Resolves or creates Institutions, creates Resources, and attaches ResourceLinks.
 */
export async function commitImport(
  records: NormalizedResourceData[],
  options: ImportCommitOptions = {}
): Promise<ImportCommitResult> {
  const defaultStatus = options.defaultStatus ?? ResourceStatus.ACTIVE;
  const skipDuplicates = options.skipDuplicates ?? true;

  let resourcesCreated = 0;
  let institutionsCreated = 0;
  let linksCreated = 0;
  let skippedDuplicates = 0;
  const errors: Array<{ row: number; error: string }> = [];

  // Institution resolution cache: Name.toLowerCase() -> institutionId
  const institutionCache = new Map<string, string>();

  // Pre-populate institution cache from database
  const existingInstitutions = await prisma.institution.findMany({
    select: { id: true, name: true },
  });
  for (const inst of existingInstitutions) {
    institutionCache.set(inst.name.toLowerCase().trim(), inst.id);
  }

  // Pre-populate existing URL and Name maps to prevent duplicates
  const existingUrls = new Set<string>();
  const existingResourceNames = new Set<string>();

  const existingResources = await prisma.resource.findMany({
    select: {
      name: true,
      links: { select: { url: true } },
    },
  });

  for (const res of existingResources) {
    existingResourceNames.add(res.name.toLowerCase().trim());
    for (const link of res.links) {
      existingUrls.add(link.url.toLowerCase().trim());
    }
  }

  // Execute import in transactional batches (default 25 records per transaction)
  const batchSize = options.batchSize ?? 25;

  for (let i = 0; i < records.length; i += batchSize) {
    const chunk = records.slice(i, i + batchSize);

    try {
      await prisma.$transaction(
        async (tx) => {
          for (const item of chunk) {
            const rowNumber = item._rowNumber;
            const primaryUrl = (item.dataLink.normalized || item.dataLink.raw).toLowerCase().trim();
            const resourceNameKey = item.name.toLowerCase().trim();

            // Duplicate prevention
            if (skipDuplicates) {
              if (existingUrls.has(primaryUrl) || existingResourceNames.has(resourceNameKey)) {
                skippedDuplicates++;
                continue;
              }
            }

            // 1. Resolve or create Institution
            let institutionId: string | null = null;
            const instName = item.institutionName.trim();

            if (instName) {
              const instKey = instName.toLowerCase();
              if (institutionCache.has(instKey)) {
                institutionId = institutionCache.get(instKey) || null;
              } else {
                // Create institution inside transaction
                const newInst = await tx.institution.create({
                  data: {
                    name: instName,
                    website: item.sourceWebsite?.normalized || item.sourceWebsite?.raw || null,
                  },
                });
                institutionId = newInst.id;
                institutionCache.set(instKey, newInst.id);
                institutionsCreated++;
              }
            }

            // 2. Create Resource
            const createdResource = await tx.resource.create({
              data: {
                name: item.name,
                description: item.description || null,
                institutionId,
                sourceType: item.sourceType || null,
                industry: item.industry || null,
                category: item.category || null,
                countryCoverage: item.coverage.raw || null,
                dataGranularity: item.dataGranularity || null,
                language: item.languages.join(', ') || null,
                accessType: item.accessType,
                updateFrequency: item.updateFrequency || null,
                apiAvailable: item.apiAvailable,
                priority: item.priority,
                notes: item.notes || null,
                status: defaultStatus,
                metadata: item.metadata as any,
              },
            });
            resourcesCreated++;
            existingResourceNames.add(resourceNameKey);

            // 3. Create primary ResourceLink
            const primaryLinkType = item.apiAvailable ? LinkType.API : LinkType.DATA;

            await tx.resourceLink.create({
              data: {
                resourceId: createdResource.id,
                url: item.dataLink.normalized || item.dataLink.raw,
                linkType: primaryLinkType,
                status: LinkHealthStatus.UNKNOWN,
              },
            });
            linksCreated++;
            existingUrls.add(primaryUrl);

            // 4. Create secondary website ResourceLink if distinct and valid
            if (item.sourceWebsite && item.sourceWebsite.isValid) {
              const websiteUrl = (item.sourceWebsite.normalized || item.sourceWebsite.raw).trim();
              if (websiteUrl.toLowerCase() !== primaryUrl) {
                await tx.resourceLink.create({
                  data: {
                    resourceId: createdResource.id,
                    url: websiteUrl,
                    linkType: LinkType.WEBSITE,
                    status: LinkHealthStatus.UNKNOWN,
                  },
                });
                linksCreated++;
              }
            }
          }
        },
        {
          timeout: 20000,
        }
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({
        row: chunk[0]?._rowNumber ?? i + 1,
        error: `Transaction failed for batch starting at row ${chunk[0]?._rowNumber}: ${message}`,
      });
    }
  }

  return {
    success: errors.length === 0,
    totalProcessed: records.length,
    resourcesCreated,
    institutionsCreated,
    linksCreated,
    skippedDuplicates,
    errors,
  };
}
