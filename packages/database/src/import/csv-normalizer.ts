import { tryNormalizeUrl, isValidUrl } from '@repo/validation/url'
import type { CsvRawRecord } from './csv-parser'

export type NormalizedAccessType =
  | 'FREE'
  | 'FREE_WITH_SIGNUP'
  | 'PARTIAL'
  | 'PAID'
  | 'OTHER'
export type NormalizedPriority =
  | 'HIGH'
  | 'MEDIUM_HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'OTHER'
export type CoverageScope =
  | 'PAN_AFRICAN'
  | 'REGIONAL'
  | 'NATIONAL'
  | 'GLOBAL'
  | 'OTHER'

export interface NormalizationWarning {
  row: number
  field: string
  rawValue: string
  message: string
}

export interface NormalizedResourceData {
  _rowNumber: number
  raw: CsvRawRecord

  // Resource model fields
  name: string
  description: string
  institutionName: string
  sourceType: string
  industry: string
  category: string
  dataGranularity: string
  notes: string
  updateFrequency: string
  lastUpdated: string

  // Normalized fields
  formats: string[]
  languages: string[]
  coverage: {
    raw: string
    scope: CoverageScope
    regions: string[]
    countries: string[]
  }
  apiAvailable: boolean
  accessType: NormalizedAccessType
  priority: NormalizedPriority

  // URL links
  dataLink: {
    raw: string
    normalized?: string
    isValid: boolean
  }
  sourceWebsite?: {
    raw: string
    normalized?: string
    isValid: boolean
  }

  // Structured metadata object for Prisma Json column
  metadata: Record<string, unknown>
}

export interface NormalizationResult {
  records: NormalizedResourceData[]
  warnings: NormalizationWarning[]
  unknownValues: NormalizationWarning[]
  totalRecords: number
}

// Canonical format normalization mappings
const FORMAT_MAP: Record<string, string> = {
  csv: 'CSV',
  excel: 'EXCEL',
  'excel (paid database)': 'EXCEL',
  'excel (paid)': 'EXCEL',
  xls: 'EXCEL',
  xlsx: 'EXCEL',
  pdf: 'PDF',
  online: 'ONLINE',
  web: 'ONLINE',
  api: 'API',
  rest: 'API',
  json: 'JSON',
  'png/jpg': 'IMAGE',
  png: 'IMAGE',
  jpg: 'IMAGE',
  jpeg: 'IMAGE',
  svg: 'SVG',
  embed: 'EMBED',
  spss: 'SPSS',
  stata: 'STATA',
  shapefile: 'SHAPEFILE',
  geotiff: 'GEOTIFF',
  cog: 'COG',
  netcdf: 'NETCDF',
  kml: 'KML',
}

// Canonical language code mappings
const LANGUAGE_MAP: Record<string, string[]> = {
  english: ['en'],
  'english and french': ['en', 'fr'],
  french: ['fr'],
  arabic: ['ar'],
  portuguese: ['pt'],
  swahili: ['sw'],
  kiswahili: ['sw'],
  spanish: ['es'],
}

export function normalizeFormats(
  rawFormats: string,
  rowNumber: number,
  unknowns: NormalizationWarning[],
): string[] {
  if (!rawFormats || rawFormats.trim() === '') return []

  const tokens = rawFormats
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)

  const normalizedSet = new Set<string>()

  for (const token of tokens) {
    const key = token.toLowerCase()
    const mapped = FORMAT_MAP[key]

    if (mapped) {
      normalizedSet.add(mapped)
    } else {
      unknowns.push({
        row: rowNumber,
        field: 'Available Formats',
        rawValue: token,
        message: `Unknown format token: "${token}". Preserved in raw metadata.`,
      })
      normalizedSet.add(token.toUpperCase())
    }
  }

  return Array.from(normalizedSet)
}

export function normalizeLanguage(
  rawLang: string,
  rowNumber: number,
  unknowns: NormalizationWarning[],
): string[] {
  if (!rawLang || rawLang.trim() === '') return ['en'] // default English

  const key = rawLang.trim().toLowerCase()
  const mapped = LANGUAGE_MAP[key]

  if (mapped) {
    return mapped
  }

  unknowns.push({
    row: rowNumber,
    field: 'Language',
    rawValue: rawLang,
    message: `Unknown language value: "${rawLang}". Stored as custom code.`,
  })

  return [rawLang.trim().toLowerCase().slice(0, 5)]
}

export function normalizeCoverage(
  rawCoverage: string,
  rowNumber: number,
  unknowns: NormalizationWarning[],
): {
  raw: string
  scope: CoverageScope
  regions: string[]
  countries: string[]
} {
  const trimmed = rawCoverage ? rawCoverage.trim() : ''
  if (!trimmed) {
    return {
      raw: '',
      scope: 'OTHER',
      regions: [],
      countries: [],
    }
  }

  const lower = trimmed.toLowerCase()

  // 1. Continental / Pan-African
  if (
    lower === 'africa' ||
    lower.includes('pan-african') ||
    lower.includes('continental') ||
    lower.includes('afcfta') ||
    lower.includes('au member') ||
    lower.includes('54 countries') ||
    lower.includes('55 countries') ||
    lower.includes('55 member') ||
    lower.includes('43 member') ||
    lower.includes('47 member') ||
    lower.includes('39+ countries') ||
    lower.includes('sub-saharan') ||
    lower.includes('selected countries')
  ) {
    return {
      raw: trimmed,
      scope: 'PAN_AFRICAN',
      regions: ['Pan-African'],
      countries: [],
    }
  }

  // 2. Global with Africa coverage
  if (lower.startsWith('global')) {
    return {
      raw: trimmed,
      scope: 'GLOBAL',
      regions: [],
      countries: [],
    }
  }

  // 3. Regional groupings
  const regions: string[] = []
  if (lower.includes('east africa') || lower.includes('horn of africa')) {
    regions.push('East Africa')
  }
  if (lower.includes('west africa') || lower.includes('waemu')) {
    regions.push('West Africa')
  }
  if (lower.includes('central africa')) {
    regions.push('Central Africa')
  }
  if (lower.includes('southern africa')) {
    regions.push('Southern Africa')
  }
  if (lower.includes('north africa')) {
    regions.push('North Africa')
  }
  if (lower.includes('francophone africa')) {
    regions.push('Francophone Africa')
  }

  if (regions.length > 0) {
    const countries: string[] = []
    if (lower.includes('kenya')) countries.push('KE')
    if (lower.includes('tanzania')) countries.push('TZ')
    if (lower.includes('uganda')) countries.push('UG')

    return {
      raw: trimmed,
      scope: 'REGIONAL',
      regions,
      countries,
    }
  }

  // 4. National / Country-specific
  if (lower === 'nigeria' || lower.includes('nigeria /')) {
    return {
      raw: trimmed,
      scope: 'NATIONAL',
      regions: ['West Africa'],
      countries: ['NG'],
    }
  }

  unknowns.push({
    row: rowNumber,
    field: 'Country / Coverage',
    rawValue: trimmed,
    message: `Unknown or unclassified coverage description: "${trimmed}". Marked as OTHER.`,
  })

  return {
    raw: trimmed,
    scope: 'OTHER',
    regions: [],
    countries: [],
  }
}

export function normalizeApiAvailable(
  rawVal: string,
  rowNumber: number,
  unknowns: NormalizationWarning[],
): boolean {
  if (!rawVal || rawVal.trim() === '') return false

  const lower = rawVal.trim().toLowerCase()
  if (['yes', 'y', 'true', '1'].includes(lower)) return true
  if (['no', 'n', 'false', '0', 'none', 'n/a'].includes(lower)) return false

  unknowns.push({
    row: rowNumber,
    field: 'API Available',
    rawValue: rawVal,
    message: `Unrecognized API Available value: "${rawVal}". Defaulted to false.`,
  })

  return false
}

export function normalizeAccessType(
  rawAccess: string,
  rowNumber: number,
  unknowns: NormalizationWarning[],
): NormalizedAccessType {
  if (!rawAccess || rawAccess.trim() === '') return 'OTHER'

  const lower = rawAccess.trim().toLowerCase()

  if (lower === 'free access' || lower === 'free' || lower === 'open access') {
    return 'FREE'
  }
  if (
    lower === 'free but requires signup' ||
    lower.includes('requires signup')
  ) {
    if (lower.includes('paid for commercial')) {
      return 'PAID'
    }
    return 'FREE_WITH_SIGNUP'
  }
  if (
    lower === 'partial free access' ||
    lower.includes('partial') ||
    lower.includes('freemium')
  ) {
    return 'PARTIAL'
  }
  if (lower.includes('paid') || lower.includes('subscription')) {
    return 'PAID'
  }

  unknowns.push({
    row: rowNumber,
    field: 'Access Type',
    rawValue: rawAccess,
    message: `Unknown Access Type: "${rawAccess}". Mapped to OTHER.`,
  })

  return 'OTHER'
}

export function normalizePriority(
  rawPriority: string,
  rowNumber: number,
  unknowns: NormalizationWarning[],
): NormalizedPriority {
  if (!rawPriority || rawPriority.trim() === '') return 'MEDIUM'

  const lower = rawPriority.trim().toLowerCase()

  if (lower === 'high' || lower === 'critical') return 'HIGH'
  if (lower === 'medium-high' || lower === 'medium high') return 'MEDIUM_HIGH'
  if (lower === 'medium') return 'MEDIUM'
  if (lower === 'low') return 'LOW'

  unknowns.push({
    row: rowNumber,
    field: 'Priority for Platform',
    rawValue: rawPriority,
    message: `Unknown Priority value: "${rawPriority}". Mapped to OTHER.`,
  })

  return 'OTHER'
}

export function normalizeCsvRecord(record: CsvRawRecord): {
  normalized: NormalizedResourceData
  warnings: NormalizationWarning[]
  unknownValues: NormalizationWarning[]
} {
  const row = record._rowNumber
  const warnings: NormalizationWarning[] = []
  const unknownValues: NormalizationWarning[] = []

  // 1. Available Formats
  const formats = normalizeFormats(record.availableFormats, row, unknownValues)

  // 2. Language
  const languages = normalizeLanguage(record.language, row, unknownValues)

  // 3. Country / Coverage
  const coverage = normalizeCoverage(record.countryCoverage, row, unknownValues)

  // 4. API Available
  const apiAvailable = normalizeApiAvailable(
    record.apiAvailable,
    row,
    unknownValues,
  )

  // 5. Access Type
  const accessType = normalizeAccessType(record.accessType, row, unknownValues)

  // 6. Priority
  const priority = normalizePriority(record.priority, row, unknownValues)

  // 7. URLs
  const rawDataLink = record.dataLink.trim()
  const dataLinkNormResult = tryNormalizeUrl(rawDataLink)
  const isValidDataLink = dataLinkNormResult.isValid
  const normalizedDataLink = dataLinkNormResult.normalizedUrl

  if (!isValidDataLink) {
    warnings.push({
      row,
      field: 'Data Link',
      rawValue: rawDataLink,
      message: `Invalid or unparseable Data Link URL: "${rawDataLink}"`,
    })
  }

  let sourceWebsiteObj:
    | { raw: string; normalized?: string; isValid: boolean }
    | undefined = undefined

  const rawWebsite = record.sourceWebsite.trim()
  if (rawWebsite) {
    const websiteNormResult = tryNormalizeUrl(rawWebsite)
    const isValidWebsite = websiteNormResult.isValid
    const normalizedWebsite = websiteNormResult.normalizedUrl

    if (!isValidWebsite) {
      warnings.push({
        row,
        field: 'Source Website',
        rawValue: rawWebsite,
        message: `Invalid or unparseable Source Website URL: "${rawWebsite}"`,
      })
    }

    sourceWebsiteObj = {
      raw: rawWebsite,
      normalized: normalizedWebsite || undefined,
      isValid: isValidWebsite,
    }
  }

  // Preserve all original attributes in metadata JSON
  const metadata: Record<string, unknown> = {
    original: {
      sn: record.sn,
      availableFormats: record.availableFormats,
      language: record.language,
      countryCoverage: record.countryCoverage,
      apiAvailable: record.apiAvailable,
      accessType: record.accessType,
      priority: record.priority,
      linkStatus: record.linkStatus,
    },
    normalized: {
      formats,
      languages,
      coverageScope: coverage.scope,
      regions: coverage.regions,
      countries: coverage.countries,
      accessType,
      priority,
    },
  }

  const normalized: NormalizedResourceData = {
    _rowNumber: row,
    raw: record,
    name: record.sourceName.trim(),
    description: record.linkDescription.trim(),
    institutionName: record.institutionName.trim(),
    sourceType: record.sourceType.trim(),
    industry: record.industry.trim(),
    category: record.category.trim(),
    dataGranularity: record.dataGranularity.trim(),
    notes: record.notes.trim(),
    updateFrequency: record.updateFrequency.trim(),
    lastUpdated: record.lastUpdated.trim(),
    formats,
    languages,
    coverage,
    apiAvailable,
    accessType,
    priority,
    dataLink: {
      raw: rawDataLink,
      normalized: normalizedDataLink || undefined,
      isValid: isValidDataLink,
    },
    sourceWebsite: sourceWebsiteObj,
    metadata,
  }

  return {
    normalized,
    warnings,
    unknownValues,
  }
}

export function normalizeCsvRecords(
  records: CsvRawRecord[],
): NormalizationResult {
  const normalizedRecords: NormalizedResourceData[] = []
  const allWarnings: NormalizationWarning[] = []
  const allUnknownValues: NormalizationWarning[] = []

  for (const record of records) {
    const res = normalizeCsvRecord(record)
    normalizedRecords.push(res.normalized)
    allWarnings.push(...res.warnings)
    allUnknownValues.push(...res.unknownValues)
  }

  return {
    records: normalizedRecords,
    warnings: allWarnings,
    unknownValues: allUnknownValues,
    totalRecords: normalizedRecords.length,
  }
}
