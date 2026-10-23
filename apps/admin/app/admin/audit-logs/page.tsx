import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma, AuditAction, getAuditLogs } from '@repo/database';
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
import { AuditDiffViewer } from './audit-diff-viewer';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const ACTION_CONFIG: Record<
  AuditAction,
  {
    label: string;
    variant: BadgeVariant;
    icon: string;
  }
> = {
  [AuditAction.CREATE_RESOURCE]: {
    label: 'Create Resource',
    variant: 'success',
    icon: '✨',
  },
  [AuditAction.UPDATE_RESOURCE]: {
    label: 'Update Resource',
    variant: 'info',
    icon: '📝',
  },
  [AuditAction.ARCHIVE_RESOURCE]: {
    label: 'Archive Resource',
    variant: 'danger',
    icon: '📦',
  },
  [AuditAction.CREATE_LINK]: {
    label: 'Create Link',
    variant: 'success',
    icon: '🔗',
  },
  [AuditAction.UPDATE_LINK]: {
    label: 'Update Link',
    variant: 'info',
    icon: '✏️',
  },
  [AuditAction.REPLACE_LINK]: {
    label: 'Replace Link',
    variant: 'warning',
    icon: '🔄',
  },
  [AuditAction.BULK_REPLACE_LINKS]: {
    label: 'Bulk Replace Links',
    variant: 'purple',
    icon: '⚡',
  },
  [AuditAction.CSV_IMPORT]: {
    label: 'CSV Import',
    variant: 'purple',
    icon: '📥',
  },
  [AuditAction.RESOURCE_STATUS_CHANGE]: {
    label: 'Status Change',
    variant: 'default',
    icon: '🚦',
  },
};

export default async function AuditLogsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect('/admin/login?callbackUrl=/admin/audit-logs');
  }

  const resolvedParams = await searchParams;
  const actionParam = resolvedParams.action as string | undefined;
  const entityParam = resolvedParams.entity as string | undefined;
  const actorParam = resolvedParams.actor as string | undefined;
  const pageParam = resolvedParams.page ? parseInt(resolvedParams.page as string, 10) : 1;

  const validAction =
    actionParam && Object.values(AuditAction).includes(actionParam as AuditAction)
      ? (actionParam as AuditAction)
      : undefined;

  const limit = 25;
  const offset = (Math.max(pageParam, 1) - 1) * limit;

  const { logs, total } = await getAuditLogs(prisma, {
    action: validAction,
    entity: entityParam?.trim() || undefined,
    actor: actorParam?.trim() || undefined,
    limit,
    offset,
  });

  const totalPages = Math.ceil(total / limit);

  // Group metrics
  const [totalActions, resourceActions, linkActions, importActions] = await Promise.all([
    prisma.auditLog?.count() ?? 0,
    prisma.auditLog?.count({
      where: {
        action: {
          in: [
            AuditAction.CREATE_RESOURCE,
            AuditAction.UPDATE_RESOURCE,
            AuditAction.ARCHIVE_RESOURCE,
            AuditAction.RESOURCE_STATUS_CHANGE,
          ],
        },
      },
    }) ?? 0,
    prisma.auditLog?.count({
      where: {
        action: {
          in: [
            AuditAction.CREATE_LINK,
            AuditAction.UPDATE_LINK,
            AuditAction.REPLACE_LINK,
            AuditAction.BULK_REPLACE_LINKS,
          ],
        },
      },
    }) ?? 0,
    prisma.auditLog?.count({
      where: { action: AuditAction.CSV_IMPORT },
    }) ?? 0,
  ]);

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="text-slate-500 hover:text-slate-700 text-sm font-medium flex items-center gap-1"
            >
              &larr; Admin
            </Link>
            <span className="text-slate-300">/</span>
            <div className="flex items-center gap-2">
              <span className="text-xl">📜</span>
              <h1 className="text-lg font-bold text-slate-900">Audit Trail</h1>
            </div>
            <Badge variant="info" size="sm">
              Phase 19
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/admin/resources">
              <Button size="sm" variant="outline">
                Catalogue
              </Button>
            </Link>
            <Link href="/admin/link-health">
              <Button size="sm" variant="outline">
                Link Health
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Header Summary */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Administrative Operations Log
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Tamper-evident record of administrative changes, link replacements, status transitions, and bulk ingestion.
            </p>
          </div>
        </div>

        {/* Quick Metrics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardDescription>Total Audit Events</CardDescription>
              <CardTitle className="text-2xl font-bold text-slate-900">
                {totalActions}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-xs text-slate-500">Historical administrative events</span>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardDescription>Resource Modifications</CardDescription>
              <CardTitle className="text-2xl font-bold text-blue-600">
                {resourceActions}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-xs text-slate-500">Creates, updates, archives & status changes</span>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardDescription>Link Remediations</CardDescription>
              <CardTitle className="text-2xl font-bold text-amber-600">
                {linkActions}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-xs text-slate-500">Individual & bulk URL replacements</span>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardDescription>CSV Ingestions</CardDescription>
              <CardTitle className="text-2xl font-bold text-purple-600">
                {importActions}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-xs text-slate-500">Committed multi-record dataset imports</span>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-slate-200 bg-white p-4">
          <form method="GET" className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="action" className="text-xs font-semibold text-slate-700">
                Action:
              </label>
              <select
                id="action"
                name="action"
                defaultValue={validAction || ''}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">All Actions</option>
                {Object.values(AuditAction).map((act) => (
                  <option key={act} value={act}>
                    {ACTION_CONFIG[act]?.label || act}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="entity" className="text-xs font-semibold text-slate-700">
                Entity:
              </label>
              <select
                id="entity"
                name="entity"
                defaultValue={entityParam || ''}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">All Entities</option>
                <option value="Resource">Resource</option>
                <option value="ResourceLink">ResourceLink</option>
                <option value="Institution">Institution</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="actor" className="text-xs font-semibold text-slate-700">
                Actor:
              </label>
              <input
                id="actor"
                name="actor"
                type="text"
                placeholder="Filter by admin..."
                defaultValue={actorParam || ''}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <Button type="submit" size="sm" variant="primary" className="text-xs h-8">
              Filter
            </Button>

            {(validAction || entityParam || actorParam) && (
              <Link href="/admin/audit-logs">
                <Button type="button" size="sm" variant="ghost" className="text-xs h-8 text-slate-500">
                  Reset
                </Button>
              </Link>
            )}
          </form>
        </Card>

        {/* Audit Log Table */}
        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-3 px-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">
                  Audit Records ({total})
                </CardTitle>
                <CardDescription className="text-xs">
                  Showing {logs.length > 0 ? offset + 1 : 0} to {Math.min(offset + limit, total)} of {total} events
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {logs.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  title="No audit events found"
                  description="No administrative actions match your current filter parameters."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-44">Timestamp</TableHead>
                      <TableHead className="w-48">Action</TableHead>
                      <TableHead className="w-48">Actor</TableHead>
                      <TableHead className="w-56">Entity & ID</TableHead>
                      <TableHead>Changes & Details</TableHead>
                      <TableHead className="text-right w-32">Inspection</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const cfg = ACTION_CONFIG[log.action] || {
                        label: log.action,
                        variant: 'default',
                        icon: '📋',
                      };
                      const dateObj = new Date(log.timestamp);
                      const formattedDate = dateObj.toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      });
                      const formattedTime = dateObj.toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      });

                      return (
                        <TableRow key={log.id} className="hover:bg-slate-50/70">
                          <TableCell className="text-xs">
                            <div className="font-medium text-slate-900">{formattedDate}</div>
                            <div className="font-mono text-slate-500 text-[11px]">
                              {formattedTime}
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge variant={cfg.variant} size="sm" className="gap-1 inline-flex items-center">
                              <span>{cfg.icon}</span>
                              <span>{cfg.label}</span>
                            </Badge>
                          </TableCell>

                          <TableCell className="text-xs">
                            <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                              {log.actor}
                            </span>
                          </TableCell>

                          <TableCell className="text-xs">
                            <div className="font-semibold text-slate-800">{log.entity}</div>
                            <div className="font-mono text-slate-500 text-[11px] truncate max-w-[200px]" title={log.entityId}>
                              {log.entityId}
                            </div>
                          </TableCell>

                          <TableCell className="text-xs text-slate-600">
                            {log.action === AuditAction.CSV_IMPORT && log.after ? (
                              <span>
                                Ingested file <span className="font-semibold text-slate-800">{(log.after as any).fileName}</span>: {(log.after as any).resourcesCreated ?? (log.after as any).createdCount ?? 0} created, {(log.after as any).skippedDuplicates ?? (log.after as any).skippedCount ?? 0} skipped
                              </span>
                            ) : log.action === AuditAction.REPLACE_LINK || log.action === AuditAction.BULK_REPLACE_LINKS ? (
                              <div className="truncate max-w-md">
                                <span className="text-rose-600 line-through mr-1">{(log.before as any)?.url || 'original'}</span>
                                &rarr;
                                <span className="text-emerald-700 font-medium ml-1">{(log.after as any)?.url}</span>
                              </div>
                            ) : log.action === AuditAction.RESOURCE_STATUS_CHANGE || log.action === AuditAction.ARCHIVE_RESOURCE ? (
                              <span>
                                Status changed: <span className="font-semibold">{(log.before as any)?.status}</span> &rarr; <span className="font-semibold text-emerald-700">{(log.after as any)?.status}</span>
                              </span>
                            ) : (log.after as any)?.name ? (
                              <span className="font-medium text-slate-800 truncate max-w-sm block">
                                {(log.after as any).name}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">State captured</span>
                            )}
                          </TableCell>

                          <TableCell className="text-right">
                            <AuditDiffViewer
                              actor={log.actor}
                              action={cfg.label}
                              entity={log.entity}
                              entityId={log.entityId}
                              timestamp={log.timestamp.toISOString()}
                              before={log.before}
                              after={log.after}
                            />
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

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 sm:px-6 rounded-lg shadow-sm">
            <div className="text-xs text-slate-600">
              Page <span className="font-semibold">{pageParam}</span> of <span className="font-semibold">{totalPages}</span>
            </div>
            <div className="flex gap-2">
              {pageParam > 1 && (
                <Link
                  href={`/admin/audit-logs?${new URLSearchParams({
                    ...(validAction ? { action: validAction } : {}),
                    ...(entityParam ? { entity: entityParam } : {}),
                    ...(actorParam ? { actor: actorParam } : {}),
                    page: String(pageParam - 1),
                  }).toString()}`}
                >
                  <Button size="sm" variant="outline">
                    &larr; Previous
                  </Button>
                </Link>
              )}
              {pageParam < totalPages && (
                <Link
                  href={`/admin/audit-logs?${new URLSearchParams({
                    ...(validAction ? { action: validAction } : {}),
                    ...(entityParam ? { entity: entityParam } : {}),
                    ...(actorParam ? { actor: actorParam } : {}),
                    page: String(pageParam + 1),
                  }).toString()}`}
                >
                  <Button size="sm" variant="outline">
                    Next &rarr;
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
