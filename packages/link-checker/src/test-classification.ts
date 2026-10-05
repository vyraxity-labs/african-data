import { classifyLinkStatus } from './classification';

async function runClassificationTests() {
  console.log('--- PHASE 12 STEP 12.7: LINK STATUS CLASSIFICATION TESTS ---');

  // TEST 1: 2xx -> HEALTHY
  console.log('\n[TEST 1] Verifying 2xx -> HEALTHY...');
  const res200 = classifyLinkStatus({ statusCode: 200 });
  const res201 = classifyLinkStatus({ statusCode: 201 });
  const res204 = classifyLinkStatus({ statusCode: 204 });

  if (res200.status !== 'HEALTHY' || res201.status !== 'HEALTHY' || res204.status !== 'HEALTHY') {
    throw new Error('2xx responses failed to classify as HEALTHY.');
  }
  console.log('  PASSED: 200, 201, 204 classified as HEALTHY.');

  // TEST 2: 301, 302, 307, 308 -> REDIRECTED
  console.log('\n[TEST 2] Verifying redirects -> REDIRECTED...');
  const res301 = classifyLinkStatus({ statusCode: 301 });
  const res302 = classifyLinkStatus({ statusCode: 302 });
  const res307 = classifyLinkStatus({ statusCode: 307 });
  const res308 = classifyLinkStatus({ statusCode: 308 });
  const res200Redirected = classifyLinkStatus({ statusCode: 200, isRedirected: true });

  if (
    res301.status !== 'REDIRECTED' ||
    res302.status !== 'REDIRECTED' ||
    res307.status !== 'REDIRECTED' ||
    res308.status !== 'REDIRECTED' ||
    res200Redirected.status !== 'REDIRECTED'
  ) {
    throw new Error('Redirect responses failed to classify as REDIRECTED.');
  }
  console.log('  PASSED: 301, 302, 307, 308, and redirected final 200 classified as REDIRECTED.');

  // TEST 3: 404, 410 -> BROKEN
  console.log('\n[TEST 3] Verifying 404/410 -> BROKEN...');
  const res404 = classifyLinkStatus({ statusCode: 404 });
  const res410 = classifyLinkStatus({ statusCode: 410 });

  if (res404.status !== 'BROKEN' || res410.status !== 'BROKEN') {
    throw new Error('404 and 410 failed to classify as BROKEN.');
  }
  console.log('  PASSED: 404 and 410 classified as BROKEN.');

  // TEST 4: 408 / timeout -> TIMEOUT
  console.log('\n[TEST 4] Verifying 408 & timeouts -> TIMEOUT...');
  const res408 = classifyLinkStatus({ statusCode: 408 });
  const resTimeoutErr = classifyLinkStatus({ error: new Error('Request timed out waiting for headers') });

  if (res408.status !== 'TIMEOUT' || resTimeoutErr.status !== 'TIMEOUT') {
    throw new Error('Timeouts failed to classify as TIMEOUT.');
  }
  if (!res408.isTemporary || !resTimeoutErr.isTemporary) {
    throw new Error('Timeouts must be flagged as temporary.');
  }
  console.log('  PASSED: 408 and timeout errors classified as temporary TIMEOUT.');

  // TEST 5: 429 -> RATE_LIMITED
  console.log('\n[TEST 5] Verifying 429 -> RATE_LIMITED...');
  const res429 = classifyLinkStatus({ statusCode: 429 });

  if (res429.status !== 'RATE_LIMITED' || !res429.isTemporary) {
    throw new Error('429 failed to classify as temporary RATE_LIMITED.');
  }
  console.log('  PASSED: 429 classified as RATE_LIMITED (temporary).');

  // TEST 6: 403 / 401 -> BLOCKED
  console.log('\n[TEST 6] Verifying 403 -> BLOCKED...');
  const res403 = classifyLinkStatus({ statusCode: 403 });
  const resSsrfBlock = classifyLinkStatus({ error: new Error('SSRF blocked destination') });

  if (res403.status !== 'BLOCKED' || resSsrfBlock.status !== 'BLOCKED') {
    throw new Error('403 and SSRF blocks failed to classify as BLOCKED.');
  }
  console.log('  PASSED: 403 and security blocks classified as BLOCKED.');

  // TEST 7: 500-599 -> SERVER_ERROR (Never classified as permanently broken!)
  console.log('\n[TEST 7] Verifying 500-599 -> SERVER_ERROR (Crucial rule: Not broken!)...');
  const res500 = classifyLinkStatus({ statusCode: 500 });
  const res502 = classifyLinkStatus({ statusCode: 502 });
  const res503 = classifyLinkStatus({ statusCode: 503 });

  if (
    res500.status !== 'SERVER_ERROR' ||
    res502.status !== 'SERVER_ERROR' ||
    res503.status !== 'SERVER_ERROR'
  ) {
    throw new Error('5xx codes incorrectly classified!');
  }

  if (res500.status === ('BROKEN' as any) || res503.status === ('BROKEN' as any)) {
    throw new Error('5xx responses must NEVER be classified as permanently BROKEN.');
  }

  if (!res500.isTemporary || !res503.isTemporary) {
    throw new Error('5xx server errors must be flagged as temporary.');
  }
  console.log('  PASSED: 500, 502, 503 classified as temporary SERVER_ERROR, never marked permanently broken.');

  console.log('\n======================================================');
  console.log('ALL PHASE 12 STEP 12.7 TESTS PASSED SUCCESSFULLY (7/7)');
  console.log('======================================================');
}

runClassificationTests();
