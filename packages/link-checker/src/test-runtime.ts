import { assertNodeRuntime } from './runtime';

async function runRuntimeVerificationTests() {
  console.log('--- PHASE 12 STEP 12.1: LINK CHECKER NODE.JS RUNTIME VERIFICATION ---');

  // TEST 1: Assert running in real Node.js environment
  console.log('\n[TEST 1] Verifying current runtime environment assertion...');
  const runtimeInfo = assertNodeRuntime();

  if (!runtimeInfo.isNodeRuntime) {
    throw new Error('Expected isNodeRuntime to be true.');
  }
  if (runtimeInfo.isEdgeRuntime) {
    throw new Error('Expected isEdgeRuntime to be false.');
  }
  if (!runtimeInfo.features.hasDnsLookup || !runtimeInfo.features.hasNetSocket || !runtimeInfo.features.hasHttpAgent) {
    throw new Error('Missing core Node.js networking primitives (dns, net, http).');
  }

  console.log(`  PASSED: Detected Node.js runtime (${runtimeInfo.nodeVersion}) with full socket & DNS capabilities.`);

  // TEST 2: Verify Edge Runtime simulated environment throws an explicit error
  console.log('\n[TEST 2] Verifying simulated Edge runtime rejection...');
  let edgeCaught = false;

  try {
    // Simulate EdgeRuntime global
    (globalThis as any).EdgeRuntime = 'edge-runtime';
    assertNodeRuntime();
  } catch (err: any) {
    edgeCaught = true;
    if (!err.message.includes('UNSUPPORTED RUNTIME')) {
      throw new Error(`Unexpected error message: ${err.message}`);
    }
  } finally {
    // Clean up simulation
    delete (globalThis as any).EdgeRuntime;
  }

  if (!edgeCaught) {
    throw new Error('Failed to reject simulated Edge runtime!');
  }
  console.log('  PASSED: Edge runtime correctly detected and rejected with explicit error.');

  // TEST 3: Verify NEXT_RUNTIME="edge" simulated environment throws an explicit error
  console.log('\n[TEST 3] Verifying Next.js NEXT_RUNTIME="edge" rejection...');
  let nextEdgeCaught = false;

  const originalNextRuntime = process.env.NEXT_RUNTIME;
  try {
    process.env.NEXT_RUNTIME = 'edge';
    assertNodeRuntime();
  } catch (err: any) {
    nextEdgeCaught = true;
    if (!err.message.includes('UNSUPPORTED RUNTIME')) {
      throw new Error(`Unexpected error message: ${err.message}`);
    }
  } finally {
    if (originalNextRuntime !== undefined) {
      process.env.NEXT_RUNTIME = originalNextRuntime;
    } else {
      delete process.env.NEXT_RUNTIME;
    }
  }

  if (!nextEdgeCaught) {
    throw new Error('Failed to reject simulated NEXT_RUNTIME="edge"!');
  }
  console.log('  PASSED: Next.js NEXT_RUNTIME="edge" correctly detected and rejected.');

  console.log('\n======================================================');
  console.log('ALL PHASE 12 STEP 12.1 TESTS PASSED SUCCESSFULLY (3/3)');
  console.log('======================================================');
}

runRuntimeVerificationTests();
