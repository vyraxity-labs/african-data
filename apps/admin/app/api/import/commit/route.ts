import { NextResponse } from 'next/server';
import {
  validateCsvSecurity,
  parseCsv,
  normalizeCsvRecords,
  commitImport,
  ResourceStatus,
} from '@repo/database';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'No CSV file provided in request.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Enforce strict CSV security checks
    const secResult = validateCsvSecurity(buffer, {
      fileName: file.name,
      sizeBytes: file.size,
      mimeType: file.type,
    });

    if (!secResult.isValid) {
      return NextResponse.json(
        { success: false, error: secResult.error || 'CSV security check failed.' },
        { status: 400 }
      );
    }

    // 2. Parse and normalize
    const parsed = parseCsv(buffer);
    if (!parsed.success && parsed.records.length === 0) {
      return NextResponse.json(
        { success: false, error: parsed.errors[0]?.message || 'Failed to parse CSV file.' },
        { status: 400 }
      );
    }

    const normalized = normalizeCsvRecords(parsed.records);

    // 3. Commit transaction
    const commitResult = await commitImport(normalized.records, {
      defaultStatus: ResourceStatus.ACTIVE,
      skipDuplicates: true,
      batchSize: 25,
    });

    return NextResponse.json({
      success: commitResult.success,
      result: commitResult,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown server error during import commit';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
