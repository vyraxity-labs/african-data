import * as React from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma, ResourceStatus } from '@repo/database'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@repo/ui'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { id } = await props.params
  const resource = await prisma.resource.findUnique({
    where: { id, status: ResourceStatus.ACTIVE },
    select: { name: true, description: true },
  })

  if (!resource) {
    return {
      title: 'Resource Not Found | African Data Directory',
    }
  }

  return {
    title: `${resource.name} | African Data Directory`,
    description:
      resource.description ||
      `Data catalogue resource details for ${resource.name}`,
  }
}

function getHealthBadgeVariant(
  status: string,
): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' {
  switch (status) {
    case 'HEALTHY':
      return 'success'
    case 'REDIRECTED':
      return 'info'
    case 'RATE_LIMITED':
    case 'BLOCKED':
      return 'warning'
    case 'BROKEN':
    case 'TIMEOUT':
    case 'SERVER_ERROR':
      return 'danger'
    case 'UNKNOWN':
    default:
      return 'default'
  }
}

function formatLinkType(linkType: string): string {
  switch (linkType) {
    case 'API':
      return 'REST API / Feed'
    case 'DATA':
      return 'Primary Data Source'
    case 'WEBSITE':
      return 'Portal / Catalogue Web'
    case 'DOWNLOAD':
      return 'Bulk Download / Export'
    case 'DOCUMENTATION':
      return 'Methodology & Docs'
    default:
      return linkType.replace(/_/g, ' ')
  }
}

export default async function ResourceDetailPage(props: PageProps) {
  const { id } = await props.params

  const resource = await prisma.resource.findUnique({
    where: {
      id,
      status: ResourceStatus.ACTIVE,
    },
    include: {
      institution: {
        select: {
          id: true,
          name: true,
          website: true,
          description: true,
          type: true,
          country: true,
        },
      },
      links: {
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!resource) {
    notFound()
  }

  // Extract normalized formats from metadata json if available
  const rawMeta = resource.metadata as Record<string, unknown> | null
  const normalizedMeta = rawMeta?.['normalized'] as
    | Record<string, unknown>
    | undefined
  const formats: string[] = Array.isArray(normalizedMeta?.['formats'])
    ? (normalizedMeta?.['formats'] as string[])
    : []

  return (
    <div className='min-h-screen bg-slate-50 pb-20'>
      {/* Breadcrumb Navigation */}
      <nav
        aria-label='Breadcrumb'
        className='border-b border-slate-200 bg-white'
      >
        <div className='mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8'>
          <ol className='flex items-center space-x-2 text-xs text-slate-500'>
            <li>
              <Link
                href='/'
                className='hover:text-emerald-700 transition-colors'
              >
                Home
              </Link>
            </li>
            <li className='text-slate-300'>/</li>
            <li>
              <Link
                href='/resources'
                className='hover:text-emerald-700 transition-colors'
              >
                Resources
              </Link>
            </li>
            <li className='text-slate-300'>/</li>
            <li
              className='font-medium text-slate-900 truncate max-w-md'
              aria-current='page'
            >
              {resource.name}
            </li>
          </ol>
        </div>
      </nav>

      {/* Hero Header */}
      <section className='border-b border-slate-200 bg-white shadow-xs'>
        <div className='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'>
          <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
            <Link href='/resources'>
              <Button
                variant='ghost'
                size='sm'
                className='text-xs text-slate-600 hover:text-emerald-700'
              >
                &larr; Back to Catalogue
              </Button>
            </Link>

            <div className='flex items-center gap-2'>
              <Link
                href={`/resources?industry=${encodeURIComponent(resource.industry || '')}`}
              >
                {resource.industry && (
                  <Badge variant='default' className='text-xs'>
                    {resource.industry}
                  </Badge>
                )}
              </Link>
              {resource.accessType && (
                <Badge
                  variant={
                    resource.accessType.toLowerCase().includes('open')
                      ? 'success'
                      : 'default'
                  }
                  className='text-xs'
                >
                  {resource.accessType}
                </Badge>
              )}
              {resource.apiAvailable && (
                <Badge variant='info' className='text-xs'>
                  API Available
                </Badge>
              )}
              {resource.priority && (
                <Badge variant='purple' className='text-xs'>
                  {resource.priority} Priority
                </Badge>
              )}
            </div>
          </div>

          <div className='mt-4'>
            <h1 className='text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl'>
              {resource.name}
            </h1>

            {resource.institution && (
              <div className='mt-2 flex items-center gap-2 text-sm text-slate-600'>
                <span>Custodian:</span>
                <Link
                  href={`/institutions/${resource.institution.id}`}
                  className='font-medium text-emerald-700 hover:text-emerald-800 hover:underline'
                >
                  🏛️ {resource.institution.name}
                </Link>
                {resource.institution.country && (
                  <span className='text-slate-400'>
                    ({resource.institution.country})
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Content Layout */}
      <div className='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'>
        <div className='grid grid-cols-1 gap-8 lg:grid-cols-3'>
          {/* Main Column */}
          <div className='space-y-8 lg:col-span-2'>
            {/* Overview / Description */}
            <Card>
              <CardHeader>
                <CardTitle>Resource Overview</CardTitle>
                <CardDescription>
                  Scope and analytical contents of this dataset
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className='prose prose-slate max-w-none text-sm text-slate-700 leading-relaxed whitespace-pre-line'>
                  {resource.description ||
                    'No detailed description provided for this catalogue record.'}
                </div>

                {resource.notes && (
                  <div className='mt-6 rounded-lg border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 leading-relaxed'>
                    <div className='font-semibold mb-1 flex items-center gap-1.5 text-amber-800'>
                      <span>💡</span>
                      <span>Cataloguer Notes & Usage Context</span>
                    </div>
                    {resource.notes}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Direct Access & Endpoints */}
            <Card>
              <CardHeader>
                <div className='flex items-center justify-between'>
                  <div>
                    <CardTitle>Access Endpoints & Data Links</CardTitle>
                    <CardDescription>
                      Verified links, APIs, and direct download portals (
                      {resource.links.length} total)
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {resource.links.length === 0 ? (
                  <p className='text-sm text-slate-500 italic'>
                    No active URLs or download endpoints registered for this
                    record.
                  </p>
                ) : (
                  <div className='divide-y divide-slate-100'>
                    {resource.links.map((link) => (
                      <div key={link.id} className='py-4 first:pt-0 last:pb-0'>
                        <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                          <div className='space-y-1'>
                            <div className='flex items-center gap-2'>
                              <span className='text-xs font-semibold text-slate-900'>
                                {formatLinkType(link.linkType)}
                              </span>
                              <Badge
                                variant={getHealthBadgeVariant(link.status)}
                                size='sm'
                                dot={link.status === 'HEALTHY'}
                              >
                                {link.status}
                              </Badge>
                              {link.httpStatus && (
                                <span className='text-[11px] font-mono text-slate-400'>
                                  HTTP {link.httpStatus}
                                </span>
                              )}
                              {link.responseTimeMs && (
                                <span className='text-[11px] font-mono text-slate-400'>
                                  {link.responseTimeMs}ms
                                </span>
                              )}
                            </div>
                            <p className='font-mono text-xs text-slate-500 break-all'>
                              {link.url}
                            </p>
                          </div>

                          <div className='shrink-0 pt-2 sm:pt-0'>
                            <a
                              href={link.url}
                              target='_blank'
                              rel='noopener noreferrer'
                              className='inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 transition-colors focus:ring-2 focus:ring-emerald-600 focus:outline-hidden'
                            >
                              <span>Open URL</span>
                              <svg
                                className='h-3.5 w-3.5'
                                viewBox='0 0 20 20'
                                fill='currentColor'
                              >
                                <path
                                  fillRule='evenodd'
                                  d='M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z'
                                  clipRule='evenodd'
                                />
                              </svg>
                            </a>
                          </div>
                        </div>

                        {link.lastCheckedAt && (
                          <div className='mt-1 text-[11px] text-slate-400'>
                            Last checked:{' '}
                            {new Date(link.lastCheckedAt).toLocaleDateString()}{' '}
                            at{' '}
                            {new Date(link.lastCheckedAt).toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Technical Specifications */}
            <Card>
              <CardHeader>
                <CardTitle>Technical Metadata</CardTitle>
                <CardDescription>
                  Coverage, granularity, formats, and update frequency
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className='grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 text-xs'>
                  <div className='rounded-lg bg-slate-50 p-3'>
                    <dt className='text-slate-400'>Source Type</dt>
                    <dd className='mt-1 font-semibold text-slate-800'>
                      {resource.sourceType || 'Not specified'}
                    </dd>
                  </div>

                  <div className='rounded-lg bg-slate-50 p-3'>
                    <dt className='text-slate-400'>Category</dt>
                    <dd className='mt-1 font-semibold text-slate-800'>
                      {resource.category || 'Not specified'}
                    </dd>
                  </div>

                  <div className='rounded-lg bg-slate-50 p-3'>
                    <dt className='text-slate-400'>Country / Coverage</dt>
                    <dd className='mt-1 font-semibold text-slate-800'>
                      {resource.countryCoverage || 'Pan-African'}
                    </dd>
                  </div>

                  <div className='rounded-lg bg-slate-50 p-3'>
                    <dt className='text-slate-400'>Language</dt>
                    <dd className='mt-1 font-semibold text-slate-800'>
                      {resource.language || 'English (default)'}
                    </dd>
                  </div>

                  <div className='rounded-lg bg-slate-50 p-3'>
                    <dt className='text-slate-400'>Data Granularity</dt>
                    <dd className='mt-1 font-semibold text-slate-800'>
                      {resource.dataGranularity || 'Country-level aggregate'}
                    </dd>
                  </div>

                  <div className='rounded-lg bg-slate-50 p-3'>
                    <dt className='text-slate-400'>Update Frequency</dt>
                    <dd className='mt-1 font-semibold text-slate-800'>
                      {resource.updateFrequency || 'Periodic / Continuous'}
                    </dd>
                  </div>

                  {formats.length > 0 && (
                    <div className='col-span-1 sm:col-span-2 rounded-lg bg-slate-50 p-3'>
                      <dt className='text-slate-400 mb-1.5'>
                        Distribution Formats
                      </dt>
                      <dd className='flex flex-wrap gap-1.5'>
                        {formats.map((fmt) => (
                          <Badge key={fmt} variant='default' size='sm'>
                            {fmt}
                          </Badge>
                        ))}
                      </dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className='space-y-6 lg:col-span-1'>
            {/* Custodian Card */}
            {resource.institution ? (
              <Card>
                <CardHeader>
                  <CardTitle className='text-base'>
                    Custodian Institution
                  </CardTitle>
                  <CardDescription>
                    Primary organisation managing this source
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-3'>
                  <div className='font-semibold text-slate-900 text-sm'>
                    {resource.institution.name}
                  </div>

                  {resource.institution.description && (
                    <p className='text-xs text-slate-600 line-clamp-3 leading-relaxed'>
                      {resource.institution.description}
                    </p>
                  )}

                  <div className='space-y-1 text-xs text-slate-500'>
                    {resource.institution.type && (
                      <div className='flex items-center justify-between'>
                        <span className='text-slate-400'>
                          Organisation Type:
                        </span>
                        <span className='font-medium text-slate-700'>
                          {resource.institution.type}
                        </span>
                      </div>
                    )}
                    {resource.institution.country && (
                      <div className='flex items-center justify-between'>
                        <span className='text-slate-400'>Headquarters:</span>
                        <span className='font-medium text-slate-700'>
                          {resource.institution.country}
                        </span>
                      </div>
                    )}
                  </div>

                  {resource.institution.website && (
                    <div className='pt-2'>
                      <a
                        href={resource.institution.website}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline'
                      >
                        <span>Visit institution website</span>
                        <span>&rarr;</span>
                      </a>
                    </div>
                  )}

                  <div className='border-t border-slate-100 pt-3'>
                    <Link href={`/institutions/${resource.institution.id}`}>
                      <Button
                        variant='outline'
                        size='sm'
                        className='w-full text-xs'
                      >
                        View Institution Records &rarr;
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className='text-base'>
                    Custodian Institution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className='text-xs text-slate-500'>
                    This resource is maintained by an independent contributor or
                    autonomous consortium.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Record Information */}
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Record Details</CardTitle>
              </CardHeader>
              <CardContent className='space-y-2 text-xs'>
                <div className='flex items-center justify-between'>
                  <span className='text-slate-400'>Record ID:</span>
                  <span className='font-mono text-slate-600 text-[11px] truncate max-w-37.5'>
                    {resource.id}
                  </span>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-slate-400'>Date Indexed:</span>
                  <span className='text-slate-700'>
                    {new Date(resource.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-slate-400'>Last Revised:</span>
                  <span className='text-slate-700'>
                    {new Date(resource.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-slate-400'>Publication Status:</span>
                  <Badge variant='success' size='sm'>
                    {resource.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Share / Actions */}
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Explore More Data</CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                <p className='text-xs text-slate-600'>
                  Find related statistical repositories and research datasets in
                  this sector.
                </p>
                <Link
                  href={
                    resource.industry
                      ? `/resources?industry=${encodeURIComponent(resource.industry)}`
                      : '/resources'
                  }
                >
                  <Button
                    variant='primary'
                    size='sm'
                    className='w-full text-xs'
                  >
                    Browse More {resource.industry || 'Data'} &rarr;
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
