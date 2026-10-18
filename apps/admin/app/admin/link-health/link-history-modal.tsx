'use client';

import * as React from 'react';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Button,
  Dialog,
  Badge,
  BadgeVariant,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  EmptyState,
} from '@repo/ui';
import {
  getLinkHistoryAction,
  type LinkHistoryResult,
  type LinkCheckHistoryEntry,
} from './actions';
import { formatHistoryDate } from './utils';

export interface LinkHistoryModalProps {
  linkId: string;
  url: string;
  currentStatus?: string;
  resourceName?: string;
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

export function LinkHistoryModal({
  linkId,
  url,
  currentStatus = 'UNKNOWN',
  resourceName,
}: LinkHistoryModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<LinkHistoryResult | null>(null);
  const [activeTab, setActiveTab] = useState<'checks' | 'audits'>('checks');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleOpen = () => {
    setIsOpen(true);
    setError(null);
    startTransition(async () => {
      const res = await getLinkHistoryAction(linkId);
      if (res.success && res.history) {
        setHistory(res.history);
      } else {
        setError(res.error || 'Failed to load link check history.');
      }
    });
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleOpen}
        className="text-xs text-slate-700 hover:text-slate-900 px-2.5 py-1"
        title="View historical checks and audit trail"
      >
        <span className="mr-1">🕒</span> History
      </Button>

      <Dialog
        isOpen={isOpen}
        onClose={handleClose}
        title="Endpoint Health History"
        description="Historical link check verifications and URL replacement audits."
        className="max-w-4xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <Link
              href={`/admin/link-health/${linkId}`}
              className="text-xs text-emerald-600 hover:text-emerald-700 hover:underline font-medium flex items-center gap-1"
              target="_blank"
            >
              Open Permalink View ↗
            </Link>
            <Button size="sm" variant="outline" onClick={handleClose}>
              Close
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Header Summary Card */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3.5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs font-semibold text-slate-900 break-all select-all">
                {url}
              </span>
              <Badge
                variant={STATUS_BADGES[currentStatus]?.variant || 'default'}
                size="sm"
                dot
              >
                {STATUS_BADGES[currentStatus]?.label || currentStatus}
              </Badge>
            </div>
            {resourceName && (
              <div className="text-xs text-slate-500">
                Dataset: <span className="font-medium text-slate-700">{resourceName}</span>
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 gap-4 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('checks')}
              className={`pb-2 transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
                activeTab === 'checks'
                  ? 'border-emerald-600 text-emerald-700 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>Historical Checks</span>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                {history?.totalChecks ?? '...'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('audits')}
              className={`pb-2 transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
                activeTab === 'audits'
                  ? 'border-emerald-600 text-emerald-700 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>URL Replacement Audits</span>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                {history?.totalAudits ?? '...'}
              </span>
            </button>
          </div>

          {/* Content Loading / Error / Data */}
          {isPending && !history ? (
            <div className="py-12 text-center">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-emerald-600 border-r-transparent"></div>
              <p className="mt-2 text-xs text-slate-500">Loading historical verification records...</p>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
              {error}
            </div>
          ) : activeTab === 'checks' ? (
            <div className="space-y-2">
              {!history || history.checks.length === 0 ? (
                <EmptyState
                  title="No check history found"
                  description="This endpoint has not been verified by the automated scanner or manual checker yet."
                />
              ) : (
                <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="w-[18%]">Date</TableHead>
                        <TableHead className="w-[16%]">Status</TableHead>
                        <TableHead className="w-[12%]">HTTP</TableHead>
                        <TableHead className="w-[14%]">Response Time</TableHead>
                        <TableHead className="w-[20%]">Final URL</TableHead>
                        <TableHead className="w-[20%]">Error Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.checks.map((check: LinkCheckHistoryEntry) => {
                        const dateFormatted = formatHistoryDate(check.checkedAt);
                        const statusCfg = STATUS_BADGES[check.status] || {
                          label: check.status,
                          variant: 'default' as BadgeVariant,
                        };

                        return (
                          <TableRow key={check.id} className="text-xs hover:bg-slate-50/60">
                            {/* Date: formatted as '20 Sep' with time subtext */}
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
                              <Badge variant={statusCfg.variant} size="sm">
                                {statusCfg.label}
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
                                    check.finalUrl !== url
                                      ? 'text-blue-700 font-medium'
                                      : 'text-slate-600'
                                  }
                                >
                                  {check.finalUrl !== url && '↳ '}
                                  {check.finalUrl}
                                </span>
                              ) : (
                                '—'
                              )}
                            </TableCell>

                            {/* Error Type & Error Message */}
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
            </div>
          ) : (
            /* Audits Tab */
            <div className="space-y-2">
              {!history || history.audits.length === 0 ? (
                <EmptyState
                  title="No remediation audits"
                  description="This endpoint has not undergone manual or batch URL replacement."
                />
              ) : (
                <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="w-[20%]">Date</TableHead>
                        <TableHead className="w-[30%]">URL Transition</TableHead>
                        <TableHead className="w-[20%]">Reason</TableHead>
                        <TableHead className="w-[15%]">Admin</TableHead>
                        <TableHead className="w-[15%]">Status Change</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.audits.map((audit) => {
                        const dateFormatted = formatHistoryDate(audit.createdAt);
                        return (
                          <TableRow key={audit.id} className="text-xs hover:bg-slate-50/60">
                            <TableCell className="font-medium text-slate-800 whitespace-nowrap">
                              <span className="block font-semibold">{dateFormatted.short}</span>
                              <span className="block text-[10px] text-slate-400 font-mono">
                                {dateFormatted.time}
                              </span>
                            </TableCell>
                            <TableCell className="font-mono text-[11px] max-w-xs space-y-1">
                              <div className="line-through text-slate-400 truncate" title={audit.oldUrl}>
                                {audit.oldUrl}
                              </div>
                              <div className="text-emerald-700 font-medium truncate" title={audit.newUrl}>
                                &rarr; {audit.newUrl}
                              </div>
                            </TableCell>
                            <TableCell className="text-slate-600">
                              {audit.reason || 'Manual replacement'}
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
              )}
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}
