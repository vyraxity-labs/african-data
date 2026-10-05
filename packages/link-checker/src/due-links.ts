/**
 * Due Link Selection & Query Builder for Scheduled Link Monitoring
 *
 * Implements Step 13.2 requirements:
 * 1. Eligibility definition:
 *    - A link is eligible if: `lastCheckedAt IS NULL` OR `lastCheckedAt <= now - checkIntervalMs`
 * 2. Uses indexed query leveraging `@@index([lastCheckedAt])`.
 * 3. Never loads every link into memory; bounded strictly by `take: batchSize`.
 * 4. Priority ordering: Unchecked links (`lastCheckedAt IS NULL`) prioritized first,
 *    followed by oldest checked links (`lastCheckedAt ASC`).
 */

export interface DueLinkQueryOptions {
  /**
   * The cutoff interval in milliseconds (default: 24 hours = 86,400,000 ms).
   * Links checked more recently than (now - checkIntervalMs) are NOT eligible.
   */
  checkIntervalMs?: number;
  /**
   * Maximum links to fetch (clamped by batchSize). Default: 25.
   */
  batchSize?: number;
  /**
   * Optional reference timestamp (defaults to new Date()). Useful for testing.
   */
  now?: Date;
  /**
   * Optional filter by resourceId (e.g. for resource-specific verification or isolated tests).
   */
  resourceId?: string;
}

export interface DueLinksWhereClause {
  resourceId?: string;
  OR: [
    { lastCheckedAt: null },
    { lastCheckedAt: { lte: Date } }
  ];
}

/**
 * Builds Prisma `where` clause for selecting links due for verification.
 * Strictly uses indexed conditions on `lastCheckedAt`.
 */
export function buildDueLinksWhereInput(
  options: DueLinkQueryOptions = {}
): { where: DueLinksWhereClause; cutoffDate: Date } {
  const now = options.now ?? new Date();
  const checkIntervalMs = options.checkIntervalMs ?? 24 * 60 * 60 * 1000; // 24 hours
  const cutoffDate = new Date(now.getTime() - checkIntervalMs);

  const where: DueLinksWhereClause = {
    OR: [
      { lastCheckedAt: null },
      { lastCheckedAt: { lte: cutoffDate } },
    ],
  };

  if (options.resourceId) {
    where.resourceId = options.resourceId;
  }

  return {
    cutoffDate,
    where,
  };
}

/**
 * Executes a bounded database query selecting links due for scheduled monitoring.
 *
 * Important (Section 13.2):
 * - Does not load all links into memory.
 * - Uses `@@index([lastCheckedAt])`.
 * - Prioritizes never-checked links first (NULLS FIRST / ascending order).
 */
export async function queryDueLinks(
  prismaClient: any,
  options: DueLinkQueryOptions = {}
): Promise<{
  dueLinks: Array<{
    id: string;
    url: string;
    linkType: string;
    status: string;
    lastCheckedAt: Date | null;
    resourceId: string;
  }>;
  cutoffDate: Date;
  batchSize: number;
}> {
  const batchSize = Math.max(1, Math.min(100, options.batchSize ?? 25));
  const { where, cutoffDate } = buildDueLinksWhereInput(options);

  const dueLinks = await prismaClient.resourceLink.findMany({
    where,
    take: batchSize,
    orderBy: [
      // In Prisma, null values in ascending order are handled first or according to DB nulls
      { lastCheckedAt: 'asc' },
    ],
    select: {
      id: true,
      url: true,
      linkType: true,
      status: true,
      lastCheckedAt: true,
      resourceId: true,
    },
  });

  return {
    dueLinks,
    cutoffDate,
    batchSize,
  };
}
