import type { CsvRawRecord, CsvParseError } from './csv-parser';
import type {
  NormalizedResourceData,
  NormalizationWarning,
  CoverageScope,
  NormalizedAccessType,
  NormalizedPriority,
} from './csv-normalizer';

export type {
  CsvRawRecord,
  CsvParseError,
  NormalizedResourceData,
  NormalizationWarning,
  CoverageScope,
  NormalizedAccessType,
  NormalizedPriority,
};

export type DuplicateMatchReason = 'EXACT_URL' | 'NORMALIZED_URL' | 'EXACT_NAME' | 'SIMILAR_NAME';

export interface DuplicateDetectionResult {
  row: number;
  sourceName: string;
  url: string;
  matchedOn: DuplicateMatchReason;
  duplicateOfRow?: number;
  duplicateInDatabase?: boolean;
  existingResourceId?: string;
  message: string;
}

export interface InvalidUrlDetail {
  row: number;
  field: 'Data Link' | 'Source Website';
  url: string;
  reason: string;
}

export interface MissingFieldDetail {
  row: number;
  field: string;
  message: string;
}

export interface UnknownValueDetail {
  row: number;
  field: string;
  rawValue: string;
  message: string;
}

export interface ImportPreviewReport {
  totalRows: number;
  validCount: number;
  potentialDuplicatesCount: number;
  invalidUrlsCount: number;
  missingFieldsCount: number;
  unknownValuesCount: number;

  validRows: number[];
  potentialDuplicates: DuplicateDetectionResult[];
  invalidUrls: InvalidUrlDetail[];
  missingFields: MissingFieldDetail[];
  unknownValues: UnknownValueDetail[];

  records: NormalizedResourceData[];
  generatedAt: string;
  formattedSummary: string;
}

export interface ValidateImportOptions {
  checkDatabaseDuplicates?: boolean;
}
