import Link from 'next/link'
import { prisma, ResourceStatus } from '@repo/database'
import { Badge, Button } from '@repo/ui'

// Prevent caching to reflect database updates
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  // Query database statistics and featured resources (Server-side rendering)
  let activeResourcesCount = 0
  let institutionsCount = 0
  let linksCount = 0
  let featuredResources: Array<{
    id: string
    name: string
    description: string | null
    sourceType: string | null
    industry: string | null
    category: string | null
    countryCoverage: string | null
    accessType: string | null
    apiAvailable: boolean
    priority: string | null
    metadata: any
    institution: { id: string; name: string } | null
    links: Array<{ id: string; url: string; linkType: string; status: string }>
  }> = []

  try {
    const [resCount, instCount, linkCount, featured] = await Promise.all([
      prisma.resource.count({ where: { status: ResourceStatus.ACTIVE } }),
      prisma.institution.count(),
      prisma.resourceLink.count(),
      prisma.resource.findMany({
        where: { status: ResourceStatus.ACTIVE },
        take: 6,
        orderBy: { createdAt: 'desc' },
        include: {
          institution: { select: { id: true, name: true } },
          links: {
            select: { id: true, url: true, linkType: true, status: true },
            take: 2,
          },
        },
      }),
    ])

    activeResourcesCount = resCount
    institutionsCount = instCount
    linksCount = linkCount
    featuredResources = featured
  } catch {
    // If DB is empty or during static pass
  }

  const sectors = [
    {
      name: 'Trade & Commerce',
      industry: 'Trade',
      description:
        'Tariff structures, intra-African trade flows, AfCFTA records, and commodity data.',
      icon: '📊',
    },
    {
      name: 'Health & Epidemiology',
      industry: 'Health',
      description:
        'Disease surveillance, clinical reports, WHO observatories, and maternal health metrics.',
      icon: '🏥',
    },
    {
      name: 'Economy & Finance',
      industry: 'Finance',
      description:
        'Central bank rates, inflation, sovereign debt, public finance, and VC investments.',
      icon: '📈',
    },
    {
      name: 'Agriculture & Food',
      industry: 'Agriculture',
      description:
        'Crop yields, livestock statistics, food balance sheets, and rural commodity prices.',
      icon: '🌾',
    },
    {
      name: 'Governance & Society',
      industry: 'Governance',
      description:
        'Afrobarometer surveys, election tracking, institutional capacity, and public attitude polls.',
      icon: '⚖️',
    },
    {
      name: 'Climate & Geospatial',
      industry: 'Climate',
      description:
        'Solar irradiance, weather station data, hydrological balances, and spatial boundaries.',
      icon: '🌍',
    },
  ]

  return (
    <main className='min-h-full'>
      {/* Hero Section */}
      <section className='relative overflow-hidden bg-linear-to-b from-white to-slate-50 border-b border-slate-200/80 py-16 sm:py-24'>
        <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center'>
          <div className='inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-600/20 mb-6'>
            <span className='flex h-2 w-2 rounded-full bg-emerald-600 animate-pulse' />
            Central Discovery Index for African Data
          </div>

          <h1 className='text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl max-w-4xl mx-auto leading-tight'>
            Discover Where{' '}
            <span className='text-emerald-600'>African Data</span> Exists
          </h1>

          <p className='mt-4 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed'>
            Find verified African datasets, development indicators, and research
            repositories without getting lost in fragmented national portals.
          </p>

          {/* Search Bar Entry Point */}
          <div className='mt-8 max-w-2xl mx-auto'>
            <form
              action='/resources'
              method='GET'
              className='relative flex items-center shadow-lg rounded-xl'
            >
              <div className='pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400'>
                <svg
                  className='h-5 w-5'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
                  />
                </svg>
              </div>
              <input
                type='text'
                name='q'
                placeholder='Search resources, topics, indicators (e.g. inflation, AfCFTA, health, trade)...'
                className='w-full rounded-l-xl border-y border-l border-slate-300 bg-white py-4 pl-12 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500'
              />
              <button
                type='submit'
                className='inline-flex shrink-0 items-center justify-center rounded-r-xl bg-emerald-600 px-6 py-4 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer'
              >
                Search Catalogue
              </button>
            </form>

            <div className='mt-3 flex items-center justify-center gap-2 text-xs text-slate-500'>
              <span>Popular searches:</span>
              <Link
                href='/resources?q=AfCFTA'
                className='text-emerald-600 hover:underline'
              >
                AfCFTA
              </Link>
              <span>•</span>
              <Link
                href='/resources?q=inflation'
                className='text-emerald-600 hover:underline'
              >
                Inflation
              </Link>
              <span>•</span>
              <Link
                href='/resources?q=Afrobarometer'
                className='text-emerald-600 hover:underline'
              >
                Afrobarometer
              </Link>
              <span>•</span>
              <Link
                href='/resources?q=DHS'
                className='text-emerald-600 hover:underline'
              >
                DHS Surveys
              </Link>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className='mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4 max-w-4xl mx-auto border-t border-slate-200/80 pt-8'>
            <div className='p-2'>
              <p className='text-2xl sm:text-3xl font-bold text-slate-900'>
                {activeResourcesCount > 0 ? `${activeResourcesCount}+` : '700+'}
              </p>
              <p className='text-xs font-medium text-slate-500 uppercase tracking-wider mt-1'>
                Data Resources
              </p>
            </div>
            <div className='p-2'>
              <p className='text-2xl sm:text-3xl font-bold text-emerald-600'>
                54
              </p>
              <p className='text-xs font-medium text-slate-500 uppercase tracking-wider mt-1'>
                African Nations
              </p>
            </div>
            <div className='p-2'>
              <p className='text-2xl sm:text-3xl font-bold text-slate-900'>
                {institutionsCount > 0 ? `${institutionsCount}+` : '150+'}
              </p>
              <p className='text-xs font-medium text-slate-500 uppercase tracking-wider mt-1'>
                Authoritative Institutions
              </p>
            </div>
            <div className='p-2'>
              <p className='text-2xl sm:text-3xl font-bold text-emerald-600'>
                {linksCount > 0 ? `${linksCount}+` : '100%'}
              </p>
              <p className='text-xs font-medium text-slate-500 uppercase tracking-wider mt-1'>
                Verified Links
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Sectors & Thematic Areas */}
      <section className='py-16 sm:py-20 bg-slate-50'>
        <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
          <div className='flex flex-col sm:flex-row sm:items-end justify-between mb-10'>
            <div>
              <h2 className='text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl'>
                Explore by Sector
              </h2>
              <p className='mt-1 text-sm text-slate-600'>
                Browse catalogue entries categorized by economic, health, and
                social domains.
              </p>
            </div>
            <Link
              href='/resources'
              className='mt-4 sm:mt-0 text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors inline-flex items-center gap-1'
            >
              View all categories →
            </Link>
          </div>

          <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3'>
            {sectors.map((sec) => (
              <Link
                key={sec.name}
                href={`/resources?industry=${encodeURIComponent(sec.industry)}`}
                className='group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:shadow-md transition-all hover:border-emerald-300'
              >
                <div className='flex items-start gap-4'>
                  <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-2xl group-hover:scale-105 transition-transform'>
                    {sec.icon}
                  </div>
                  <div>
                    <h3 className='font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors'>
                      {sec.name}
                    </h3>
                    <p className='mt-1.5 text-xs text-slate-500 leading-relaxed'>
                      {sec.description}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Resources Section */}
      <section className='py-16 sm:py-20 bg-white border-t border-slate-200'>
        <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
          <div className='flex flex-col sm:flex-row sm:items-end justify-between mb-10'>
            <div>
              <div className='inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-600 mb-1'>
                <span>Verified Data Repositories</span>
              </div>
              <h2 className='text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl'>
                Featured African Data Portals
              </h2>
              <p className='mt-1 text-sm text-slate-600'>
                High-priority data repositories indexed and monitored for
                availability.
              </p>
            </div>
            <Link
              href='/resources'
              className='mt-4 sm:mt-0 text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors inline-flex items-center gap-1'
            >
              Browse all {activeResourcesCount > 0 ? activeResourcesCount : ''}{' '}
              resources →
            </Link>
          </div>

          {featuredResources.length > 0 ? (
            <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3'>
              {featuredResources.map((res) => {
                const primaryLink = res.links[0]
                const formats: string[] =
                  res.metadata?.normalized?.formats || []

                return (
                  <div
                    key={res.id}
                    className='flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:border-slate-300 transition-all hover:shadow-sm'
                  >
                    <div>
                      <div className='flex items-center justify-between gap-2 mb-3'>
                        <Badge
                          size='sm'
                          variant={res.apiAvailable ? 'success' : 'default'}
                        >
                          {res.apiAvailable
                            ? 'API Available'
                            : res.sourceType || 'Catalogue'}
                        </Badge>
                        {res.accessType && (
                          <span className='text-[11px] font-medium text-slate-500'>
                            {res.accessType}
                          </span>
                        )}
                      </div>

                      <h3 className='font-semibold text-slate-900 line-clamp-1 hover:text-emerald-600 transition-colors'>
                        <Link href={`/resources/${res.id}`}>{res.name}</Link>
                      </h3>

                      {res.institution && (
                        <p className='mt-1 text-xs font-medium text-slate-500 flex items-center gap-1'>
                          <svg
                            className='h-3.5 w-3.5 text-slate-400'
                            fill='none'
                            viewBox='0 0 24 24'
                            stroke='currentColor'
                          >
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth='2'
                              d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
                            />
                          </svg>
                          <span>{res.institution.name}</span>
                        </p>
                      )}

                      <p className='mt-3 text-xs text-slate-600 line-clamp-3 leading-relaxed'>
                        {res.description || 'Verified African data source.'}
                      </p>

                      {/* Coverage & Format Pills */}
                      <div className='mt-4 flex flex-wrap gap-1.5 items-center'>
                        {res.countryCoverage && (
                          <span className='inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700'>
                            🌍 {res.countryCoverage}
                          </span>
                        )}
                        {formats.slice(0, 2).map((fmt) => (
                          <span
                            key={fmt}
                            className='inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700'
                          >
                            {fmt}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className='mt-6 border-t border-slate-100 pt-4 flex items-center justify-between'>
                      <Link
                        href={`/resources/${res.id}`}
                        className='text-xs font-semibold text-emerald-600 hover:text-emerald-700'
                      >
                        View details →
                      </Link>
                      {primaryLink && (
                        <a
                          href={primaryLink.url}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1'
                        >
                          Source Link ↗
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className='rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center'>
              <div className='mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-4'>
                <svg
                  className='h-6 w-6'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
                  />
                </svg>
              </div>
              <h3 className='text-base font-semibold text-slate-900'>
                Data Catalogue Ingestion Ready
              </h3>
              <p className='mt-1 text-sm text-slate-500 max-w-md mx-auto'>
                The database is connected. You can ingest catalogue records via
                the Admin Ingestion Pipeline or browse the full catalogue.
              </p>
              <div className='mt-6 flex justify-center gap-4'>
                <Link href='/resources'>
                  <Button>Explore Catalogue</Button>
                </Link>
                <a
                  href='http://localhost:3001/import'
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  <Button variant='outline'>Admin Ingestion Pipeline ↗</Button>
                </a>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className='bg-slate-900 text-white py-16'>
        <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center'>
          <h2 className='text-2xl sm:text-3xl font-bold tracking-tight'>
            Can’t find the specific dataset you need?
          </h2>
          <p className='mt-3 text-slate-400 max-w-xl mx-auto text-sm'>
            Our catalogue continually indexes national statistics offices,
            regional economic communities, and research organizations across
            Africa.
          </p>
          <div className='mt-8 flex justify-center gap-4'>
            <Link href='/resources'>
              <Button className='bg-emerald-600 hover:bg-emerald-500'>
                Browse Full Resource Catalogue
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
