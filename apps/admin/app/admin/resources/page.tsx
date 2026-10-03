import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma, Prisma, ResourceStatus } from '@repo/database';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  Button,
  EmptyState,
} from '@repo/ui';
import { ResourceStatusActions } from './resource-status-actions';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdminResourcesPage(props: PageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect('/admin/login?callbackUrl=/admin/resources');
  }

  const resolvedSearchParams = await props.searchParams;
  const getParam = (key: string): string | undefined => {
    const val = resolvedSearchParams[key];
    if (Array.isArray(val)) return val[0];
    return val;
  };

  const statusFilter = getParam('status')?.toUpperCase() || 'ALL';
  const q = getParam('q')?.trim() || '';
  const rawPage = parseInt(getParam('page') || '1', 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const pageSize = 15;

  // Counts for tabs
  const [totalCount, draftCount, activeCount, archivedCount] = await Promise.all([
    prisma.resource.count(),
    prisma.resource.count({ where: { status: ResourceStatus.DRAFT } }),
    prisma.resource.count({ where: { status: ResourceStatus.ACTIVE } }),
    prisma.resource.count({ where: { status: ResourceStatus.ARCHIVED } }),
  ]);

  // Build where filter
  const where: Prisma.ResourceWhereInput = {};

  if (statusFilter === 'DRAFT') {
    where.status = ResourceStatus.DRAFT;
  } else if (statusFilter === 'ACTIVE') {
    where.status = ResourceStatus.ACTIVE;
  } else if (statusFilter === 'ARCHIVED') {
    where.status = ResourceStatus.ARCHIVED;
  }

  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { industry: { contains: q, mode: 'insensitive' } },
      { countryCoverage: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [resources, filteredTotal] = await Promise.all([
    prisma.resource.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { updatedAt: 'desc' },
      include: {
        institution: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            links: true,
          },
        },
      },
    }),
    prisma.resource.count({ where }),
  ]);

  const totalPages = Math.ceil(filteredTotal / pageSize) || 1;

  const getStatusBadge = (status: ResourceStatus) => {
    switch (status) {
      case ResourceStatus.ACTIVE:
        return <Badge variant="success">Active / Public</Badge>;
      case ResourceStatus.DRAFT:
        return <Badge variant="warning">Draft</Badge>;
      case ResourceStatus.ARCHIVED:
        return <Badge variant="default">Archived</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Admin Top Navigation */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors"
            >
              &larr; Admin Overview
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-bold text-slate-900">Resource Datasets</span>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/admin/resources/new">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                + Create Resource
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Title & Description */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Dataset Lifecycle Management
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Curate datasets, govern lifecycle stages (Draft &rarr; Active &rarr; Archived), and manage metadata.
            </p>
          </div>
        </div>

        {/* Status Filters & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          {/* Status Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <Link
              href={`/admin/resources?status=ALL${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({totalCount})
            </Link>
            <Link
              href={`/admin/resources?status=DRAFT${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === 'DRAFT'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              Drafts ({draftCount})
            </Link>
            <Link
              href={`/admin/resources?status=ACTIVE${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === 'ACTIVE'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              Active ({activeCount})
            </Link>
            <Link
              href={`/admin/resources?status=ARCHIVED${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === 'ARCHIVED'
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Archived ({archivedCount})
            </Link>
          </div>

          {/* Quick Search */}
          <form method="GET" action="/admin/resources" className="flex items-center gap-2">
            <input type="hidden" name="status" value={statusFilter} />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search resources..."
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-60"
            />
            <Button size="sm" type="submit" variant="outline">
              Filter
            </Button>
            {q && (
              <Link href={`/admin/resources?status=${statusFilter}`}>
                <Button size="sm" variant="ghost" type="button" className="text-slate-500">
                  Clear
                </Button>
              </Link>
            )}
          </form>
        </div>

        {/* Resources Table */}
        {resources.length === 0 ? (
          <EmptyState
            title="No datasets found"
            description={
              q
                ? `No records match your query "${q}" in ${statusFilter.toLowerCase()} status.`
                : `There are currently no datasets in ${statusFilter.toLowerCase()} status.`
            }
            action={
              <Link href="/admin/resources/new">
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  Create First Resource
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[35%]">Dataset / Resource</TableHead>
                  <TableHead>Custodian</TableHead>
                  <TableHead>Industry / Category</TableHead>
                  <TableHead>Coverage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Links</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resources.map((res) => (
                  <TableRow key={res.id}>
                    <TableCell>
                      <div className="font-semibold text-slate-900 hover:text-emerald-600">
                        <Link href={`/admin/resources/${res.id}/edit`}>{res.name}</Link>
                      </div>
                      {res.description && (
                        <p className="line-clamp-1 text-xs text-slate-500 mt-0.5">
                          {res.description}
                        </p>
                      )}
                    </TableCell>

                    <TableCell>
                      {res.institution ? (
                        <span className="text-xs font-medium text-slate-700">
                          {res.institution.name}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">None</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="text-xs text-slate-800">
                        {res.industry || '—'}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {res.category || '—'}
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="text-xs text-slate-600">
                        {res.countryCoverage || '—'}
                      </span>
                    </TableCell>

                    <TableCell>{getStatusBadge(res.status)}</TableCell>

                    <TableCell>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {res._count.links} endpoints
                      </span>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/admin/resources/${res.id}/edit`}>
                          <Button size="sm" variant="outline" className="text-xs">
                            Edit
                          </Button>
                        </Link>
                        <ResourceStatusActions
                          resourceId={res.id}
                          resourceName={res.name}
                          currentStatus={res.status}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 px-2 py-3">
                <span className="text-xs text-slate-500">
                  Showing {(page - 1) * pageSize + 1} to{' '}
                  {Math.min(page * pageSize, filteredTotal)} of {filteredTotal} resources
                </span>
                <div className="flex items-center gap-2">
                  {page > 1 ? (
                    <Link
                      href={`/admin/resources?status=${statusFilter}&page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                    >
                      <Button size="sm" variant="outline">
                        Previous
                      </Button>
                    </Link>
                  ) : (
                    <Button size="sm" variant="outline" disabled>
                      Previous
                    </Button>
                  )}

                  <span className="text-xs font-medium text-slate-700">
                    Page {page} of {totalPages}
                  </span>

                  {page < totalPages ? (
                    <Link
                      href={`/admin/resources?status=${statusFilter}&page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                    >
                      <Button size="sm" variant="outline">
                        Next
                      </Button>
                    </Link>
                  ) : (
                    <Button size="sm" variant="outline" disabled>
                      Next
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
