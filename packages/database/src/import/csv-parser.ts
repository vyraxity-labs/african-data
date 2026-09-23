import { parse } from 'csv-parse/sync'

export const CANONICAL_HEADERS = [
  'S/N',
  'Source Name',
  'Data Link',
  'Source Website',
  'Country / Coverage',
  'Link Description',
  'Source Type',
  'Industry',
  'Institution Name',
  'Available Formats',
  'Access Type',
  'Update Frequency',
  'Last Updated (latest data seen)',
  'Notes',
  'Category',
  'Data Granularity',
  'Language',
  'API Available',
  'Link Status',
  'Priority for Platform',
] as const

export type CanonicalHeader = (typeof CANONICAL_HEADERS)[number]

export interface CsvRawRecord {
  sn: string
  sourceName: string
  dataLink: string
  sourceWebsite: string
  countryCoverage: string
  linkDescription: string
  sourceType: string
  industry: string
  institutionName: string
  availableFormats: string
  accessType: string
  updateFrequency: string
  lastUpdated: string
  notes: string
  category: string
  dataGranularity: string
  language: string
  apiAvailable: string
  linkStatus: string
  priority: string
  _rowNumber: number
}

export type CsvErrorCode =
  | 'EMPTY_FILE'
  | 'HEADER_MISMATCH'
  | 'MISSING_COLUMN'
  | 'UNEXPECTED_COLUMN'
  | 'MALFORMED_RECORD'
  | 'INVALID_FIELD_COUNT'

export interface CsvParseError {
  row: number
  column?: string
  code: CsvErrorCode
  message: string
}

export interface CsvParseResult {
  success: boolean
  records: CsvRawRecord[]
  errors: CsvParseError[]
  totalRows: number
  validRows: number
  invalidRows: number
}

export interface CsvParserOptions {
  strictColumns?: boolean // default true
  skipEmptyLines?: boolean // default true
}

export function parseCsv(
  content: string | Buffer,
  options: CsvParserOptions = {},
): CsvParseResult {
  const text = typeof content === 'string' ? content : content.toString('utf-8')
  const strictColumns = options.strictColumns ?? true

  const errors: CsvParseError[] = []
  const records: CsvRawRecord[] = []

  if (!text || text.trim().length === 0) {
    return {
      success: false,
      records: [],
      errors: [
        {
          row: 1,
          code: 'EMPTY_FILE',
          message: 'The provided CSV file is empty.',
        },
      ],
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
    }
  }

  // First pass: extract raw rows using csv-parse
  let rawRows: string[][]
  try {
    rawRows = parse(text, {
      relax_column_count: true,
      skip_empty_lines: options.skipEmptyLines ?? true,
      trim: true,
    })
  } catch (err: unknown) {
    const error = err as { message?: string; line?: number }
    return {
      success: false,
      records: [],
      errors: [
        {
          row: error.line ?? 1,
          code: 'MALFORMED_RECORD',
          message:
            error.message ||
            'Malformed CSV content or invalid quote encapsulation.',
        },
      ],
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
    }
  }

  if (rawRows.length === 0) {
    return {
      success: false,
      records: [],
      errors: [
        {
          row: 1,
          code: 'EMPTY_FILE',
          message: 'CSV file contains no rows.',
        },
      ],
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
    }
  }

  // Row 1 is header
  const rawHeader = rawRows[0]
  if (!rawHeader) {
    return {
      success: false,
      records: [],
      errors: [
        {
          row: 1,
          code: 'EMPTY_FILE',
          message: 'CSV file contains no header row.',
        },
      ],
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
    }
  }

  const headerRow = rawHeader.map((h) => h.trim())
  const headerMap = new Map<string, number>()

  headerRow.forEach((h, idx) => {
    headerMap.set(h, idx)
  })

  // Verify missing canonical headers
  for (const expectedHeader of CANONICAL_HEADERS) {
    if (!headerMap.has(expectedHeader)) {
      errors.push({
        row: 1,
        column: expectedHeader,
        code: 'MISSING_COLUMN',
        message: `Missing required canonical column: "${expectedHeader}"`,
      })
    }
  }

  // Verify unexpected columns if strict
  if (strictColumns) {
    const canonicalSet = new Set<string>(CANONICAL_HEADERS)
    for (const foundHeader of headerRow) {
      if (!canonicalSet.has(foundHeader)) {
        errors.push({
          row: 1,
          column: foundHeader,
          code: 'UNEXPECTED_COLUMN',
          message: `Unexpected column encountered in header: "${foundHeader}"`,
        })
      }
    }
  }

  // If header has fatal mismatch, return early with errors
  if (errors.length > 0) {
    return {
      success: false,
      records: [],
      errors,
      totalRows: rawRows.length - 1,
      validRows: 0,
      invalidRows: rawRows.length - 1,
    }
  }

  // Parse subsequent data rows (row numbers in CSV are 1-indexed, data starts at row 2)
  for (let i = 1; i < rawRows.length; i++) {
    const rowNumber = i + 1
    const rowValues = rawRows[i]
    if (!rowValues) continue

    if (rowValues.length !== CANONICAL_HEADERS.length) {
      errors.push({
        row: rowNumber,
        code: 'INVALID_FIELD_COUNT',
        message: `Row ${rowNumber} has ${rowValues.length} columns, expected ${CANONICAL_HEADERS.length}.`,
      })
      continue
    }

    const getVal = (col: CanonicalHeader): string => {
      const idx = headerMap.get(col)
      if (idx === undefined || idx >= rowValues.length) return ''
      const cell = rowValues[idx]
      return cell !== undefined ? cell.trim() : ''
    }

    const record: CsvRawRecord = {
      _rowNumber: rowNumber,
      sn: getVal('S/N'),
      sourceName: getVal('Source Name'),
      dataLink: getVal('Data Link'),
      sourceWebsite: getVal('Source Website'),
      countryCoverage: getVal('Country / Coverage'),
      linkDescription: getVal('Link Description'),
      sourceType: getVal('Source Type'),
      industry: getVal('Industry'),
      institutionName: getVal('Institution Name'),
      availableFormats: getVal('Available Formats'),
      accessType: getVal('Access Type'),
      updateFrequency: getVal('Update Frequency'),
      lastUpdated: getVal('Last Updated (latest data seen)'),
      notes: getVal('Notes'),
      category: getVal('Category'),
      dataGranularity: getVal('Data Granularity'),
      language: getVal('Language'),
      apiAvailable: getVal('API Available'),
      linkStatus: getVal('Link Status'),
      priority: getVal('Priority for Platform'),
    }

    records.push(record)
  }

  const validRows = records.length
  const invalidRows = errors.filter((e) => e.row > 1).length

  return {
    success: errors.length === 0,
    records,
    errors,
    totalRows: rawRows.length - 1,
    validRows,
    invalidRows,
  }
}
