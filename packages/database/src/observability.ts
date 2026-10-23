import { prisma, LinkHealthStatus, AuditAction } from './index';

export interface ObservabilityMetrics {
  lastSuccessfulImport: {
    timestamp: Date | null;
    fileName: string | null;
    resourcesCreated: number;
    institutionsCreated: number;
    linksCreated: number;
    skippedDuplicates: number;
    actor: string | null;
  } | null;
  lastLinkCheckBatch: {
    timestamp: Date | null;
    totalChecks: number;
  } | null;
  linkHealthSummary: {
    totalLinks: number;
    checkedLinks: number;
    uncheckedLinks: number;
    healthy: number;
    redirected: number;
    broken: number;
    timeout: number;
    rateLimited: number;
    blocked: number;
    serverError: number;
    unknown: number;
  };
  importErrors: {
    recentImportErrors: Array<{
      id: string;
      timestamp: Date;
      actor: string;
      details: unknown;
    }>;
  };
}

export interface StructuredErrorLog {
  timestamp: string;
  level: 'ERROR' | 'WARN' | 'INFO';
  component: string;
  message: string;
  details?: Record<string, unknown> | null;
  stack?: string | null;
}

/**
 * Standard structured logger producing consistent JSON output for platform observability.
 */
export function logStructuredError(
  component: string,
  error: unknown,
  context?: Record<string, unknown>
): StructuredErrorLog {
  const isErr = error instanceof Error;
  const structured: StructuredErrorLog = {
    timestamp: new Date().toISOString(),
    level: 'ERROR',
    component,
    message: isErr ? error.message : String(error),
    stack: isErr ? error.stack : undefined,
    details: context || undefined,
  };

  // Structured stdout logging compatible with Datadog, CloudWatch, Vercel log drain
  console.error(JSON.stringify(structured));
  return structured;
}

/**
 * Collects complete real-time observability metrics per Phase 25 specifications.
 */
export async function getObservabilityMetrics(): Promise<ObservabilityMetrics> {
  // 1. Last successful CSV Import from AuditLog
  const lastImportAudit = await prisma.auditLog.findFirst({
    where: { action: AuditAction.CSV_IMPORT },
    orderBy: { timestamp: 'desc' },
  });

  let lastSuccessfulImport: ObservabilityMetrics['lastSuccessfulImport'] = null;
  if (lastImportAudit && lastImportAudit.after) {
    const data = lastImportAudit.after as Record<string, any>;
    lastSuccessfulImport = {
      timestamp: lastImportAudit.timestamp,
      fileName: data.fileName || null,
      resourcesCreated: data.resourcesCreated || 0,
      institutionsCreated: data.institutionsCreated || 0,
      linksCreated: data.linksCreated || 0,
      skippedDuplicates: data.skippedDuplicates || 0,
      actor: lastImportAudit.actor,
    };
  }

  // 2. Last Link Check Batch
  const latestCheck = await prisma.linkCheck.findFirst({
    orderBy: { checkedAt: 'desc' },
    select: { checkedAt: true },
  });

  const lastLinkCheckBatch: ObservabilityMetrics['lastLinkCheckBatch'] = {
    timestamp: latestCheck?.checkedAt || null,
    totalChecks: await prisma.linkCheck.count(),
  };

  // 3. Link Health Status Breakdown
  const [
    totalLinks,
    healthy,
    redirected,
    broken,
    timeout,
    rateLimited,
    blocked,
    serverError,
    unknown,
  ] = await Promise.all([
    prisma.resourceLink.count(),
    prisma.resourceLink.count({ where: { status: LinkHealthStatus.HEALTHY } }),
    prisma.resourceLink.count({ where: { status: LinkHealthStatus.REDIRECTED } }),
    prisma.resourceLink.count({ where: { status: LinkHealthStatus.BROKEN } }),
    prisma.resourceLink.count({ where: { status: LinkHealthStatus.TIMEOUT } }),
    prisma.resourceLink.count({ where: { status: LinkHealthStatus.RATE_LIMITED } }),
    prisma.resourceLink.count({ where: { status: LinkHealthStatus.BLOCKED } }),
    prisma.resourceLink.count({ where: { status: LinkHealthStatus.SERVER_ERROR } }),
    prisma.resourceLink.count({ where: { status: LinkHealthStatus.UNKNOWN } }),
  ]);

  const checkedLinks = totalLinks - unknown;

  // 4. Import Errors tracking
  const errorAudits = await prisma.auditLog.findMany({
    where: {
      action: AuditAction.CSV_IMPORT,
      after: {
        path: ['errorCount'],
        gt: 0,
      },
    },
    orderBy: { timestamp: 'desc' },
    take: 10,
    select: {
      id: true,
      timestamp: true,
      actor: true,
      after: true,
    },
  });

  return {
    lastSuccessfulImport,
    lastLinkCheckBatch,
    linkHealthSummary: {
      totalLinks,
      checkedLinks,
      uncheckedLinks: unknown,
      healthy,
      redirected,
      broken,
      timeout,
      rateLimited,
      blocked,
      serverError,
      unknown,
    },
    importErrors: {
      recentImportErrors: errorAudits.map((a) => ({
        id: a.id,
        timestamp: a.timestamp,
        actor: a.actor,
        details: a.after,
      })),
    },
  };
}
