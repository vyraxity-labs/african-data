import { normalizeUrl, tryNormalizeUrl, isValidUrl, InvalidUrlError } from './url';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function runUrlNormalizationTests() {
  console.log('--- Testing Step 4.1 URL Normalization ---');

  // Test 1: Required cases from implementation guide
  const u1 = normalizeUrl('https://example.com');
  const u2 = normalizeUrl('https://example.com/');
  const u3 = normalizeUrl('HTTPS://EXAMPLE.COM');
  const u4 = normalizeUrl('https://example.com/data');
  const u5 = normalizeUrl('https://example.com/Data');
  const u6 = normalizeUrl('https://example.com/data?id=123');

  console.log(`u1 (https://example.com):       ${u1}`);
  console.log(`u2 (https://example.com/):      ${u2}`);
  console.log(`u3 (HTTPS://EXAMPLE.COM):       ${u3}`);
  console.log(`u4 (https://example.com/data):  ${u4}`);
  console.log(`u5 (https://example.com/Data):  ${u5}`);
  console.log(`u6 (https://example.com/data?id=123): ${u6}`);

  // Canonicalization equivalence assertions:
  assert(u1 === 'https://example.com', 'u1 should normalize to https://example.com');
  assert(u2 === 'https://example.com', 'u2 with trailing slash should normalize to https://example.com');
  assert(u3 === 'https://example.com', 'u3 with uppercase protocol and host should normalize to https://example.com');
  assert(u1 === u2, 'https://example.com and https://example.com/ must normalize to the identical canonical URL');
  assert(u1 === u3, 'https://example.com and HTTPS://EXAMPLE.COM must normalize to the identical canonical URL');
  console.log('✓ Canonical root host equivalence verified (u1 === u2 === u3)');

  // Distinctness assertions:
  assert(u4 === 'https://example.com/data', 'u4 should normalize to https://example.com/data');
  assert(u5 === 'https://example.com/Data', 'u5 should preserve path casing as /Data');
  assert(u4 !== u5, 'CRITICAL: /data and /Data must NOT collapse; case-sensitive path semantics must be preserved!');
  console.log('✓ Path case-sensitivity preserved (/data !== /Data)');

  assert(u6 === 'https://example.com/data?id=123', 'u6 should preserve query parameters as ?id=123');
  assert(u4 !== u6, 'CRITICAL: URL with query parameters must NOT collapse with URL without query parameters!');
  console.log('✓ Query parameters preserved (https://example.com/data !== https://example.com/data?id=123)');

  assert(u1 !== u4, 'Root URL must not collapse with path URL');

  // Test 2: Whitespace trimming
  const withWhitespace = normalizeUrl('   https://example.com/portal/reports   ');
  assert(withWhitespace === 'https://example.com/portal/reports', 'Whitespace should be trimmed');
  console.log('✓ Whitespace trimming verified');

  // Test 3: Trailing slash on subpath
  const subpathWithSlash = normalizeUrl('https://example.com/data/');
  assert(subpathWithSlash === 'https://example.com/data', 'Trailing slash on subpath should be normalized');
  console.log('✓ Subpath trailing slash normalization verified');

  // Test 4: Default port removal
  const defaultPortHttps = normalizeUrl('https://example.com:443/api');
  const defaultPortHttp = normalizeUrl('http://example.com:80/api');
  assert(defaultPortHttps === 'https://example.com/api', 'Default HTTPS port 443 should be omitted');
  assert(defaultPortHttp === 'http://example.com/api', 'Default HTTP port 80 should be omitted');
  console.log('✓ Default port stripping verified');

  // Test 5: Redundant duplicate slashes in pathname
  const duplicateSlashes = normalizeUrl('https://example.com//portal///data');
  assert(duplicateSlashes === 'https://example.com/portal/data', 'Duplicate slashes in pathname should be resolved');
  console.log('✓ Redundant slashes resolved');

  // Test 6: Invalid URLs and error handling
  assert(!isValidUrl('not-a-valid-url'), 'not-a-valid-url should be invalid');
  assert(!isValidUrl('ftp://example.com/file'), 'ftp:// protocol should be invalid');
  assert(!isValidUrl(''), 'empty string should be invalid');

  const resultOk = tryNormalizeUrl('  HTTPS://OPENAFRICA.NET/DATASET/   ');
  assert(resultOk.isValid === true && resultOk.normalizedUrl === 'https://openafrica.net/DATASET', 'tryNormalizeUrl on valid URL');

  const resultErr = tryNormalizeUrl('invalid://bad');
  assert(resultErr.isValid === false && resultErr.normalizedUrl === null && !!resultErr.error, 'tryNormalizeUrl on invalid protocol');
  console.log('✓ Validation and tryNormalizeUrl error handling verified');

  console.log('All URL normalization tests PASSED successfully!');
}

try {
  runUrlNormalizationTests();
  process.exit(0);
} catch (error) {
  console.error('URL normalization tests FAILED:', error);
  process.exit(1);
}
