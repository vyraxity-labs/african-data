import dotenv from 'dotenv';
import path from 'path';

// Load workspace environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { validateCronSecret } from './cron-auth';
import { resolveBatchConfig } from './batch-config';

async function runScheduledMonitoringTests() {
  console.log('--- PHASE 22 STEP 22.3: SCHEDULED MONITORING VERIFICATION ---');

  const testSecret = process.env.CRON_SECRET || 'bH7n1vcvtLrfGiG+8b4hF33hHhe7R2ji2wHbGEycjmE=';

  // TEST 1: Vercel Cron invocation header simulation (Authorization: Bearer <CRON_SECRET>)
  console.log('\n[TEST 1] Testing native Vercel Cron header format (Bearer token)...');
  const vercelCronHeader = `Bearer ${testSecret}`;
  const vercelAuth = validateCronSecret(vercelCronHeader, null, testSecret);
  if (!vercelAuth.isAuthorized) {
    throw new Error('Vercel Cron Bearer token authorization failed.');
  }
  console.log('  PASSED: Vercel Cron Authorization header validated successfully.');

  // TEST 2: External orchestrator header simulation (x-cron-secret)
  console.log('\n[TEST 2] Testing external orchestrator header format (x-cron-secret)...');
  const externalAuth = validateCronSecret(null, testSecret, testSecret);
  if (!externalAuth.isAuthorized) {
    throw new Error('External orchestrator x-cron-secret authorization failed.');
  }
  console.log('  PASSED: External orchestrator x-cron-secret validated successfully.');

  // TEST 3: Unauthorized simulation
  console.log('\n[TEST 3] Testing unauthorized requests rejection...');
  const noAuth = validateCronSecret(null, null, testSecret);
  const badAuth = validateCronSecret('Bearer invalid_token', null, testSecret);
  if (noAuth.isAuthorized || badAuth.isAuthorized) {
    throw new Error('Unauthorized requests should not be permitted.');
  }
  console.log('  PASSED: Unauthenticated and invalid requests strictly rejected.');

  // TEST 4: Batch configuration resolver defaults & overrides
  console.log('\n[TEST 4] Testing batch configuration resolver for scheduled executions...');
  const defaultConfig = resolveBatchConfig();
  if (defaultConfig.batchSize !== 25 || defaultConfig.timeoutMs !== 8000) {
    throw new Error(`Unexpected default config: ${JSON.stringify(defaultConfig)}`);
  }
  console.log(`  PASSED: Default batch config resolved (batchSize: ${defaultConfig.batchSize}, timeout: ${defaultConfig.timeoutMs}ms).`);

  const customConfig = resolveBatchConfig({ batchSize: 50, timeoutMs: 5000 });
  if (customConfig.batchSize !== 50 || customConfig.timeoutMs !== 5000) {
    throw new Error(`Unexpected custom config: ${JSON.stringify(customConfig)}`);
  }
  console.log('  PASSED: Query/body overrides cleanly applied to batch config.');

  // TEST 5: vercel.json cron configuration presence and validity
  console.log('\n[TEST 5] Verifying apps/admin/vercel.json configuration...');
  const fs = await import('fs');
  const vercelJsonPath = path.resolve(__dirname, '../../../apps/admin/vercel.json');
  if (!fs.existsSync(vercelJsonPath)) {
    throw new Error(`apps/admin/vercel.json is missing at ${vercelJsonPath}.`);
  }
  const vercelJson = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
  if (!Array.isArray(vercelJson.crons) || vercelJson.crons.length === 0) {
    throw new Error('apps/admin/vercel.json does not define crons array.');
  }
  const cronJob = vercelJson.crons[0];
  if (!cronJob.path.startsWith('/api/internal/link-check') || !cronJob.schedule) {
    throw new Error(`apps/admin/vercel.json cron job misconfigured: ${JSON.stringify(cronJob)}`);
  }
  console.log(`  PASSED: vercel.json verified with schedule "${cronJob.schedule}" pointing to "${cronJob.path}".`);

  console.log('\n=============================================================');
  console.log('ALL PHASE 22 STEP 22.3 SCHEDULED MONITORING TESTS PASSED (5/5)');
  console.log('=============================================================');
}

runScheduledMonitoringTests().catch((err) => {
  console.error('\nFAILED STEP 22.3 TESTS:', err);
  process.exit(1);
});
