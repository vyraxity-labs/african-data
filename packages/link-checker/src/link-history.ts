import { PrismaClient, LinkHealthStatus } from '@repo/database';

export interface LinkHistoryOptions {
  limit?: number;
  offset?: number;
}

export interface LinkCheckHistoryEntry {
  id: string;
  checkedAt: Date;
  status: LinkHealthStatus;
  httpStatus: number | null;
  responseTimeMs: number | null;
  finalUrl: string | null;
  errorType: string | null;
  errorMessage: string | null;
}

export interface LinkAuditHistoryEntry {
  id: string;
  createdAt: Date;
  oldUrl: string;
  newUrl: string;
  reason: string | null;
  changedBy: string | null;
  statusBefore: LinkHealthStatus | null;
  statusAfter: LinkHealthStatus | null;
}

export interface LinkHistoryResult {
  link: {
    id: string;
    url: string;
    linkType: string;
    status: LinkHealthStatus;
    httpStatus: number | null;
    finalUrl: string | null;
    responseTimeMs: number | null;
    lastCheckedAt: Date | null;
    errorMessage: string | null;
    resource: {
      id: string;
      name: string;
    };
  };
  checks: LinkCheckHistoryEntry[];
  totalChecks: number;
  audits: LinkAuditHistoryEntry[];
  totalAudits: number;
}

/**
 * Retrieves the historical link checks and remediation audits for a given resource link.
 * Historical checks are strictly sorted newest first (`checkedAt: 'desc'`).
 *
 * Implements Phase 16 Link History:
 * - Date, Status, HTTP
 * - response time, final URL, error type, error message
 */
export async function getLinkHistory(
  prisma: PrismaClient,
  linkId: string,
  options: LinkHistoryOptions = {}
): Promise<LinkHistoryResult | null> {
  const { limit = 50, offset = 0 } = options;

  const link = await prisma.resourceLink.findUnique({
    where: { id: linkId },
    include: {
      resource: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!link) {
    return null;
  }

  const [checks, totalChecks, audits, totalAudits] = await Promise.all([
    prisma.linkCheck.findMany({
      where: { linkId },
      orderBy: { checkedAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        checkedAt: true,
        status: true,
        httpStatus: true,
        responseTimeMs: true,
        finalUrl: true,
        errorType: true,
        errorMessage: true,
      },
    }),
    prisma.linkCheck.count({ where: { linkId } }),
    prisma.linkAudit.findMany({
      where: { linkId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        createdAt: true,
        oldUrl: true,
        newUrl: true,
        reason: true,
        changedBy: true,
        statusBefore: true,
        statusAfter: true,
      },
    }),
    prisma.linkAudit.count({ where: { linkId } }),
  ]);

  return {
    link: {
      id: link.id,
      url: link.url,
      linkType: link.linkType,
      status: link.status,
      httpStatus: link.httpStatus,
      finalUrl: link.finalUrl,
      responseTimeMs: link.responseTimeMs,
      lastCheckedAt: link.lastCheckedAt,
      errorMessage: link.errorMessage,
      resource: link.resource,
    },
    checks,
    totalChecks,
    audits,
    totalAudits,
  };
}

/**
 * Format a Date for display in historical checks (e.g., "20 Sep" or "20 Sep 2026").
 */
export function formatHistoryDate(date: Date | string | number): { short: string; full: string; time: string } {
  const d = new Date(date);
  const day = d.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return {
    short: `${day} ${month}`,
    full: `${day} ${month} ${year}`,
    time: `${hours}:${minutes}:${seconds}`,
  };
}
