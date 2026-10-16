import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma, Prisma, LinkHealthStatus, LinkType } from '@repo/database'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  BadgeVariant,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  EmptyState,
} from '@repo/ui'
import { ManualCheckButton } from './manual-check-button'
import { RemediateModal } from './remediate-modal'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

const STATUS_CONFIG: Record<
  LinkHealthStatus,
  {
    label: string
    variant: BadgeVariant
    description: string
    dotColor: string
  }
> = {
  [LinkHealthStatus.HEALTHY]: {
    label: 'Healthy',
    variant: 'success',
    description: '2xx OK responses with accessible content',
    dotColor: 'bg-emerald-500',
  },
  [LinkHealthStatus.REDIRECTED]: {
    label: 'Redirected',
    variant: 'info',
    description: '3xx redirects followed safely to target',
    dotColor: 'bg-blue-500',
  },
  [LinkHealthStatus.BROKEN]: {
    label: 'Broken',
    variant: 'danger',
    description: '404/410 Not Found or non-existent endpoint',
    dotColor: 'bg-red-500',
  },
  [LinkHealthStatus.TIMEOUT]: {
    label: 'Timeout',
    variant: 'warning',
    description: 'Exceeded response timeout limit',
    dotColor: 'bg-amber-500',
  },
  [LinkHealthStatus.RATE_LIMITED]: {
    label: 'Rate Limited',
    variant: 'purple',
    description: '429 Too Many Requests response',
    dotColor: 'bg-purple-500',
  },
  [LinkHealthStatus.BLOCKED]: {
    label: 'Blocked',
    variant: 'danger',
    description: '403 Forbidden or access rejected',
    dotColor: 'bg-rose-600',
  },
  [LinkHealthStatus.SERVER_ERROR]: {
    label: 'Server Error',
    variant: 'warning',
    description: '5xx temporary upstream failure (not broken)',
    dotColor: 'bg-orange-500',
  },
  [LinkHealthStatus.UNKNOWN]: {
    label: 'Unknown',
    variant: 'default',
    description: 'Pending initial verification or scan',
    dotColor: 'bg-slate-400',
  },
}

function formatRelativeTime(date: Date | null): string {
  if (!date) return 'Never checked'
  const now = Date.now()
  const diffMs = now - new Date(date).getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'Just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function formatLatency(ms: number | null): { text: string; color: string } {
  if (ms === null || ms === undefined)
    return { text: '—', color: 'text-slate-400' }
  if (ms < 500)
    return { text: `${ms} ms`, color: 'text-emerald-700 font-medium' }
  if (ms < 1500)
    return { text: `${ms} ms`, color: 'text-amber-700 font-medium' }
  return { text: `${ms} ms`, color: 'text-rose-700 font-medium' }
}

export default async function AdminLinkHealthDashboard(props: PageProps) {
  const session = await auth()
  if (!session?.user) {
    redirect('/admin/login?callbackUrl=/admin/link-health')
  }

  const resolvedSearchParams = await props.searchParams
  const getParam = (key: string): string | undefined => {
    const val = resolvedSearchParams[key]
    if (Array.isArray(val)) return val[0]
    return val
  }

  const statusParam = getParam('status')?.toUpperCase() || 'ALL'
  const typeParam = getParam('type')?.toUpperCase() || 'ALL'
  const q = getParam('q')?.trim() || ''
  const sortParam = getParam('sort') || 'recently_checked'
  const rawPage = parseInt(getParam('page') || '1', 10)
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1
  const pageSize = 20

  // Aggregate counts per status using Prisma groupBy for indexed efficiency
  const [totalLinks, groupedCounts] = await Promise.all([
    prisma.resourceLink.count(),
    prisma.resourceLink.groupBy({
      by: ['status'],
      _count: {
        _all: true,
      },
    }),
  ])

  const countMap: Record<LinkHealthStatus, number> = {
    [LinkHealthStatus.HEALTHY]: 0,
    [LinkHealthStatus.REDIRECTED]: 0,
    [LinkHealthStatus.BROKEN]: 0,
    [LinkHealthStatus.TIMEOUT]: 0,
    [LinkHealthStatus.RATE_LIMITED]: 0,
    [LinkHealthStatus.BLOCKED]: 0,
    [LinkHealthStatus.SERVER_ERROR]: 0,
    [LinkHealthStatus.UNKNOWN]: 0,
  }

  for (const group of groupedCounts) {
    if (group.status in countMap) {
      countMap[group.status] = group._count._all
    }
  }

  const healthyCount = countMap[LinkHealthStatus.HEALTHY]
  const brokenCount = countMap[LinkHealthStatus.BROKEN]
  const redirectedCount = countMap[LinkHealthStatus.REDIRECTED]
  const timeoutCount = countMap[LinkHealthStatus.TIMEOUT]
  const rateLimitedCount = countMap[LinkHealthStatus.RATE_LIMITED]
  const blockedCount = countMap[LinkHealthStatus.BLOCKED]
  const serverErrorCount = countMap[LinkHealthStatus.SERVER_ERROR]
  const unknownCount = countMap[LinkHealthStatus.UNKNOWN]

  const issuesCount =
    brokenCount +
    blockedCount +
    timeoutCount +
    serverErrorCount +
    rateLimitedCount
  const uptimePercent =
    totalLinks > 0 ? Math.round((healthyCount / totalLinks) * 100) : 0

  // Build filtered query
  const where: Prisma.ResourceLinkWhereInput = {}

  if (statusParam in LinkHealthStatus) {
    where.status = statusParam as LinkHealthStatus
  }

  if (typeParam in LinkType) {
    where.linkType = typeParam as LinkType
  }

  if (q) {
    where.OR = [
      { url: { contains: q, mode: 'insensitive' } },
      { finalUrl: { contains: q, mode: 'insensitive' } },
      { errorMessage: { contains: q, mode: 'insensitive' } },
      { resource: { name: { contains: q, mode: 'insensitive' } } },
    ]
  }

  // Determine sort order
  let orderBy: Prisma.ResourceLinkOrderByWithRelationInput = {
    lastCheckedAt: 'desc',
  }
  if (sortParam === 'oldest_checked') {
    orderBy = { lastCheckedAt: 'asc' }
  } else if (sortParam === 'slowest') {
    orderBy = { responseTimeMs: 'desc' }
  } else if (sortParam === 'fastest') {
    orderBy = { responseTimeMs: 'asc' }
  } else if (sortParam === 'newest') {
    orderBy = { createdAt: 'desc' }
  }

  // Execute paginated query (strictly bounded to pageSize to prevent memory bloat)
  const [links, filteredTotal] = await Promise.all([
    prisma.resourceLink.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy,
      include: {
        resource: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        audits: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    }),
    prisma.resourceLink.count({ where }),
  ])

  const totalPages = Math.ceil(filteredTotal / pageSize) || 1

  // Helper for generating query links preserving active filters
  const buildFilterUrl = (
    overrides: Record<string, string | number | undefined>,
  ) => {
    const params = new URLSearchParams()
    const current = {
      status: statusParam !== 'ALL' ? statusParam : undefined,
      type: typeParam !== 'ALL' ? typeParam : undefined,
      q: q || undefined,
      sort: sortParam !== 'recently_checked' ? sortParam : undefined,
      page: page > 1 ? page : undefined,
      ...overrides,
    }

    for (const [key, value] of Object.entries(current)) {
      if (value !== undefined && value !== '' && value !== 'ALL') {
        params.set(key, String(value))
      }
    }
    const queryStr = params.toString()
    return `/admin/link-health${queryStr ? `?${queryStr}` : ''}`
  }

  return (
    <div className='min-h-screen bg-slate-50 pb-16'>
      {/* Admin Header */}
      <header className='border-b border-slate-200 bg-white'>
        <div className='mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8'>
          <div className='flex items-center gap-3'>
            <Link
              href='/admin'
              className='text-slate-400 hover:text-slate-600 transition-colors text-sm flex items-center gap-1 font-medium'
            >
              &larr; Admin Console
            </Link>
            <span className='text-slate-300'>|</span>
            <div className='flex items-center gap-2'>
              <span className='text-xl'>🩺</span>
              <span className='font-bold text-slate-900 text-lg'>
                Link Health Dashboard
              </span>
            </div>
            <Badge variant='success' size='sm'>
              Live Auditing
            </Badge>
          </div>

          <ManualCheckButton />
        </div>
      </header>

      {/* Main Container */}
      <main className='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8'>
        {/* Title and summary */}
        <div>
          <h1 className='text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl'>
            Catalogue Link Health & Telemetry
          </h1>
          <p className='mt-1 text-sm text-slate-500'>
            Real-time monitoring, SSRF-guarded verification, and HTTP status
            diagnostics for all institutional dataset links.
          </p>
        </div>

        {/* Primary Stat Cards */}
        <div className='grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4'>
          <Card className='border-slate-200'>
            <CardHeader className='pb-2'>
              <CardDescription>Total Registered Endpoints</CardDescription>
              <CardTitle className='text-3xl font-extrabold text-slate-900'>
                {totalLinks}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className='text-xs text-slate-500'>
                APIs, direct downloads, and web portals
              </span>
            </CardContent>
          </Card>

          <Card className='border-slate-200'>
            <CardHeader className='pb-2'>
              <CardDescription>Healthy & Accessible</CardDescription>
              <CardTitle className='text-3xl font-extrabold text-emerald-600'>
                {healthyCount}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className='text-xs text-emerald-700 font-medium'>
                {uptimePercent}% accessible uptime
              </span>
            </CardContent>
          </Card>

          <Card className='border-slate-200'>
            <CardHeader className='pb-2'>
              <CardDescription>Detected Issues / Action Needed</CardDescription>
              <CardTitle
                className={`text-3xl font-extrabold ${issuesCount > 0 ? 'text-red-600' : 'text-slate-700'}`}
              >
                {issuesCount}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className='text-xs text-slate-500'>
                {brokenCount} broken &bull; {blockedCount} blocked &bull;{' '}
                {timeoutCount} timeout &bull; {serverErrorCount} 5xx
              </span>
            </CardContent>
          </Card>

          <Card className='border-slate-200'>
            <CardHeader className='pb-2'>
              <CardDescription>Redirects & Unchecked</CardDescription>
              <CardTitle className='text-3xl font-extrabold text-blue-600'>
                {redirectedCount}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className='text-xs text-slate-500'>
                {redirectedCount} redirected &bull; {unknownCount} pending
                verification
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Status Distribution Pills / Mini-Cards (All 8 Statuses from Spec) */}
        <div className='rounded-xl border border-slate-200 bg-white p-4 shadow-2xs'>
          <div className='text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3'>
            Endpoint Status Breakdown (Click to filter)
          </div>
          <div className='grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8'>
            {(
              [
                LinkHealthStatus.HEALTHY,
                LinkHealthStatus.REDIRECTED,
                LinkHealthStatus.BROKEN,
                LinkHealthStatus.TIMEOUT,
                LinkHealthStatus.RATE_LIMITED,
                LinkHealthStatus.BLOCKED,
                LinkHealthStatus.SERVER_ERROR,
                LinkHealthStatus.UNKNOWN,
              ] as const
            ).map((st) => {
              const cfg = STATUS_CONFIG[st]
              const isActive = statusParam === st
              const count = countMap[st]

              return (
                <Link
                  key={st}
                  href={buildFilterUrl({
                    status: isActive ? 'ALL' : st,
                    page: 1,
                  })}
                  className={`flex flex-col items-center justify-center rounded-lg border p-3 text-center transition-all ${
                    isActive
                      ? 'border-emerald-600 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-600'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/70 hover:border-slate-300'
                  }`}
                >
                  <div className='flex items-center gap-1.5'>
                    <span className={`h-2 w-2 rounded-full ${cfg.dotColor}`} />
                    <span className='text-xs font-semibold text-slate-700'>
                      {cfg.label}
                    </span>
                  </div>
                  <span className='mt-1 text-lg font-bold text-slate-900'>
                    {count}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className='rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-4'>
          {/* Status Tabs */}
          <div className='flex items-center gap-1 overflow-x-auto border-b border-slate-200 pb-3'>
            <Link
              href={buildFilterUrl({ status: 'ALL', page: 1 })}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                statusParam === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              All Statuses ({totalLinks})
            </Link>

            {(
              [
                LinkHealthStatus.HEALTHY,
                LinkHealthStatus.REDIRECTED,
                LinkHealthStatus.BROKEN,
                LinkHealthStatus.TIMEOUT,
                LinkHealthStatus.RATE_LIMITED,
                LinkHealthStatus.BLOCKED,
                LinkHealthStatus.SERVER_ERROR,
                LinkHealthStatus.UNKNOWN,
              ] as const
            ).map((st) => {
              const cfg = STATUS_CONFIG[st]
              const count = countMap[st]
              const isActive = statusParam === st

              return (
                <Link
                  key={st}
                  href={buildFilterUrl({ status: st, page: 1 })}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-white' : cfg.dotColor}`}
                  />
                  {cfg.label} ({count})
                </Link>
              )
            })}
          </div>

          {/* Search and Secondary Filter Controls */}
          <form
            method='GET'
            action='/admin/link-health'
            className='grid grid-cols-1 gap-3 sm:grid-cols-4'
          >
            {statusParam !== 'ALL' && (
              <input type='hidden' name='status' value={statusParam} />
            )}

            <div className='sm:col-span-2'>
              <input
                type='text'
                name='q'
                defaultValue={q}
                placeholder='Search by URL, destination, or dataset title...'
                className='w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500'
              />
            </div>

            <div>
              <select
                name='type'
                defaultValue={typeParam}
                className='w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500'
              >
                <option value='ALL'>All Link Types</option>
                <option value={LinkType.DATA}>DATA</option>
                <option value={LinkType.DOWNLOAD}>DOWNLOAD</option>
                <option value={LinkType.API}>API</option>
                <option value={LinkType.WEBSITE}>WEBSITE</option>
                <option value={LinkType.DOCUMENTATION}>DOCUMENTATION</option>
                <option value={LinkType.OTHER}>OTHER</option>
              </select>
            </div>

            <div className='flex gap-2'>
              <select
                name='sort'
                defaultValue={sortParam}
                className='w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500'
              >
                <option value='recently_checked'>Recently Checked</option>
                <option value='oldest_checked'>Oldest Checked / Due</option>
                <option value='slowest'>Slowest Latency</option>
                <option value='fastest'>Fastest Latency</option>
                <option value='newest'>Newly Added</option>
              </select>

              <Button
                type='submit'
                size='sm'
                variant='outline'
                className='px-3 shrink-0'
              >
                Filter
              </Button>

              {(q ||
                typeParam !== 'ALL' ||
                statusParam !== 'ALL' ||
                sortParam !== 'recently_checked') && (
                <Link href='/admin/link-health'>
                  <Button
                    type='button'
                    size='sm'
                    variant='ghost'
                    className='text-slate-500 hover:text-slate-700'
                  >
                    Reset
                  </Button>
                </Link>
              )}
            </div>
          </form>
        </div>

        {/* Table of Links (strictly paginated: pageSize=20) */}
        {links.length === 0 ? (
          <EmptyState
            title='No links matched criteria'
            description='Try adjusting your status filter, search query, or link type.'
            action={
              <Link href='/admin/link-health'>
                <Button size='sm' variant='outline'>
                  Clear All Filters
                </Button>
              </Link>
            }
          />
        ) : (
          <div className='rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden'>
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow className='bg-slate-50/75'>
                    <TableHead className='w-[30%]'>
                      Endpoint & Dataset
                    </TableHead>
                    <TableHead className='w-[12%]'>Type</TableHead>
                    <TableHead className='w-[16%]'>Health Status</TableHead>
                    <TableHead className='w-[12%]'>HTTP Code</TableHead>
                    <TableHead className='w-[12%]'>Latency</TableHead>
                    <TableHead className='w-[12%]'>Last Checked</TableHead>
                    <TableHead className='w-[6%] text-right'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {links.map((link) => {
                    const cfg = STATUS_CONFIG[link.status]
                    const latency = formatLatency(link.responseTimeMs)

                    return (
                      <TableRow
                        key={link.id}
                        className='hover:bg-slate-50/50 transition-colors'
                      >
                        {/* Endpoint & Dataset */}
                        <TableCell>
                          <div className='space-y-1'>
                            <a
                              href={link.url}
                              target='_blank'
                              rel='noopener noreferrer'
                              className='font-mono text-xs text-slate-800 hover:text-emerald-600 transition-colors break-all flex items-center gap-1 group font-medium'
                              title={link.url}
                            >
                              <span className='truncate max-w-sm sm:max-w-md'>
                                {link.url}
                              </span>
                              <span className='text-slate-400 group-hover:text-emerald-600 shrink-0'>
                                ↗
                              </span>
                            </a>

                            {link.finalUrl && link.finalUrl !== link.url && (
                              <div className='text-[11px] text-blue-600 flex items-center gap-1 font-mono truncate max-w-sm'>
                                <span>↳ Redirects to:</span>
                                <span className='truncate'>
                                  {link.finalUrl}
                                </span>
                              </div>
                            )}

                            <div className='flex items-center gap-2'>
                              <span className='text-[11px] text-slate-400'>
                                Dataset:
                              </span>
                              <Link
                                href={`/admin/resources/${link.resource.id}`}
                                className='text-xs text-slate-600 hover:text-emerald-700 hover:underline font-medium truncate max-w-xs'
                              >
                                {link.resource.name}
                              </Link>
                            </div>
                          </div>
                        </TableCell>

                        {/* Type */}
                        <TableCell>
                          <Badge
                            variant='default'
                            size='sm'
                            className='font-mono text-[10px]'
                          >
                            {link.linkType}
                          </Badge>
                        </TableCell>

                        {/* Health Status */}
                        <TableCell>
                          <div className='space-y-1'>
                            <Badge variant={cfg.variant} size='sm' dot>
                              {cfg.label}
                            </Badge>

                            {link.errorMessage && (
                              <div
                                className='text-[11px] text-red-600 max-w-xs truncate'
                                title={link.errorMessage}
                              >
                                ⚠ {link.errorMessage}
                              </div>
                            )}
                          </div>
                        </TableCell>

                        {/* HTTP Code */}
                        <TableCell>
                          {link.httpStatus ? (
                            <span
                              className={`font-mono text-xs font-semibold px-2 py-0.5 rounded-sm ${
                                link.httpStatus >= 200 && link.httpStatus < 300
                                  ? 'bg-emerald-50 text-emerald-800'
                                  : link.httpStatus >= 300 &&
                                      link.httpStatus < 400
                                    ? 'bg-blue-50 text-blue-800'
                                    : link.httpStatus >= 400 &&
                                        link.httpStatus < 500
                                      ? 'bg-red-50 text-red-800'
                                      : 'bg-amber-50 text-amber-800'
                              }`}
                            >
                              HTTP {link.httpStatus}
                            </span>
                          ) : (
                            <span className='font-mono text-xs text-slate-400'>
                              —
                            </span>
                          )}
                        </TableCell>

                        {/* Latency */}
                        <TableCell>
                          <span className={`text-xs ${latency.color}`}>
                            {latency.text}
                          </span>
                        </TableCell>

                        {/* Last Checked */}
                        <TableCell>
                          <div className='space-y-0.5'>
                            <span className='text-xs text-slate-700 font-medium block'>
                              {formatRelativeTime(link.lastCheckedAt)}
                            </span>
                            {link.lastCheckedAt && (
                              <span className='text-[10px] text-slate-400 block font-mono'>
                                {new Date(
                                  link.lastCheckedAt,
                                ).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className='text-right'>
                          <div className='flex items-center justify-end gap-1.5'>
                            <RemediateModal
                              linkId={link.id}
                              currentUrl={link.url}
                              currentStatus={link.status}
                              resourceName={link.resource.name}
                              audits={link.audits}
                            />
                            <Link href={`/admin/resources/${link.resource.id}`}>
                              <Button
                                size='sm'
                                variant='ghost'
                                className='text-slate-600 hover:text-emerald-700 text-xs'
                              >
                                Manage
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className='flex items-center justify-between border-t border-slate-200 px-4 py-3 bg-slate-50/50'>
                <span className='text-xs text-slate-500'>
                  Showing {(page - 1) * pageSize + 1} to{' '}
                  {Math.min(page * pageSize, filteredTotal)} of {filteredTotal}{' '}
                  endpoints
                </span>

                <div className='flex items-center gap-2'>
                  {page > 1 ? (
                    <Link href={buildFilterUrl({ page: page - 1 })}>
                      <Button size='sm' variant='outline'>
                        Previous
                      </Button>
                    </Link>
                  ) : (
                    <Button size='sm' variant='outline' disabled>
                      Previous
                    </Button>
                  )}

                  <span className='text-xs font-medium text-slate-700'>
                    Page {page} of {totalPages}
                  </span>

                  {page < totalPages ? (
                    <Link href={buildFilterUrl({ page: page + 1 })}>
                      <Button size='sm' variant='outline'>
                        Next
                      </Button>
                    </Link>
                  ) : (
                    <Button size='sm' variant='outline' disabled>
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
  )
}
