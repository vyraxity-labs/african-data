export interface CsvSecurityOptions {
  maxSizeBytes?: number; // default 10MB
  maxRowCount?: number; // default 5000 rows
  allowedMimeTypes?: string[];
}

export interface SecurityValidationResult {
  isValid: boolean;
  error?: string;
}

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_MAX_ROWS = 5000;
const ALLOWED_MIME_TYPES = [
  'text/csv',
  'application/vnd.ms-excel',
  'text/plain',
  'application/csv',
  'text/x-csv',
];

/**
 * Validates untrusted CSV upload metadata and raw content according to Step 7.5 security rules.
 */
export function validateCsvSecurity(
  content: string | Buffer,
  fileMetadata?: {
    fileName?: string;
    sizeBytes?: number;
    mimeType?: string;
  },
  options: CsvSecurityOptions = {}
): SecurityValidationResult {
  const maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_SIZE;
  const maxRowCount = options.maxRowCount ?? DEFAULT_MAX_ROWS;

  // 1. File size validation
  const actualSize = Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content, 'utf-8');
  if (actualSize === 0) {
    return { isValid: false, error: 'Uploaded CSV file is empty.' };
  }
  if (actualSize > maxSizeBytes) {
    return {
      isValid: false,
      error: `File size exceeds allowed maximum of ${Math.round(maxSizeBytes / (1024 * 1024))}MB.`,
    };
  }

  // 2. File metadata validation (extension & mimeType)
  if (fileMetadata?.fileName) {
    const ext = fileMetadata.fileName.split('.').pop()?.toLowerCase();
    if (ext !== 'csv') {
      return {
        isValid: false,
        error: `Invalid file extension ".${ext}". Only .csv files are supported.`,
      };
    }
  }

  if (fileMetadata?.mimeType) {
    const cleanMime = fileMetadata.mimeType.toLowerCase().split(';')[0]?.trim();
    if (cleanMime && !ALLOWED_MIME_TYPES.includes(cleanMime)) {
      return {
        isValid: false,
        error: `Unsupported MIME type "${fileMetadata.mimeType}". Expected text/csv.`,
      };
    }
  }

  // 3. Encoding & Binary check (CSV must be UTF-8/ASCII text, not a binary executable or archive)
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');
  // Check first 1024 bytes for null bytes (\0) which indicate binary files
  const sampleLength = Math.min(buffer.length, 1024);
  for (let i = 0; i < sampleLength; i++) {
    if (buffer[i] === 0) {
      return {
        isValid: false,
        error: 'File appears to be binary or corrupted. Only UTF-8 text CSV files are accepted.',
      };
    }
  }

  // 4. Row count cap validation (prevents DoS via million-row uploads)
  const text = buffer.toString('utf-8');
  const lineCount = (text.match(/\n/g) || []).length + 1;
  if (lineCount > maxRowCount) {
    return {
      isValid: false,
      error: `Row count (${lineCount}) exceeds maximum allowed batch limit of ${maxRowCount} rows.`,
    };
  }

  return { isValid: true };
}

/**
 * Sanitizes dangerous formula prefixes to prevent CSV injection (DDE attacks).
 * Cells starting with =, +, -, @, \t, or \r are neutralized.
 */
export function sanitizeCsvFormulaInjection(val: string): string {
  if (!val || typeof val !== 'string') return '';
  const trimmed = val.trim();
  if (/^[=+\-@\t\r]/.test(trimmed)) {
    // Prefix with single quote to deactivate spreadsheet formula execution
    return `'${val}`;
  }
  return val;
}
