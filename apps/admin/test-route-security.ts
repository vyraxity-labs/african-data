import dotenv from 'dotenv';
import path from 'path';

// Load workspace environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { POST, GET } from './app/api/internal/link-check/route';
import { NextRequest } from 'next/server';

interface RouteResponse {
  message?: string;
  error?: string;
  [key: string]: unknown;
}

async function runRouteSecurityTests() {
  console.log('--- ADMIN APP: SCHEDULED ROUTE HANDLER TESTS ---');

  const testSecret = process.env.CRON_SECRET || 'bH7n1vcvtLrfGiG+8b4hF33hHhe7R2ji2wHbGEycjmE=';

  // TEST 1: Unauthorized request returns HTTP 401
  console.log('\n[TEST 1] Testing POST /api/internal/link-check with invalid secret (HTTP 401)...');
  const unauthReq = new NextRequest('http://localhost:3001/api/internal/link-check', {
    method: 'POST',
    headers: {
      authorization: 'Bearer bad_secret',
    },
  });

  const unauthRes = await POST(unauthReq);
  if (unauthRes.status !== 401) {
    throw new Error(`Expected HTTP 401 Unauthorized, got: ${unauthRes.status}`);
  }
  const unauthBody = (await unauthRes.json()) as RouteResponse;
  if (unauthBody.error !== 'Unauthorized') {
    throw new Error('Expected Unauthorized error message in response body.');
  }
  console.log(`  PASSED: HTTP handler returned 401 Unauthorized (${unauthBody.message}).`);

  // TEST 2: GET method rejection (HTTP 405 Method Not Allowed)
  console.log('\n[TEST 2] Testing GET /api/internal/link-check method restriction (HTTP 405)...');
  const getRes = await GET();
  if (getRes.status !== 405) {
    throw new Error(`Expected HTTP 405 Method Not Allowed, got: ${getRes.status}`);
  }
  console.log('  PASSED: GET request rejected with 405 Method Not Allowed.');

  // TEST 3: Authorized POST request returns HTTP 200
  console.log('\n[TEST 3] Testing POST /api/internal/link-check with valid CRON_SECRET (HTTP 200)...');
  const authReq = new NextRequest('http://localhost:3001/api/internal/link-check', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${testSecret}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ batchSize: 5 }),
  });

  const authRes = await POST(authReq);
  if (authRes.status !== 200) {
    const errBody = (await authRes.json()) as RouteResponse;
    throw new Error(`Expected HTTP 200 OK, got: ${authRes.status} - ${JSON.stringify(errBody)}`);
  }
  const authData = (await authRes.json()) as RouteResponse;
  if (!authData.message) {
    throw new Error('Expected response body message from link-check endpoint.');
  }
  console.log(`  PASSED: Authorized execution succeeded: "${authData.message}"`);

  console.log('\n======================================================');
  console.log('ALL ADMIN ROUTE HANDLER TESTS PASSED SUCCESSFULLY (3/3)');
  console.log('======================================================');
}

runRouteSecurityTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
