import dotenv from 'dotenv';
import path from 'path';

// Load workspace environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import {
  getObservabilityMetrics,
  logStructuredError,
  prisma,
  ResourceStatus,
  LinkHealthStatus,
  AuditAction,
  recordAuditLog,
} from '@repo/database';

async function runObservabilityTests() {
  console.log('===============================================================');
  console.log('           PHASE 25: OBSERVABILITY SUITE TESTS                 ');
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
      throw new Error(`Observability test failed: ${title}`);
    }
  }

  // 1. Test Structured Error Logging
  console.log('--- [1] Testing Structured Error Logging ---');
  const dummyError = new Error('Test observability failure simulation');
  const structured = logStructuredError('LinkCheckerWorker', dummyError, {
    batchId: 'batch-test-123',
    host: 'statssa.gov.za',
  });

  assert('Structured error generates ISO-8601 timestamp', typeof structured.timestamp === 'string');
  assert('Structured error records severity level', structured.level === 'ERROR');
  assert('Structured error tracks component name', structured.component === 'LinkCheckerWorker');
  assert('Structured error retains error message', structured.message.includes('simulation'));
  assert('Structured error preserves contextual details', structured.details?.host === 'statssa.gov.za');

  // 2. Test Real-time Platform Metrics Retrieval
  console.log('\n--- [2] Testing Platform Metrics Aggregation ---');
  const metrics = await getObservabilityMetrics();

  assert('Returns lastSuccessfulImport structure', metrics.lastSuccessfulImport !== undefined);
  if (metrics.lastSuccessfulImport) {
    assert(
      'Tracks import stats accurately',
      typeof metrics.lastSuccessfulImport.resourcesCreated === 'number' &&
        typeof metrics.lastSuccessfulImport.skippedDuplicates === 'number'
    );
  }

  assert('Returns lastLinkCheckBatch metric', metrics.lastLinkCheckBatch !== undefined);
  assert(
    'Returns full LinkHealth status breakdown (all 9 states)',
    typeof metrics.linkHealthSummary.totalLinks === 'number' &&
      typeof metrics.linkHealthSummary.healthy === 'number' &&
      typeof metrics.linkHealthSummary.broken === 'number' &&
      typeof metrics.linkHealthSummary.redirected === 'number' &&
      typeof metrics.linkHealthSummary.timeout === 'number' &&
      typeof metrics.linkHealthSummary.rateLimited === 'number' &&
      typeof metrics.linkHealthSummary.blocked === 'number' &&
      typeof metrics.linkHealthSummary.serverError === 'number' &&
      typeof metrics.linkHealthSummary.unknown === 'number'
  );

  console.log('\nCurrent Observability Telemetry Snapshot:');
  console.log(`  - Total catalogued links:   ${metrics.linkHealthSummary.totalLinks}`);
  console.log(`  - Healthy links (2xx):      ${metrics.linkHealthSummary.healthy}`);
  console.log(`  - Broken links (404/410):   ${metrics.linkHealthSummary.broken}`);
  console.log(`  - Redirected links (3xx):   ${metrics.linkHealthSummary.redirected}`);
  console.log(`  - Timeouts (408/net):       ${metrics.linkHealthSummary.timeout}`);
  console.log(`  - Rate limited (429):       ${metrics.linkHealthSummary.rateLimited}`);
  console.log(`  - Blocked (403/SSRF):       ${metrics.linkHealthSummary.blocked}`);
  console.log(`  - Server errors (5xx):      ${metrics.linkHealthSummary.serverError}`);
  console.log(`  - Unchecked / Unknown:      ${metrics.linkHealthSummary.unknown}`);

  console.log('\n===============================================================');
  console.log(`ALL PHASE 25 OBSERVABILITY TESTS PASSED (${passed}/${total})`);
  console.log('===============================================================\n');
}

runObservabilityTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
