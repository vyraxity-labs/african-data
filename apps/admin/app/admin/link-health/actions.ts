'use server';

import { auth } from '@/auth';
import { prisma } from '@repo/database';
import { claimDueLinksAtomic, processClaimedBatch } from '@repo/link-checker';
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
