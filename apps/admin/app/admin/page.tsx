import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { logoutAdmin } from './login/actions'
import { prisma, ResourceStatus } from '@repo/database'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
} from '@repo/ui'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/admin/login?callbackUrl=/admin')
  }

  // Fetch live system statistics
  const [
    totalResources,
    activeResources,
    draftResources,
    totalInstitutions,
    totalLinks,
  ] = await Promise.all([
    prisma.resource.count(),
    prisma.resource.count({ where: { status: ResourceStatus.ACTIVE } }),
    prisma.resource.count({ where: { status: ResourceStatus.DRAFT } }),
    prisma.institution.count(),
    prisma.resourceLink.count(),
  ])

  return (
    <div className='min-h-screen bg-slate-50 pb-16'>
      {/* Admin Header */}
      <header className='border-b border-slate-200 bg-white'>
        <div className='mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8'>
          <div className='flex items-center gap-3'>
            <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-xl text-white'>
              🛡️
            </div>
            <div>
              <div className='flex items-center gap-2'>
                <span className='font-bold text-slate-900 text-lg'>
                  Platform Administration
                </span>
                <Badge variant='success' size='sm'>
                  Authenticated
                </Badge>
              </div>
              <span className='text-xs text-slate-500 font-mono'>
                {session.user.email}
              </span>
            </div>
          </div>

          <div className='flex items-center gap-3'>
            <Link href='/import'>
              <Button size='sm' variant='outline'>
                CSV Ingestion
              </Button>
            </Link>
            <form action={logoutAdmin}>
              <Button
                size='sm'
                variant='ghost'
                type='submit'
                className='text-red-600 hover:text-red-700 hover:bg-red-50'
              >
                Sign Out
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8'>
        {/* Welcome & Overview */}
        <div>
          <h1 className='text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl'>
            Management Console
          </h1>
          <p className='mt-1 text-sm text-slate-500'>
            Authenticated administrative control center for datasets,
            institutions, link health, and data ingestion.
          </p>
        </div>

        {/* Live Metrics Grid */}
        <div className='grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4'>
          <Card className='border-slate-200'>
            <CardHeader className='pb-2'>
              <CardDescription>Total Catalogued</CardDescription>
              <CardTitle className='text-3xl font-extrabold text-slate-900'>
                {totalResources}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className='text-xs text-slate-500'>
                {activeResources} published active &bull; {draftResources} in
                draft
              </span>
            </CardContent>
          </Card>

          <Card className='border-slate-200'>
            <CardHeader className='pb-2'>
              <CardDescription>Active Resources</CardDescription>
              <CardTitle className='text-3xl font-extrabold text-emerald-600'>
                {activeResources}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className='text-xs text-slate-500'>
                Publicly visible across search directory
              </span>
            </CardContent>
          </Card>

          <Card className='border-slate-200'>
            <CardHeader className='pb-2'>
              <CardDescription>Institutions</CardDescription>
              <CardTitle className='text-3xl font-extrabold text-slate-900'>
                {totalInstitutions}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className='text-xs text-slate-500'>
                Custodian organizations recorded
              </span>
            </CardContent>
          </Card>

          <Card className='border-slate-200'>
            <CardHeader className='pb-2'>
              <CardDescription>Registered Endpoints</CardDescription>
              <CardTitle className='text-3xl font-extrabold text-slate-900'>
                {totalLinks}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className='text-xs text-slate-500'>
                APIs, data portals, and downloads
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Operation Modules */}
        <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
          <Card className='border-slate-200'>
            <CardHeader>
              <div className='flex items-center gap-2'>
                <span className='text-xl'>📥</span>
                <CardTitle>Batch CSV Import Pipeline</CardTitle>
              </div>
              <CardDescription>
                Upload, security-scan, validate, and atomically commit
                multi-source CSV dataset inventories.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <p className='text-xs text-slate-600 leading-relaxed'>
                Ingest institutional datasets with schema auto-mapping, URL
                normalization, and transaction safety.
              </p>
              <Link href='/import'>
                <Button className='w-full bg-emerald-600 hover:bg-emerald-700'>
                  Launch Ingestion Wizard &rarr;
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className='border-slate-200'>
            <CardHeader>
              <div className='flex items-center gap-2'>
                <span className='text-xl'>🔍</span>
                <CardTitle>Catalogue Lifecycle & Quality</CardTitle>
              </div>
              <CardDescription>
                Manage resource lifecycle states: Draft, Active, and Archived.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <p className='text-xs text-slate-600 leading-relaxed'>
                Manage metadata, link health status verification, and
                publication controls.
              </p>
              <Link href='/admin/resources'>
                <Button variant='outline' className='w-full'>
                  Manage Records &rarr;
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
