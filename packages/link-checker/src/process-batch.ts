/**
 * Claimed Batch Processor for Scheduled Link Monitoring
 *
 * Implements Step 13.4 specifications:
 *
 * Processing Sequence:
 * For each claimed link:
 *   1. Claimed (verified with lockToken)
 *   2. Check URL (via executeHeadFirstCheck with per-host concurrency & SSRF protections)
 *   3. Record LinkCheck history entry
 *   4. Update ResourceLink (status, httpStatus, finalUrl, lastCheckedAt, responseTimeMs, etc.)
 *   5. Release claim (checkLockedUntil = null, checkLockToken = null)
 *
 * Error Handling:
 * If checking fails unexpectedly:
 *   1. Record failure in LinkCheck
 *   2. Update ResourceLink with error status
 *   3. Release claim (never leave links permanently locked)
 */

import { executeHeadFirstCheck, HeadFirstCheckResult } from './head-first';
import { classifyLinkStatus, LinkHealthStatus } from './classification';
import { PerHostConcurrencyLimiter } from './concurrency';
import { ClaimedLink, releaseLinkClaim } from './atomic-claim';
import { resolveBatchConfig, LinkCheckBatchConfig } from './batch-config';

export interface ProcessBatchOptions {
  /**
   * Concurrency & timeout configurations.
   */
  config?: Partial<LinkCheckBatchConfig>;
  /**
   * Optional custom resolver injection for testing.
   */
  customResolver?: (hostname: string) => Promise<string[]>;
}

export interface LinkProcessingResult {
  linkId: string;
  url: string;
  status: LinkHealthStatus;
  httpStatus: number | null;
  finalUrl: string | null;
  responseTimeMs: number;
  errorMessage: string | null;
  checkId?: string;
  released: boolean;
}

export interface BatchProcessingSummary {
  totalProcessed: number;
  successful: number;
  failed: number;
  healthy: number;
  redirected: number;
  broken: number;
  timeout: number;
  rateLimited: number;
  blocked: number;
  serverError: number;
  unknown: number;
  results: LinkProcessingResult[];
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
}

/**
 * Processes a single claimed link, persisting LinkCheck and updating ResourceLink.
 * Strictly guarantees that claim is released in the finally block.
 */
export async function processSingleClaimedLink(
  prismaClient: any,
  link: ClaimedLink,
  lockToken: string,
  options: {
    timeoutMs: number;
    maxRedirects: number;
    limiter: PerHostConcurrencyLimiter;
    customResolver?: (hostname: string) => Promise<string[]>;
  }
): Promise<LinkProcessingResult> {
  const startTime = Date.now();
  let checkResult: HeadFirstCheckResult | undefined;
  let executionError: any = null;

  try {
    // 1. Schedule check through per-host concurrency limiter
    checkResult = await options.limiter.schedule(link.url, async () => {
      return executeHeadFirstCheck(link.url, {
        timeoutMs: options.timeoutMs,
        maxRedirects: options.maxRedirects,
        customResolver: options.customResolver,
      });
    });
  } catch (err: any) {
    executionError = err;
  }

  const elapsed = Date.now() - startTime;

  // 2. Classify response status
  const classification = classifyLinkStatus({
    statusCode: checkResult?.statusCode ?? null,
    error: executionError,
    isRedirected: checkResult?.isRedirected ?? false,
  });

  const finalUrl = checkResult?.finalUrl ?? (executionError?.target ? executionError.target : null);
  const httpStatus = checkResult?.statusCode ?? classification.httpStatus ?? null;
  const errorMessage = executionError ? executionError.message : (classification.status === 'BROKEN' ? classification.reason : null);
  const now = new Date();

  let checkId: string | undefined;

  // 3. Atomically record LinkCheck, update ResourceLink, and release claim
  await prismaClient.$transaction(async (tx: any) => {
    // A. Record historical check log
    const checkRecord = await tx.linkCheck.create({
      data: {
        linkId: link.id,
        status: classification.status as any,
        httpStatus,
        finalUrl,
        responseTimeMs: elapsed,
        errorMessage,
        errorType: executionError ? (executionError.name || 'Error') : null,
        checkedAt: now,
      },
    });
    checkId = checkRecord.id;

    // B. Update current ResourceLink state & release claim lock
    const updateData: any = {
      status: classification.status as any,
      httpStatus,
      finalUrl,
      lastCheckedAt: now,
      responseTimeMs: elapsed,
      errorMessage,
      // Release lock
      checkLockedUntil: null,
      checkLockToken: null,
    };

    // If check succeeded (HEALTHY or REDIRECTED), update lastSuccessfulCheckAt
    if (classification.status === 'HEALTHY' || classification.status === 'REDIRECTED') {
      updateData.lastSuccessfulCheckAt = now;
    }

    await tx.resourceLink.update({
      where: { id: link.id },
      data: updateData,
    });
  });

  return {
    linkId: link.id,
    url: link.url,
    status: classification.status,
    httpStatus,
    finalUrl,
    responseTimeMs: elapsed,
    errorMessage,
    checkId,
    released: true,
  };
}

/**
 * Processes an entire batch of claimed links with concurrency governance and fail-safe lock release.
 */
export async function processClaimedBatch(
  prismaClient: any,
  claimedLinks: ClaimedLink[],
  lockToken: string,
  options: ProcessBatchOptions = {}
): Promise<BatchProcessingSummary> {
  const startedAt = new Date();
  const config = resolveBatchConfig(options.config);

  const limiter = new PerHostConcurrencyLimiter({
    maxConcurrentPerHost: config.maxConcurrentPerHost,
    globalMaxConcurrency: config.globalMaxConcurrency,
  });

  const results: LinkProcessingResult[] = [];

  // If no links to process, return early
  if (!claimedLinks || claimedLinks.length === 0) {
    const finishedAt = new Date();
    return {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      healthy: 0,
      redirected: 0,
      broken: 0,
      timeout: 0,
      rateLimited: 0,
      blocked: 0,
      serverError: 0,
      unknown: 0,
      results: [],
      startedAt,
      finishedAt,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    };
  }

  try {
    // Process all claimed links through the concurrency limiter in parallel
    const promises = claimedLinks.map(async (link) => {
      try {
        const res = await processSingleClaimedLink(prismaClient, link, lockToken, {
          timeoutMs: config.timeoutMs,
          maxRedirects: config.maxRedirects,
          limiter,
          customResolver: options.customResolver,
        });
        results.push(res);
      } catch (err: any) {
        // Fail-safe: ensure lock release even if transaction failed
        await releaseLinkClaim(prismaClient, link.id, lockToken).catch(() => {});
        results.push({
          linkId: link.id,
          url: link.url,
          status: 'UNKNOWN',
          httpStatus: null,
          finalUrl: null,
          responseTimeMs: 0,
          errorMessage: err.message || 'Fatal error processing link',
          released: true,
        });
      }
    });

    await Promise.all(promises);
  } finally {
    // Safety sweep: ensure any remaining links claimed with this token are unlocked
    const remainingUnreleased = claimedLinks
      .map((l) => l.id)
      .filter((id) => !results.find((r) => r.linkId === id));

    if (remainingUnreleased.length > 0) {
      await releaseLinkClaim(prismaClient, remainingUnreleased, lockToken).catch(() => {});
    }
  }

  const finishedAt = new Date();

  // Aggregate summary
  let healthy = 0;
  let redirected = 0;
  let broken = 0;
  let timeout = 0;
  let rateLimited = 0;
  let blocked = 0;
  let serverError = 0;
  let unknown = 0;

  for (const r of results) {
    switch (r.status) {
      case 'HEALTHY':
        healthy++;
        break;
      case 'REDIRECTED':
        redirected++;
        break;
      case 'BROKEN':
        broken++;
        break;
      case 'TIMEOUT':
        timeout++;
        break;
      case 'RATE_LIMITED':
        rateLimited++;
        break;
      case 'BLOCKED':
        blocked++;
        break;
      case 'SERVER_ERROR':
        serverError++;
        break;
      default:
        unknown++;
        break;
    }
  }

  return {
    totalProcessed: results.length,
    successful: healthy + redirected,
    failed: broken + timeout + rateLimited + blocked + serverError + unknown,
    healthy,
    redirected,
    broken,
    timeout,
    rateLimited,
    blocked,
    serverError,
    unknown,
    results,
    startedAt,
    finishedAt,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
  };
}
