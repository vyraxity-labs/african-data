import { resolveBatchConfig, DEFAULT_BATCH_CONFIG } from './batch-config';

async function runBatchConfigTests() {
  console.log('--- PHASE 13 STEP 13.1: BATCHED SCHEDULED CHECKING TESTS ---');

  // TEST 1: Default batch configuration
  console.log('\n[TEST 1] Verifying default batch configuration...');
  const originalEnv = process.env.LINK_CHECK_BATCH_SIZE;
  delete process.env.LINK_CHECK_BATCH_SIZE;

  const defaultCfg = resolveBatchConfig();
  if (defaultCfg.batchSize !== 25) {
    throw new Error(`Expected default batch size 25, got: ${defaultCfg.batchSize}`);
  }
  if (defaultCfg.maxConcurrentPerHost !== 1) {
    throw new Error(`Expected default maxConcurrentPerHost 1, got: ${defaultCfg.maxConcurrentPerHost}`);
  }
  if (defaultCfg.globalMaxConcurrency !== 5) {
    throw new Error(`Expected default globalMaxConcurrency 5, got: ${defaultCfg.globalMaxConcurrency}`);
  }
  console.log(`  PASSED: Default batch config verified (batchSize=${defaultCfg.batchSize}, timeout=${defaultCfg.timeoutMs}ms).`);

  // TEST 2: Environment variable override (LINK_CHECK_BATCH_SIZE=50)
  console.log('\n[TEST 2] Verifying LINK_CHECK_BATCH_SIZE environment variable support...');
  process.env.LINK_CHECK_BATCH_SIZE = '50';
  const envCfg = resolveBatchConfig();

  if (envCfg.batchSize !== 50) {
    throw new Error(`Expected batch size 50 from env, got: ${envCfg.batchSize}`);
  }
  console.log(`  PASSED: LINK_CHECK_BATCH_SIZE=50 parsed successfully.`);

  // TEST 3: Safe bounds clamping (Prevent infinite or negative batches)
  console.log('\n[TEST 3] Verifying boundary clamping [1, 100]...');
  process.env.LINK_CHECK_BATCH_SIZE = '1000'; // Exceeds upper bound
  const clampedUpper = resolveBatchConfig();
  if (clampedUpper.batchSize !== 100) {
    throw new Error(`Expected upper clamp to 100, got: ${clampedUpper.batchSize}`);
  }

  process.env.LINK_CHECK_BATCH_SIZE = '-10'; // Negative
  const clampedLower = resolveBatchConfig();
  if (clampedLower.batchSize !== DEFAULT_BATCH_CONFIG.batchSize) {
    throw new Error(`Expected negative value fallback to default, got: ${clampedLower.batchSize}`);
  }

  process.env.LINK_CHECK_BATCH_SIZE = 'invalid_number'; // Malformed
  const clampedMalformed = resolveBatchConfig();
  if (clampedMalformed.batchSize !== DEFAULT_BATCH_CONFIG.batchSize) {
    throw new Error(`Expected malformed fallback to default, got: ${clampedMalformed.batchSize}`);
  }
  console.log('  PASSED: Boundary clamping strictly enforces [1, 100] link limits.');

  // TEST 4: Programmatic override precedence
  console.log('\n[TEST 4] Verifying programmatic override precedence over environment variables...');
  process.env.LINK_CHECK_BATCH_SIZE = '25';
  const customOverride = resolveBatchConfig({ batchSize: 30, timeoutMs: 5000 });

  if (customOverride.batchSize !== 30 || customOverride.timeoutMs !== 5000) {
    throw new Error('Programmatic override was ignored.');
  }
  console.log('  PASSED: Programmatic overrides respected over env variables.');

  // Restore env
  if (originalEnv !== undefined) {
    process.env.LINK_CHECK_BATCH_SIZE = originalEnv;
  } else {
    delete process.env.LINK_CHECK_BATCH_SIZE;
  }

  console.log('\n======================================================');
  console.log('ALL PHASE 13 STEP 13.1 TESTS PASSED SUCCESSFULLY (4/4)');
  console.log('======================================================');
}

runBatchConfigTests();
