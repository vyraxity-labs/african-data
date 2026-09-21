export class InvalidUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidUrlError';
  }
}

export interface UrlNormalizationResult {
  isValid: boolean;
  normalizedUrl: string | null;
  error?: string;
}

/**
 * Normalizes a URL to prevent accidental duplicates caused by trivial formatting differences:
 * - Trims leading/trailing and accidental whitespace
 * - Validates URL syntax and allowed protocols (http, https)
 * - Normalizes protocol casing to lowercase (e.g. HTTPS -> https)
 * - Normalizes hostname casing to lowercase (e.g. EXAMPLE.COM -> example.com)
 * - Removes default ports (80 for http, 443 for https)
 * - Normalizes obvious trailing slash differences where safe (e.g. https://example.com/ -> https://example.com)
 * - Preserves meaningful case-sensitive path components (e.g. /Data/Report vs /data/report)
 * - Preserves query parameters and their values
 */
export function normalizeUrl(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new InvalidUrlError('URL must be a non-empty string');
  }

  // 1. Trim outer whitespace
  const trimmed = input.trim();
  if (!trimmed) {
    throw new InvalidUrlError('URL must be a non-empty string');
  }

  // 2. Parse using WHATWG URL parser
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new InvalidUrlError(`Invalid URL syntax: "${input}"`);
  }

  // 3. Validate protocol (http and https supported)
  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new InvalidUrlError(
      `Unsupported URL protocol: "${parsed.protocol}". Only HTTP and HTTPS are permitted.`
    );
  }

  // 4. Hostname is automatically lowercased by WHATWG URL.
  // Ensure hostname is non-empty.
  if (!parsed.hostname) {
    throw new InvalidUrlError(`Missing hostname in URL: "${input}"`);
  }

  const hostname = parsed.hostname.toLowerCase();

  // 5. Port: omit default ports (80 for http, 443 for https)
  let port = parsed.port;
  if ((protocol === 'http:' && port === '80') || (protocol === 'https:' && port === '443')) {
    port = '';
  }
  const host = port ? `${hostname}:${port}` : hostname;

  // 6. Pathname normalization:
  // - Preserve exact casing of path segments!
  // - Clean redundant duplicate slashes (e.g. //data -> /data)
  let pathname = parsed.pathname.replace(/\/{2,}/g, '/');

  // Normalize trailing slash:
  // Root path "/" is normalized to empty string so https://example.com/ and https://example.com are identical.
  // Subpaths with trailing slash (e.g. /data/) are safely normalized to /data.
  if (pathname === '/') {
    pathname = '';
  } else if (pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }

  // 7. Search (query parameters) - preserve exactly as provided
  const search = parsed.search;

  // 8. Hash - preserve if present
  const hash = parsed.hash;

  return `${protocol}//${host}${pathname}${search}${hash}`;
}

/**
 * Attempts to normalize a URL, returning a safe result object instead of throwing.
 */
export function tryNormalizeUrl(input: string): UrlNormalizationResult {
  try {
    const normalizedUrl = normalizeUrl(input);
    return {
      isValid: true,
      normalizedUrl,
    };
  } catch (err) {
    return {
      isValid: false,
      normalizedUrl: null,
      error: err instanceof Error ? err.message : 'Unknown URL normalization error',
    };
  }
}

/**
 * Checks if a URL string is valid and can be normalized.
 */
export function isValidUrl(input: string): boolean {
  return tryNormalizeUrl(input).isValid;
}
