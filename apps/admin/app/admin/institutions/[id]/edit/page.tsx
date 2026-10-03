import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@repo/database'
import { InstitutionForm } from '../../institution-form'
import { updateInstitution } from '../../actions'
import { InstitutionRowActions } from '../../institution-row-actions'
import { Card, CardHeader, CardTitle, CardContent, Badge } from '@repo/ui'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditInstitutionPage(props: PageProps) {
  const session = await auth()
  if (!session?.user) {
    redirect('/admin/login?callbackUrl=/admin/institutions')
  }

  const { id } = await props.params

  const institution = await prisma.institution.findUnique({
    where: { id },
    include: {
      resources: {
        select: {
          id: true,
          name: true,
          status: true,
          industry: true,
          category: true,
        },
        orderBy: { name: 'asc' },
      },
    },
  })

  if (!institution) {
    notFound()
  }

  const boundUpdateAction = updateInstitution.bind(null, id)

  return (
    <div className='min-h-screen bg-slate-50 pb-16'>
      {/* Header */}
      <header className='border-b border-slate-200 bg-white'>
        <div className='mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8'>
          <div className='flex items-center gap-3'>
            <Link
              href='/admin/institutions'
              className='text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors'
            >
              &larr; Back to Institutions
            </Link>
            <span className='text-slate-300'>/</span>
            <span className='text-sm font-bold text-slate-900'>
              Edit Institution
            </span>
          </div>

          <div className='flex items-center gap-3'>
            <Link
              href={`${process.env.PUBLIC_APP_URL || 'http://localhost:3000'}/institutions/${institution.id}`}
              target='_blank'
              className='text-xs text-emerald-600 hover:underline'
            >
              View Public Profile &rarr;
            </Link>
            <InstitutionRowActions
              institutionId={institution.id}
              institutionName={institution.name}
              associatedResourcesCount={institution.resources.length}
            />
          </div>
        </div>
      </header>

      <main className='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight text-slate-900'>
            {institution.name}
          </h1>
          <p className='mt-1 text-xs text-slate-500 font-mono'>
            ID: {institution.id} &bull; Registered{' '}
            {new Date(institution.createdAt).toLocaleDateString()}
          </p>
        </div>

        <div className='grid grid-cols-1 gap-8 lg:grid-cols-3'>
          {/* Main Edit Form */}
          <div className='lg:col-span-2'>
            <InstitutionForm
              mode='edit'
              initialData={{
                id: institution.id,
                name: institution.name,
                website: institution.website,
                description: institution.description,
                type: institution.type,
                country: institution.country,
              }}
              action={boundUpdateAction}
            />
          </div>

          {/* Sidebar: Associated Datasets */}
          <div className='space-y-6'>
            <Card className='border-slate-200'>
              <CardHeader>
                <CardTitle className='text-base'>
                  Published Datasets ({institution.resources.length})
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                {institution.resources.length === 0 ? (
                  <p className='text-xs text-slate-500 italic'>
                    No datasets are currently linked to this institution.
                  </p>
                ) : (
                  institution.resources.map((res) => (
                    <div
                      key={res.id}
                      className='rounded-lg border border-slate-200 p-3 bg-slate-50 space-y-1'
                    >
                      <div className='flex items-center justify-between'>
                        <Link
                          href={`/admin/resources/${res.id}/edit`}
                          className='text-xs font-semibold text-slate-800 hover:text-emerald-600 truncate block max-w-50'
                        >
                          {res.name}
                        </Link>
                        <Badge
                          variant={
                            res.status === 'ACTIVE'
                              ? 'success'
                              : res.status === 'DRAFT'
                                ? 'warning'
                                : 'default'
                          }
                          size='sm'
                        >
                          {res.status}
                        </Badge>
                      </div>
                      <div className='text-[11px] text-slate-500'>
                        {res.industry || res.category || 'General'}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className='border-slate-200'>
              <CardHeader>
                <CardTitle className='text-base'>Deletion Policy</CardTitle>
              </CardHeader>
              <CardContent className='text-xs text-slate-600 leading-relaxed'>
                Deleting an institution unlinks it from all associated datasets,
                setting their custodian to null while preserving all dataset
                records and links intact.
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
