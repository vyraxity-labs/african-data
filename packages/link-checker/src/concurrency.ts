/**
 * Per-Host Concurrency Limiter and Rate Governor
 *
 * Implements Step 12.6 requirements:
 * 1. Per-Host Concurrency Limiting:
 *    - Defaults to `maxConcurrentPerHost = 1` (configurable).
 *    - Ensures multiple links targeting the same host (e.g. statssa.gov.za) are never hammered simultaneously.
 * 2. Cross-Host Concurrency:
 *    - Different hosts (e.g. statssa.gov.za, worldbank.org, africacdc.org) execute concurrently up to `globalMaxConcurrency`.
 * 3. Graceful FIFO Queueing per host.
 * 4. Error isolation: A failure on one link check does not block or cancel subsequent queue items for that host.
 */

export interface ConcurrencyLimiterOptions {
  /**
   * Maximum concurrent checks allowed for a single hostname/domain.
   * Default: 1
   */
  maxConcurrentPerHost?: number;
  /**
   * Maximum total concurrent checks executing across all hosts simultaneously.
   * Default: 10
   */
  globalMaxConcurrency?: number;
}

interface QueuedTask<T> {
  fn: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
}

export class PerHostConcurrencyLimiter {
  private readonly maxConcurrentPerHost: number;
  private readonly globalMaxConcurrency: number;

  // Active counts
  private activeGlobalCount = 0;
  private readonly activePerHost = new Map<string, number>();

  // Queues per host
  private readonly hostQueues = new Map<string, QueuedTask<any>[]>();

  constructor(options: ConcurrencyLimiterOptions = {}) {
    this.maxConcurrentPerHost = options.maxConcurrentPerHost ?? 1;
    this.globalMaxConcurrency = options.globalMaxConcurrency ?? 10;
  }

  /**
   * Extracts canonical normalized host key from a URL string or hostname.
   */
  public extractHostKey(urlOrHost: string): string {
    try {
      if (urlOrHost.includes('://')) {
        return new URL(urlOrHost).hostname.toLowerCase();
      }
      return urlOrHost.toLowerCase().trim();
    } catch {
      return urlOrHost.toLowerCase().trim();
    }
  }

  /**
   * Returns current active task count for a given host.
   */
  public getActiveCountForHost(urlOrHost: string): number {
    const host = this.extractHostKey(urlOrHost);
    return this.activePerHost.get(host) ?? 0;
  }

  /**
   * Returns current global active task count.
   */
  public getGlobalActiveCount(): number {
    return this.activeGlobalCount;
  }

  /**
   * Enqueues an asynchronous action bound to a host key, adhering to per-host and global concurrency caps.
   */
  public async schedule<T>(urlOrHost: string, task: () => Promise<T>): Promise<T> {
    const host = this.extractHostKey(urlOrHost);

    return new Promise<T>((resolve, reject) => {
      let queue = this.hostQueues.get(host);
      if (!queue) {
        queue = [];
        this.hostQueues.set(host, queue);
      }

      queue.push({
        fn: task,
        resolve,
        reject,
      });

      this.processNext(host);
    });
  }

  /**
   * Dispatches pending tasks for the given host if capacity is available.
   */
  private processNext(host: string): void {
    if (this.activeGlobalCount >= this.globalMaxConcurrency) {
      return;
    }

    const currentHostActive = this.activePerHost.get(host) ?? 0;
    if (currentHostActive >= this.maxConcurrentPerHost) {
      return;
    }

    const queue = this.hostQueues.get(host);
    if (!queue || queue.length === 0) {
      return;
    }

    const nextTask = queue.shift()!;
    this.activeGlobalCount++;
    this.activePerHost.set(host, currentHostActive + 1);

    (async () => {
      try {
        const result = await nextTask.fn();
        nextTask.resolve(result);
      } catch (err) {
        nextTask.reject(err);
      } finally {
        this.activeGlobalCount--;
        const remainingHostActive = (this.activePerHost.get(host) ?? 1) - 1;

        if (remainingHostActive <= 0) {
          this.activePerHost.delete(host);
        } else {
          this.activePerHost.set(host, remainingHostActive);
        }

        // Clean up empty queue
        if (queue.length === 0) {
          this.hostQueues.delete(host);
        }

        // Trigger next tasks for this host and any other waiting hosts
        this.processNext(host);
        this.processAllWaitingHosts();
      }
    })();
  }

  /**
   * Checks all waiting hosts to utilize freed global capacity.
   */
  private processAllWaitingHosts(): void {
    for (const waitingHost of this.hostQueues.keys()) {
      if (this.activeGlobalCount >= this.globalMaxConcurrency) {
        break;
      }
      this.processNext(waitingHost);
    }
  }
}
