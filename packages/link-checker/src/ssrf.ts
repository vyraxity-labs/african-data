/**
 * SSRF (Server-Side Request Forgery) IP and Protocol Validation
 *
 * Implements Step 12.2 requirements:
 * Reject destinations resolving to private/internal/link-local/multicast IP ranges:
 * - 127.0.0.0/8 (IPv4 Loopback)
 * - 10.0.0.0/8 (IPv4 Private Class A)
 * - 172.16.0.0/12 (IPv4 Private Class B)
 * - 192.168.0.0/16 (IPv4 Private Class C)
 * - 169.254.0.0/16 (IPv4 Link-local / Cloud Metadata)
 * - 0.0.0.0/8 ("This network" / Broadcast / Localhost equivalent in some OS)
 * - 100.64.0.0/10 (Carrier-Grade NAT)
 * - 198.18.0.0/15 (Benchmark testing)
 * - 224.0.0.0/4 (IPv4 Multicast)
 * - 240.0.0.0/4 (IPv4 Reserved)
 * - 255.255.255.255/32 (IPv4 Limited Broadcast)
 * - ::1/128 (IPv6 Loopback)
 * - ::/128 (IPv6 Unspecified)
 * - fc00::/7 (IPv6 Unique Local / Private ULA)
 * - fe80::/10 (IPv6 Link-Local)
 * - ff00::/8 (IPv6 Multicast)
 * - ::ffff:0:0/96 (IPv4-mapped IPv6 addresses, inspected against IPv4 private rules)
 * - 64:ff9b::/96 (IPv4/IPv6 translation)
 * - 2001:db8::/32 (Documentation)
 * - Known cloud metadata endpoints (e.g., 169.254.169.254, metadata.google.internal, instance-data)
 *
 * Only http: and https: protocols are permitted.
 */

import * as net from 'node:net';

export class SsrfBlockedError extends Error {
  public readonly code = 'SSRF_BLOCKED';
  public readonly target: string;
  public readonly reason: string;

  constructor(target: string, reason: string) {
    super(`SSRF protection rejected destination "${target}": ${reason}`);
    this.name = 'SsrfBlockedError';
    this.target = target;
    this.reason = reason;
  }
}

/**
 * Checks if a numeric protocol string is http or https.
 */
export function isAllowedProtocol(protocol: string): boolean {
  const normalized = protocol.toLowerCase().replace(/:$/, '');
  return normalized === 'http' || normalized === 'https';
}

/**
 * Validates the protocol of a given URL.
 * Throws SsrfBlockedError if disallowed (e.g. file:, ftp:, gopher:, data:, dict:, etc.).
 */
export function assertAllowedProtocol(url: string | URL): void {
  const parsed = typeof url === 'string' ? new URL(url) : url;
  if (!isAllowedProtocol(parsed.protocol)) {
    throw new SsrfBlockedError(
      parsed.href,
      `Protocol "${parsed.protocol}" is forbidden. Only HTTP and HTTPS are permitted.`
    );
  }
}

/**
 * Converts an IPv4 string (dotted quad) into a 32-bit unsigned integer.
 */
function ipv4ToLong(ip: string): number {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    throw new Error(`Invalid IPv4 address format: ${ip}`);
  }
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}

/**
 * Checks if an IPv4 address falls within a given CIDR subnet.
 */
function isIpv4InCidr(ipNum: number, subnet: string): boolean {
  const [range, bitsStr] = subnet.split('/');
  const bits = bitsStr ? parseInt(bitsStr, 10) : 32;
  const rangeNum = ipv4ToLong(range!);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipNum & mask) === (rangeNum & mask);
}

/**
 * List of forbidden IPv4 CIDR blocks according to RFC 6890 and Step 12.2.
 */
const FORBIDDEN_IPV4_CIDRS = [
  '0.0.0.0/8', // Current network (often routes to 127.0.0.1 on Linux/macOS)
  '10.0.0.0/8', // Private Class A
  '100.64.0.0/10', // Shared Address Space (Carrier-grade NAT)
  '127.0.0.0/8', // Loopback
  '169.254.0.0/16', // Link Local / Cloud Metadata (169.254.169.254)
  '172.16.0.0/12', // Private Class B
  '192.0.0.0/24', // IETF Protocol Assignments
  '192.0.2.0/24', // TEST-NET-1 (Documentation)
  '192.88.99.0/24', // 6to4 Relay Anycast
  '192.168.0.0/16', // Private Class C
  '198.18.0.0/15', // Benchmarking
  '198.51.100.0/24', // TEST-NET-2 (Documentation)
  '203.0.113.0/24', // TEST-NET-3 (Documentation)
  '224.0.0.0/4', // Multicast
  '240.0.0.0/4', // Reserved / Future use
  '255.255.255.255/32', // Limited Broadcast
];

/**
 * Checks if an IPv4 address is private, loopback, link-local, or otherwise reserved.
 */
export function isPrivateIpv4(ip: string): boolean {
  const ipNum = ipv4ToLong(ip);
  for (const cidr of FORBIDDEN_IPV4_CIDRS) {
    if (isIpv4InCidr(ipNum, cidr)) {
      return true;
    }
  }
  return false;
}

/**
 * Normalizes an IPv6 address into 8 16-bit numeric words.
 */
function parseIpv6(ip: string): number[] {
  // Handle IPv4-mapped IPv6, e.g. ::ffff:192.168.1.1
  const lower = ip.toLowerCase();
  let v6Part = lower;
  let v4MappedPart: string | null = null;

  const lastColon = lower.lastIndexOf(':');
  const possibleV4 = lower.substring(lastColon + 1);
  if (possibleV4.includes('.')) {
    v4MappedPart = possibleV4;
    v6Part = lower.substring(0, lastColon);
  }

  const parts = v6Part.split(':');
  const doubleColonIdx = parts.indexOf('');
  const words: number[] = [];

  const neededWords = v4MappedPart ? 6 : 8;

  if (doubleColonIdx !== -1) {
    // There is a '::' compression
    const leftParts = parts.slice(0, doubleColonIdx).filter(Boolean);
    const rightParts = parts.slice(doubleColonIdx + 1).filter(Boolean);
    const fillCount = neededWords - (leftParts.length + rightParts.length);

    for (const p of leftParts) words.push(parseInt(p, 16));
    for (let i = 0; i < fillCount; i++) words.push(0);
    for (const p of rightParts) words.push(parseInt(p, 16));
  } else {
    for (const p of parts) {
      if (p) words.push(parseInt(p, 16));
    }
  }

  if (v4MappedPart) {
    const v4Num = ipv4ToLong(v4MappedPart);
    words.push((v4Num >>> 16) & 0xffff);
    words.push(v4Num & 0xffff);
  }

  while (words.length < 8) words.push(0);
  return words;
}

/**
 * Checks if an IPv6 address is private, loopback, unique local, link-local, or documentation.
 */
export function isPrivateIpv6(ip: string): boolean {
  try {
    const words = parseIpv6(ip);

    // ::/128 Unspecified
    if (words.every((w) => w === 0)) return true;

    // ::1/128 Loopback
    if (
      words[0] === 0 &&
      words[1] === 0 &&
      words[2] === 0 &&
      words[3] === 0 &&
      words[4] === 0 &&
      words[5] === 0 &&
      words[6] === 0 &&
      words[7] === 1
    ) {
      return true;
    }

    // ::ffff:0:0/96 IPv4-mapped IPv6 address -> check mapped IPv4
    if (
      words[0] === 0 &&
      words[1] === 0 &&
      words[2] === 0 &&
      words[3] === 0 &&
      words[4] === 0 &&
      words[5] === 0xffff
    ) {
      const ipv4Num = ((words[6]! << 16) | words[7]!) >>> 0;
      const ipv4Str = [
        (ipv4Num >>> 24) & 255,
        (ipv4Num >>> 16) & 255,
        (ipv4Num >>> 8) & 255,
        ipv4Num & 255,
      ].join('.');
      return isPrivateIpv4(ipv4Str);
    }

    // fc00::/7 Unique Local Address (ULA) - Private (fc00:: to fdff::)
    if ((words[0]! & 0xfe00) === 0xfc00) {
      return true;
    }

    // fe80::/10 Link-Local Unicast (fe80:: to febf::)
    if ((words[0]! & 0xffc0) === 0xfe80) {
      return true;
    }

    // ff00::/8 Multicast
    if ((words[0]! & 0xff00) === 0xff00) {
      return true;
    }

    // 2001:db8::/32 Documentation
    if (words[0] === 0x2001 && words[1] === 0x0db8) {
      return true;
    }

    // 64:ff9b::/96 Local-Use IPv4/IPv6 Translation (NAT64)
    if (
      words[0] === 0x0064 &&
      words[1] === 0xff9b &&
      words[2] === 0 &&
      words[3] === 0 &&
      words[4] === 0 &&
      words[5] === 0
    ) {
      const ipv4Num = ((words[6]! << 16) | words[7]!) >>> 0;
      const ipv4Str = [
        (ipv4Num >>> 24) & 255,
        (ipv4Num >>> 16) & 255,
        (ipv4Num >>> 8) & 255,
        ipv4Num & 255,
      ].join('.');
      return isPrivateIpv4(ipv4Str);
    }

    return false;
  } catch {
    // If parsing fails, fail closed for security
    return true;
  }
}

/**
 * Checks if an IP address string is an IP address and if it resolves to private/internal range.
 */
export function isPrivateIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) {
    return isPrivateIpv4(ip);
  }
  if (version === 6) {
    return isPrivateIpv6(ip);
  }
  return false;
}

/**
 * Cloud metadata hostnames explicitly blocked before/independent of DNS.
 */
const FORBIDDEN_METADATA_HOSTS = new Set([
  'instance-data',
  'metadata.google.internal',
  'metadata.goog',
  '169.254.169.254',
  'fd00:ec2::254',
  'kubernetes.default.svc',
  'metadata.packet.net',
]);

/**
 * Validates that a resolved or literal IP is safe for public egress.
 * Throws an SsrfBlockedError if destination is internal/private/forbidden.
 */
export function assertSafeDestinationIp(ip: string): void {
  const version = net.isIP(ip);
  if (version === 0) {
    throw new SsrfBlockedError(ip, `Invalid IP address format: "${ip}".`);
  }

  if (isPrivateIp(ip)) {
    throw new SsrfBlockedError(
      ip,
      `Resolved to private, loopback, link-local, or reserved IP address (${ip}).`
    );
  }
}

/**
 * Validates a target hostname against known cloud metadata endpoints.
 */
export function assertSafeHostname(hostname: string): void {
  const lower = hostname.toLowerCase();

  if (FORBIDDEN_METADATA_HOSTS.has(lower) || lower.endsWith('.internal')) {
    throw new SsrfBlockedError(
      hostname,
      `Access to internal/cloud metadata destination "${hostname}" is forbidden.`
    );
  }

  // If hostname is directly an IP address, validate it immediately
  if (net.isIP(lower) !== 0) {
    assertSafeDestinationIp(lower);
  }
}

/**
 * High-level pre-flight SSRF check for a URL string.
 * Validates protocol, hostname, and if the host is a literal IP, validates IP range.
 */
export function validateUrlSsrf(inputUrl: string): { hostname: string; protocol: string } {
  let parsed: URL;
  try {
    parsed = new URL(inputUrl);
  } catch {
    throw new SsrfBlockedError(inputUrl, 'Malformed URL syntax.');
  }

  assertAllowedProtocol(parsed);
  assertSafeHostname(parsed.hostname);

  return {
    hostname: parsed.hostname,
    protocol: parsed.protocol,
  };
}
