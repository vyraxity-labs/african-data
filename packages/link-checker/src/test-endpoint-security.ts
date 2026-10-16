import dotenv from 'dotenv';
import path from 'path';

// Load workspace environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { validateCronSecret } from './cron-auth';

async function runScheduledEndpointSecurityTests() {
  console.log('--- PHASE 13 STEP 13.5: SCHEDULED ENDPOINT SECURITY TESTS ---');

  const testSecret = process.env.CRON_SECRET || 'bH7n1vcvtLrfGiG+8b4hF33hHhe7R2ji2wHbGEycjmE=';

  // TEST 1: Pure function validator - No headers -> Rejected
  console.log('\n[TEST 1] Testing missing authorization credentials...');
  const resNoAuth = validateCronSecret(null, null, testSecret);
  if (resNoAuth.isAuthorized) {
    throw new Error('Expected missing auth to be rejected.');
  }
  console.log('  PASSED: Missing credentials rejected.');

  // TEST 2: Wrong Bearer token -> Rejected
  console.log('\n[TEST 2] Testing invalid Bearer token...');
  const resWrongBearer = validateCronSecret('Bearer wrong-secret-token', null, testSecret);
  if (resWrongBearer.isAuthorized) {
    throw new Error('Expected wrong Bearer token to be rejected.');
  }
  console.log('  PASSED: Invalid Bearer token rejected.');

  // TEST 3: Valid Bearer token -> Authorized
  console.log('\n[TEST 3] Testing valid Bearer token...');
  const resValidBearer = validateCronSecret(`Bearer ${testSecret}`, null, testSecret);
  if (!resValidBearer.isAuthorized) {
    throw new Error('Expected valid Bearer token to be authorized.');
  }
  console.log('  PASSED: Valid Bearer token authorized.');

  // TEST 4: Valid x-cron-secret header -> Authorized
  console.log('\n[TEST 4] Testing valid x-cron-secret header...');
  const resValidHeader = validateCronSecret(null, testSecret, testSecret);
  if (!resValidHeader.isAuthorized) {
    throw new Error('Expected valid x-cron-secret header to be authorized.');
  }
  console.log('  PASSED: Valid x-cron-secret header authorized.');

  // TEST 5: Timing safe comparison with mismatched lengths
  console.log('\n[TEST 5] Testing timing-safe comparison with mismatched length secret...');
  const resShort = validateCronSecret('Bearer short', null, testSecret);
  if (resShort.isAuthorized) {
    throw new Error('Expected short secret to be rejected.');
  }
  console.log('  PASSED: Mismatched length secret safely rejected.');

  // TEST 6: Empty configured secret handling
  console.log('\n[TEST 6] Testing missing server-side secret configuration...');
  const resNoConfig = validateCronSecret(`Bearer ${testSecret}`, null, '');
  if (resNoConfig.isAuthorized) {
    throw new Error('Expected unconfigured server secret to reject all requests.');
  }
  console.log('  PASSED: Unconfigured server secret securely rejected all requests.');

  console.log('\n======================================================');
  console.log('ALL PHASE 13 STEP 13.5 SECURITY TESTS PASSED (6/6)');
  console.log('======================================================');
}

runScheduledEndpointSecurityTests();
