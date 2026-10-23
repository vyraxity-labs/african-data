/**
 * Individual Link Remediation Workflow
 *
 * Implements Step 15.1 specification:
 * Workflow:
 *   Broken URL
 *    ↓
 *   Replace
 *    ↓
 *   Enter new URL
 *    ↓
 *   Normalize (canonicalizing scheme, host, ports, trimming, etc.)
 *    ↓
 *   Validate (syntax, protocol, duplicate collision check)
 *    ↓
 *   Check (HEAD-first bounded verification with SSRF & anti-rebinding defenses)
 *    ↓
 *   Save (Transaction: LinkAudit + LinkCheck + ResourceLink)
 *
 * Rules:
 *   - The old URL must NOT disappear from history.
 *   - Create an audit record (LinkAudit).
 */

import { normalizeUrl, InvalidUrlError } from '@repo/validation';
import { executeHeadFirstCheck, HeadFirstCheckResult } from './head-first';
import { classifyLinkStatus } from './classification';
import { SsrfBlockedError } from './ssrf';
import { LinkHealthStatus, LinkType, AuditAction } from '@repo/database';

export interface IndividualRemediationInput {
  linkId: string;
  newUrl: string;
  linkType?: LinkType;
  reason?: string;
  adminIdentifier?: string;
  /**
   * Concurrency/timeout settings.
   */
  timeoutMs?: number;
  maxRedirects?: number;
  /**
   * Optional custom resolver injection for testing/anti-rebinding simulation.
   */
  customResolver?: (hostname: string) => Promise<string[]>;
}

export interface IndividualRemediationResult {
  success: boolean;
  linkId: string;
  oldUrl: string;
  newUrl: string;
  statusBefore: LinkHealthStatus;
  statusAfter: LinkHealthStatus;
  httpStatus: number | null;
  finalUrl: string | null;
  responseTimeMs: number;
  errorMessage: string | null;
  auditId: string;
  checkId: string;
  checkResult?: HeadFirstCheckResult;
}

/**
 * Executes individual link URL remediation following the strict Step 15.1 workflow.
 */
export async function remediateLinkIndividual(
  prismaClient: any,
  input: IndividualRemediationInput
): Promise<IndividualRemediationResult> {
  const {
    linkId,
    newUrl: rawNewUrl,
    linkType,
    reason,
    adminIdentifier,
    timeoutMs,
    maxRedirects,
    customResolver,
  } = input;

  // 1. Fetch current link to verify existence and capture baseline state
  const existingLink = await prismaClient.resourceLink.findUnique({
    where: { id: linkId },
    include: { resource: true },
  });

  if (!existingLink) {
    throw new Error(`ResourceLink not found: ${linkId}`);
  }

  // 2. Normalize: canonicalize protocol, hostname, whitespace, ports, and trailing slashes
  let normalizedNewUrl: string;
  try {
    normalizedNewUrl = normalizeUrl(rawNewUrl);
  } catch (err: unknown) {
    if (err instanceof InvalidUrlError) {
      throw new Error(`Invalid URL normalization: ${err.message}`);
    }
    throw new Error(`Failed to normalize URL: ${rawNewUrl}`);
  }

  // 3. Validate: check duplicate within the same parent resource
  const duplicate = await prismaClient.resourceLink.findFirst({
    where: {
      resourceId: existingLink.resourceId,
      url: normalizedNewUrl,
      id: { not: existingLink.id },
    },
  });

  if (duplicate) {
    throw new Error(`Another endpoint on this dataset already uses URL: ${normalizedNewUrl}`);
  }

  // 4. Check: run HEAD-first check with SSRF, DNS rebinding, and timeout protections
  const startTime = Date.now();
  let checkResult: HeadFirstCheckResult | undefined;
  let checkError: any = null;

  try {
    checkResult = await executeHeadFirstCheck(normalizedNewUrl, {
      timeoutMs: timeoutMs ?? 10000,
      maxRedirects: maxRedirects ?? 5,
      customResolver,
    });
  } catch (err: any) {
    if (err instanceof SsrfBlockedError || err?.code === 'SSRF_BLOCKED' || err?.name === 'SsrfBlockedError') {
      throw err;
    }
    checkError = err;
  }

  const elapsed = Date.now() - startTime;

  // Classify resulting status
  const classification = classifyLinkStatus({
    statusCode: checkResult?.statusCode ?? null,
    error: checkError,
    isRedirected: checkResult?.isRedirected ?? false,
  });

  const finalUrl = checkResult?.finalUrl ?? (checkError?.target ? checkError.target : null);
  const httpStatus = checkResult?.statusCode ?? classification.httpStatus ?? null;
  const errorMessage = checkError
    ? checkError.message
    : classification.status === 'BROKEN'
    ? classification.reason
    : null;

  // 5. Save & Audit atomically inside a database transaction
  const now = new Date();

  return await prismaClient.$transaction(async (tx: any) => {
    // 5a. Create audit record preserving historical oldUrl
    const audit = await tx.linkAudit.create({
      data: {
        linkId: existingLink.id,
        oldUrl: existingLink.url,
        newUrl: normalizedNewUrl,
        reason: reason || 'INDIVIDUAL_REPLACEMENT',
        changedBy: adminIdentifier || 'admin',
        statusBefore: existingLink.status,
        statusAfter: classification.status as any,
        createdAt: now,
      },
    });

    // 5b. Create LinkCheck record for verification history
    const check = await tx.linkCheck.create({
      data: {
        linkId: existingLink.id,
        status: classification.status as any,
        httpStatus,
        finalUrl,
        responseTimeMs: elapsed,
        errorMessage,
        errorType: checkError ? checkError.name || 'Error' : null,
        checkedAt: now,
      },
    });

    // 5c. Update ResourceLink with new URL and checked health state
    const updated = await tx.resourceLink.update({
      where: { id: existingLink.id },
      data: {
        url: normalizedNewUrl,
        linkType: linkType || existingLink.linkType,
        status: classification.status as any,
        httpStatus,
        finalUrl,
        responseTimeMs: elapsed,
        errorMessage,
        lastCheckedAt: now,
        lastSuccessfulCheckAt:
          classification.status === LinkHealthStatus.HEALTHY
            ? now
            : existingLink.lastSuccessfulCheckAt,
        checkLockedUntil: null,
        checkLockToken: null,
        updatedAt: now,
      },
    });

    // 5d. Track REPLACE_LINK in general AuditLog
    await tx.auditLog.create({
      data: {
        actor: adminIdentifier || 'admin',
        action: AuditAction.REPLACE_LINK,
        entity: 'ResourceLink',
        entityId: existingLink.id,
        before: {
          url: existingLink.url,
          status: existingLink.status,
          linkType: existingLink.linkType,
        },
        after: {
          url: normalizedNewUrl,
          status: classification.status,
          linkType: linkType || existingLink.linkType,
          reason: reason || 'INDIVIDUAL_REPLACEMENT',
        },
      },
    });

    return {
      success: true,
      linkId: updated.id,
      oldUrl: existingLink.url,
      newUrl: updated.url,
      statusBefore: existingLink.status,
      statusAfter: updated.status,
      httpStatus: updated.httpStatus,
      finalUrl: updated.finalUrl,
      responseTimeMs: updated.responseTimeMs,
      errorMessage: updated.errorMessage,
      auditId: audit.id,
      checkId: check.id,
      checkResult,
    };
  });
}
