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
async function handleLinkCheck(req: NextRequest, customConfig?: any) {
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
    const config = resolveBatchConfig({
      batchSize: customConfig?.batchSize,
      timeoutMs: customConfig?.timeoutMs,
      maxConcurrentPerHost: customConfig?.maxConcurrentPerHost,
      globalMaxConcurrency: customConfig?.globalMaxConcurrency,
      maxRedirects: customConfig?.maxRedirects,
    });

    // 1. Claim batch of due links atomically
    const claimResult = await claimDueLinksAtomic(prisma, {
      batchSize: config.batchSize,
      resourceId: customConfig?.resourceId,
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
 * Scheduled Link Health Check Endpoint (POST)
 * Used by external schedulers (e.g. GitHub Actions, QStash, Cloudflare Cron Triggers)
 * allowing custom batch configuration in the JSON body.
 */
export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional
  }
  return handleLinkCheck(req, body);
}

/**
 * Scheduled Link Health Check Endpoint (GET)
 * Used by native Vercel Cron Jobs, which issue GET requests with Authorization: Bearer <CRON_SECRET>.
 * Query params (e.g. ?batchSize=50) are supported optionally.
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const batchSizeParam = searchParams.get('batchSize');
  const timeoutMsParam = searchParams.get('timeoutMs');

  const configOverrides: any = {};
  if (batchSizeParam && !isNaN(Number(batchSizeParam))) {
    configOverrides.batchSize = Number(batchSizeParam);
  }
  if (timeoutMsParam && !isNaN(Number(timeoutMsParam))) {
    configOverrides.timeoutMs = Number(timeoutMsParam);
  }

  return handleLinkCheck(req, configOverrides);
}
