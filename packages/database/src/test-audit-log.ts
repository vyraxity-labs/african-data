import { prisma, AuditAction, recordAuditLog, getAuditLogs, sanitizeAuditValues } from './index';

async function runTests() {
  console.log('🧪 Starting Phase 19 Audit Log Verification Tests...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // TEST SUITE 1: Secret Sanitization Engine
  // ----------------------------------------------------
  console.log('--- Suite 1: Secret Sanitization Engine ---');

  const dirtyPayload = {
    resourceName: 'National Health Survey 2026',
    password: 'superSecretPassword123!',
    apiToken: 'eyJhGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    bearerAuth: 'Bearer secret_access_token_xyz',
    secretKey: 'top_secret_value',
    userCredentials: 'superSecretCredentialsObject',
    metadata: {
      userHash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
      apiKey: 'ak_live_abcdef1234567890',
      nestedSafeField: 'Safe metadata value',
    },
    arrayOfSecrets: [
      { key: 'apiKey', value: 'secretVal' },
      { key: 'publicName', value: 'Public Dataset' },
    ],
  };

  const cleanPayload = sanitizeAuditValues(dirtyPayload);

  assert(
    cleanPayload.resourceName === 'National Health Survey 2026',
    'Non-sensitive keys preserved'
  );
  assert(
    cleanPayload.password === '[REDACTED]',
    'Password key redacted with [REDACTED]'
  );
  assert(
    cleanPayload.apiToken === '[REDACTED]',
    'apiToken key redacted with [REDACTED]'
  );
  assert(
    cleanPayload.bearerAuth === '[REDACTED_SECRET]' || cleanPayload.bearerAuth === '[REDACTED]',
    'Bearer token string value sanitized'
  );
  assert(
    cleanPayload.secretKey === '[REDACTED]',
    'secretKey key redacted with [REDACTED]'
  );
  assert(
    cleanPayload.userCredentials === '[REDACTED]',
    'Sensitive userCredentials key redacted with [REDACTED]'
  );
  assert(
    cleanPayload.metadata.userHash === '[REDACTED]',
    'Nested userHash redacted'
  );
  assert(
    cleanPayload.metadata.apiKey === '[REDACTED]',
    'Nested apiKey redacted'
  );
  assert(
    cleanPayload.metadata.nestedSafeField === 'Safe metadata value',
    'Nested safe field preserved intact'
  );

  // ----------------------------------------------------
  // TEST SUITE 2: Record Minimum Audit Actions
  // ----------------------------------------------------
  console.log('\n--- Suite 2: Minimum Audit Actions Persistence ---');

  const testActor = 'test-audit-admin@african-data.gov';
  const testRunId = `test-${Date.now()}`;

  const minimumActions: AuditAction[] = [
    AuditAction.CREATE_RESOURCE,
    AuditAction.UPDATE_RESOURCE,
    AuditAction.ARCHIVE_RESOURCE,
    AuditAction.CREATE_LINK,
    AuditAction.UPDATE_LINK,
    AuditAction.REPLACE_LINK,
    AuditAction.BULK_REPLACE_LINKS,
    AuditAction.CSV_IMPORT,
    AuditAction.RESOURCE_STATUS_CHANGE,
  ];

  for (const action of minimumActions) {
    const log = await recordAuditLog(prisma, {
      actor: testActor,
      action,
      entity: action.includes('LINK') ? 'ResourceLink' : 'Resource',
      entityId: `${testRunId}-${action}`,
      before: {
        status: 'DRAFT',
        sampleSecret: 'shouldBeScrubbed12345',
      },
      after: {
        status: 'ACTIVE',
        name: `Resource for ${action}`,
        authToken: 'Bearer secret_value_here',
      },
    });

    assert(
      log.action === action && log.actor === testActor,
      `Successfully recorded action: ${action}`
    );
    assert(
      (log.before as any)?.sampleSecret === '[REDACTED]',
      `Action ${action} scrubbed secrets in before payload`
    );
    assert(
      (log.after as any)?.authToken === '[REDACTED_SECRET]' || (log.after as any)?.authToken === '[REDACTED]',
      `Action ${action} scrubbed secrets in after payload`
    );
  }

  // ----------------------------------------------------
  // TEST SUITE 3: Reverse-Chronological Querying & Filters
  // ----------------------------------------------------
  console.log('\n--- Suite 3: Querying, Ordering & Filtering ---');

  // Query logs for testActor
  const queryResult = await getAuditLogs(prisma, {
    actor: testActor,
    limit: 20,
  });

  assert(
    queryResult.total >= minimumActions.length,
    `Retrieved all ${minimumActions.length} recorded actions for test actor (found ${queryResult.total})`
  );

  // Verify reverse chronological order
  let isDesc = true;
  for (let i = 0; i < queryResult.logs.length - 1; i++) {
    const curLog = queryResult.logs[i];
    const nextLog = queryResult.logs[i + 1];
    if (curLog && nextLog) {
      const cur = new Date(curLog.timestamp).getTime();
      const next = new Date(nextLog.timestamp).getTime();
      if (cur < next) {
        isDesc = false;
        break;
      }
    }
  }
  assert(isDesc, 'Logs are strictly returned in reverse chronological order (newest first)');

  // Filter by action
  const csvImportResult = await getAuditLogs(prisma, {
    actor: testActor,
    action: AuditAction.CSV_IMPORT,
  });
  assert(
    csvImportResult.logs.every((l) => l.action === AuditAction.CSV_IMPORT),
    'Action filtering returns strictly matching action records'
  );

  // Filter by entity
  const linkLogsResult = await getAuditLogs(prisma, {
    actor: testActor,
    entity: 'ResourceLink',
  });
  assert(
    linkLogsResult.logs.every((l) => l.entity === 'ResourceLink'),
    'Entity filtering returns strictly matching entity records'
  );

  // Pagination test
  const paged1 = await getAuditLogs(prisma, { actor: testActor, limit: 3, offset: 0 });
  const paged2 = await getAuditLogs(prisma, { actor: testActor, limit: 3, offset: 3 });
  assert(
    paged1.logs.length === 3 && paged2.logs.length === 3 && paged1.logs[0]?.id !== paged2.logs[0]?.id,
    'Pagination limit and offset work accurately'
  );

  // Cleanup test artifacts
  await prisma.auditLog.deleteMany({
    where: { actor: testActor },
  });
  console.log('\n🧹 Test audit artifacts cleaned up successfully.');

  console.log(`\n==================================================`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`==================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
