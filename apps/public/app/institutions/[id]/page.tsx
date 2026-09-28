import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma, Prisma, ResourceStatus } from '@repo/database'
import { Badge, Button, EmptyState } from '@repo/ui'
import { ResourcePagination } from '../../resources/resource-pagination'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { id } = await props.params
  const institution = await prisma.institution.findUnique({
    where: { id },
    select: { name: true, description: true },
  })

  if (!institution) {
    return {
      title: 'Institution Not Found | African Data Directory',
    }
  }

  return {
    title: `${institution.name} | African Data Directory`,
    description:
      institution.description ||
      `Discover open datasets, statistics, and repositories published by ${institution.name}.`,
  }
}

export default async function InstitutionDetailPage(props: PageProps) {
  const { id } = await props.params
  const resolvedSearchParams = await props.searchParams

  const rawPage = parseInt(
    (Array.isArray(resolvedSearchParams['page'])
      ? resolvedSearchParams['page'][0]
      : resolvedSearchParams['page']) || '1',
    10,
  )
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1
  const pageSize = 10

  // 1. Fetch institution details
  const institution = await prisma.institution.findUnique({
    where: { id },
  })

  if (!institution) {
    notFound()
  }

  // 2. Fetch associated active resources with server-side pagination
  const where: Prisma.ResourceWhereInput = {
    institutionId: id,
    status: ResourceStatus.ACTIVE,
  }

  const [totalCount, resources] = await Promise.all([
    prisma.resource.count({ where }),
    prisma.resource.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        links: {
          select: {
            id: true,
            url: true,
            linkType: true,
            status: true,
          },
          take: 3,
        },
      },
    }),
  ])

  const totalPages = Math.ceil(totalCount / pageSize)

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
            <li>
              <span className='text-slate-500'>Institutions</span>
            </li>
            <li className='text-slate-300'>/</li>
            <li
              className='font-medium text-slate-900 truncate max-w-md'
              aria-current='page'
            >
              {institution.name}
            </li>
          </ol>
        </div>
      </nav>

      {/* Institution Hero Profile */}
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
              {institution.country && (
                <Badge variant='default' className='text-xs'>
                  🌍 {institution.country}
                </Badge>
              )}
              {institution.type && (
                <Badge variant='info' className='text-xs'>
                  {institution.type}
                </Badge>
              )}
            </div>
          </div>

          <div className='mt-4'>
            <div className='flex items-center gap-3'>
              <div className='flex w-14 md:w-16 aspect-square items-center justify-center rounded-xl bg-emerald-50 text-lg md:text-2xl text-emerald-700'>
                🏛️
              </div>
              <div>
                <h1 className='text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl'>
                  {institution.name}
                </h1>
                {institution.website && (
                  <a
                    href={institution.website}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:underline mt-1'
                  >
                    <span>
                      {institution.website.replace(/^https?:\/\//, '')}
                    </span>
                    <svg
                      className='h-3 w-3'
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
                )}
              </div>
            </div>

            {institution.description && (
              <p className='mt-4 max-w-3xl text-sm text-slate-600 leading-relaxed'>
                {institution.description}
              </p>
            )}

            {/* Quick Metrics Bar */}
            <div className='mt-6 flex flex-wrap gap-4 border-t border-slate-100 pt-4 text-xs text-slate-500'>
              <div>
                <span className='text-slate-400'>Published Datasets:</span>{' '}
                <strong className='text-slate-800 font-semibold'>
                  {totalCount}
                </strong>
              </div>
              <div>
                <span className='text-slate-400'>Headquarters:</span>{' '}
                <strong className='text-slate-800 font-semibold'>
                  {institution.country || 'Pan-African'}
                </strong>
              </div>
              <div>
                <span className='text-slate-400'>Type:</span>{' '}
                <strong className='text-slate-800 font-semibold'>
                  {institution.type || 'Data Provider'}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Associated Resources Catalogue */}
      <div className='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'>
        <div className='mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <h2 className='text-lg font-bold text-slate-900 sm:text-xl'>
              Catalogued Datasets & Portals
            </h2>
            <p className='text-xs text-slate-500'>
              Active open data sources curated under {institution.name}
            </p>
          </div>

          <div className='text-xs text-slate-500'>
            {totalCount > 0 && (
              <span>
                Showing <strong>{(page - 1) * pageSize + 1}</strong> to{' '}
                <strong>{Math.min(page * pageSize, totalCount)}</strong> of{' '}
                <strong>{totalCount}</strong>
              </span>
            )}
          </div>
        </div>

        {resources.length === 0 ? (
          <EmptyState
            title='No active datasets found'
            description={`There are currently no published data resources associated with ${institution.name}.`}
            action={
              <Link href='/resources'>
                <Button variant='primary'>Browse Full Catalogue</Button>
              </Link>
            }
          />
        ) : (
          <div className='space-y-4'>
            {resources.map((resource) => (
              <article
                key={resource.id}
                className='flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300 hover:shadow-sm'
              >
                <div>
                  <div className='flex flex-wrap items-center justify-between gap-2 mb-2'>
                    <span className='text-xs font-semibold text-emerald-700'>
                      🏛️ {institution.name}
                    </span>

                    <div className='flex flex-wrap items-center gap-1.5'>
                      {resource.industry && (
                        <Badge variant='default' className='text-xs'>
                          {resource.industry}
                        </Badge>
                      )}
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
                          API Ready
                        </Badge>
                      )}
                    </div>
                  </div>

                  <h3 className='text-base font-semibold text-slate-900 hover:text-emerald-700 transition-colors sm:text-lg'>
                    <Link href={`/resources/${resource.id}`}>
                      {resource.name}
                    </Link>
                  </h3>

                  {resource.description && (
                    <p className='mt-2 text-sm text-slate-600 line-clamp-2 leading-relaxed'>
                      {resource.description}
                    </p>
                  )}

                  <div className='mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500'>
                    {resource.category && (
                      <div>
                        <span className='text-slate-400'>Category:</span>{' '}
                        <span className='font-medium text-slate-700'>
                          {resource.category}
                        </span>
                      </div>
                    )}
                    {resource.countryCoverage && (
                      <div>
                        <span className='text-slate-400'>Coverage:</span>{' '}
                        <span className='font-medium text-slate-700'>
                          {resource.countryCoverage}
                        </span>
                      </div>
                    )}
                    {resource.sourceType && (
                      <div>
                        <span className='text-slate-400'>Type:</span>{' '}
                        <span className='font-medium text-slate-700'>
                          {resource.sourceType}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className='mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3'>
                  <div className='flex flex-wrap items-center gap-2'>
                    {resource.links.map((link) => (
                      <a
                        key={link.id}
                        href={link.url}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 transition-colors'
                      >
                        <span>🔗</span>
                        <span>
                          {link.linkType.replace(/_/g, ' ').toLowerCase()}
                        </span>
                        <svg
                          className='h-3 w-3 text-slate-400'
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
                    ))}
                  </div>

                  <Link href={`/resources/${resource.id}`}>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='text-xs font-semibold text-emerald-700'
                    >
                      View details &rarr;
                    </Button>
                  </Link>
                </div>
              </article>
            ))}

            {/* Pagination Controls */}
            <div className='mt-8'>
              <ResourcePagination
                currentPage={page}
                totalPages={totalPages}
                totalCount={totalCount}
                pageSize={pageSize}
                searchParams={{}}
                baseUrl={`/institutions/${id}`}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
