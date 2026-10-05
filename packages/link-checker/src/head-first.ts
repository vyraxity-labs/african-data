/**
 * HEAD-First Link Verification Engine with Bounded GET Fallback
 *
 * Implements Step 12.5 requirements:
 * 1. HEAD-first checking:
 *    - First attempts a lightweight HTTP HEAD request without downloading dataset bodies.
 * 2. Automatic bounded GET fallback:
 *    - Triggered when the server responds with HTTP 403 (Forbidden), 405 (Method Not Allowed),
 *      501 (Not Implemented), or when HEAD times out or encounters network rejection suggesting
 *      HEAD is disallowed by the server/WAF.
 * 3. Bounded GET execution:
 *    - Never downloads entire files/large datasets.
 *    - Sends an HTTP Range request header (`Range: bytes=0-1024`) to request only the first 1 KB.
 *    - Aborts / destroys the incoming response stream after reading 1 KB to prevent bandwidth exhaustion.
 * 4. Tracks checking metadata:
 *    - response time in milliseconds
 *    - HTTP status code
 *    - resolved final URL
 *    - strategy used ('HEAD' vs 'HEAD_THEN_GET' vs 'GET_ONLY')
 *    - connected remote IP
 *    - response headers and content preview
 */

import { executeSecureRequestWithRedirects, SecureFollowRedirectResult } from './redirect-handler';
import { SecureRequestOptions } from './secure-client';

export interface HeadFirstCheckOptions extends SecureRequestOptions {
  maxRedirects?: number;
  /**
   * Maximum bytes to read during a GET fallback (default: 1024 bytes = 1 KB).
   */
  maxPreviewBytes?: number;
}

export type CheckStrategy = 'HEAD' | 'HEAD_THEN_GET' | 'GET_ONLY';

export interface HeadFirstCheckResult {
  url: string;
  finalUrl: string;
  statusCode: number;
  statusMessage: string;
  strategy: CheckStrategy;
  responseTimeMs: number;
  connectedIp: string;
  isRedirected: boolean;
  redirectCount: number;
  headers: Record<string, string | string[] | undefined>;
  bodyPreviewBytes: number;
  headAttempt?: {
    statusCode: number;
    error?: string;
  };
}

/**
 * HTTP Status codes returned by servers that reject or disallow HEAD requests,
 * warranting a bounded GET fallback attempt.
 */
const HEAD_FALLBACK_STATUS_CODES = new Set([
  400, // Bad Request (some servers choke on HEAD)
  403, // Forbidden (WAFs frequently block HEAD while allowing GET)
  405, // Method Not Allowed
  501, // Not Implemented
]);

/**
 * Determines whether a HEAD response or error should trigger a GET fallback attempt.
 */
export function shouldFallbackToGet(
  headResult?: { statusCode: number; error?: any }
): boolean {
  if (!headResult) return true;

  if (headResult.error) {
    const msg = String(headResult.error.message || '').toLowerCase();
    // Fallback if HEAD timed out or connection was reset by remote peer refusing HEAD
    if (msg.includes('timeout') || msg.includes('econnreset') || msg.includes('socket hang up')) {
      return true;
    }
    return false;
  }

  return HEAD_FALLBACK_STATUS_CODES.has(headResult.statusCode);
}

/**
 * Executes a HEAD-first link check with automatic bounded GET fallback.
 */
export async function executeHeadFirstCheck(
  targetUrl: string,
  options: HeadFirstCheckOptions = {}
): Promise<HeadFirstCheckResult> {
  const startTime = Date.now();
  const timeoutMs = options.timeoutMs || 8000;

  let headResponse: SecureFollowRedirectResult | undefined;
  let headError: any;

  // 1. First Attempt: HTTP HEAD
  try {
    headResponse = await executeSecureRequestWithRedirects(targetUrl, {
      ...options,
      method: 'HEAD',
      timeoutMs,
    });
  } catch (err: any) {
    headError = err;
  }

  const headStatusCode = headResponse ? headResponse.statusCode : 0;
  const needsFallback = shouldFallbackToGet({
    statusCode: headStatusCode,
    error: headError,
  });

  // If HEAD succeeded with a 2xx or 3xx or client error other than 403/405, return HEAD result directly
  if (!needsFallback && headResponse) {
    const elapsed = Date.now() - startTime;
    return {
      url: targetUrl,
      finalUrl: headResponse.finalUrl,
      statusCode: headResponse.statusCode,
      statusMessage: headResponse.statusMessage,
      strategy: 'HEAD',
      responseTimeMs: elapsed,
      connectedIp: headResponse.connectedIp,
      isRedirected: headResponse.isRedirected,
      redirectCount: headResponse.redirectCount,
      headers: headResponse.headers,
      bodyPreviewBytes: headResponse.bodyPreview ? headResponse.bodyPreview.length : 0,
      headAttempt: {
        statusCode: headResponse.statusCode,
      },
    };
  }

  // 2. Fallback Attempt: Bounded HTTP GET
  const getHeaders: Record<string, string> = {
    ...(options.headers || {}),
    // Request only the first 1 KB of dataset content
    'Range': 'bytes=0-1024',
  };

  try {
    const getResponse = await executeSecureRequestWithRedirects(targetUrl, {
      ...options,
      method: 'GET',
      headers: getHeaders,
      timeoutMs,
    });

    const elapsed = Date.now() - startTime;
    return {
      url: targetUrl,
      finalUrl: getResponse.finalUrl,
      statusCode: getResponse.statusCode,
      statusMessage: getResponse.statusMessage,
      strategy: 'HEAD_THEN_GET',
      responseTimeMs: elapsed,
      connectedIp: getResponse.connectedIp,
      isRedirected: getResponse.isRedirected,
      redirectCount: getResponse.redirectCount,
      headers: getResponse.headers,
      bodyPreviewBytes: getResponse.bodyPreview ? getResponse.bodyPreview.length : 0,
      headAttempt: {
        statusCode: headStatusCode,
        error: headError ? headError.message : undefined,
      },
    };
  } catch (getErr: any) {
    // If GET also threw an error, rethrow or return combined error info
    if (headError && !headResponse) {
      // If both HEAD and GET failed, throw the GET error (or head error if SSRF blocked)
      throw getErr;
    }
    throw getErr;
  }
}
