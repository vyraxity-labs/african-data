import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma, Prisma } from '@repo/database'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button,
  EmptyState,
} from '@repo/ui'
import { InstitutionRowActions } from './institution-row-actions'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function AdminInstitutionsPage(props: PageProps) {
  const session = await auth()
  if (!session?.user) {
    redirect('/admin/login?callbackUrl=/admin/institutions')
  }

  const resolvedSearchParams = await props.searchParams
  const getParam = (key: string): string | undefined => {
    const val = resolvedSearchParams[key]
    if (Array.isArray(val)) return val[0]
    return val
  }

  const q = getParam('q')?.trim() || ''
  const rawPage = parseInt(getParam('page') || '1', 10)
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1
  const pageSize = 15

  const where: Prisma.InstitutionWhereInput = {}
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { country: { contains: q, mode: 'insensitive' } },
      { type: { contains: q, mode: 'insensitive' } },
    ]
  }

  const [institutions, totalCount] = await Promise.all([
    prisma.institution.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            resources: true,
          },
        },
      },
    }),
    prisma.institution.count({ where }),
  ])

  const totalPages = Math.ceil(totalCount / pageSize) || 1

  return (
    <div className='min-h-screen bg-slate-50 pb-16'>
      {/* Top Header */}
      <header className='border-b border-slate-200 bg-white'>
        <div className='mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8'>
          <div className='flex items-center gap-3'>
            <Link
              href='/admin'
              className='text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors'
            >
              &larr; Admin Overview
            </Link>
            <span className='text-slate-300'>/</span>
            <span className='text-sm font-bold text-slate-900'>
              Institutions
            </span>
          </div>

          <div className='flex items-center gap-3'>
            <Link href='/admin/institutions/new'>
              <Button
                size='sm'
                className='bg-emerald-600 hover:bg-emerald-700 text-white'
              >
                + Register Institution
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6'>
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight text-slate-900'>
              Custodian Institutions
            </h1>
            <p className='mt-1 text-sm text-slate-500'>
              Manage data-producing institutions, statistical agencies, and
              ministerial bodies across Africa.
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs'>
          <span className='text-xs font-semibold text-slate-700'>
            Total registered:{' '}
            <span className='text-emerald-600 font-bold'>{totalCount}</span>
          </span>

          <form
            method='GET'
            action='/admin/institutions'
            className='flex items-center gap-2'
          >
            <input
              type='text'
              name='q'
              defaultValue={q}
              placeholder='Search by name, country, type...'
              className='rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-64'
            />
            <Button size='sm' type='submit' variant='outline'>
              Filter
            </Button>
            {q && (
              <Link href='/admin/institutions'>
                <Button
                  size='sm'
                  variant='ghost'
                  type='button'
                  className='text-slate-500'
                >
                  Clear
                </Button>
              </Link>
            )}
          </form>
        </div>

        {/* Table / Empty State */}
        {institutions.length === 0 ? (
          <EmptyState
            title='No institutions found'
            description={
              q
                ? `No institutions match your search query "${q}".`
                : 'No custodian institutions have been registered yet.'
            }
            action={
              <Link href='/admin/institutions/new'>
                <Button
                  size='sm'
                  className='bg-emerald-600 hover:bg-emerald-700 text-white'
                >
                  Register First Institution
                </Button>
              </Link>
            }
          />
        ) : (
          <div className='space-y-4'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-[35%]'>Institution</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Country / Jurisdiction</TableHead>
                  <TableHead>Website</TableHead>
                  <TableHead>Datasets</TableHead>
                  <TableHead className='text-right'>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {institutions.map((inst) => (
                  <TableRow key={inst.id}>
                    <TableCell>
                      <div className='font-semibold text-slate-900 hover:text-emerald-600'>
                        <Link href={`/admin/institutions/${inst.id}/edit`}>
                          {inst.name}
                        </Link>
                      </div>
                      {inst.description && (
                        <p className='line-clamp-1 text-xs text-slate-500 mt-0.5'>
                          {inst.description}
                        </p>
                      )}
                    </TableCell>

                    <TableCell>
                      <span className='text-xs text-slate-700 font-medium'>
                        {inst.type || '—'}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className='text-xs text-slate-600'>
                        {inst.country || '—'}
                      </span>
                    </TableCell>

                    <TableCell>
                      {inst.website ? (
                        <a
                          href={inst.website}
                          target='_blank'
                          rel='noreferrer'
                          className='text-xs text-emerald-600 hover:underline truncate max-w-50 block'
                        >
                          {inst.website}
                        </a>
                      ) : (
                        <span className='text-xs text-slate-400 italic'>
                          None
                        </span>
                      )}
                    </TableCell>

                    <TableCell>
                      <span className='inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700'>
                        {inst._count.resources} datasets
                      </span>
                    </TableCell>

                    <TableCell className='text-right'>
                      <div className='flex items-center justify-end gap-2'>
                        <Link href={`/admin/institutions/${inst.id}/edit`}>
                          <Button
                            size='sm'
                            variant='outline'
                            className='text-xs'
                          >
                            Edit
                          </Button>
                        </Link>
                        <InstitutionRowActions
                          institutionId={inst.id}
                          institutionName={inst.name}
                          associatedResourcesCount={inst._count.resources}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className='flex items-center justify-between border-t border-slate-200 px-2 py-3'>
                <span className='text-xs text-slate-500'>
                  Showing {(page - 1) * pageSize + 1} to{' '}
                  {Math.min(page * pageSize, totalCount)} of {totalCount}{' '}
                  institutions
                </span>
                <div className='flex items-center gap-2'>
                  {page > 1 ? (
                    <Link
                      href={`/admin/institutions?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                    >
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
                    <Link
                      href={`/admin/institutions?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                    >
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
