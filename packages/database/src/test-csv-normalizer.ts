import fs from 'node:fs'
import path from 'node:path'
import { parseCsv } from './import/csv-parser'
import {
  normalizeCsvRecord,
  normalizeCsvRecords,
  normalizeFormats,
  normalizeLanguage,
  normalizeCoverage,
  normalizeApiAvailable,
  normalizeAccessType,
  normalizePriority,
  NormalizationWarning,
} from './import/csv-normalizer'

async function runNormalizerTests() {
  console.log('--- Testing Step 7.3 CSV Normalizer ---')

  // Test 1: Available Formats normalization
  console.log('\n[1] Testing Available Formats normalization...')
  const unknowns1: NormalizationWarning[] = []
  const formats1 = normalizeFormats('PDF, Online, Excel', 2, unknowns1)
  if (
    !formats1.includes('PDF') ||
    !formats1.includes('ONLINE') ||
    !formats1.includes('EXCEL')
  ) {
    throw new Error(
      `Test 1 failed: Expected PDF, ONLINE, EXCEL, got ${formats1.join(', ')}`,
    )
  }
  if (unknowns1.length !== 0) {
    throw new Error(
      `Test 1 failed: Expected 0 unknowns, got ${unknowns1.length}`,
    )
  }
  console.log(`✓ "PDF, Online, Excel" -> [${formats1.join(', ')}]`)

  // Test 2: Language normalization
  console.log('\n[2] Testing Language normalization...')
  const unknowns2: NormalizationWarning[] = []
  const langBoth = normalizeLanguage('English and French', 2, unknowns2)
  const langEn = normalizeLanguage('English', 3, unknowns2)
  if (
    langBoth.length !== 2 ||
    !langBoth.includes('en') ||
    !langBoth.includes('fr')
  ) {
    throw new Error(
      `Test 2 failed: Expected ['en', 'fr'], got ${JSON.stringify(langBoth)}`,
    )
  }
  if (langEn.length !== 1 || langEn[0] !== 'en') {
    throw new Error(
      `Test 2 failed: Expected ['en'], got ${JSON.stringify(langEn)}`,
    )
  }
  console.log(
    `✓ "English and French" -> [${langBoth.join(', ')}]; "English" -> [${langEn.join(', ')}]`,
  )

  // Test 3: Coverage normalization
  console.log('\n[3] Testing Country / Coverage normalization...')
  const unknowns3: NormalizationWarning[] = []
  const covPan = normalizeCoverage('Africa (54 countries)', 2, unknowns3)
  const covGlobal = normalizeCoverage(
    'Global (deep Africa coverage)',
    3,
    unknowns3,
  )
  const covReg = normalizeCoverage(
    'East Africa (Kenya, Tanzania, Uganda)',
    4,
    unknowns3,
  )
  const covNat = normalizeCoverage('Nigeria', 5, unknowns3)

  if (covPan.scope !== 'PAN_AFRICAN')
    throw new Error(`Expected PAN_AFRICAN, got ${covPan.scope}`)
  if (covGlobal.scope !== 'GLOBAL')
    throw new Error(`Expected GLOBAL, got ${covGlobal.scope}`)
  if (covReg.scope !== 'REGIONAL' || !covReg.regions.includes('East Africa')) {
    throw new Error(
      `Expected REGIONAL with East Africa, got ${JSON.stringify(covReg)}`,
    )
  }
  if (covNat.scope !== 'NATIONAL' || !covNat.countries.includes('NG')) {
    throw new Error(`Expected NATIONAL with NG, got ${JSON.stringify(covNat)}`)
  }
  console.log(
    '✓ Coverage correctly categorized into PAN_AFRICAN, GLOBAL, REGIONAL, NATIONAL.',
  )

  // Test 4: API Available, Access Type, Priority
  console.log('\n[4] Testing API Available, Access Type, and Priority...')
  const unknowns4: NormalizationWarning[] = []
  if (!normalizeApiAvailable('Yes', 2, unknowns4))
    throw new Error('Expected true for Yes')
  if (normalizeApiAvailable('No', 2, unknowns4))
    throw new Error('Expected false for No')

  const accessFree = normalizeAccessType('Free access', 2, unknowns4)
  const accessSignup = normalizeAccessType(
    'Free but requires signup',
    3,
    unknowns4,
  )
  const accessPartial = normalizeAccessType('Partial free access', 4, unknowns4)
  if (
    accessFree !== 'FREE' ||
    accessSignup !== 'FREE_WITH_SIGNUP' ||
    accessPartial !== 'PARTIAL'
  ) {
    throw new Error(
      `Access type mismatch: ${accessFree}, ${accessSignup}, ${accessPartial}`,
    )
  }

  const prioHigh = normalizePriority('High', 2, unknowns4)
  const prioMedHigh = normalizePriority('Medium-High', 3, unknowns4)
  if (prioHigh !== 'HIGH' || prioMedHigh !== 'MEDIUM_HIGH') {
    throw new Error(`Priority mismatch: ${prioHigh}, ${prioMedHigh}`)
  }
  console.log(
    '✓ API Available, Access Type, and Priority normalized as expected.',
  )

  // Test 5: Defensive unknown value reporting
  console.log('\n[5] Testing defensive unknown value handling...')
  const unknownMockRow = {
    sn: '999',
    sourceName: 'Experimental Source',
    dataLink: 'https://experimental.org',
    sourceWebsite: 'https://experimental.org',
    countryCoverage: 'Martian Territory',
    linkDescription: 'Unknown test',
    sourceType: 'Experimental',
    industry: 'Sci-Fi',
    institutionName: 'Unknown Corp',
    availableFormats: 'QUANTUM_STREAM, PDF',
    accessType: 'Blockchain DAO Staking',
    updateFrequency: 'Nanosecond',
    lastUpdated: '3026',
    notes: 'None',
    category: 'Other',
    dataGranularity: 'Quantum',
    language: 'Elvish',
    apiAvailable: 'Sometimes',
    linkStatus: 'Live',
    priority: 'Super-Urgent-Tier',
    _rowNumber: 42,
  }

  const unknownRes = normalizeCsvRecord(unknownMockRow)
  if (unknownRes.unknownValues.length === 0) {
    throw new Error('Test 5 failed: Expected unknown values to be flagged')
  }

  const flaggedFields = unknownRes.unknownValues.map((u) => u.field)
  console.log(
    `✓ Defensive normalizer flagged ${unknownRes.unknownValues.length} unknown fields at row 42:`,
  )
  unknownRes.unknownValues.forEach((u) => {
    console.log(`   - Row ${u.row} [${u.field}]: ${u.message}`)
  })

  if (
    !flaggedFields.includes('Available Formats') ||
    !flaggedFields.includes('Language') ||
    !flaggedFields.includes('Country / Coverage') ||
    !flaggedFields.includes('API Available') ||
    !flaggedFields.includes('Access Type') ||
    !flaggedFields.includes('Priority for Platform')
  ) {
    throw new Error(
      `Test 5 failed: Did not flag all unknown fields: ${flaggedFields.join(', ')}`,
    )
  }

  // Original raw data preserved
  if (unknownRes.normalized.raw.sourceName !== 'Experimental Source') {
    throw new Error('Raw record was not preserved intact')
  }
  if (unknownRes.normalized.metadata.original === undefined) {
    throw new Error('Original metadata payload was not preserved')
  }
  console.log(
    '✓ Original raw data preserved in both .raw and .metadata.original',
  )

  // Test 6: Normalize sample fixture file
  console.log(
    '\n[6] Normalizing development sample fixture (fixtures/sample-data-sources.csv)...',
  )
  const fixturePath = path.resolve(
    __dirname,
    '../../../fixtures/sample-data-sources.csv',
  )
  const fixtureContent = fs.readFileSync(fixturePath, 'utf-8')
  const parsedFixture = parseCsv(fixtureContent)

  const normalizedFixture = normalizeCsvRecords(parsedFixture.records)
  if (normalizedFixture.records.length !== 10) {
    throw new Error(
      `Expected 10 normalized fixture records, got ${normalizedFixture.records.length}`,
    )
  }
  console.log(
    `✓ Normalized 10 fixture records. Warnings: ${normalizedFixture.warnings.length}, Unknown values: ${normalizedFixture.unknownValues.length}`,
  )

  // Test 7: End-to-end normalization of full production dataset
  console.log(
    '\n[7] Normalizing full production dataset (african_csv_data.csv)...',
  )
  const prodCsvPath = path.resolve(__dirname, '../../../african_csv_data.csv')
  if (fs.existsSync(prodCsvPath)) {
    const prodContent = fs.readFileSync(prodCsvPath, 'utf-8')
    const parsedProd = parseCsv(prodContent)
    const normalizedProd = normalizeCsvRecords(parsedProd.records)

    console.log(`Production Dataset Normalization Summary:`)
    console.log(`  Total records processed: ${normalizedProd.totalRecords}`)
    console.log(
      `  Invalid/Unparseable URL warnings: ${normalizedProd.warnings.length}`,
    )
    console.log(
      `  Unknown values flagged: ${normalizedProd.unknownValues.length}`,
    )

    if (normalizedProd.unknownValues.length > 0) {
      console.log('Sample unknown values found in dataset:')
      normalizedProd.unknownValues.slice(0, 5).forEach((u) => {
        console.log(`  Row ${u.row} [${u.field}]: ${u.rawValue}`)
      })
    }
  }

  console.log('\nAll CSV normalizer tests PASSED successfully!')
}

runNormalizerTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('CSV Normalizer testing failed:', err)
    process.exit(1)
  })
