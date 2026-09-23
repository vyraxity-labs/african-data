import { prisma } from '../client'
import { parseCsv } from './csv-parser'
import { normalizeCsvRecords } from './csv-normalizer'
import type {
  ImportPreviewReport,
  ValidateImportOptions,
  DuplicateDetectionResult,
  InvalidUrlDetail,
  MissingFieldDetail,
  UnknownValueDetail,
} from './types'

/**
 * Produces an in-memory pre-import validation and preview report.
 * GUARANTEE: Performs ZERO database writes. Only read-only queries may be performed.
 */
export async function generateImportPreview(
  content: string | Buffer,
  options: ValidateImportOptions = {},
): Promise<ImportPreviewReport> {
  const checkDb = options.checkDatabaseDuplicates ?? true

  // 1. Parse CSV
  const parseResult = parseCsv(content)

  const potentialDuplicates: DuplicateDetectionResult[] = []
  const invalidUrls: InvalidUrlDetail[] = []
  const missingFields: MissingFieldDetail[] = []
  const unknownValues: UnknownValueDetail[] = []

  // Record fatal parse errors (header mismatch, malformed rows) as missing fields or syntax errors
  if (parseResult.errors.length > 0) {
    for (const err of parseResult.errors) {
      if (err.code === 'MISSING_COLUMN') {
        missingFields.push({
          row: err.row,
          field: err.column || 'Header',
          message: err.message,
        })
      } else if (
        err.code === 'INVALID_FIELD_COUNT' ||
        err.code === 'MALFORMED_RECORD'
      ) {
        missingFields.push({
          row: err.row,
          field: 'Row Structure',
          message: err.message,
        })
      }
    }
  }

  // 2. Normalize records
  const normalizationResult = normalizeCsvRecords(parseResult.records)
  const records = normalizationResult.records

  // Collect unknown values from normalizer
  for (const u of normalizationResult.unknownValues) {
    unknownValues.push({
      row: u.row,
      field: u.field,
      rawValue: u.rawValue,
      message: u.message,
    })
  }

  // Optional: Read existing database resources for cross-database duplicate check (READ-ONLY)
  const existingDbUrls = new Set<string>()
  const existingDbNames = new Map<string, string>()

  if (checkDb) {
    try {
      const existingResources = await prisma.resource.findMany({
        select: {
          id: true,
          name: true,
          links: {
            select: {
              url: true,
            },
          },
        },
      })

      for (const res of existingResources) {
        existingDbNames.set(res.name.toLowerCase().trim(), res.id)
        for (const link of res.links) {
          existingDbUrls.add(link.url.toLowerCase().trim())
        }
      }
    } catch {
      // If DB is offline or table empty, continue with intra-batch duplicate detection only
    }
  }

  // Maps to track duplicates within the current import batch
  const seenUrlsInBatch = new Map<string, number>() // normalizedUrl -> row
  const seenNamesInBatch = new Map<string, number>() // lowercase name -> row

  const invalidRowSet = new Set<number>()

  // 3. Inspect each record
  for (const record of records) {
    const row = record._rowNumber
    let hasFatalError = false

    // A. Check required fields
    if (!record.name || record.name.trim() === '') {
      missingFields.push({
        row,
        field: 'Source Name',
        message: 'Source Name is required and cannot be empty.',
      })
      hasFatalError = true
    }

    if (!record.dataLink.raw || record.dataLink.raw.trim() === '') {
      missingFields.push({
        row,
        field: 'Data Link',
        message: 'Data Link is required and cannot be empty.',
      })
      hasFatalError = true
    }

    // B. Check URL validity
    if (!record.dataLink.isValid) {
      invalidUrls.push({
        row,
        field: 'Data Link',
        url: record.dataLink.raw,
        reason: 'Malformed or invalid URL syntax according to RFC standard.',
      })
      hasFatalError = true
    }

    if (record.sourceWebsite && !record.sourceWebsite.isValid) {
      invalidUrls.push({
        row,
        field: 'Source Website',
        url: record.sourceWebsite.raw,
        reason: 'Malformed or invalid URL syntax according to RFC standard.',
      })
      hasFatalError = true
    }

    // C. Check potential duplicates
    const urlKey = (record.dataLink.normalized || record.dataLink.raw)
      .toLowerCase()
      .trim()
    const nameKey = record.name.toLowerCase().trim()

    // 1) Intra-batch duplicate check by URL
    if (seenUrlsInBatch.has(urlKey)) {
      const originalRow = seenUrlsInBatch.get(urlKey)
      potentialDuplicates.push({
        row,
        sourceName: record.name,
        url: record.dataLink.raw,
        matchedOn: 'NORMALIZED_URL',
        duplicateOfRow: originalRow,
        message: `Duplicate URL matches row ${originalRow} in this batch: "${record.dataLink.raw}".`,
      })
      hasFatalError = true
    } else if (urlKey) {
      seenUrlsInBatch.set(urlKey, row)
    }

    // 2) Intra-batch duplicate check by Name
    if (seenNamesInBatch.has(nameKey) && nameKey) {
      const originalRow = seenNamesInBatch.get(nameKey)
      // If not already flagged by URL
      if (!seenUrlsInBatch.has(urlKey) || seenUrlsInBatch.get(urlKey) === row) {
        potentialDuplicates.push({
          row,
          sourceName: record.name,
          url: record.dataLink.raw,
          matchedOn: 'EXACT_NAME',
          duplicateOfRow: originalRow,
          message: `Identical Source Name matches row ${originalRow} in this batch: "${record.name}".`,
        })
      }
    } else if (nameKey) {
      seenNamesInBatch.set(nameKey, row)
    }

    // 3) Existing database duplicate check
    if (checkDb && urlKey && existingDbUrls.has(urlKey)) {
      potentialDuplicates.push({
        row,
        sourceName: record.name,
        url: record.dataLink.raw,
        matchedOn: 'EXACT_URL',
        duplicateInDatabase: true,
        message: `URL already exists in database: "${record.dataLink.raw}".`,
      })
      hasFatalError = true
    } else if (checkDb && nameKey && existingDbNames.has(nameKey)) {
      const existingId = existingDbNames.get(nameKey)
      potentialDuplicates.push({
        row,
        sourceName: record.name,
        url: record.dataLink.raw,
        matchedOn: 'EXACT_NAME',
        duplicateInDatabase: true,
        existingResourceId: existingId,
        message: `Resource with identical name already exists in database: "${record.name}".`,
      })
    }

    if (hasFatalError) {
      invalidRowSet.add(row)
    }
  }

  // Rows flagged by parse errors (like missing columns in row) are also invalid
  for (const err of parseResult.errors) {
    if (err.row > 1) {
      invalidRowSet.add(err.row)
    }
  }

  const validRows: number[] = []
  for (const record of records) {
    if (!invalidRowSet.has(record._rowNumber)) {
      validRows.push(record._rowNumber)
    }
  }

  const totalRows = parseResult.totalRows
  const validCount = validRows.length
  const potentialDuplicatesCount = potentialDuplicates.length
  const invalidUrlsCount = invalidUrls.length
  const missingFieldsCount = missingFields.length
  const unknownValuesCount = unknownValues.length

  const formattedSummary = [
    `${totalRows} rows`,
    '',
    `Valid: ${validCount}`,
    `Potential duplicates: ${potentialDuplicatesCount}`,
    `Invalid URLs: ${invalidUrlsCount}`,
    `Missing fields: ${missingFieldsCount}`,
    `Unknown values: ${unknownValuesCount}`,
  ].join('\n')

  return {
    totalRows,
    validCount,
    potentialDuplicatesCount,
    invalidUrlsCount,
    missingFieldsCount,
    unknownValuesCount,
    validRows,
    potentialDuplicates,
    invalidUrls,
    missingFields,
    unknownValues,
    records,
    generatedAt: new Date().toISOString(),
    formattedSummary,
  }
}
