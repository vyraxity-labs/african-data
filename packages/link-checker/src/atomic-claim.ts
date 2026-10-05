/**
 * Atomic Link Claiming Engine with PostgreSQL FOR UPDATE SKIP LOCKED
 *
 * Implements Step 13.3 specifications:
 * 1. Prevents two concurrent scheduled jobs/workers from checking the same links.
 * 2. Uses PostgreSQL row locking with `FOR UPDATE SKIP LOCKED`:
 *    - Worker A claims batch 1-25.
 *    - Worker B concurrently skips rows locked by Worker A and claims batch 26-50.
 * 3. Sets an explicit claim lock state:
 *    - `checkLockedUntil`: Timestamp when lock expires.
 *    - `checkLockToken`: Unique UUID token owned by the claiming worker.
 *    - `checkAttemptedAt`: Timestamp when check attempt started.
 * 4. Lock Expiration Safety:
 *    - If a worker crashes or encounters an unhandled exception, `checkLockedUntil`
 *      expires automatically (default lock duration: 5 minutes), allowing stale
 *      locks to be reclaimed by subsequent workers.
 * 5. Releasing Claim:
 *    - Worker releases claim using token verification when check finishes or fails.
 */

import { randomUUID } from 'node:crypto';

export interface ClaimOptions {
  /**
   * Number of links to claim in this batch (clamped 1 to 100). Default: 25.
   */
  batchSize?: number;
  /**
   * Cutoff interval for due links in milliseconds (default: 24h = 86,400,000ms).
   */
  checkIntervalMs?: number;
  /**
   * Duration in milliseconds that the claimed lock remains valid before expiring.
   * Default: 5 minutes (300,000ms).
   */
  lockDurationMs?: number;
  /**
   * Unique worker / execution instance token. Generated automatically if omitted.
   */
  lockToken?: string;
  /**
   * Optional reference time (defaults to new Date()).
   */
  now?: Date;
  /**
   * Optional filter by resourceId (e.g. for resource-specific execution or testing).
   */
  resourceId?: string;
}

export interface ClaimedLink {
  id: string;
  url: string;
  linkType: string;
  status: string;
  lastCheckedAt: Date | null;
  resourceId: string;
  checkLockedUntil: Date | null;
  checkLockToken: string | null;
  checkAttemptedAt: Date | null;
}

export interface ClaimResult {
  claimedLinks: ClaimedLink[];
  lockToken: string;
  lockExpiresAt: Date;
  claimedCount: number;
}

/**
 * Claims a batch of due links atomically using PostgreSQL `FOR UPDATE SKIP LOCKED`.
 */
export async function claimDueLinksAtomic(
  prismaClient: any,
  options: ClaimOptions = {}
): Promise<ClaimResult> {
  const batchSize = Math.max(1, Math.min(100, options.batchSize ?? 25));
  const checkIntervalMs = options.checkIntervalMs ?? 24 * 60 * 60 * 1000;
  const lockDurationMs = options.lockDurationMs ?? 5 * 60 * 1000; // 5 min default lock
  const lockToken = options.lockToken ?? randomUUID();
  const now = options.now ?? new Date();

  const cutoffDate = new Date(now.getTime() - checkIntervalMs);
  const lockExpiresAt = new Date(now.getTime() + lockDurationMs);

  // Execute atomic claim inside a PostgreSQL transaction using SKIP LOCKED
  const claimedLinks = await prismaClient.$transaction(async (tx: any) => {
    // 1. Select eligible row IDs with FOR UPDATE SKIP LOCKED
    // Eligible if:
    //   (lastCheckedAt IS NULL OR lastCheckedAt <= cutoffDate)
    //   AND (checkLockedUntil IS NULL OR checkLockedUntil <= now)
    //   AND (optional resourceId filter)
    const resourceFilterSql = options.resourceId
      ? `AND "resourceId" = '${options.resourceId.replace(/'/g, "''")}'`
      : '';

    const selectQuery = `
      SELECT "id"
      FROM "ResourceLink"
      WHERE (
        "lastCheckedAt" IS NULL
        OR "lastCheckedAt" <= '${cutoffDate.toISOString()}'
      )
      AND (
        "checkLockedUntil" IS NULL
        OR "checkLockedUntil" <= '${now.toISOString()}'
      )
      ${resourceFilterSql}
      ORDER BY "lastCheckedAt" ASC NULLS FIRST
      FOR UPDATE SKIP LOCKED
      LIMIT ${batchSize};
    `;

    const candidateRows: Array<{ id: string }> = await tx.$queryRawUnsafe(selectQuery);

    if (!candidateRows || candidateRows.length === 0) {
      return [];
    }

    const candidateIds = candidateRows.map((r) => r.id);

    // 2. Mark the selected rows as claimed with worker lock token
    await tx.resourceLink.updateMany({
      where: {
        id: { in: candidateIds },
      },
      data: {
        checkLockedUntil: lockExpiresAt,
        checkLockToken: lockToken,
        checkAttemptedAt: now,
      },
    });

    // 3. Return full claimed link records
    const records: ClaimedLink[] = await tx.resourceLink.findMany({
      where: {
        id: { in: candidateIds },
      },
      select: {
        id: true,
        url: true,
        linkType: true,
        status: true,
        lastCheckedAt: true,
        resourceId: true,
        checkLockedUntil: true,
        checkLockToken: true,
        checkAttemptedAt: true,
      },
    });

    return records;
  });

  return {
    claimedLinks,
    lockToken,
    lockExpiresAt,
    claimedCount: claimedLinks.length,
  };
}

/**
 * Releases a claim lock for a specific link or array of link IDs upon completion or failure.
 * Ensures only the worker holding the matching lockToken can release it.
 */
export async function releaseLinkClaim(
  prismaClient: any,
  linkIds: string | string[],
  lockToken: string
): Promise<{ releasedCount: number }> {
  const ids = Array.isArray(linkIds) ? linkIds : [linkIds];
  if (ids.length === 0) return { releasedCount: 0 };

  const result = await prismaClient.resourceLink.updateMany({
    where: {
      id: { in: ids },
      checkLockToken: lockToken,
    },
    data: {
      checkLockedUntil: null,
      checkLockToken: null,
    },
  });

  return { releasedCount: result.count };
}
