import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@repo/database'
import { getDataQualityReport } from '@repo/link-checker'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  BadgeVariant,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  EmptyState,
} from '@repo/ui'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function DataQualityDashboardPage(props: PageProps) {
  const session = await auth()
  if (!session?.user) {
    redirect('/admin/login?callbackUrl=/admin/data-quality')
  }

  const resolvedSearchParams = await props.searchParams
  const tabParam =
    (typeof resolvedSearchParams.tab === 'string'
      ? resolvedSearchParams.tab
      : Array.isArray(resolvedSearchParams.tab)
        ? resolvedSearchParams.tab[0]
        : 'duplicates') || 'duplicates'

  // Fetch full Phase 18 Data Quality Report
  const report = await getDataQualityReport(prisma, { staleDays: 30 })
  const { summary } = report

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600'
    if (score >= 60) return 'text-amber-600'
    return 'text-rose-600'
  }

  const getCompletenessVariant = (pct: number): BadgeVariant => {
    if (pct >= 80) return 'success'
    if (pct >= 50) return 'warning'
    return 'danger'
  }

  return (
    <div className='min-h-screen bg-slate-50 pb-16'>
      {/* Top Header */}
      <header className='border-b border-slate-200 bg-white'>
        <div className='mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8'>
          <div className='flex items-center gap-3'>
            <Link
              href='/admin'
              className='text-slate-500 hover:text-slate-700 transition-colors text-sm flex items-center gap-1 font-medium'
            >
              &larr; Admin Console
            </Link>
            <span className='text-slate-300'>|</span>
            <div className='flex items-center gap-2'>
              <span className='text-xl'>📊</span>
              <h1 className='font-bold text-slate-900 text-lg'>
                Data Quality & Governance
              </h1>
            </div>
            {/* <Badge variant="purple" size="sm">
              Phase 18
            </Badge> */}
          </div>

          <div className='flex items-center gap-2.5'>
            <Link href='/admin/resources'>
              <Button size='sm' variant='outline'>
                Manage Resources
              </Button>
            </Link>
            <Link href='/admin/link-health'>
              <Button size='sm' variant='outline'>
                Link Health
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8'>
        {/* Intro */}
        <div>
          <h2 className='text-2xl font-bold tracking-tight text-slate-900'>
            Catalogue Integrity & Health Assessment
          </h2>
          <p className='mt-1 text-sm text-slate-500'>
            Comprehensive audit covering potential duplicates, metadata gaps,
            stale checks, orphaned datasets, and unverified endpoints.
          </p>
        </div>

        {/* Top Summary Metrics Grid */}
        <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7'>
          {/* Overall Score */}
          <Card className='border-slate-200 bg-white shadow-2xs'>
            <CardHeader className='p-4 pb-2'>
              <CardDescription className='text-xs'>
                Overall Health
              </CardDescription>
              <CardTitle
                className={`text-2xl font-black ${getScoreColor(summary.overallHealthScore)}`}
              >
                {summary.overallHealthScore}%
              </CardTitle>
            </CardHeader>
            <CardContent className='p-4 pt-0'>
              <span className='text-[11px] text-slate-400'>
                Composite score
              </span>
            </CardContent>
          </Card>

          {/* Duplicates */}
          <Link href='/admin/data-quality?tab=duplicates' className='block'>
            <Card
              className={`border-slate-200 bg-white shadow-2xs hover:border-emerald-500 transition-all ${
                tabParam === 'duplicates'
                  ? 'ring-2 ring-emerald-500 border-emerald-500'
                  : ''
              }`}
            >
              <CardHeader className='p-4 pb-2'>
                <CardDescription className='text-xs'>
                  Duplicates
                </CardDescription>
                <CardTitle
                  className={`text-2xl font-bold ${
                    summary.duplicatesCount > 0
                      ? 'text-amber-600'
                      : 'text-slate-900'
                  }`}
                >
                  {summary.duplicatesCount}
                </CardTitle>
              </CardHeader>
              <CardContent className='p-4 pt-0'>
                <span className='text-[11px] text-slate-400'>
                  Flagged pairs &rarr;
                </span>
              </CardContent>
            </Card>
          </Link>

          {/* Missing Fields */}
          <Link href='/admin/data-quality?tab=missing-fields' className='block'>
            <Card
              className={`border-slate-200 bg-white shadow-2xs hover:border-emerald-500 transition-all ${
                tabParam === 'missing-fields'
                  ? 'ring-2 ring-emerald-500 border-emerald-500'
                  : ''
              }`}
            >
              <CardHeader className='p-4 pb-2'>
                <CardDescription className='text-xs'>
                  Missing Fields
                </CardDescription>
                <CardTitle
                  className={`text-2xl font-bold ${
                    summary.missingFieldsCount > 0
                      ? 'text-amber-600'
                      : 'text-slate-900'
                  }`}
                >
                  {summary.missingFieldsCount}
                </CardTitle>
              </CardHeader>
              <CardContent className='p-4 pt-0'>
                <span className='text-[11px] text-slate-400'>
                  Gaps in metadata &rarr;
                </span>
              </CardContent>
            </Card>
          </Link>

          {/* Stale Checks */}
          <Link href='/admin/data-quality?tab=stale' className='block'>
            <Card
              className={`border-slate-200 bg-white shadow-2xs hover:border-emerald-500 transition-all ${
                tabParam === 'stale'
                  ? 'ring-2 ring-emerald-500 border-emerald-500'
                  : ''
              }`}
            >
              <CardHeader className='p-4 pb-2'>
                <CardDescription className='text-xs'>
                  Stale Checks
                </CardDescription>
                <CardTitle
                  className={`text-2xl font-bold ${
                    summary.staleVerificationsCount > 0
                      ? 'text-amber-600'
                      : 'text-slate-900'
                  }`}
                >
                  {summary.staleVerificationsCount}
                </CardTitle>
              </CardHeader>
              <CardContent className='p-4 pt-0'>
                <span className='text-[11px] text-slate-400'>
                  &gt; 30d since verify &rarr;
                </span>
              </CardContent>
            </Card>
          </Link>

          {/* Without Links */}
          <Link href='/admin/data-quality?tab=no-links' className='block'>
            <Card
              className={`border-slate-200 bg-white shadow-2xs hover:border-emerald-500 transition-all ${
                tabParam === 'no-links'
                  ? 'ring-2 ring-emerald-500 border-emerald-500'
                  : ''
              }`}
            >
              <CardHeader className='p-4 pb-2'>
                <CardDescription className='text-xs'>
                  Without Links
                </CardDescription>
                <CardTitle
                  className={`text-2xl font-bold ${
                    summary.resourcesWithoutLinksCount > 0
                      ? 'text-rose-600'
                      : 'text-slate-900'
                  }`}
                >
                  {summary.resourcesWithoutLinksCount}
                </CardTitle>
              </CardHeader>
              <CardContent className='p-4 pt-0'>
                <span className='text-[11px] text-slate-400'>
                  Orphaned items &rarr;
                </span>
              </CardContent>
            </Card>
          </Link>

          {/* Without Institutions */}
          <Link href='/admin/data-quality?tab=no-inst' className='block'>
            <Card
              className={`border-slate-200 bg-white shadow-2xs hover:border-emerald-500 transition-all ${
                tabParam === 'no-inst'
                  ? 'ring-2 ring-emerald-500 border-emerald-500'
                  : ''
              }`}
            >
              <CardHeader className='p-4 pb-2'>
                <CardDescription className='text-xs'>
                  Without Custodian
                </CardDescription>
                <CardTitle
                  className={`text-2xl font-bold ${
                    summary.resourcesWithoutInstitutionsCount > 0
                      ? 'text-amber-600'
                      : 'text-slate-900'
                  }`}
                >
                  {summary.resourcesWithoutInstitutionsCount}
                </CardTitle>
              </CardHeader>
              <CardContent className='p-4 pt-0'>
                <span className='text-[11px] text-slate-400'>
                  No institution &rarr;
                </span>
              </CardContent>
            </Card>
          </Link>

          {/* Never Checked */}
          <Link href='/admin/data-quality?tab=never-checked' className='block'>
            <Card
              className={`border-slate-200 bg-white shadow-2xs hover:border-emerald-500 transition-all ${
                tabParam === 'never-checked'
                  ? 'ring-2 ring-emerald-500 border-emerald-500'
                  : ''
              }`}
            >
              <CardHeader className='p-4 pb-2'>
                <CardDescription className='text-xs'>
                  Never Checked
                </CardDescription>
                <CardTitle
                  className={`text-2xl font-bold ${
                    summary.neverCheckedCount > 0
                      ? 'text-rose-600'
                      : 'text-slate-900'
                  }`}
                >
                  {summary.neverCheckedCount}
                </CardTitle>
              </CardHeader>
              <CardContent className='p-4 pt-0'>
                <span className='text-[11px] text-slate-400'>
                  Pending scan &rarr;
                </span>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Tab Navigation */}
        <div className='flex border-b border-slate-200 gap-6 text-sm font-medium'>
          <Link
            href='/admin/data-quality?tab=duplicates'
            className={`pb-3 -mb-px border-b-2 flex items-center gap-2 transition-colors ${
              tabParam === 'duplicates'
                ? 'border-emerald-600 text-emerald-700 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>Duplicate Detection</span>
            <Badge variant='purple' size='sm'>
              {summary.duplicatesCount}
            </Badge>
          </Link>

          <Link
            href='/admin/data-quality?tab=missing-fields'
            className={`pb-3 -mb-px border-b-2 flex items-center gap-2 transition-colors ${
              tabParam === 'missing-fields'
                ? 'border-emerald-600 text-emerald-700 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>Missing Fields</span>
            <Badge variant='default' size='sm'>
              {summary.missingFieldsCount}
            </Badge>
          </Link>

          <Link
            href='/admin/data-quality?tab=stale'
            className={`pb-3 -mb-px border-b-2 flex items-center gap-2 transition-colors ${
              tabParam === 'stale'
                ? 'border-emerald-600 text-emerald-700 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>Stale Verifications</span>
            <Badge variant='warning' size='sm'>
              {summary.staleVerificationsCount}
            </Badge>
          </Link>

          <Link
            href='/admin/data-quality?tab=no-links'
            className={`pb-3 -mb-px border-b-2 flex items-center gap-2 transition-colors ${
              tabParam === 'no-links'
                ? 'border-emerald-600 text-emerald-700 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>Without Links</span>
            <Badge variant='danger' size='sm'>
              {summary.resourcesWithoutLinksCount}
            </Badge>
          </Link>

          <Link
            href='/admin/data-quality?tab=no-inst'
            className={`pb-3 -mb-px border-b-2 flex items-center gap-2 transition-colors ${
              tabParam === 'no-inst'
                ? 'border-emerald-600 text-emerald-700 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>Without Institutions</span>
            <Badge variant='default' size='sm'>
              {summary.resourcesWithoutInstitutionsCount}
            </Badge>
          </Link>

          <Link
            href='/admin/data-quality?tab=never-checked'
            className={`pb-3 -mb-px border-b-2 flex items-center gap-2 transition-colors ${
              tabParam === 'never-checked'
                ? 'border-emerald-600 text-emerald-700 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>Never Checked</span>
            <Badge variant='danger' size='sm'>
              {summary.neverCheckedCount}
            </Badge>
          </Link>
        </div>

        {/* Tab 1: Duplicate Detection */}
        {tabParam === 'duplicates' && (
          <div className='space-y-4'>
            {/* Phase 18 Explicit Guardrail Notice */}
            <div className='rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 flex items-start gap-3'>
              <span className='text-lg'>🛡️</span>
              <div className='space-y-0.5'>
                <span className='font-semibold block text-amber-950'>
                  Data Governance Guardrail:
                </span>
                <span>
                  Potential duplicates are strictly flagged for administrative
                  review and curation,
                  <strong> not automatically deleted</strong>. Use the
                  comparison view to merge, deprecate, or retain entries
                  intentionally.
                </span>
              </div>
            </div>

            <Card className='bg-white'>
              <CardHeader>
                <CardTitle>Flagged Duplicate Candidates</CardTitle>
                <CardDescription>
                  Identified by exact title match, normalized fuzzy title match,
                  or shared endpoint URLs.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {report.duplicates.length === 0 ? (
                  <EmptyState
                    title='No potential duplicates detected'
                    description='The catalogue is currently clean of duplicate titles and shared endpoints.'
                  />
                ) : (
                  <div className='overflow-x-auto rounded-lg border border-slate-200'>
                    <Table>
                      <TableHeader className='bg-slate-50'>
                        <TableRow>
                          <TableHead className='w-[30%]'>
                            Resource Candidate A
                          </TableHead>
                          <TableHead className='w-[30%]'>
                            Resource Candidate B
                          </TableHead>
                          <TableHead className='w-[20%]'>
                            Match Criterion
                          </TableHead>
                          <TableHead className='w-[20%] text-right'>
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.duplicates.map((dup) => (
                          <TableRow
                            key={dup.id}
                            className='text-xs hover:bg-slate-50/60'
                          >
                            <TableCell>
                              <div className='space-y-1'>
                                <Link
                                  href={`/admin/resources/${dup.resourceA.id}`}
                                  className='font-medium text-slate-900 hover:text-emerald-700 hover:underline block truncate max-w-xs'
                                >
                                  {dup.resourceA.name}
                                </Link>
                                <div className='flex items-center gap-2 text-[11px] text-slate-500'>
                                  <span>
                                    {dup.resourceA.institutionName ||
                                      'No custodian'}
                                  </span>
                                  <Badge variant='default' size='sm'>
                                    {dup.resourceA.status}
                                  </Badge>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className='space-y-1'>
                                <Link
                                  href={`/admin/resources/${dup.resourceB.id}`}
                                  className='font-medium text-slate-900 hover:text-emerald-700 hover:underline block truncate max-w-xs'
                                >
                                  {dup.resourceB.name}
                                </Link>
                                <div className='flex items-center gap-2 text-[11px] text-slate-500'>
                                  <span>
                                    {dup.resourceB.institutionName ||
                                      'No custodian'}
                                  </span>
                                  <Badge variant='default' size='sm'>
                                    {dup.resourceB.status}
                                  </Badge>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className='space-y-1'>
                                <Badge
                                  variant={
                                    dup.matchReason === 'EXACT_NAME'
                                      ? 'danger'
                                      : dup.matchReason ===
                                          'SHARED_ENDPOINT_URL'
                                        ? 'warning'
                                        : 'info'
                                  }
                                  size='sm'
                                >
                                  {dup.matchReason.replace(/_/g, ' ')}
                                </Badge>
                                <span
                                  className='block text-[11px] text-slate-500 max-w-xs truncate'
                                  title={dup.detail}
                                >
                                  {dup.detail}
                                </span>
                              </div>
                            </TableCell>

                            <TableCell className='text-right'>
                              <div className='flex items-center justify-end gap-1.5'>
                                <Link
                                  href={`/admin/resources/${dup.resourceA.id}`}
                                >
                                  <Button
                                    size='sm'
                                    variant='outline'
                                    className='text-xs'
                                  >
                                    Review A
                                  </Button>
                                </Link>
                                <Link
                                  href={`/admin/resources/${dup.resourceB.id}`}
                                >
                                  <Button
                                    size='sm'
                                    variant='outline'
                                    className='text-xs'
                                  >
                                    Review B
                                  </Button>
                                </Link>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab 2: Missing Fields */}
        {tabParam === 'missing-fields' && (
          <Card className='bg-white'>
            <CardHeader>
              <CardTitle>Missing Metadata Fields</CardTitle>
              <CardDescription>
                Datasets missing essential catalogue attributes (description,
                industry, category, coverage, language, etc.).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {report.missingFields.length === 0 ? (
                <EmptyState
                  title='All datasets complete!'
                  description='Every catalogued resource contains 100% of required metadata fields.'
                />
              ) : (
                <div className='overflow-x-auto rounded-lg border border-slate-200'>
                  <Table>
                    <TableHeader className='bg-slate-50'>
                      <TableRow>
                        <TableHead className='w-[30%]'>Dataset</TableHead>
                        <TableHead className='w-[15%]'>Status</TableHead>
                        <TableHead className='w-[15%]'>Completeness</TableHead>
                        <TableHead className='w-[30%]'>
                          Missing Fields
                        </TableHead>
                        <TableHead className='w-[10%] text-right'>
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.missingFields.map((item) => (
                        <TableRow
                          key={item.id}
                          className='text-xs hover:bg-slate-50/60'
                        >
                          <TableCell className='font-medium text-slate-900'>
                            <Link
                              href={`/admin/resources/${item.id}`}
                              className='hover:text-emerald-700 hover:underline'
                            >
                              {item.name}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge variant='default' size='sm'>
                              {item.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={getCompletenessVariant(
                                item.completenessPercent,
                              )}
                              size='sm'
                            >
                              {item.completenessPercent}%
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className='flex flex-wrap gap-1'>
                              {item.missingFields.map((f) => (
                                <span
                                  key={f}
                                  className='rounded-xs bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-700 border border-slate-200'
                                >
                                  {f}
                                </span>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className='text-right'>
                            <Link href={`/admin/resources/${item.id}`}>
                              <Button
                                size='sm'
                                variant='outline'
                                className='text-xs'
                              >
                                Edit
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tab 3: Stale Verifications */}
        {tabParam === 'stale' && (
          <Card className='bg-white'>
            <CardHeader>
              <CardTitle>Stale Verification Records</CardTitle>
              <CardDescription>
                Endpoints that have not undergone health verification within the
                last 30 days.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {report.staleVerifications.length === 0 ? (
                <EmptyState
                  title='No stale verifications'
                  description='All catalogued links have been checked recently by the scheduled cron scanner.'
                />
              ) : (
                <div className='overflow-x-auto rounded-lg border border-slate-200'>
                  <Table>
                    <TableHeader className='bg-slate-50'>
                      <TableRow>
                        <TableHead className='w-[30%]'>Endpoint URL</TableHead>
                        <TableHead className='w-[25%]'>Dataset</TableHead>
                        <TableHead className='w-[15%]'>Last Checked</TableHead>
                        <TableHead className='w-[15%]'>Days Stale</TableHead>
                        <TableHead className='w-[15%] text-right'>
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.staleVerifications.map((item) => (
                        <TableRow
                          key={item.linkId}
                          className='text-xs hover:bg-slate-50/60'
                        >
                          <TableCell
                            className='font-mono text-[11px] max-w-xs truncate'
                            title={item.url}
                          >
                            {item.url}
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/admin/resources/${item.resourceId}`}
                              className='font-medium text-slate-800 hover:text-emerald-700 hover:underline truncate block max-w-xs'
                            >
                              {item.resourceName}
                            </Link>
                          </TableCell>
                          <TableCell className='text-slate-500 whitespace-nowrap'>
                            {new Date(item.lastCheckedAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant='warning' size='sm'>
                              {item.daysSinceCheck} days ago
                            </Badge>
                          </TableCell>
                          <TableCell className='text-right'>
                            <Link href={`/admin/link-health/${item.linkId}`}>
                              <Button
                                size='sm'
                                variant='outline'
                                className='text-xs'
                              >
                                Check Link
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tab 4: Resources Without Links */}
        {tabParam === 'no-links' && (
          <Card className='bg-white'>
            <CardHeader>
              <CardTitle>Resources Without Links (Orphaned)</CardTitle>
              <CardDescription>
                Datasets currently catalogued with zero endpoints or data
                downloads attached.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {report.resourcesWithoutLinks.length === 0 ? (
                <EmptyState
                  title='No orphaned resources'
                  description='All datasets in the platform have at least one verified endpoint URL.'
                />
              ) : (
                <div className='overflow-x-auto rounded-lg border border-slate-200'>
                  <Table>
                    <TableHeader className='bg-slate-50'>
                      <TableRow>
                        <TableHead className='w-[35%]'>Dataset Name</TableHead>
                        <TableHead className='w-[25%]'>
                          Custodian Institution
                        </TableHead>
                        <TableHead className='w-[15%]'>Status</TableHead>
                        <TableHead className='w-[15%]'>Catalogued On</TableHead>
                        <TableHead className='w-[10%] text-right'>
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.resourcesWithoutLinks.map((item) => (
                        <TableRow
                          key={item.id}
                          className='text-xs hover:bg-slate-50/60'
                        >
                          <TableCell className='font-medium text-slate-900'>
                            <Link
                              href={`/admin/resources/${item.id}`}
                              className='hover:text-emerald-700 hover:underline'
                            >
                              {item.name}
                            </Link>
                          </TableCell>
                          <TableCell className='text-slate-600'>
                            {item.institutionName || 'None assigned'}
                          </TableCell>
                          <TableCell>
                            <Badge variant='default' size='sm'>
                              {item.status}
                            </Badge>
                          </TableCell>
                          <TableCell className='text-slate-500 whitespace-nowrap'>
                            {new Date(item.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className='text-right'>
                            <Link href={`/admin/resources/${item.id}/links`}>
                              <Button
                                size='sm'
                                variant='outline'
                                className='text-xs text-emerald-700'
                              >
                                + Add Link
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tab 5: Resources Without Institutions */}
        {tabParam === 'no-inst' && (
          <Card className='bg-white'>
            <CardHeader>
              <CardTitle>Resources Without Institutions</CardTitle>
              <CardDescription>
                Datasets without an assigned custodian institution or publishing
                organization.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {report.resourcesWithoutInstitutions.length === 0 ? (
                <EmptyState
                  title='All datasets have custodians'
                  description='Every catalogued resource is mapped to an authenticated publishing institution.'
                />
              ) : (
                <div className='overflow-x-auto rounded-lg border border-slate-200'>
                  <Table>
                    <TableHeader className='bg-slate-50'>
                      <TableRow>
                        <TableHead className='w-[40%]'>Dataset Name</TableHead>
                        <TableHead className='w-[20%]'>Category</TableHead>
                        <TableHead className='w-[15%]'>Status</TableHead>
                        <TableHead className='w-[15%]'>Catalogued On</TableHead>
                        <TableHead className='w-[10%] text-right'>
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.resourcesWithoutInstitutions.map((item) => (
                        <TableRow
                          key={item.id}
                          className='text-xs hover:bg-slate-50/60'
                        >
                          <TableCell className='font-medium text-slate-900'>
                            <Link
                              href={`/admin/resources/${item.id}`}
                              className='hover:text-emerald-700 hover:underline'
                            >
                              {item.name}
                            </Link>
                          </TableCell>
                          <TableCell className='text-slate-600'>
                            {item.category || '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant='default' size='sm'>
                              {item.status}
                            </Badge>
                          </TableCell>
                          <TableCell className='text-slate-500 whitespace-nowrap'>
                            {new Date(item.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className='text-right'>
                            <Link href={`/admin/resources/${item.id}`}>
                              <Button
                                size='sm'
                                variant='outline'
                                className='text-xs text-emerald-700'
                              >
                                Assign Custodian
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tab 6: Never Checked */}
        {tabParam === 'never-checked' && (
          <Card className='bg-white'>
            <CardHeader>
              <CardTitle>Endpoints Never Checked</CardTitle>
              <CardDescription>
                Registered endpoint URLs that have not yet had an initial
                verification check run.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {report.neverChecked.length === 0 ? (
                <EmptyState
                  title='All links verified'
                  description='Every registered endpoint in the platform has at least one verification scan recorded.'
                />
              ) : (
                <div className='overflow-x-auto rounded-lg border border-slate-200'>
                  <Table>
                    <TableHeader className='bg-slate-50'>
                      <TableRow>
                        <TableHead className='w-[35%]'>Endpoint URL</TableHead>
                        <TableHead className='w-[25%]'>Dataset</TableHead>
                        <TableHead className='w-[15%]'>Link Type</TableHead>
                        <TableHead className='w-[15%]'>
                          Current Status
                        </TableHead>
                        <TableHead className='w-[10%] text-right'>
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.neverChecked.map((item) => (
                        <TableRow
                          key={item.linkId}
                          className='text-xs hover:bg-slate-50/60'
                        >
                          <TableCell
                            className='font-mono text-[11px] max-w-xs truncate'
                            title={item.url}
                          >
                            {item.url}
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/admin/resources/${item.resourceId}`}
                              className='font-medium text-slate-800 hover:text-emerald-700 hover:underline truncate block max-w-xs'
                            >
                              {item.resourceName}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge variant='default' size='sm'>
                              {item.linkType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant='default' size='sm'>
                              {item.status}
                            </Badge>
                          </TableCell>
                          <TableCell className='text-right'>
                            <Link href={`/admin/link-health/${item.linkId}`}>
                              <Button
                                size='sm'
                                variant='outline'
                                className='text-xs'
                              >
                                Check Endpoint
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
