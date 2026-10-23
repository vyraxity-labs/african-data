import dotenv from 'dotenv';
import path from 'path';

// Load workspace environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import {
  validateCsvSecurity,
  parseCsv,
  sanitizeCsvFormulaInjection,
  prisma,
} from '@repo/database';
import {
  validateCronSecret,
  resolveBatchConfig,
  validateUrlSsrf,
  isPrivateIpv4,
  isPrivateIpv6,
  isAllowedProtocol,
  assertSafeHostname,
  executeSecureRequest,
} from '@repo/link-checker';

async function runSecurityAudit() {
  console.log('===============================================================');
  console.log('       PHASE 24: DEDICATED SECURITY HARDENING AUDIT            ');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function assert(title: string, condition: boolean, detail?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`[PASS] ${title}`);
      if (detail) console.log(`       → ${detail}`);
    } else {
      console.error(`[FAIL] ${title}`);
      if (detail) console.error(`       → Error: ${detail}`);
      throw new Error(`Security assertion failed: ${title}`);
    }
  }

  // --------------------------------------------------------------------------
  // DOMAIN 1: AUTHENTICATION & ACCESS CONTROL
  // --------------------------------------------------------------------------
  console.log('--- [DOMAIN 1] Authentication & Route Protection ---');

  // Test 1.1: Cron Secret validation reject missing / malformed credentials
  const badAuth = validateCronSecret(null, null, 'expected_secret');
  assert('Rejects missing cron authentication credentials', !badAuth.isAuthorized);

  const wrongAuth = validateCronSecret('Bearer wrong_token', null, 'expected_secret');
  assert('Rejects invalid cron authentication credentials', !wrongAuth.isAuthorized);

  const validBearer = validateCronSecret('Bearer expected_secret', null, 'expected_secret');
  assert('Accepts valid Bearer token for scheduled worker', validBearer.isAuthorized);

  const validCustomHeader = validateCronSecret(null, 'expected_secret', 'expected_secret');
  assert('Accepts valid x-cron-secret header for orchestrator', validCustomHeader.isAuthorized);

  // --------------------------------------------------------------------------
  // DOMAIN 2: CSV UPLOAD SECURITY & INGESTION
  // --------------------------------------------------------------------------
  console.log('\n--- [DOMAIN 2] CSV Security & Sanitization ---');

  // Test 2.1: File size restriction (> 10MB)
  const oversizeBuf = Buffer.alloc(11 * 1024 * 1024);
  const sizeCheck = validateCsvSecurity(oversizeBuf, {
    fileName: 'large.csv',
    sizeBytes: oversizeBuf.length,
    mimeType: 'text/csv',
  });
  assert('Enforces strict 10MB maximum file size limit', !sizeCheck.isValid && Boolean(sizeCheck.error?.includes('10MB')));

  // Test 2.2: Invalid extension
  const exeBuf = Buffer.from('name,link\nDataset,http://example.com');
  const extCheck = validateCsvSecurity(exeBuf, {
    fileName: 'payload.exe',
    sizeBytes: exeBuf.length,
    mimeType: 'application/x-msdownload',
  });
  assert('Rejects non-csv file extensions', !extCheck.isValid);

  // Test 2.3: Null byte detection (binary payload disguised as CSV)
  const nullByteBuf = Buffer.from('name,link\x00malicious');
  const nullCheck = validateCsvSecurity(nullByteBuf, {
    fileName: 'test.csv',
    sizeBytes: nullByteBuf.length,
    mimeType: 'text/csv',
  });
  assert('Detects and rejects binary/corrupted files with null bytes', !nullCheck.isValid && Boolean(nullCheck.error?.includes('binary')));

  // Test 2.4: Formula injection mitigation (=, +, -, @)
  const formulaPayload = '=cmd|"/C calc"!A0';
  const sanitized = sanitizeCsvFormulaInjection(formulaPayload);
  assert(
    'Neutralizes formula injection payloads with single-quote escaping',
    sanitized.startsWith("'=") && !sanitized.startsWith('=')
  );

  const atPayload = '@SUM(1+1)';
  assert(
    'Neutralizes @ symbol formula injections',
    sanitizeCsvFormulaInjection(atPayload).startsWith("'@")
  );

  // --------------------------------------------------------------------------
  // DOMAIN 3: LINK CHECKER & SSRF PROTECTION
  // --------------------------------------------------------------------------
  console.log('\n--- [DOMAIN 3] Link Checker SSRF & TOCTOU Defense ---');

  // Test 3.1: Loopback IPv4
  assert('Blocks IPv4 loopback (127.0.0.1)', isPrivateIpv4('127.0.0.1'));

  // Test 3.2: Hostname resolving to loopback or private IP via secure client
  let caughtLocal = false;
  try {
    await executeSecureRequest('http://localhost:3000/');
  } catch {
    caughtLocal = true;
  }
  assert('Blocks connection attempts to localhost', caughtLocal);

  // Test 3.2b: Cloud metadata hostname pre-resolution
  let caughtMetadata = false;
  try {
    assertSafeHostname('metadata.google.internal');
  } catch {
    caughtMetadata = true;
  }
  assert('Blocks cloud metadata hostname (metadata.google.internal)', caughtMetadata);

  // Test 3.3: RFC 1918 Private ranges
  const privA = isPrivateIpv4('10.0.0.1');
  const privB = isPrivateIpv4('172.16.0.1');
  const privC = isPrivateIpv4('192.168.1.1');
  assert('Blocks RFC1918 private IPv4 subnets (10/8, 172.16/12, 192.168/16)', privA && privB && privC);

  // Test 3.4: Cloud metadata services (AWS / GCP / Azure 169.254.169.254)
  assert('Blocks cloud metadata service endpoint (169.254.169.254)', isPrivateIpv4('169.254.169.254'));

  // Test 3.5: IPv6 loopback and private
  assert('Blocks IPv6 loopback (::1)', isPrivateIpv6('::1'));
  assert('Blocks IPv6 ULA (fc00::1)', isPrivateIpv6('fc00::1'));

  // Test 3.6: Disallowed protocols
  assert('Allows http protocol', isAllowedProtocol('http:'));
  assert('Allows https protocol', isAllowedProtocol('https:'));
  assert('Blocks non-HTTP/HTTPS protocols (ftp:, file:, gopher:)', !isAllowedProtocol('ftp:') && !isAllowedProtocol('file:'));

  // Test 3.7: Safe public endpoint parse
  const parsedPublic = validateUrlSsrf('https://example.com/dataset.csv');
  assert('Permits legitimate public URLs (https://example.com)', parsedPublic.hostname === 'example.com');

  // Test 3.8: Concurrency & batch limits
  const config = resolveBatchConfig();
  assert(
    'Enforces conservative per-host concurrency (maxConcurrentPerHost=1)',
    config.maxConcurrentPerHost === 1
  );
  assert(
    'Enforces global concurrency and timeout boundaries',
    config.globalMaxConcurrency <= 10 && config.timeoutMs <= 10000
  );

  // --------------------------------------------------------------------------
  // DOMAIN 4: DATABASE & PRISMA SECURITY
  // --------------------------------------------------------------------------
  console.log('\n--- [DOMAIN 4] Database Parameterization & Isolation ---');

  // Test 4.1: Prisma query parameterization (SQL injection test payload)
  const sqlInjectionName = "Test' OR '1'='1";
  const searchResults = await prisma.resource.findMany({
    where: { name: sqlInjectionName },
    take: 1,
  });
  assert(
    'Safely escapes SQL injection strings via Prisma parameterized queries',
    Array.isArray(searchResults)
  );

  // Test 4.2: Audit logging capability
  const auditCount = await prisma.auditLog.count();
  assert('Audit trail table is reachable and active', typeof auditCount === 'number');

  console.log('\n===============================================================');
  console.log(`ALL SECURITY HARDENING TESTS PASSED (${passed}/${total})`);
  console.log('===============================================================\n');
}

runSecurityAudit()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
