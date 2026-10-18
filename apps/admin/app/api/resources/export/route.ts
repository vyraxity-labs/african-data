import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma, Prisma, ResourceStatus } from '@repo/database';
import { exportCatalogueToCsv } from '@repo/validation';

export const dynamic = 'force-dynamic';

/**
 * Admin Catalogue CSV Export Endpoint
 *
 * Implements Phase 17 CSV Export for administrators:
 * - Session-authenticated administrative export
 * - Can export all resources across lifecycle states (ACTIVE, DRAFT, ARCHIVED)
 * - Protects against spreadsheet formula injection (=, +, -, @)
 * - Conforms to RFC 4180 with UTF-8 BOM
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized: Administrator authentication required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    const q = searchParams.get('q')?.trim() || '';
    const statusParam = searchParams.get('status')?.trim().toUpperCase() || 'ALL';
    const institutionId = searchParams.get('institutionId')?.trim() || '';

    const where: Prisma.ResourceWhereInput = {};

    if (statusParam !== 'ALL' && Object.values(ResourceStatus).includes(statusParam as ResourceStatus)) {
      where.status = statusParam as ResourceStatus;
    }

    if (institutionId) {
      where.institutionId = institutionId;
    }

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
      ];
    }

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
    const filename = `african-data-catalogue-admin-${dateStr}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('Error generating admin catalogue CSV export:', error);
    return NextResponse.json(
      { error: 'Failed to generate admin catalogue CSV export.' },
      { status: 500 }
    );
  }
}
