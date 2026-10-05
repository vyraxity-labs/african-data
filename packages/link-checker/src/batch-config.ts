/**
 * Batch Configuration & Options for Scheduled Link Monitoring
 *
 * Implements Step 13.1 specifications:
 * - Avoids serverless/cron execution timeouts by strictly bounding execution to a finite batch size.
 * - Never loads every link into memory.
 * - Default batch size: 25 links (configurable up to 50 links per invocation).
 * - Reads LINK_CHECK_BATCH_SIZE from environment variables with bounds checking.
 */

export interface LinkCheckBatchConfig {
  /**
   * Maximum links to process per invocation.
   * Default: 25 (clamped between 1 and 100).
   */
  batchSize: number;
  /**
   * Request timeout per link in milliseconds.
   * Default: 8000 (8 seconds).
   */
  timeoutMs: number;
  /**
   * Maximum concurrent checks allowed per host within the batch.
   * Default: 1.
   */
  maxConcurrentPerHost: number;
  /**
   * Maximum global concurrent checks running simultaneously.
   * Default: 5.
   */
  globalMaxConcurrency: number;
  /**
   * Maximum redirect hops to follow per link.
   * Default: 5.
   */
  maxRedirects: number;
}

export const DEFAULT_BATCH_CONFIG: LinkCheckBatchConfig = {
  batchSize: 25,
  timeoutMs: 8000,
  maxConcurrentPerHost: 1,
  globalMaxConcurrency: 5,
  maxRedirects: 5,
};

/**
 * Resolves batch configuration from environment variables and optional overrides.
 * Guarantees batchSize is strictly positive and bounded (1 to 100) to protect execution runtimes.
 */
export function resolveBatchConfig(
  overrides?: Partial<LinkCheckBatchConfig>
): LinkCheckBatchConfig {
  const envBatchSize = process.env.LINK_CHECK_BATCH_SIZE
    ? parseInt(process.env.LINK_CHECK_BATCH_SIZE, 10)
    : undefined;

  let batchSize = overrides?.batchSize ?? envBatchSize ?? DEFAULT_BATCH_CONFIG.batchSize;
  if (!Number.isFinite(batchSize) || batchSize <= 0) {
    batchSize = DEFAULT_BATCH_CONFIG.batchSize;
  }
  // Clamp to safe bounds [1, 100]
  batchSize = Math.max(1, Math.min(100, Math.floor(batchSize)));

  let timeoutMs = overrides?.timeoutMs ?? DEFAULT_BATCH_CONFIG.timeoutMs;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000) {
    timeoutMs = DEFAULT_BATCH_CONFIG.timeoutMs;
  }

  let maxConcurrentPerHost =
    overrides?.maxConcurrentPerHost ?? DEFAULT_BATCH_CONFIG.maxConcurrentPerHost;
  if (!Number.isFinite(maxConcurrentPerHost) || maxConcurrentPerHost <= 0) {
    maxConcurrentPerHost = 1;
  }

  let globalMaxConcurrency =
    overrides?.globalMaxConcurrency ?? DEFAULT_BATCH_CONFIG.globalMaxConcurrency;
  if (!Number.isFinite(globalMaxConcurrency) || globalMaxConcurrency <= 0) {
    globalMaxConcurrency = 5;
  }

  let maxRedirects = overrides?.maxRedirects ?? DEFAULT_BATCH_CONFIG.maxRedirects;
  if (!Number.isFinite(maxRedirects) || maxRedirects < 0) {
    maxRedirects = 5;
  }

  return {
    batchSize,
    timeoutMs,
    maxConcurrentPerHost,
    globalMaxConcurrency,
    maxRedirects,
  };
}
