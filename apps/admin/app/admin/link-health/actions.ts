'use server';

import { auth } from '@/auth';
import { prisma } from '@repo/database';
import {
  claimDueLinksAtomic,
  processClaimedBatch,
  remediateLinkIndividual,
  remediateRedirectLink,
  parseReplacementCsv,
  previewBatchReplacement,
  applyBatchReplacement,
  BatchPreviewSummary,
  BatchApplyResult,
} from '@repo/link-checker';
import { revalidatePath } from 'next/cache';

export interface ManualCheckResult {
  success: boolean;
  claimedCount: number;
  checkedCount: number;
  healthyCount: number;
  brokenCount: number;
  serverErrorCount: number;
  message: string;
}

export interface RemediateActionResult {
  success: boolean;
  linkId?: string;
  oldUrl?: string;
  newUrl?: string;
  statusBefore?: string;
  statusAfter?: string;
  httpStatus?: number | null;
  responseTimeMs?: number;
  message?: string;
  error?: string;
}

/**
 * Trigger an immediate batch link health verification for administrative monitoring.
 */
export async function triggerManualBatchCheck(batchSize = 25): Promise<ManualCheckResult> {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  // Atomically claim due links using FOR UPDATE SKIP LOCKED
  const claimResult = await claimDueLinksAtomic(prisma, { batchSize });
  if (claimResult.claimedCount === 0) {
    return {
      success: true,
      claimedCount: 0,
      checkedCount: 0,
      healthyCount: 0,
      brokenCount: 0,
      serverErrorCount: 0,
      message: 'All endpoints are currently up to date. No links due for check.',
    };
  }

  // Process claimed batch with HEAD-first bounded checking & SSRF protections
  const batchReport = await processClaimedBatch(
    prisma,
    claimResult.claimedLinks,
    claimResult.lockToken
  );

  // Revalidate the dashboard cache
  revalidatePath('/admin/link-health');
  revalidatePath('/admin');

  return {
    success: true,
    claimedCount: claimResult.claimedCount,
    checkedCount: batchReport.totalProcessed,
    healthyCount: batchReport.healthy,
    brokenCount: batchReport.broken,
    serverErrorCount: batchReport.serverError,
    message: `Batch check finished: ${batchReport.totalProcessed} link(s) checked (${batchReport.healthy} healthy, ${batchReport.broken} broken).`,
  };
}

/**
 * Server Action: Remediate an individual link URL with normalization, SSRF/HEAD verification, and audit logging.
 */
export async function remediateLinkAction(formData: FormData): Promise<RemediateActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: 'Unauthorized: Administrator authentication required.' };
  }

  const linkId = formData.get('linkId') as string;
  const newUrl = formData.get('newUrl') as string;
  const reason = formData.get('reason') as string | undefined;

  if (!linkId || !newUrl) {
    return { success: false, error: 'Link ID and replacement URL are required.' };
  }

  try {
    const result = await remediateLinkIndividual(prisma, {
      linkId,
      newUrl,
      reason: reason || 'INDIVIDUAL_REMEDIATION',
      adminIdentifier: session.user.email || session.user.name || 'admin',
    });

    revalidatePath('/admin/link-health');
    revalidatePath('/admin/resources');
    revalidatePath('/admin');

    return {
      success: true,
      linkId: result.linkId,
      oldUrl: result.oldUrl,
      newUrl: result.newUrl,
      statusBefore: result.statusBefore,
      statusAfter: result.statusAfter,
      httpStatus: result.httpStatus,
      responseTimeMs: result.responseTimeMs,
      message: `Successfully remediated endpoint: Status is now ${result.statusAfter}${result.httpStatus ? ` (HTTP ${result.httpStatus})` : ''}.`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to remediate link.',
    };
  }
}

/**
 * Server Action: Adopt detected redirect destination (OLD → 301 → NEW).
 * Implements Step 15.2 pre-save validation rules.
 */
export async function applyRedirectDestinationAction(linkId: string): Promise<RemediateActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: 'Unauthorized: Administrator authentication required.' };
  }

  if (!linkId) {
    return { success: false, error: 'Link ID is required.' };
  }

  try {
    const result = await remediateRedirectLink(prisma, {
      linkId,
      adminIdentifier: session.user.email || session.user.name || 'admin',
    });

    revalidatePath('/admin/link-health');
    revalidatePath('/admin/resources');
    revalidatePath('/admin');

    return {
      success: true,
      linkId: result.linkId,
      oldUrl: result.oldUrl,
      newUrl: result.newUrl,
      statusBefore: result.statusBefore,
      statusAfter: result.statusAfter,
      httpStatus: result.httpStatus,
      responseTimeMs: result.responseTimeMs,
      message: `Successfully replaced redirect with verified destination: ${result.newUrl} (${result.statusAfter} HTTP ${result.httpStatus || 200}).`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to apply redirect destination.',
    };
  }
}

/**
 * Server Action: Validates and dry-runs a batch replacement CSV.
 */
export async function previewBatchReplacementAction(
  csvContent: string
): Promise<{ success: boolean; preview?: BatchPreviewSummary; error?: string }> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: 'Unauthorized: Administrator authentication required.' };
  }

  try {
    const rows = parseReplacementCsv(csvContent);
    const preview = await previewBatchReplacement(prisma, rows);
    return { success: true, preview };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to parse replacement CSV.' };
  }
}

/**
 * Server Action: Transactionally applies a verified batch replacement CSV.
 * Enforces all-or-nothing execution.
 */
export async function applyBatchReplacementAction(
  csvContent: string,
  reason?: string
): Promise<{ success: boolean; result?: BatchApplyResult; error?: string }> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: 'Unauthorized: Administrator authentication required.' };
  }

  try {
    const rows = parseReplacementCsv(csvContent);
    const result = await applyBatchReplacement(prisma, {
      rows,
      adminIdentifier: session.user.email || session.user.name || 'admin',
      reason: reason || 'BATCH_REPLACEMENT',
    });

    revalidatePath('/admin/link-health');
    revalidatePath('/admin/resources');
    revalidatePath('/admin');

    return { success: true, result };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to apply batch replacement.' };
  }
}
