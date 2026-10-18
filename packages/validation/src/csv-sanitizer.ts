/**
 * Spreadsheet Formula Injection (CSV Injection) Sanitizer & RFC 4180 CSV Generator
 * 
 * Conforms to Section 17 of Implementation Guide:
 * Values beginning with:
 *   =
 *   +
 *   -
 *   @
 * must not become unintended spreadsheet formulas when opened in spreadsheet software.
 */

/**
 * Formula trigger characters in Excel, Google Sheets, LibreOffice Calc, etc.
 */
export const FORMULA_TRIGGERS = ['=', '+', '-', '@'] as const;

/**
 * Sanitizes a string value against spreadsheet formula injection (CSV injection).
 *
 * If a value (or a value with leading whitespace) begins with '=', '+', '-', or '@',
 * it prepends a single quote (') so that spreadsheet software treats the cell
 * strictly as a text label rather than evaluating it as a formula or executable command.
 */
export function sanitizeSpreadsheetFormula(value: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    return value;
  }

  const trimmed = value.trimStart();
  if (trimmed.length === 0) {
    return value;
  }

  // If already escaped with a leading single quote, do not double-escape
  if (trimmed.startsWith("'")) {
    return value;
  }

  const firstChar = trimmed[0];
  if (firstChar === '=' || firstChar === '+' || firstChar === '-' || firstChar === '@') {
    return `'${value}`;
  }

  // Also catch leading control characters that can trigger formula parsing in older Excel versions
  if (value.startsWith('\t') || value.startsWith('\r') || value.startsWith('\n')) {
    return `'${value}`;
  }

  return value;
}

/**
 * Formats a single value as an RFC 4180 compliant CSV cell with formula injection protection.
 */
export function formatCsvCell(rawValue: unknown): string {
  if (rawValue === null || rawValue === undefined) {
    return '';
  }

  let str: string;
  if (typeof rawValue === 'boolean') {
    str = rawValue ? 'Yes' : 'No';
  } else if (rawValue instanceof Date) {
    str = rawValue.toISOString();
  } else if (typeof rawValue === 'object') {
    str = JSON.stringify(rawValue);
  } else {
    str = String(rawValue);
  }

  // Apply spreadsheet formula injection protection
  str = sanitizeSpreadsheetFormula(str);

  // RFC 4180 quoting:
  // If the cell contains quotes, commas, newlines, or begins with single quote,
  // enclose in double quotes and escape internal double quotes by doubling them ("")
  if (
    str.includes('"') ||
    str.includes(',') ||
    str.includes('\n') ||
    str.includes('\r') ||
    str.startsWith("'")
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Formats an array of row values into an RFC 4180 CSV row string.
 */
export function buildCsvRow(values: unknown[]): string {
  return values.map(formatCsvCell).join(',');
}

/**
 * Builds a complete RFC 4180 compliant CSV document with formula injection protection
 * and UTF-8 Byte Order Mark (BOM) for Excel/spreadsheet software compatibility.
 */
export function buildCsv(rows: unknown[][], headers?: string[]): string {
  const lines: string[] = [];

  if (headers && headers.length > 0) {
    lines.push(buildCsvRow(headers));
  }

  for (const row of rows) {
    lines.push(buildCsvRow(row));
  }

  // Prepend UTF-8 BOM (\uFEFF) so Excel correctly recognizes UTF-8 encoding
  // Use CRLF (\r\n) per RFC 4180
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}
