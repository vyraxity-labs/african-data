/**
 * Redirect Link Remediation Workflow
 *
 * Implements Step 15.2 specification:
 * If:
 *   OLD → 301 → NEW
 * Show:
 *   Detected destination:
 *   NEW
 *   [Use Destination]
 *
 * Before saving:
 *   1. Validate NEW.
 *   2. SSRF-check NEW.
 *   3. Check NEW.
 *   4. Save only if appropriate.
 *
 * Preserves OLD URL in LinkAudit history.
 */

import { normalizeUrl, InvalidUrlError } from '@repo/validation';
import { executeHeadFirstCheck, HeadFirstCheckResult } from './head-first';
import { classifyLinkStatus } from './classification';
import { SsrfBlockedError } from './ssrf';
import { LinkHealthStatus, LinkType, AuditAction } from '@repo/database';

export interface RedirectRemediationInput {
  linkId: string;
  adminIdentifier?: string;
  destinationOverride?: string;
  timeoutMs?: number;
  maxRedirects?: number;
  customResolver?: (hostname: string) => Promise<string[]>;
  /**
   * If true, allows saving even if destination is not 2xx HEALTHY (e.g., if manually confirmed).
   * By default false (requires appropriate accessible response).
   */
  allowNonHealthySave?: boolean;
}

export interface RedirectRemediationResult {
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
 * Replaces a redirecting link with its verified destination endpoint.
 * Strictly adheres to Step 15.2 pre-save validation rules.
 */
export async function remediateRedirectLink(
  prismaClient: any,
  input: RedirectRemediationInput
): Promise<RedirectRemediationResult> {
  const {
    linkId,
    adminIdentifier,
    destinationOverride,
    timeoutMs,
    maxRedirects,
    customResolver,
    allowNonHealthySave = false,
  } = input;

  // 1. Fetch current link
  const existingLink = await prismaClient.resourceLink.findUnique({
    where: { id: linkId },
    include: { resource: true },
  });

  if (!existingLink) {
    throw new Error(`ResourceLink not found: ${linkId}`);
  }

  const rawDestination = destinationOverride || existingLink.finalUrl;
  if (!rawDestination) {
    throw new Error(
      `Cannot perform redirect remediation: Link #${linkId} does not have a detected redirect destination.`
    );
  }

  // 2. Validate NEW: Normalize & check syntax
  let normalizedNew: string;
  try {
    normalizedNew = normalizeUrl(rawDestination);
  } catch (err: unknown) {
    if (err instanceof InvalidUrlError) {
      throw new Error(`Invalid redirect destination URL: ${err.message}`);
    }
    throw new Error(`Failed to normalize redirect destination URL: ${rawDestination}`);
  }

  // Ensure destination is not identical to current URL
  if (normalizedNew === existingLink.url) {
    throw new Error(`Redirect destination is identical to the current URL: ${normalizedNew}`);
  }

  // Validate duplicate collision on parent resource
  const duplicate = await prismaClient.resourceLink.findFirst({
    where: {
      resourceId: existingLink.resourceId,
      url: normalizedNew,
      id: { not: existingLink.id },
    },
  });

  if (duplicate) {
    throw new Error(`Another endpoint on this dataset already uses destination URL: ${normalizedNew}`);
  }

  // 3. SSRF-check NEW & 4. Check NEW (HEAD-first bounded check)
  const startTime = Date.now();
  let checkResult: HeadFirstCheckResult | undefined;
  let checkError: any = null;

  try {
    checkResult = await executeHeadFirstCheck(normalizedNew, {
      timeoutMs: timeoutMs ?? 10000,
      maxRedirects: maxRedirects ?? 5,
      customResolver,
    });
  } catch (err: any) {
    // SSRF-check NEW: If destination triggers SSRF, immediately block and abort saving
    if (
      err instanceof SsrfBlockedError ||
      err?.code === 'SSRF_BLOCKED' ||
      err?.name === 'SsrfBlockedError'
    ) {
      throw new Error(
        `SSRF violation detected: Destination "${normalizedNew}" resolves to a restricted/private network target.`
      );
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

  const finalDestinationUrl = checkResult?.finalUrl ?? (checkError?.target ? checkError.target : null);
  const httpStatus = checkResult?.statusCode ?? classification.httpStatus ?? null;
  const errorMessage = checkError
    ? checkError.message
    : classification.status === 'BROKEN'
    ? classification.reason
    : null;

  // 5. Save only if appropriate:
  // Reject save if the destination is broken, blocked, or timed out (unless explicitly overridden)
  if (!allowNonHealthySave) {
    if (
      classification.status === LinkHealthStatus.BROKEN ||
      classification.status === LinkHealthStatus.BLOCKED ||
      classification.status === LinkHealthStatus.TIMEOUT
    ) {
      throw new Error(
        `Cannot save redirect replacement: Target destination "${normalizedNew}" is not accessible (${classification.status}${
          httpStatus ? ` HTTP ${httpStatus}` : ''
        }${errorMessage ? ` - ${errorMessage}` : ''}).`
      );
    }
  }

  // Atomically save LinkAudit, LinkCheck, and updated ResourceLink
  const now = new Date();

  return await prismaClient.$transaction(async (tx: any) => {
    // Save audit record preserving OLD in history
    const audit = await tx.linkAudit.create({
      data: {
        linkId: existingLink.id,
        oldUrl: existingLink.url,
        newUrl: normalizedNew,
        reason: 'REDIRECT_REPLACEMENT',
        changedBy: adminIdentifier || 'admin',
        statusBefore: existingLink.status,
        statusAfter: classification.status as any,
        createdAt: now,
      },
    });

    // Record check history for the new destination
    const check = await tx.linkCheck.create({
      data: {
        linkId: existingLink.id,
        status: classification.status as any,
        httpStatus,
        finalUrl: finalDestinationUrl,
        responseTimeMs: elapsed,
        errorMessage,
        errorType: checkError ? checkError.name || 'Error' : null,
        checkedAt: now,
      },
    });

    // Update ResourceLink with normalized NEW destination
    const updated = await tx.resourceLink.update({
      where: { id: existingLink.id },
      data: {
        url: normalizedNew,
        status: classification.status as any,
        httpStatus,
        finalUrl: finalDestinationUrl,
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

    // Track REPLACE_LINK in general AuditLog
    await tx.auditLog.create({
      data: {
        actor: adminIdentifier || 'admin',
        action: AuditAction.REPLACE_LINK,
        entity: 'ResourceLink',
        entityId: existingLink.id,
        before: {
          url: existingLink.url,
          status: existingLink.status,
        },
        after: {
          url: normalizedNew,
          status: classification.status,
          reason: 'REDIRECT_DESTINATION_ADOPTED',
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
