import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/database';
import {
  claimDueLinksAtomic,
  processClaimedBatch,
  resolveBatchConfig,
  validateCronSecret,
} from '@repo/link-checker';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // Requirement 12.1: strictly Node.js runtime

/**
 * Scheduled Link Health Check Endpoint
 *
 * Implements Step 13.5:
 * - Requires Authorization: Bearer <CRON_SECRET> or x-cron-secret header
 * - Claims batch using PostgreSQL FOR UPDATE SKIP LOCKED
 * - Checks links via HEAD-first bounded verification with SSRF protection
 * - Records LinkCheck entries and updates ResourceLink states
 * - Returns structured execution report
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecretHeader = req.headers.get('x-cron-secret');

  const authValidation = validateCronSecret(authHeader, cronSecretHeader);

  if (!authValidation.isAuthorized) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        message: authValidation.error || 'Invalid or missing CRON_SECRET credentials.',
      },
      { status: 401 }
    );
  }

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    const config = resolveBatchConfig({
      batchSize: body?.batchSize,
      timeoutMs: body?.timeoutMs,
      maxConcurrentPerHost: body?.maxConcurrentPerHost,
      globalMaxConcurrency: body?.globalMaxConcurrency,
      maxRedirects: body?.maxRedirects,
    });

    // 1. Claim batch of due links atomically
    const claimResult = await claimDueLinksAtomic(prisma, {
      batchSize: config.batchSize,
      resourceId: body?.resourceId,
    });

    if (claimResult.claimedCount === 0) {
      return NextResponse.json({
        message: 'No links currently due for checking.',
        claimedCount: 0,
        totalProcessed: 0,
      });
    }

    // 2. Process the claimed batch
    const summary = await processClaimedBatch(
      prisma,
      claimResult.claimedLinks,
      claimResult.lockToken,
      {
        config,
      }
    );

    return NextResponse.json({
      message: 'Batch link check completed successfully.',
      batchSize: config.batchSize,
      summary,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error?.message || 'Unexpected failure while processing scheduled link check batch.',
      },
      { status: 500 }
    );
  }
}

/**
 * Reject GET requests to prevent accidental pre-fetching or crawlers from triggering batches.
 */
export async function GET() {
  return NextResponse.json(
    {
      error: 'Method Not Allowed',
      message: 'Scheduled link checks must be invoked via POST with Authorization: Bearer <CRON_SECRET>.',
    },
    { status: 405 }
  );
}
