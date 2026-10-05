/**
 * Safe Redirect Follower with Per-Hop SSRF & DNS Rebinding Security
 *
 * Implements Step 12.4 requirements:
 * 1. Follows HTTP redirects (301, 302, 303, 307, 308) up to a configurable maximum limit (default 5).
 * 2. Every redirect hop is independently validated against SSRF rules:
 *    Original URL -> Redirect target -> Parse -> Validate protocol (only http/https) ->
 *    Validate hostname -> Validate IP destinations -> Open socket with remote IP check -> Send request.
 * 3. Prevents infinite redirect loops and redirect bombs.
 * 4. Detects and tracks redirect hops, final destination URL, and intermediate locations.
 * 5. Rejects redirects pointing to localhost, private networks, cloud metadata, or unsafe schemes.
 */

import { executeSecureRequest, SecureRequestOptions, SecureResponse } from './secure-client';
import { assertAllowedProtocol, assertSafeHostname, SsrfBlockedError } from './ssrf';

export interface RedirectHop {
  fromUrl: string;
  toUrl: string;
  statusCode: number;
  connectedIp: string;
}

export interface SecureFollowRedirectOptions extends SecureRequestOptions {
  maxRedirects?: number;
}

export interface SecureFollowRedirectResult {
  finalUrl: string;
  initialUrl: string;
  statusCode: number;
  statusMessage: string;
  headers: Record<string, string | string[] | undefined>;
  connectedIp: string;
  redirectCount: number;
  hops: RedirectHop[];
  isRedirected: boolean;
  bodyPreview?: Buffer;
}

export class TooManyRedirectsError extends Error {
  public readonly code = 'TOO_MANY_REDIRECTS';
  public readonly redirectCount: number;

  constructor(count: number, max: number) {
    super(`Exceeded maximum allowed redirect hops (${count} > ${max}).`);
    this.name = 'TooManyRedirectsError';
    this.redirectCount = count;
  }
}

export class InvalidRedirectLocationError extends Error {
  public readonly code = 'INVALID_REDIRECT_LOCATION';

  constructor(message: string) {
    super(`Invalid redirect location: ${message}`);
    this.name = 'InvalidRedirectLocationError';
  }
}

const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);

/**
 * Resolves a redirect location header against the current URL.
 * Supports relative paths, absolute paths, and fully-qualified URLs.
 */
export function resolveRedirectUrl(currentUrl: string, locationHeader: string): string {
  if (!locationHeader || typeof locationHeader !== 'string') {
    throw new InvalidRedirectLocationError('Missing or empty Location header in HTTP redirect.');
  }

  const trimmed = locationHeader.trim();
  try {
    // URL constructor automatically resolves relative to base URL
    const resolved = new URL(trimmed, currentUrl);
    return resolved.href;
  } catch (err: any) {
    throw new InvalidRedirectLocationError(`Cannot parse Location "${locationHeader}": ${err.message}`);
  }
}

/**
 * Performs an HTTP/HTTPS request, securely following redirects up to maxRedirects (default 5).
 * Validates each hop through SSRF checks before establishing connections.
 */
export async function executeSecureRequestWithRedirects(
  initialUrl: string,
  options: SecureFollowRedirectOptions = {}
): Promise<SecureFollowRedirectResult> {
  const maxRedirects = typeof options.maxRedirects === 'number' ? options.maxRedirects : 5;
  const hops: RedirectHop[] = [];
  const visitedUrls = new Set<string>();

  let currentUrl = initialUrl;
  let currentMethod = options.method || 'HEAD';
  let redirectCount = 0;

  while (true) {
    // Detect redirect loops
    if (visitedUrls.has(currentUrl)) {
      throw new InvalidRedirectLocationError(`Redirect loop detected: "${currentUrl}" was already visited.`);
    }
    visitedUrls.add(currentUrl);

    // Validate current URL SSRF safety before connecting
    const parsedCurrent = new URL(currentUrl);
    assertAllowedProtocol(parsedCurrent);
    assertSafeHostname(parsedCurrent.hostname);

    const response: SecureResponse = await executeSecureRequest(currentUrl, {
      ...options,
      method: currentMethod,
    });

    const isRedirect = REDIRECT_STATUS_CODES.has(response.statusCode);
    const locationHeader = response.headers.location;

    if (!isRedirect || !locationHeader) {
      // Reached final non-redirect response
      return {
        finalUrl: currentUrl,
        initialUrl,
        statusCode: response.statusCode,
        statusMessage: response.statusMessage,
        headers: response.headers,
        connectedIp: response.connectedIp,
        redirectCount,
        hops,
        isRedirected: redirectCount > 0,
        bodyPreview: response.bodyPreview,
      };
    }

    // It is a redirect
    redirectCount++;
    if (redirectCount > maxRedirects) {
      throw new TooManyRedirectsError(redirectCount, maxRedirects);
    }

    const nextUrl = resolveRedirectUrl(currentUrl, locationHeader);

    // Per-hop SSRF validation on target
    const parsedNext = new URL(nextUrl);
    try {
      assertAllowedProtocol(parsedNext);
      assertSafeHostname(parsedNext.hostname);
    } catch (err: any) {
      throw new SsrfBlockedError(
        nextUrl,
        `Redirect from "${currentUrl}" targeted unsafe destination "${nextUrl}": ${err.message}`
      );
    }

    hops.push({
      fromUrl: currentUrl,
      toUrl: nextUrl,
      statusCode: response.statusCode,
      connectedIp: response.connectedIp,
    });

    // In HTTP semantics, 303 always changes method to GET
    if (response.statusCode === 303 && currentMethod !== 'HEAD') {
      currentMethod = 'GET';
    }

    currentUrl = nextUrl;
  }
}
