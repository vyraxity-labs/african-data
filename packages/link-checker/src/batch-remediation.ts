/**
 * Batch Link Remediation Workflow
 *
 * Implements Step 15.3 specification:
 * Workflow:
 *   Select multiple links
 *    ↓
 *   Upload replacement CSV (link_id,new_url)
 *    ↓
 *   Validate
 *    ↓
 *   Preview (Dry run)
 *    ↓
 *   Confirm
 *    ↓
 *   Apply transactionally
 *
 * Rules:
 *   - CSV schema: link_id,new_url
 *   - "Do not silently partially apply invalid batches." (Strict atomic all-or-nothing guarantee)
 *   - Audit log: Creates a LinkAudit record for every replaced endpoint preserving oldUrl.
 */

import { parse } from 'csv-parse/sync';
import { normalizeUrl, InvalidUrlError } from '@repo/validation';
import { LinkHealthStatus } from '@repo/database';

export interface ParsedReplacementRow {
  rowNumber: number;
  linkId: string;
  newUrl: string;
}

export interface BatchPreviewItem {
  rowNumber: number;
  linkId: string;
  datasetId?: string;
  datasetName?: string;
  oldUrl?: string;
  rawNewUrl: string;
  normalizedNewUrl?: string;
  isValid: boolean;
  error?: string;
}

export interface BatchPreviewSummary {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  canApply: boolean;
  items: BatchPreviewItem[];
  validationErrors: string[];
}

export interface BatchApplyResult {
  success: boolean;
  appliedCount: number;
  auditIds: string[];
  message: string;
}

/**
 * Parses a CSV string containing link_id and new_url headers.
 */
export function parseReplacementCsv(csvContent: string): ParsedReplacementRow[] {
  if (!csvContent || typeof csvContent !== 'string' || !csvContent.trim()) {
    throw new Error('Replacement CSV content is empty.');
  }

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  if (!records || records.length === 0) {
    throw new Error('No data rows found in replacement CSV.');
  }

  const rows: ParsedReplacementRow[] = [];

  for (let i = 0; i < records.length; i++) {
    const raw = records[i] as Record<string, string>;
    const rowNumber = i + 2; // Row 1 is header

    // Support case-insensitive & standard variations of link_id and new_url
    const linkId = (
      raw['link_id'] ||
      raw['linkId'] ||
      raw['LinkId'] ||
      raw['id'] ||
      raw['ID'] ||
      ''
    ).trim();

    const newUrl = (
      raw['new_url'] ||
      raw['newUrl'] ||
      raw['NewUrl'] ||
      raw['url'] ||
      raw['URL'] ||
      ''
    ).trim();

    rows.push({
      rowNumber,
      linkId,
      newUrl,
    });
  }

  return rows;
}

/**
 * Validates and dry-runs a batch of replacement rows without applying changes.
 * Checks existence, URL syntax, normalization, and duplicate collision.
 */
export async function previewBatchReplacement(
  prismaClient: any,
  rows: ParsedReplacementRow[]
): Promise<BatchPreviewSummary> {
  if (!rows || rows.length === 0) {
    return {
      totalRows: 0,
      validCount: 0,
      invalidCount: 0,
      canApply: false,
      items: [],
      validationErrors: ['No rows provided for batch preview.'],
    };
  }

  // Pre-fetch all referenced links in a single query
  const linkIds = rows.map((r) => r.linkId).filter(Boolean);
  const existingLinks = await prismaClient.resourceLink.findMany({
    where: { id: { in: linkIds } },
    include: {
      resource: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const linkMap = new Map<string, any>();
  for (const link of existingLinks) {
    linkMap.set(link.id, link);
  }

  const items: BatchPreviewItem[] = [];
  const validationErrors: string[] = [];

  // Track within-batch URLs per resource to prevent batch-internal collisions
  const batchResourceUrlSet = new Set<string>();

  for (const row of rows) {
    const { rowNumber, linkId, newUrl: rawNewUrl } = row;

    if (!linkId) {
      items.push({
        rowNumber,
        linkId: '',
        rawNewUrl,
        isValid: false,
        error: 'Missing required link_id column value.',
      });
      validationErrors.push(`Row ${rowNumber}: Missing link_id.`);
      continue;
    }

    if (!rawNewUrl) {
      items.push({
        rowNumber,
        linkId,
        rawNewUrl: '',
        isValid: false,
        error: 'Missing required new_url column value.',
      });
      validationErrors.push(`Row ${rowNumber}: Missing new_url.`);
      continue;
    }

    const existingLink = linkMap.get(linkId);
    if (!existingLink) {
      items.push({
        rowNumber,
        linkId,
        rawNewUrl,
        isValid: false,
        error: `Link ID "${linkId}" does not exist in database.`,
      });
      validationErrors.push(`Row ${rowNumber}: Link ID "${linkId}" not found.`);
      continue;
    }

    // Normalize URL
    let normalizedNewUrl: string;
    try {
      normalizedNewUrl = normalizeUrl(rawNewUrl);
    } catch (err: unknown) {
      const msg = err instanceof InvalidUrlError ? err.message : 'Invalid URL syntax.';
      items.push({
        rowNumber,
        linkId,
        datasetId: existingLink.resourceId,
        datasetName: existingLink.resource.name,
        oldUrl: existingLink.url,
        rawNewUrl,
        isValid: false,
        error: `URL normalization failed: ${msg}`,
      });
      validationErrors.push(`Row ${rowNumber}: Invalid URL "${rawNewUrl}" (${msg}).`);
      continue;
    }

    // Check if new URL is identical to current URL
    if (normalizedNewUrl === existingLink.url) {
      items.push({
        rowNumber,
        linkId,
        datasetId: existingLink.resourceId,
        datasetName: existingLink.resource.name,
        oldUrl: existingLink.url,
        rawNewUrl,
        normalizedNewUrl,
        isValid: false,
        error: 'Replacement URL is identical to current URL.',
      });
      validationErrors.push(`Row ${rowNumber}: Replacement URL is identical to current URL.`);
      continue;
    }

    // Check duplicate in same batch for the same resource
    const batchKey = `${existingLink.resourceId}::${normalizedNewUrl}`;
    if (batchResourceUrlSet.has(batchKey)) {
      items.push({
        rowNumber,
        linkId,
        datasetId: existingLink.resourceId,
        datasetName: existingLink.resource.name,
        oldUrl: existingLink.url,
        rawNewUrl,
        normalizedNewUrl,
        isValid: false,
        error: 'Duplicate URL conflict within this batch for the same dataset.',
      });
      validationErrors.push(
        `Row ${rowNumber}: URL "${normalizedNewUrl}" is duplicated within this batch for "${existingLink.resource.name}".`
      );
      continue;
    }
    batchResourceUrlSet.add(batchKey);

    // Valid item
    items.push({
      rowNumber,
      linkId,
      datasetId: existingLink.resourceId,
      datasetName: existingLink.resource.name,
      oldUrl: existingLink.url,
      rawNewUrl,
      normalizedNewUrl,
      isValid: true,
    });
  }

  const validCount = items.filter((i) => i.isValid).length;
  const invalidCount = items.length - validCount;
  // Strict rule: "Do not silently partially apply invalid batches"
  const canApply = items.length > 0 && invalidCount === 0;

  return {
    totalRows: items.length,
    validCount,
    invalidCount,
    canApply,
    items,
    validationErrors,
  };
}

/**
 * Transactionally applies a verified batch of link replacements.
 * Strictly guarantees all-or-nothing execution with audit record generation.
 */
export async function applyBatchReplacement(
  prismaClient: any,
  input: {
    rows: ParsedReplacementRow[];
    adminIdentifier?: string;
    reason?: string;
  }
): Promise<BatchApplyResult> {
  const { rows, adminIdentifier = 'admin', reason = 'BATCH_REPLACEMENT' } = input;

  // 1. Dry run validation first
  const preview = await previewBatchReplacement(prismaClient, rows);

  // 2. Reject if any item is invalid: "Do not silently partially apply invalid batches."
  if (!preview.canApply) {
    throw new Error(
      `Cannot apply batch replacement: Batch contains ${preview.invalidCount} invalid row(s). Correct all errors before applying.\nErrors: ${preview.validationErrors.slice(0, 5).join('; ')}`
    );
  }

  const now = new Date();
  const auditIds: string[] = [];

  // 3. Atomically apply inside a single PostgreSQL database transaction
  await prismaClient.$transaction(async (tx: any) => {
    for (const item of preview.items) {
      if (!item.isValid || !item.normalizedNewUrl || !item.oldUrl) {
        throw new Error(`Unexpected invalid item encountered during transactional apply: Row ${item.rowNumber}`);
      }

      // Create LinkAudit record preserving oldUrl in history
      const audit = await tx.linkAudit.create({
        data: {
          linkId: item.linkId,
          oldUrl: item.oldUrl,
          newUrl: item.normalizedNewUrl,
          reason,
          changedBy: adminIdentifier,
          statusBefore: LinkHealthStatus.UNKNOWN,
          statusAfter: LinkHealthStatus.UNKNOWN,
          createdAt: now,
        },
      });
      auditIds.push(audit.id);

      // Update ResourceLink with new normalized URL and reset to UNKNOWN for verification
      await tx.resourceLink.update({
        where: { id: item.linkId },
        data: {
          url: item.normalizedNewUrl,
          status: LinkHealthStatus.UNKNOWN,
          httpStatus: null,
          finalUrl: null,
          lastCheckedAt: null, // Queues link for immediate inclusion in scheduled monitoring
          errorMessage: null,
          checkLockedUntil: null,
          checkLockToken: null,
          updatedAt: now,
        },
      });
    }
  });

  return {
    success: true,
    appliedCount: preview.items.length,
    auditIds,
    message: `Batch replacement applied successfully. ${preview.items.length} endpoint URL(s) updated with audit records.`,
  };
}
