/**
 * Scheduled Endpoint Security & Authorization Verifier
 *
 * Implements Step 13.5 requirements:
 * 1. Validates incoming requests against server-side CRON_SECRET.
 * 2. Supported authorization mechanisms:
 *    - Authorization: Bearer <CRON_SECRET>
 *    - x-cron-secret: <CRON_SECRET>
 * 3. Constant-time timing-safe string comparison to prevent timing side-channel attacks.
 * 4. Rejects unauthorized, missing, or mismatched secrets with HTTP 401 Unauthorized.
 */

import { timingSafeEqual } from 'node:crypto';

export interface CronAuthValidationResult {
  isAuthorized: boolean;
  error?: string;
}

/**
 * Validates request authorization headers against the server-side CRON_SECRET.
 */
export function validateCronSecret(
  authHeader: string | null | undefined,
  cronSecretHeader: string | null | undefined,
  expectedSecret = process.env.CRON_SECRET
): CronAuthValidationResult {
  if (!expectedSecret || typeof expectedSecret !== 'string' || expectedSecret.trim() === '') {
    return {
      isAuthorized: false,
      error: 'CRON_SECRET is not configured on the server.',
    };
  }

  let candidateSecret: string | null = null;

  // Check Authorization: Bearer <token>
  if (authHeader && authHeader.startsWith('Bearer ')) {
    candidateSecret = authHeader.substring(7).trim();
  } else if (cronSecretHeader && typeof cronSecretHeader === 'string') {
    candidateSecret = cronSecretHeader.trim();
  }

  if (!candidateSecret) {
    return {
      isAuthorized: false,
      error: 'Missing authorization credentials. Provide Bearer token or x-cron-secret header.',
    };
  }

  // Constant-time comparison to prevent timing attacks
  const expectedBuf = Buffer.from(expectedSecret, 'utf-8');
  const candidateBuf = Buffer.from(candidateSecret, 'utf-8');

  if (expectedBuf.length !== candidateBuf.length) {
    return {
      isAuthorized: false,
      error: 'Invalid authorization secret.',
    };
  }

  const isMatch = timingSafeEqual(expectedBuf, candidateBuf);
  if (!isMatch) {
    return {
      isAuthorized: false,
      error: 'Invalid authorization secret.',
    };
  }

  return {
    isAuthorized: true,
  };
}
