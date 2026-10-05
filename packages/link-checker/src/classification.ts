/**
 * Link Health Status Classification Engine
 *
 * Implements Step 12.7 specifications:
 *
 * Semantic HTTP Status Mapping:
 * - 2xx (200-299)         -> HEALTHY
 * - 301, 302, 307, 308    -> REDIRECTED
 * - 404, 410              -> BROKEN (Permanently missing)
 * - 408 / timeout         -> TIMEOUT
 * - 429                   -> RATE_LIMITED
 * - 403                   -> BLOCKED (Access denied / WAF)
 * - 500-599               -> SERVER_ERROR (Do NOT classify as permanently broken)
 * - Unreachable / Unknown -> UNKNOWN
 */

export type LinkHealthStatus =
  | 'UNKNOWN'
  | 'HEALTHY'
  | 'REDIRECTED'
  | 'BROKEN'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'BLOCKED'
  | 'SERVER_ERROR';

export interface ClassificationInput {
  statusCode?: number | null;
  error?: Error | { message?: string; name?: string; code?: string } | null;
  isRedirected?: boolean;
}

export interface ClassificationResult {
  status: LinkHealthStatus;
  reason: string;
  isTemporary: boolean;
  httpStatus?: number | null;
}

/**
 * Classifies an HTTP response status code or error into a LinkHealthStatus.
 */
export function classifyLinkStatus(input: ClassificationInput): ClassificationResult {
  const { statusCode, error, isRedirected } = input;

  // 1. Check network / client error first if present
  if (error) {
    const errorMsg = String(error.message || '').toLowerCase();
    const errorCode = String((error as any).code || '').toUpperCase();

    if (
      errorMsg.includes('timeout') ||
      errorMsg.includes('timed out') ||
      errorMsg.includes('aborted') ||
      errorCode === 'ETIMEDOUT' ||
      errorCode === 'ESOCKETTIMEDOUT' ||
      errorCode === 'ECONNABORTED'
    ) {
      return {
        status: 'TIMEOUT',
        reason: error.message || 'Request timed out waiting for server response.',
        isTemporary: true,
        httpStatus: statusCode ?? 408,
      };
    }

    if (errorMsg.includes('ssrf') || errorMsg.includes('blocked destination') || (error as any).name === 'SsrfBlockedError') {
      return {
        status: 'BLOCKED',
        reason: error.message || 'Blocked by security policies.',
        isTemporary: false,
        httpStatus: statusCode ?? null,
      };
    }

    if (
      errorCode === 'ECONNRESET' ||
      errorCode === 'ECONNREFUSED' ||
      errorCode === 'EHOSTUNREACH' ||
      errorCode === 'ENOTFOUND'
    ) {
      return {
        status: 'BROKEN',
        reason: `Network connection failed (${errorCode}): ${error.message}`,
        isTemporary: false,
        httpStatus: statusCode ?? null,
      };
    }
  }

  // 2. Classify based on numeric HTTP status code
  if (typeof statusCode === 'number' && statusCode > 0) {
    // 2xx -> HEALTHY (Even if it followed a safe redirect to get there, final target is healthy)
    if (statusCode >= 200 && statusCode < 300) {
      return {
        status: isRedirected ? 'REDIRECTED' : 'HEALTHY',
        reason: isRedirected
          ? `Redirected successfully to live endpoint (HTTP ${statusCode}).`
          : `Endpoint responded with HTTP ${statusCode} (OK).`,
        isTemporary: false,
        httpStatus: statusCode,
      };
    }

    // 301, 302, 307, 308 -> REDIRECTED
    if ([301, 302, 303, 307, 308].includes(statusCode)) {
      return {
        status: 'REDIRECTED',
        reason: `Endpoint redirects with HTTP ${statusCode}.`,
        isTemporary: statusCode === 302 || statusCode === 307,
        httpStatus: statusCode,
      };
    }

    // 404, 410 -> BROKEN
    if (statusCode === 404 || statusCode === 410) {
      return {
        status: 'BROKEN',
        reason: statusCode === 404 ? 'Resource not found (HTTP 404).' : 'Resource permanently gone (HTTP 410).',
        isTemporary: false,
        httpStatus: statusCode,
      };
    }

    // 408 -> TIMEOUT
    if (statusCode === 408 || statusCode === 504) {
      return {
        status: 'TIMEOUT',
        reason: `Server or gateway timeout (HTTP ${statusCode}).`,
        isTemporary: true,
        httpStatus: statusCode,
      };
    }

    // 429 -> RATE_LIMITED
    if (statusCode === 429) {
      return {
        status: 'RATE_LIMITED',
        reason: 'Too many requests / rate limited by server (HTTP 429).',
        isTemporary: true,
        httpStatus: statusCode,
      };
    }

    // 403 -> BLOCKED
    if (statusCode === 401 || statusCode === 403) {
      return {
        status: 'BLOCKED',
        reason: `Access prohibited or blocked by WAF (HTTP ${statusCode}).`,
        isTemporary: false,
        httpStatus: statusCode,
      };
    }

    // 500-599 -> SERVER_ERROR
    // Crucial rule: Do not classify temporary 500/503 responses as permanently broken!
    if (statusCode >= 500 && statusCode <= 599) {
      return {
        status: 'SERVER_ERROR',
        reason: `Temporary upstream server error (HTTP ${statusCode}). Not marked as permanently broken.`,
        isTemporary: true,
        httpStatus: statusCode,
      };
    }

    // Other 4xx client errors (e.g. 400, 422)
    if (statusCode >= 400 && statusCode < 500) {
      return {
        status: 'BROKEN',
        reason: `Client request error (HTTP ${statusCode}).`,
        isTemporary: false,
        httpStatus: statusCode,
      };
    }
  }

  // 3. Fallback: UNKNOWN
  return {
    status: 'UNKNOWN',
    reason: error?.message || 'Unclassified link verification status.',
    isTemporary: true,
    httpStatus: statusCode ?? null,
  };
}
