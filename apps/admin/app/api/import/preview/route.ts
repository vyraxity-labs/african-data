import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { validateCsvSecurity, generateImportPreview } from '@repo/database';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Administrator authentication required.' },
        { status: 401 }
      );
    }

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

    // 2. Generate in-memory preview (0 database writes guaranteed)
    const report = await generateImportPreview(buffer, { checkDatabaseDuplicates: true });

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown server error during preview';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
