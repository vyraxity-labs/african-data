import { PerHostConcurrencyLimiter } from './concurrency';

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runConcurrencyTests() {
  console.log('--- PHASE 12 STEP 12.6: PER-HOST CONCURRENCY LIMITING TESTS ---');

  // TEST 1: Multiple links to SAME host executed with MAX_CONCURRENT_PER_HOST = 1
  console.log('\n[TEST 1] Testing strict serialization for same host (maxConcurrentPerHost = 1)...');
  const limiter1 = new PerHostConcurrencyLimiter({ maxConcurrentPerHost: 1, globalMaxConcurrency: 10 });

  const sameHostTarget = 'https://statssa.gov.za';
  let sameHostMaxActiveObserved = 0;
  let sameHostCurrentlyActive = 0;
  const executionOrder: number[] = [];

  const tasksForSameHost = [1, 2, 3, 4, 5].map((id) =>
    limiter1.schedule(sameHostTarget, async () => {
      sameHostCurrentlyActive++;
      sameHostMaxActiveObserved = Math.max(sameHostMaxActiveObserved, sameHostCurrentlyActive);
      await sleep(50); // Simulate network latency
      executionOrder.push(id);
      sameHostCurrentlyActive--;
      return `Result ${id}`;
    })
  );

  const results1 = await Promise.all(tasksForSameHost);

  if (sameHostMaxActiveObserved !== 1) {
    throw new Error(`Expected max concurrent to be 1 for same host, observed: ${sameHostMaxActiveObserved}`);
  }
  if (results1.length !== 5 || executionOrder.length !== 5) {
    throw new Error('Not all tasks finished successfully.');
  }
  console.log(`  PASSED: 5 links to statssa.gov.za executed with max concurrent = 1 (Observed: ${sameHostMaxActiveObserved}).`);

  // TEST 2: Different hosts executed concurrently (global concurrency)
  console.log('\n[TEST 2] Testing concurrent execution across different hosts...');
  const limiter2 = new PerHostConcurrencyLimiter({ maxConcurrentPerHost: 1, globalMaxConcurrency: 5 });

  const differentHosts = [
    'https://statssa.gov.za/data1',
    'https://worldbank.org/data1',
    'https://africacdc.org/data1',
    'https://knbs.or.ke/data1',
  ];

  let crossHostMaxActiveObserved = 0;
  let crossHostCurrentlyActive = 0;

  const tasksForDifferentHosts = differentHosts.map((url) =>
    limiter2.schedule(url, async () => {
      crossHostCurrentlyActive++;
      crossHostMaxActiveObserved = Math.max(crossHostMaxActiveObserved, crossHostCurrentlyActive);
      await sleep(60);
      crossHostCurrentlyActive--;
      return url;
    })
  );

  await Promise.all(tasksForDifferentHosts);

  // Since all 4 are different hosts and global limit is 5, all 4 should run concurrently
  if (crossHostMaxActiveObserved < 2) {
    throw new Error(`Expected concurrent execution across different hosts, observed: ${crossHostMaxActiveObserved}`);
  }
  console.log(`  PASSED: 4 distinct hosts executed concurrently (Peak simultaneous active: ${crossHostMaxActiveObserved}).`);

  // TEST 3: Configurable per-host limit (e.g. maxConcurrentPerHost = 2)
  console.log('\n[TEST 3] Testing custom per-host concurrency threshold (maxConcurrentPerHost = 2)...');
  const limiter3 = new PerHostConcurrencyLimiter({ maxConcurrentPerHost: 2, globalMaxConcurrency: 10 });

  let customMaxActiveObserved = 0;
  let customCurrentlyActive = 0;

  const tasksCustom = [1, 2, 3, 4].map((id) =>
    limiter3.schedule('https://bceao.int', async () => {
      customCurrentlyActive++;
      customMaxActiveObserved = Math.max(customMaxActiveObserved, customCurrentlyActive);
      await sleep(50);
      customCurrentlyActive--;
      return id;
    })
  );

  await Promise.all(tasksCustom);

  if (customMaxActiveObserved > 2) {
    throw new Error(`Exceeded configured per-host limit: observed ${customMaxActiveObserved}`);
  }
  console.log(`  PASSED: Per-host limit respected with maxConcurrentPerHost = 2 (Observed: ${customMaxActiveObserved}).`);

  // TEST 4: Error resilience (Failed task does not stall the queue for that host)
  console.log('\n[TEST 4] Testing error resilience in host queue...');
  let taskAfterErrorRan = false;

  const failTask = limiter1.schedule('https://example.com', async () => {
    throw new Error('Simulated network timeout');
  }).catch(() => 'Caught expected error');

  const succeedTask = limiter1.schedule('https://example.com', async () => {
    taskAfterErrorRan = true;
    return 'OK';
  });

  const [resFail, resSuccess] = await Promise.all([failTask, succeedTask]);

  if (!taskAfterErrorRan || resSuccess !== 'OK') {
    throw new Error('Subsequent task was blocked by prior error in host queue.');
  }
  console.log('  PASSED: Host queue recovered immediately after error and processed subsequent tasks.');

  console.log('\n======================================================');
  console.log('ALL PHASE 12 STEP 12.6 TESTS PASSED SUCCESSFULLY (4/4)');
  console.log('======================================================');
}

runConcurrencyTests();
