import fs from 'node:fs'
import path from 'node:path'
import { parseCsv } from './import/csv-parser'

async function runCsvParserTests() {
  console.log('--- Testing Step 7.2 CSV Parser ---')

  // Test 1: Empty CSV content
  console.log('\n[1] Testing empty content...')
  const emptyRes = parseCsv('')
  const firstEmptyErr = emptyRes.errors[0]
  if (
    emptyRes.success ||
    !firstEmptyErr ||
    firstEmptyErr.code !== 'EMPTY_FILE'
  ) {
    throw new Error('Test 1 failed: Expected EMPTY_FILE error')
  }
  if (firstEmptyErr.row !== 1) {
    throw new Error(
      `Test 1 failed: Expected row 1 in error, got ${firstEmptyErr.row}`,
    )
  }
  console.log('✓ Empty content correctly reports error at row 1.')

  // Test 2: Missing columns in header
  console.log('\n[2] Testing missing columns in header...')
  const missingHeaderRes = parseCsv(
    'S/N,Source Name,Data Link\n1,Test,https://example.com',
  )
  if (
    missingHeaderRes.success ||
    !missingHeaderRes.errors.some((e) => e.code === 'MISSING_COLUMN')
  ) {
    throw new Error('Test 2 failed: Expected MISSING_COLUMN error')
  }
  if (!missingHeaderRes.errors.every((e) => e.row === 1)) {
    throw new Error('Test 2 failed: Header errors must report row 1')
  }
  console.log(
    `✓ Header missing columns correctly flagged at row 1 (${missingHeaderRes.errors.length} missing columns).`,
  )

  // Test 3: Unexpected columns in header
  console.log('\n[3] Testing unexpected columns in header...')
  const invalidHeaderCsv =
    'S/N,Source Name,Data Link,Source Website,Country / Coverage,Link Description,Source Type,Industry,Institution Name,Available Formats,Access Type,Update Frequency,Last Updated (latest data seen),Notes,Category,Data Granularity,Language,API Available,Link Status,Priority for Platform,UnexpectedExtraCol\n' +
    '1,A,https://a.com,https://a.com,Africa,Desc,Type,Ind,Inst,PDF,Free,Annual,2026,Note,Cat,Gran,Lang,No,Live,High,ExtraVal'
  const unexpectedHeaderRes = parseCsv(invalidHeaderCsv)
  if (
    unexpectedHeaderRes.success ||
    !unexpectedHeaderRes.errors.some(
      (e) =>
        e.code === 'UNEXPECTED_COLUMN' && e.column === 'UnexpectedExtraCol',
    )
  ) {
    throw new Error(
      'Test 3 failed: Expected UNEXPECTED_COLUMN error for UnexpectedExtraCol',
    )
  }
  console.log('✓ Unexpected column correctly rejected at row 1.')

  // Test 4: Quoted values, commas inside values, and whitespace trimming
  console.log(
    '\n[4] Testing quoted values with commas, quotes, and whitespace...',
  )
  const validCsv =
    'S/N,Source Name,Data Link,Source Website,Country / Coverage,Link Description,Source Type,Industry,Institution Name,Available Formats,Access Type,Update Frequency,Last Updated (latest data seen),Notes,Category,Data Granularity,Language,API Available,Link Status,Priority for Platform\n' +
    ' 1 , "AfCFTA Secretariat" , https://au-afcfta.org/ , https://au-afcfta.org/ , "Africa (AfCFTA state parties)" , "Portal with agreement texts, tariff offers." , Continental body , Trade , "AfCFTA Secretariat" , "PDF, Online, Excel" , Free access , Continuous , 2024 , "The record of AfCFTA." , Pan-African Source , Country-level , English and French , No , Live , High \n' +
    '2,Africa CDC,https://africacdc.org/,https://africacdc.org/,Africa,"Health security data, including COVID-19.",International,Health,CDC,"PDF, Online",Free access,Weekly,2026,"Key series.",Pan-African Source,Country-level,English and French,No,Live,High'

  const validRes = parseCsv(validCsv)
  if (!validRes.success || validRes.records.length !== 2) {
    throw new Error(
      `Test 4 failed: Expected 2 valid records, got ${validRes.records.length}. Errors: ${JSON.stringify(validRes.errors)}`,
    )
  }
  const first = validRes.records[0]
  if (!first) {
    throw new Error('Test 4 failed: Record 0 is undefined')
  }
  if (first.sourceName !== 'AfCFTA Secretariat') {
    throw new Error(
      `Test 4 failed: sourceName expected "AfCFTA Secretariat", got "${first.sourceName}"`,
    )
  }
  if (first.availableFormats !== 'PDF, Online, Excel') {
    throw new Error(
      `Test 4 failed: availableFormats expected "PDF, Online, Excel", got "${first.availableFormats}"`,
    )
  }
  if (first.countryCoverage !== 'Africa (AfCFTA state parties)') {
    throw new Error(
      `Test 4 failed: countryCoverage expected "Africa (AfCFTA state parties)", got "${first.countryCoverage}"`,
    )
  }
  if (first._rowNumber !== 2) {
    throw new Error(
      `Test 4 failed: Expected _rowNumber to be 2, got ${first._rowNumber}`,
    )
  }
  console.log(
    '✓ Quoted values with embedded commas and whitespace parsed cleanly with row numbers.',
  )

  // Test 5: Malformed record (unmatched quote or wrong column count) with row number
  console.log('\n[5] Testing malformed records with exact row reporting...')
  const malformedRowCountCsv =
    'S/N,Source Name,Data Link,Source Website,Country / Coverage,Link Description,Source Type,Industry,Institution Name,Available Formats,Access Type,Update Frequency,Last Updated (latest data seen),Notes,Category,Data Granularity,Language,API Available,Link Status,Priority for Platform\n' +
    '1,Valid Row,https://a.com,https://a.com,Africa,Desc,Type,Ind,Inst,PDF,Free,Annual,2026,Note,Cat,Gran,Lang,No,Live,High\n' +
    '2,Short Row,https://b.com\n' + // Row 3 in file (missing columns)
    '3,Another Valid Row,https://c.com,https://c.com,Africa,Desc,Type,Ind,Inst,PDF,Free,Annual,2026,Note,Cat,Gran,Lang,No,Live,High'

  const rowCountRes = parseCsv(malformedRowCountCsv)
  if (rowCountRes.success) {
    throw new Error(
      'Test 5 failed: Expected parsing failure on invalid row column count',
    )
  }
  const row3Error = rowCountRes.errors.find((e) => e.row === 3)
  if (!row3Error || row3Error.code !== 'INVALID_FIELD_COUNT') {
    throw new Error(
      `Test 5 failed: Expected INVALID_FIELD_COUNT at row 3, got ${JSON.stringify(rowCountRes.errors)}`,
    )
  }
  if (rowCountRes.validRows !== 2 || rowCountRes.invalidRows !== 1) {
    throw new Error(
      `Test 5 failed: Expected 2 valid and 1 invalid row, got ${rowCountRes.validRows} valid and ${rowCountRes.invalidRows} invalid`,
    )
  }
  console.log(
    `✓ Row count mismatch correctly flagged with row number ${row3Error.row}: "${row3Error.message}"`,
  )

  // Test 6: Parse development sample fixture file
  console.log(
    '\n[6] Parsing development sample fixture (fixtures/sample-data-sources.csv)...',
  )
  const fixturePath = path.resolve(
    __dirname,
    '../../../fixtures/sample-data-sources.csv',
  )
  const fixtureContent = fs.readFileSync(fixturePath, 'utf-8')
  const fixtureRes = parseCsv(fixtureContent)

  if (!fixtureRes.success || fixtureRes.records.length !== 10) {
    throw new Error(
      `Test 6 failed: Fixture parsing failed: ${JSON.stringify(fixtureRes.errors)}`,
    )
  }
  console.log(
    `✓ Successfully parsed all ${fixtureRes.records.length} fixture rows with 0 errors!`,
  )

  // Test 7: Parse full production dataset (read-only verification)
  console.log('\n[7] Parsing full production dataset (african_csv_data.csv)...')
  const prodCsvPath = path.resolve(__dirname, '../../../african_csv_data.csv')
  if (fs.existsSync(prodCsvPath)) {
    const prodContent = fs.readFileSync(prodCsvPath, 'utf-8')
    const prodRes = parseCsv(prodContent)

    console.log(`Production CSV Parse Summary:`)
    console.log(`  Total data rows: ${prodRes.totalRows}`)
    console.log(`  Valid rows: ${prodRes.validRows}`)
    console.log(`  Errors: ${prodRes.errors.length}`)

    if (prodRes.errors.length > 0) {
      console.log('Sample errors encountered:')
      prodRes.errors.slice(0, 5).forEach((e) => {
        console.log(`  Row ${e.row}: [${e.code}] ${e.message}`)
      })
    }
  }

  console.log('\nAll CSV parser tests PASSED successfully!')
}

runCsvParserTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('CSV Parser testing failed:', err)
    process.exit(1)
  })
