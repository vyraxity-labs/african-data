import { NextRequest, NextResponse } from 'next/server';
import { prisma, Prisma, ResourceStatus } from '@repo/database';
import { exportCatalogueToCsv } from '@repo/validation';

export const dynamic = 'force-dynamic';

/**
 * Public Catalogue CSV Export Endpoint
 *
 * Implements Phase 17 CSV Export:
 * - Exports catalogue datasets and endpoints
 * - Protects against spreadsheet formula injection (=, +, -, @)
 * - Conforms to RFC 4180 with UTF-8 BOM for spreadsheet compatibility
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const q = searchParams.get('q')?.trim() || '';
    const industry = searchParams.get('industry')?.trim() || '';
    const category = searchParams.get('category')?.trim() || '';
    const coverage = searchParams.get('coverage')?.trim() || '';
    const sourceType = searchParams.get('sourceType')?.trim() || '';
    const access = searchParams.get('access')?.trim() || '';
    const api = searchParams.get('api')?.trim() || '';
    const language = searchParams.get('language')?.trim() || '';
    const granularity = searchParams.get('granularity')?.trim() || '';

    // Public export only exposes ACTIVE catalogue entries
    const where: Prisma.ResourceWhereInput = {
      status: ResourceStatus.ACTIVE,
    };

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (industry) where.industry = industry;
    if (category) where.category = category;
    if (coverage) where.countryCoverage = coverage;
    if (sourceType) where.sourceType = sourceType;
    if (access) where.accessType = access;
    if (api === 'true') where.apiAvailable = true;
    if (api === 'false') where.apiAvailable = false;
    if (language) where.language = language;
    if (granularity) where.dataGranularity = granularity;

    const resources = await prisma.resource.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        institution: {
          select: {
            name: true,
            country: true,
            website: true,
            type: true,
          },
        },
        links: {
          select: {
            url: true,
            linkType: true,
            status: true,
            httpStatus: true,
            responseTimeMs: true,
            lastCheckedAt: true,
            finalUrl: true,
          },
        },
      },
    });

    const csvContent = exportCatalogueToCsv(resources);

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `african-data-catalogue-${dateStr}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('Error generating catalogue CSV export:', error);
    return NextResponse.json(
      { error: 'Failed to generate catalogue CSV export.' },
      { status: 500 }
    );
  }
}
