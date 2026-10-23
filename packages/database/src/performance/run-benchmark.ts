import { seedSyntheticScaleData } from './synthetic-data-generator';
import { runPerformanceBenchmarkSuite, BenchmarkResult } from './benchmark-suite';

function formatTable(results: BenchmarkResult[]): string {
  const headers = ['Category', 'Benchmark Workload', 'Records', 'p50 (ms)', 'p95 (ms)', 'Avg (ms)', 'SLA (ms)', 'Status'];
  const colWidths = [15, 38, 9, 10, 10, 10, 10, 8];

  const pad = (str: string, width: number, alignLeft = true) => {
    const s = String(str);
    if (s.length >= width) return s.slice(0, width);
    return alignLeft ? s + ' '.repeat(width - s.length) : ' '.repeat(width - s.length) + s;
  };

  const separator = '+' + colWidths.map((w) => '-'.repeat(w + 2)).join('+') + '+';
  const headerRow = '| ' + headers.map((h, i) => pad(h, colWidths[i]!)).join(' | ') + ' |';

  const rows = results.map((r) => {
    return (
      '| ' +
      [
        pad(r.category, colWidths[0]!),
        pad(r.name, colWidths[1]!),
        pad(String(r.totalRecordsMatched), colWidths[2]!, false),
        pad(r.p50Ms.toFixed(1), colWidths[3]!, false),
        pad(r.p95Ms.toFixed(1), colWidths[4]!, false),
        pad(r.avgMs.toFixed(1), colWidths[5]!, false),
        pad(String(r.targetSlaMs), colWidths[6]!, false),
        pad(r.passedSla ? '✅ PASS' : '❌ FAIL', colWidths[7]!),
      ].join(' | ') +
      ' |'
    );
  });

  return [separator, headerRow, separator, ...rows, separator].join('\n');
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       AFRICAN DATA PLATFORM — PHASE 20 PERFORMANCE SUITE      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Step 1: Ensure 10,000 resources and 50,000 links
  const seedStats = await seedSyntheticScaleData(10000, 5);

  // Step 2: Run benchmark suite
  const suite = await runPerformanceBenchmarkSuite();

  // Step 3: Print formatted table
  console.log('\n📈 BENCHMARK RESULTS MATRIX:');
  console.log(formatTable(suite.results));

  // Step 4: Summary statistics
  console.log('\n📊 SCALE & SLA SUMMARY:');
  console.log(`   - Scale:           ${suite.datasetScale.resourcesCount.toLocaleString()} resources, ${suite.datasetScale.linksCount.toLocaleString()} links, ${suite.datasetScale.institutionsCount.toLocaleString()} institutions`);
  console.log(`   - Workloads Run:   ${suite.totalWorkloads}`);
  console.log(`   - Passed SLAs:     ${suite.passedWorkloads} / ${suite.totalWorkloads} (${((suite.passedWorkloads / suite.totalWorkloads) * 100).toFixed(0)}%)`);

  // Step 5: Architectural Verdict
  console.log('\n🏛️ ARCHITECTURAL VERDICT (Section 20 Protocol):');
  if (suite.verdict === 'POSTGRES_HIGH_PERFORMANCE_SUFFICIENT') {
    console.log('   ✅ PostgreSQL is DEMONSTRABLY SUFFICIENT at scale.');
    console.log('   ✅ All measured p95 query latencies are well below required SLA targets.');
    console.log('   ✅ Per Phase 20 rule ("Only introduce Elasticsearch/Redis/etc. if PostgreSQL is demonstrably insufficient"):');
    console.log('      No auxiliary search engine (Elasticsearch) or external cache (Redis) is required.');
    console.log('      PostgreSQL handles search, multi-faceted filtering, deep pagination, link-health aggregates,');
    console.log('      and atomic locking efficiently using existing B-Tree indexes.');
  } else {
    console.log('   ⚠️ PostgreSQL performance showed bottlenecks on some queries. Consider targeted indexing optimizations.');
  }

  console.log('\n💡 RECOMMENDATIONS:');
  for (const rec of suite.recommendations) {
    console.log(`   • ${rec}`);
  }

  console.log('\n════════════════════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('Fatal benchmark error:', err);
  process.exit(1);
});
