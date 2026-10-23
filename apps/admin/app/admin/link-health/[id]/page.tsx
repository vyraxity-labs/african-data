import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@repo/database';
import { getLinkHistory } from '@repo/link-checker';
import { formatHistoryDate } from '../utils';
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
} from '@repo/ui';
import { RemediateModal } from '../remediate-modal';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS_BADGES: Record<string, { label: string; variant: BadgeVariant }> = {
  HEALTHY: { label: 'HEALTHY', variant: 'success' },
  REDIRECTED: { label: 'REDIRECTED', variant: 'info' },
  BROKEN: { label: 'BROKEN', variant: 'danger' },
  TIMEOUT: { label: 'TIMEOUT', variant: 'warning' },
  RATE_LIMITED: { label: 'RATE LIMITED', variant: 'purple' },
  BLOCKED: { label: 'BLOCKED', variant: 'danger' },
  SERVER_ERROR: { label: 'SERVER ERROR', variant: 'warning' },
  UNKNOWN: { label: 'UNKNOWN', variant: 'default' },
};

export default async function LinkHistoryPage(props: PageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect('/admin/login');
  }

  const { id } = await props.params;
  const history = await getLinkHistory(prisma, id, { limit: 100 });

  if (!history) {
    notFound();
  }

  const { link, checks, audits } = history;
  const currentBadge = STATUS_BADGES[link.status] || {
    label: link.status,
    variant: 'default' as BadgeVariant,
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Top Header / Breadcrumbs */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/link-health"
              className="text-slate-500 hover:text-slate-700 transition-colors text-sm flex items-center gap-1 font-medium"
            >
              &larr; Link Health Dashboard
            </Link>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-2">
              <span className="text-xl">📜</span>
              <h1 className="font-bold text-slate-900 text-lg">Endpoint Verification History</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <RemediateModal
              linkId={link.id}
              currentUrl={link.url}
              currentStatus={link.status}
              resourceName={link.resource.name}
              finalUrl={link.finalUrl}
              audits={audits}
            />
            <Link href={`/admin/resources/${link.resource.id}`}>
              <Button size="sm" variant="outline">
                View Dataset
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Link Overview Card */}
        <Card className="bg-white">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1 max-w-3xl">
                <CardTitle className="font-mono text-base break-all flex items-center gap-2 text-slate-900">
                  <span className="select-all">{link.url}</span>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-emerald-600 text-sm"
                    title="Open endpoint in new tab"
                  >
                    ↗
                  </a>
                </CardTitle>
                <CardDescription>
                  Attached to dataset{' '}
                  <Link
                    href={`/admin/resources/${link.resource.id}/edit`}
                    className="font-medium text-emerald-700 hover:underline"
                  >
                    {link.resource.name}
                  </Link>
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant={currentBadge.variant} size="md" dot>
                  {currentBadge.label}
                </Badge>
                {link.httpStatus && (
                  <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-800 border border-slate-200">
                    HTTP {link.httpStatus}
                  </span>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-slate-100 pt-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Link Type</span>
                <span className="font-semibold text-slate-800">{link.linkType}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Response Time</span>
                <span className="font-mono font-medium text-slate-800">
                  {link.responseTimeMs ? `${link.responseTimeMs} ms` : '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Last Checked</span>
                <span className="font-medium text-slate-800">
                  {link.lastCheckedAt ? formatHistoryDate(link.lastCheckedAt).full : 'Never'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Total Verifications</span>
                <span className="font-semibold text-slate-800">{history.totalChecks} checks recorded</span>
              </div>
            </div>

            {link.finalUrl && link.finalUrl !== link.url && (
              <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900 flex items-center gap-2 font-mono">
                <span className="font-bold">↳ Destination:</span>
                <span className="break-all">{link.finalUrl}</span>
              </div>
            )}

            {link.errorMessage && (
              <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-800 flex items-center gap-2">
                <span className="font-bold">⚠ Error message:</span>
                <span>{link.errorMessage}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Historical Checks Section */}
        <Card className="bg-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Historical Checks</CardTitle>
                <CardDescription>
                  Full audit timeline of automated and manual endpoint health checks (newest first).
                </CardDescription>
              </div>
              <Badge variant="default" size="sm">
                {checks.length} recorded
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {checks.length === 0 ? (
              <EmptyState
                title="No historical checks"
                description="This endpoint has not yet been processed by the scheduled monitor or manual scanner."
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-[18%]">Date</TableHead>
                      <TableHead className="w-[14%]">Status</TableHead>
                      <TableHead className="w-[12%]">HTTP</TableHead>
                      <TableHead className="w-[14%]">Response Time</TableHead>
                      <TableHead className="w-[22%]">Final URL</TableHead>
                      <TableHead className="w-[20%]">Error Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {checks.map((check) => {
                      const dateFormatted = formatHistoryDate(check.checkedAt);
                      const badgeCfg = STATUS_BADGES[check.status] || {
                        label: check.status,
                        variant: 'default' as BadgeVariant,
                      };

                      return (
                        <TableRow key={check.id} className="text-xs hover:bg-slate-50/60">
                          {/* Date: formatted as '20 Sep' with time */}
                          <TableCell className="font-medium text-slate-900 whitespace-nowrap">
                            <span className="block font-semibold text-slate-800">
                              {dateFormatted.short}
                            </span>
                            <span className="block text-[10px] text-slate-400 font-mono">
                              {dateFormatted.time} ({dateFormatted.full})
                            </span>
                          </TableCell>

                          {/* Status */}
                          <TableCell>
                            <Badge variant={badgeCfg.variant} size="sm">
                              {badgeCfg.label}
                            </Badge>
                          </TableCell>

                          {/* HTTP */}
                          <TableCell>
                            {check.httpStatus ? (
                              <span
                                className={`font-mono text-xs font-semibold px-2 py-0.5 rounded-sm ${
                                  check.httpStatus >= 200 && check.httpStatus < 300
                                    ? 'bg-emerald-50 text-emerald-800'
                                    : check.httpStatus >= 300 && check.httpStatus < 400
                                      ? 'bg-blue-50 text-blue-800'
                                      : check.httpStatus >= 400 && check.httpStatus < 500
                                        ? 'bg-red-50 text-red-800'
                                        : 'bg-amber-50 text-amber-800'
                                }`}
                              >
                                {check.httpStatus}
                              </span>
                            ) : (
                              <span className="font-mono text-slate-400">—</span>
                            )}
                          </TableCell>

                          {/* Response Time */}
                          <TableCell className="font-mono text-slate-600 whitespace-nowrap">
                            {check.responseTimeMs !== null && check.responseTimeMs !== undefined ? (
                              <span
                                className={
                                  check.responseTimeMs < 500
                                    ? 'text-emerald-700 font-medium'
                                    : check.responseTimeMs < 1500
                                      ? 'text-amber-700 font-medium'
                                      : 'text-rose-700 font-medium'
                                }
                              >
                                {check.responseTimeMs} ms
                              </span>
                            ) : (
                              '—'
                            )}
                          </TableCell>

                          {/* Final URL */}
                          <TableCell className="max-w-xs truncate font-mono text-[11px] text-slate-600">
                            {check.finalUrl ? (
                              <span
                                title={check.finalUrl}
                                className={
                                  check.finalUrl !== link.url
                                    ? 'text-blue-700 font-medium'
                                    : 'text-slate-600'
                                }
                              >
                                {check.finalUrl !== link.url && '↳ '}
                                {check.finalUrl}
                              </span>
                            ) : (
                              '—'
                            )}
                          </TableCell>

                          {/* Error Type & Message */}
                          <TableCell className="max-w-xs text-[11px]">
                            {check.errorType || check.errorMessage ? (
                              <div className="space-y-0.5">
                                {check.errorType && (
                                  <span className="font-mono font-semibold text-rose-700 block">
                                    {check.errorType}
                                  </span>
                                )}
                                {check.errorMessage && (
                                  <span
                                    className="text-slate-600 block truncate"
                                    title={check.errorMessage}
                                  >
                                    {check.errorMessage}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* URL Replacement Audits (if any exist) */}
        {audits.length > 0 && (
          <Card className="bg-white">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>URL Replacement Audits</CardTitle>
                  <CardDescription>
                    Historical changes to the endpoint URL performed during remediation.
                  </CardDescription>
                </div>
                <Badge variant="purple" size="sm">
                  {audits.length} remediation(s)
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-[18%]">Date</TableHead>
                      <TableHead className="w-[34%]">URL Transition</TableHead>
                      <TableHead className="w-[20%]">Reason</TableHead>
                      <TableHead className="w-[14%]">Changed By</TableHead>
                      <TableHead className="w-[14%]">Status Transition</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audits.map((audit) => {
                      const dateFormatted = formatHistoryDate(audit.createdAt);
                      return (
                        <TableRow key={audit.id} className="text-xs hover:bg-slate-50/60">
                          <TableCell className="font-medium text-slate-800 whitespace-nowrap">
                            <span className="block font-semibold">{dateFormatted.short}</span>
                            <span className="block text-[10px] text-slate-400 font-mono">
                              {dateFormatted.time} ({dateFormatted.full})
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-[11px] max-w-sm space-y-1">
                            <div className="line-through text-slate-400 truncate" title={audit.oldUrl}>
                              {audit.oldUrl}
                            </div>
                            <div className="text-emerald-700 font-medium truncate" title={audit.newUrl}>
                              &rarr; {audit.newUrl}
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {audit.reason || 'Remediation'}
                          </TableCell>
                          <TableCell className="font-mono text-slate-700">
                            {audit.changedBy || 'system'}
                          </TableCell>
                          <TableCell>
                            {audit.statusBefore || audit.statusAfter ? (
                              <span className="text-[11px] text-slate-600">
                                {audit.statusBefore || '—'} &rarr; {audit.statusAfter || '—'}
                              </span>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
