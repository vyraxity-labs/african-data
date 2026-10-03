import Link from 'next/link';
import { prisma, Prisma, ResourceStatus } from '@repo/database';
import { Badge, Button, EmptyState } from '@repo/ui';
import { ResourceFilters } from './resource-filters';
import { ResourcePagination } from './resource-pagination';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ResourcesPage(props: PageProps) {
  const resolvedSearchParams = await props.searchParams;

  const getParam = (key: string): string | undefined => {
    const val = resolvedSearchParams[key];
    if (Array.isArray(val)) return val[0];
    return val;
  };

  const q = getParam('q')?.trim() || '';
  const industry = getParam('industry')?.trim() || '';
  const category = getParam('category')?.trim() || '';
  const coverage = getParam('coverage')?.trim() || '';
  const sourceType = getParam('sourceType')?.trim() || '';
  const access = getParam('access')?.trim() || '';
  const api = getParam('api')?.trim() || '';
  const language = getParam('language')?.trim() || '';
  const granularity = getParam('granularity')?.trim() || '';
  const sort = getParam('sort')?.trim() || 'name';
  const direction = (getParam('direction')?.toLowerCase() === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc';
  const rawPage = parseInt(getParam('page') || '1', 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const rawPageSize = parseInt(getParam('pageSize') || '15', 10);
  const pageSize = [10, 15, 25, 50].includes(rawPageSize) ? rawPageSize : 15;

  // Build Prisma where clause
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

  if (industry) {
    where.industry = industry;
  }

  if (category) {
    where.category = category;
  }

  if (coverage) {
    where.countryCoverage = coverage;
  }

  if (sourceType) {
    where.sourceType = sourceType;
  }

  if (access) {
    where.accessType = access;
  }

  if (api === 'true') {
    where.apiAvailable = true;
  } else if (api === 'false') {
    where.apiAvailable = false;
  }

  if (language) {
    where.language = language;
  }

  if (granularity) {
    where.dataGranularity = granularity;
  }

  // Safe sorting field mapping
  let orderBy: Prisma.ResourceOrderByWithRelationInput = { name: direction };
  if (sort === 'createdAt') {
    orderBy = { createdAt: direction };
  } else if (sort === 'priority') {
    orderBy = { priority: direction };
  } else if (sort === 'name') {
    orderBy = { name: direction };
  }

  // Perform bounded server queries concurrently
  const [
    totalCount,
    resources,
    distinctIndustriesRaw,
    distinctCategoriesRaw,
    distinctAccessRaw,
    distinctCoveragesRaw,
    distinctSourceTypesRaw,
    distinctLanguagesRaw,
    distinctGranularitiesRaw,
  ] = await Promise.all([
    prisma.resource.count({ where }),
    prisma.resource.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy,
      include: {
        institution: {
          select: {
            id: true,
            name: true,
          },
        },
        links: {
          select: {
            id: true,
            url: true,
            linkType: true,
            status: true,
          },
        },
      },
    }),
    prisma.resource.findMany({
      where: { status: ResourceStatus.ACTIVE, industry: { not: null } },
      distinct: ['industry'],
      select: { industry: true },
    }),
    prisma.resource.findMany({
      where: { status: ResourceStatus.ACTIVE, category: { not: null } },
      distinct: ['category'],
      select: { category: true },
    }),
    prisma.resource.findMany({
      where: { status: ResourceStatus.ACTIVE, accessType: { not: null } },
      distinct: ['accessType'],
      select: { accessType: true },
    }),
    prisma.resource.findMany({
      where: { status: ResourceStatus.ACTIVE, countryCoverage: { not: null } },
      distinct: ['countryCoverage'],
      select: { countryCoverage: true },
    }),
    prisma.resource.findMany({
      where: { status: ResourceStatus.ACTIVE, sourceType: { not: null } },
      distinct: ['sourceType'],
      select: { sourceType: true },
    }),
    prisma.resource.findMany({
      where: { status: ResourceStatus.ACTIVE, language: { not: null } },
      distinct: ['language'],
      select: { language: true },
    }),
    prisma.resource.findMany({
      where: { status: ResourceStatus.ACTIVE, dataGranularity: { not: null } },
      distinct: ['dataGranularity'],
      select: { dataGranularity: true },
    }),
  ]);

  const industries = distinctIndustriesRaw
    .map((r) => r.industry)
    .filter((v): v is string => Boolean(v))
    .sort();

  const categories = distinctCategoriesRaw
    .map((r) => r.category)
    .filter((v): v is string => Boolean(v))
    .sort();

  const accessTypes = distinctAccessRaw
    .map((r) => r.accessType)
    .filter((v): v is string => Boolean(v))
    .sort();

  const coverages = distinctCoveragesRaw
    .map((r) => r.countryCoverage)
    .filter((v): v is string => Boolean(v))
    .sort();

  const sourceTypes = distinctSourceTypesRaw
    .map((r) => r.sourceType)
    .filter((v): v is string => Boolean(v))
    .sort();

  const languages = distinctLanguagesRaw
    .map((r) => r.language)
    .filter((v): v is string => Boolean(v))
    .sort();

  const granularities = distinctGranularitiesRaw
    .map((r) => r.dataGranularity)
    .filter((v): v is string => Boolean(v))
    .sort();

  const totalPages = Math.ceil(totalCount / pageSize);

  const currentParamsRecord: Record<string, string | undefined> = {
    q: q || undefined,
    industry: industry || undefined,
    category: category || undefined,
    coverage: coverage || undefined,
    sourceType: sourceType || undefined,
    access: access || undefined,
    api: api || undefined,
    language: language || undefined,
    granularity: granularity || undefined,
    sort: sort !== 'name' ? sort : undefined,
    direction: direction !== 'asc' ? direction : undefined,
    pageSize: pageSize !== 15 ? String(pageSize) : undefined,
  };

  const hasActiveFilters = Boolean(
    q ||
    industry ||
    category ||
    coverage ||
    sourceType ||
    access ||
    api ||
    language ||
    granularity
  );

  return (
    <div className="bg-slate-50 min-h-screen pb-16">
      {/* Top Banner */}
      <div className="border-b border-slate-200 bg-white shadow-xs">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Data Resources Directory
                </h1>
                <Badge variant="default" className="text-xs font-semibold px-2.5 py-0.5">
                  {totalCount} {totalCount === 1 ? 'record' : 'records'}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Search, filter, and discover open data repositories, statistical databases, and portals across Africa.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link href="/">
                <Button variant="outline" size="sm">
                  &larr; Back to Home
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          {/* Sidebar Filters */}
          <aside className="lg:col-span-1">
            <div className="lg:sticky lg:top-20">
              <ResourceFilters
                industries={industries}
                categories={categories}
                accessTypes={accessTypes}
                coverages={coverages}
                sourceTypes={sourceTypes}
                languages={languages}
                granularities={granularities}
                currentParams={currentParamsRecord}
              />
            </div>
          </aside>

          {/* Main Results Section */}
          <main className="lg:col-span-3">
            {/* Filter Summary & Active Badges */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
              <div className="text-xs font-medium text-slate-500">
                {totalCount === 0 ? (
                  <span>No results matching current query</span>
                ) : (
                  <span>
                    Showing <strong className="text-slate-800">{(page - 1) * pageSize + 1}</strong> to{' '}
                    <strong className="text-slate-800">{Math.min(page * pageSize, totalCount)}</strong> of{' '}
                    <strong className="text-slate-800">{totalCount}</strong> results
                  </span>
                )}
              </div>

              {hasActiveFilters && (
                <Link
                  href="/resources"
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                >
                  Clear all active filters &times;
                </Link>
              )}
            </div>

            {/* Results List */}
            {resources.length === 0 ? (
              <EmptyState
                title="No data resources found"
                description={
                  hasActiveFilters
                    ? 'No catalogues match your search criteria. Try removing some filters or searching for different keywords.'
                    : 'There are currently no active data resources available in the catalogue.'
                }
                action={
                  hasActiveFilters ? (
                    <Link href="/resources">
                      <Button variant="primary">Reset All Filters</Button>
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <div className="space-y-4">
                {resources.map((resource) => (
                  <article
                    key={resource.id}
                    className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300 hover:shadow-sm"
                  >
                    <div>
                      {/* Institution & Badges */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        {resource.institution ? (
                          <Link
                            href={`/institutions/${resource.institution.id}`}
                            className="inline-flex items-center text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
                          >
                            🏛️ {resource.institution.name}
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">Independent Provider</span>
                        )}

                        <div className="flex flex-wrap items-center gap-1.5">
                          {resource.industry && (
                            <Badge variant="default" className="text-xs">
                              {resource.industry}
                            </Badge>
                          )}
                          {resource.accessType && (
                            <Badge
                              variant={resource.accessType.toLowerCase().includes('open') ? 'success' : 'default'}
                              className="text-xs"
                            >
                              {resource.accessType}
                            </Badge>
                          )}
                          {resource.apiAvailable && (
                            <Badge variant="info" className="text-xs">
                              API Ready
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Title */}
                      <h2 className="text-base font-semibold text-slate-900 hover:text-emerald-700 transition-colors sm:text-lg">
                        <Link href={`/resources/${resource.id}`}>{resource.name}</Link>
                      </h2>

                      {/* Description */}
                      {resource.description && (
                        <p className="mt-2 text-sm text-slate-600 line-clamp-3 leading-relaxed">
                          {resource.description}
                        </p>
                      )}

                      {/* Metadata tags */}
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        {resource.category && (
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400">Category:</span>
                            <span className="font-medium text-slate-700">{resource.category}</span>
                          </div>
                        )}
                        {resource.countryCoverage && (
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400">Coverage:</span>
                            <span className="font-medium text-slate-700">{resource.countryCoverage}</span>
                          </div>
                        )}
                        {resource.sourceType && (
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400">Format:</span>
                            <span className="font-medium text-slate-700">{resource.sourceType}</span>
                          </div>
                        )}
                        {resource.language && (
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400">Lang:</span>
                            <span className="font-medium text-slate-700">{resource.language}</span>
                          </div>
                        )}
                        {resource.dataGranularity && (
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400">Granularity:</span>
                            <span className="font-medium text-slate-700">{resource.dataGranularity}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom action row & links */}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {resource.links.slice(0, 3).map((link) => (
                          <a
                            key={link.id}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 transition-colors"
                          >
                            <span>🔗</span>
                            <span>{link.linkType.replace(/_/g, ' ').toLowerCase()}</span>
                            <svg className="h-3 w-3 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                              <path
                                fillRule="evenodd"
                                d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </a>
                        ))}
                      </div>

                      <Link href={`/resources/${resource.id}`}>
                        <Button variant="ghost" size="sm" className="text-xs font-semibold text-emerald-700">
                          View details &rarr;
                        </Button>
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {/* Pagination Controls */}
            <div className="mt-8">
              <ResourcePagination
                currentPage={page}
                totalPages={totalPages}
                totalCount={totalCount}
                pageSize={pageSize}
                searchParams={currentParamsRecord}
              />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
