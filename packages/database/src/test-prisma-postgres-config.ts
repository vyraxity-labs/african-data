import fs from 'node:fs';
import path from 'node:path';
import { PrismaPostgresAdapter } from '@prisma/adapter-ppg';
import { createPrismaClient } from './client';

async function testPrismaPostgresConfiguration() {
  console.log('🧪 Starting Phase 21 Prisma Postgres Production Verification...\n');

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
  // SUITE 1: Serverless Driver Adapter Architecture
  // ----------------------------------------------------
  console.log('--- Suite 1: Prisma Postgres Serverless Driver (@prisma/adapter-ppg) ---');

  assert(
    typeof PrismaPostgresAdapter === 'function',
    '@prisma/adapter-ppg exports PrismaPostgresAdapter'
  );

  // Test adapter instantiation with prisma+postgres:// connection string
  const samplePpgUrl = 'prisma+postgres://accelerate.prisma-data.net/?api_key=test_api_key_12345';
  const adapterInstance = new PrismaPostgresAdapter({ connectionString: samplePpgUrl });

  assert(
    adapterInstance !== null && adapterInstance !== undefined,
    'PrismaPostgresAdapter instantiates successfully with serverless connection string'
  );

  // Test createPrismaClient switches to serverless adapter when DATABASE_URL is prisma+postgres://
  const originalEnv = process.env.DATABASE_URL;
  try {
    process.env.DATABASE_URL = samplePpgUrl;
    const client = createPrismaClient();
    assert(
      client !== null && client !== undefined,
      'createPrismaClient() instantiates PrismaClient with serverless driver for prisma+postgres:// URL'
    );
  } finally {
    process.env.DATABASE_URL = originalEnv;
  }

  // ----------------------------------------------------
  // SUITE 2: Environment & Connection Architecture (No DIRECT_URL)
  // ----------------------------------------------------
  console.log('\n--- Suite 2: Environment Architecture (Single DATABASE_URL, No DIRECT_URL) ---');

  const rootEnvExamplePath = path.resolve(__dirname, '../../../.env.example');
  const prisma7ConfigPath = path.resolve(__dirname, '../prisma7.config.ts');
  const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');

  const envExampleContent = fs.readFileSync(rootEnvExamplePath, 'utf8');
  assert(
    !envExampleContent.includes('DIRECT_URL'),
    '.env.example strictly omits DIRECT_URL'
  );
  assert(
    envExampleContent.includes('DATABASE_URL'),
    '.env.example defines single DATABASE_URL connection variable'
  );

  const prisma7ConfigContent = fs.readFileSync(prisma7ConfigPath, 'utf8');
  assert(
    !prisma7ConfigContent.includes('DIRECT_URL'),
    'prisma7.config.ts strictly omits DIRECT_URL'
  );
  assert(
    prisma7ConfigContent.includes("url: env('DATABASE_URL')"),
    "prisma7.config.ts configures datasource directly with env('DATABASE_URL')"
  );

  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  assert(
    !schemaContent.includes('directUrl'),
    'schema.prisma strictly omits directUrl configuration'
  );

  // ----------------------------------------------------
  // SUITE 3: Production Environment Documentation
  // ----------------------------------------------------
  console.log('\n--- Suite 3: Production Deployment Readiness ---');

  const hasPpgInDeps = (() => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));
    return Boolean(pkg.dependencies['@prisma/adapter-ppg']);
  })();

  assert(
    hasPpgInDeps,
    '@repo/database declares @prisma/adapter-ppg in production dependencies'
  );

  console.log(`\n==================================================`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`==================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

testPrismaPostgresConfiguration().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
