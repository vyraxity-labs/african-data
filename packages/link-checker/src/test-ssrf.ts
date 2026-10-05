import {
  isPrivateIp,
  isPrivateIpv4,
  isPrivateIpv6,
  assertSafeDestinationIp,
  assertSafeHostname,
  assertAllowedProtocol,
  validateUrlSsrf,
  SsrfBlockedError,
} from './ssrf';

async function runSsrfTests() {
  console.log('--- PHASE 12 STEP 12.2: SSRF PROTECTION TESTS ---');

  // TEST 1: Protocol enforcement (Only http: and https: permitted)
  console.log('\n[TEST 1] Testing protocol restriction (Only http and https allowed)...');
  const allowedProtocols = ['http://example.com', 'https://example.com'];
  for (const url of allowedProtocols) {
    validateUrlSsrf(url);
  }
  console.log('  PASSED: http and https URLs accepted.');

  const forbiddenProtocols = [
    'file:///etc/passwd',
    'ftp://example.com/file',
    'gopher://127.0.0.1:70',
    'data:text/plain;base64,SGVsbG8=',
    'dict://127.0.0.1:11211',
    'ldap://example.com',
  ];

  for (const url of forbiddenProtocols) {
    let threw = false;
    try {
      validateUrlSsrf(url);
    } catch (err) {
      if (err instanceof SsrfBlockedError) {
        threw = true;
      }
    }
    if (!threw) {
      throw new Error(`Expected protocol rejection for forbidden scheme: ${url}`);
    }
  }
  console.log('  PASSED: All non-HTTP/HTTPS protocols strictly rejected.');

  // TEST 2: Private IPv4 Range Rejections (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, etc.)
  console.log('\n[TEST 2] Testing private and reserved IPv4 address ranges...');
  const privateIpv4Addresses = [
    '127.0.0.1', // Loopback
    '127.100.50.1', // Loopback subnet
    '10.0.0.1', // Private Class A
    '10.254.254.254', // Private Class A upper
    '172.16.0.1', // Private Class B lower
    '172.31.255.255', // Private Class B upper
    '192.168.1.1', // Private Class C
    '192.168.254.254', // Private Class C
    '169.254.169.254', // Cloud metadata / link-local
    '169.254.1.1', // Link-local
    '0.0.0.0', // This host/network
    '100.64.0.1', // Carrier-grade NAT
    '198.18.0.1', // Benchmark
    '224.0.0.1', // Multicast
    '240.0.0.1', // Reserved
    '255.255.255.255', // Broadcast
  ];

  for (const ip of privateIpv4Addresses) {
    if (!isPrivateIpv4(ip)) {
      throw new Error(`Failed to flag private IPv4 address: ${ip}`);
    }
    let threw = false;
    try {
      assertSafeDestinationIp(ip);
    } catch (err) {
      if (err instanceof SsrfBlockedError) threw = true;
    }
    if (!threw) {
      throw new Error(`assertSafeDestinationIp failed to block private IPv4: ${ip}`);
    }
  }
  console.log(`  PASSED: Verified ${privateIpv4Addresses.length} private/reserved IPv4 addresses rejected.`);

  // TEST 3: Public IPv4 Acceptance
  console.log('\n[TEST 3] Testing public IPv4 addresses...');
  const publicIpv4Addresses = [
    '8.8.8.8', // Google DNS
    '1.1.1.1', // Cloudflare DNS
    '142.250.190.46', // Google
    '104.16.132.229', // Cloudflare
    '197.210.64.1', // African public IP (MTN Nigeria)
    '41.203.208.1', // African public IP (Afrinic)
  ];

  for (const ip of publicIpv4Addresses) {
    if (isPrivateIpv4(ip)) {
      throw new Error(`Incorrectly classified public IPv4 as private: ${ip}`);
    }
    assertSafeDestinationIp(ip); // Should not throw
  }
  console.log(`  PASSED: Verified ${publicIpv4Addresses.length} valid public IPv4 addresses accepted.`);

  // TEST 4: Private IPv6 Range Rejections (::1, fc00::/7, fe80::/10, etc.)
  console.log('\n[TEST 4] Testing private, loopback, and local IPv6 address ranges...');
  const privateIpv6Addresses = [
    '::1', // Loopback
    '::', // Unspecified
    'fc00::1', // Unique Local (ULA)
    'fd12:3456:789a:1::1', // Unique Local (ULA)
    'fe80::1', // Link-local
    'fe80::200:5aee:feaa:20a2', // Link-local
    'ff02::1', // Multicast all-nodes
    '2001:db8::1', // Documentation
    '::ffff:127.0.0.1', // IPv4-mapped loopback
    '::ffff:192.168.1.1', // IPv4-mapped private
    '::ffff:10.0.0.1', // IPv4-mapped private
    '::ffff:169.254.169.254', // IPv4-mapped metadata
  ];

  for (const ip of privateIpv6Addresses) {
    if (!isPrivateIpv6(ip)) {
      throw new Error(`Failed to flag private IPv6 address: ${ip}`);
    }
    let threw = false;
    try {
      assertSafeDestinationIp(ip);
    } catch (err) {
      if (err instanceof SsrfBlockedError) threw = true;
    }
    if (!threw) {
      throw new Error(`assertSafeDestinationIp failed to block private IPv6: ${ip}`);
    }
  }
  console.log(`  PASSED: Verified ${privateIpv6Addresses.length} private/reserved IPv6 addresses rejected.`);

  // TEST 5: Public IPv6 Acceptance
  console.log('\n[TEST 5] Testing public IPv6 addresses...');
  const publicIpv6Addresses = [
    '2001:4860:4860::8888', // Google DNS v6
    '2606:4700:4700::1111', // Cloudflare DNS v6
    '2a00:1450:4009:820::200e', // Public Google Web
    '2001:42d0:0:200::1', // Afrinic public IPv6
  ];

  for (const ip of publicIpv6Addresses) {
    if (isPrivateIpv6(ip)) {
      throw new Error(`Incorrectly classified public IPv6 as private: ${ip}`);
    }
    assertSafeDestinationIp(ip);
  }
  console.log(`  PASSED: Verified ${publicIpv6Addresses.length} valid public IPv6 addresses accepted.`);

  // TEST 6: Cloud Metadata Hostnames Rejections
  console.log('\n[TEST 6] Testing Cloud Metadata hostnames and URL blocking...');
  const metadataDestinations = [
    'http://169.254.169.254/latest/meta-data/',
    'http://instance-data/latest/meta-data/',
    'http://metadata.google.internal/computeMetadata/v1/',
    'http://metadata.goog/',
    'http://service.internal/api',
  ];

  for (const url of metadataDestinations) {
    let threw = false;
    try {
      validateUrlSsrf(url);
    } catch (err) {
      if (err instanceof SsrfBlockedError) threw = true;
    }
    if (!threw) {
      throw new Error(`Failed to block cloud metadata endpoint: ${url}`);
    }
  }
  console.log('  PASSED: Cloud metadata endpoints and internal domains rejected.');

  console.log('\n======================================================');
  console.log('ALL PHASE 12 STEP 12.2 TESTS PASSED SUCCESSFULLY (6/6)');
  console.log('======================================================');
}

runSsrfTests();
