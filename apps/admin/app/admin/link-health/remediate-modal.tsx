'use client';

import * as React from 'react';
import { useState, useTransition } from 'react';
import { Button, Dialog, Input, Badge } from '@repo/ui';
import {
  remediateLinkAction,
  applyRedirectDestinationAction,
  RemediateActionResult,
} from './actions';

export interface RemediateModalProps {
  linkId: string;
  currentUrl: string;
  currentStatus: string;
  resourceName: string;
  finalUrl?: string | null;
  audits?: Array<{
    id: string;
    oldUrl: string;
    newUrl: string;
    reason: string | null;
    changedBy: string | null;
    createdAt: Date | string;
  }>;
}

export function RemediateModal({
  linkId,
  currentUrl,
  currentStatus,
  resourceName,
  finalUrl,
  audits = [],
}: RemediateModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [reason, setReason] = useState('URL update / Broken link remediation');
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<RemediateActionResult | null>(null);

  const handleOpen = () => {
    setNewUrl('');
    setResult(null);
    setIsOpen(true);
  };

  const handleClose = () => {
    if (isPending) return;
    setIsOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.set('linkId', linkId);
      formData.set('newUrl', newUrl.trim());
      formData.set('reason', reason.trim());

      const res = await remediateLinkAction(formData);
      setResult(res);

      if (res.success) {
        setTimeout(() => {
          setIsOpen(false);
        }, 1500);
      }
    });
  };

  // Step 15.2: [Use Destination] one-click action
  const handleUseDestination = () => {
    if (!finalUrl) return;

    startTransition(async () => {
      setResult(null);
      const res = await applyRedirectDestinationAction(linkId);
      setResult(res);

      if (res.success) {
        setTimeout(() => {
          setIsOpen(false);
        }, 1500);
      }
    });
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={handleOpen}
        className={`text-xs ${
          currentStatus === 'REDIRECTED'
            ? 'text-blue-700 hover:text-blue-800 hover:bg-blue-50 border-blue-300'
            : 'text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-300'
        }`}
      >
        {currentStatus === 'REDIRECTED' ? '↳ Resolve' : 'Remediate'}
      </Button>

      <Dialog
        isOpen={isOpen}
        onClose={handleClose}
        title={currentStatus === 'REDIRECTED' ? 'Resolve Redirecting Link' : 'Remediate Endpoint Link'}
        description={`Dataset: ${resourceName}`}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current URL Details */}
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Current URL (OLD)</span>
              <Badge
                variant={
                  currentStatus === 'HEALTHY'
                    ? 'success'
                    : currentStatus === 'REDIRECTED'
                    ? 'info'
                    : 'danger'
                }
                size="sm"
              >
                {currentStatus}
              </Badge>
            </div>
            <div className="font-mono text-xs text-slate-800 break-all">{currentUrl}</div>
          </div>

          {/* Step 15.2: Detected Destination Section for Redirects */}
          {finalUrl && finalUrl !== currentUrl && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/75 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-blue-950">
                <span className="flex items-center gap-1.5">
                  <span className="text-blue-600 font-bold">↳</span> Detected Destination:
                </span>
                <Badge variant="info" size="sm">
                  3xx Redirect Detected
                </Badge>
              </div>

              <div className="font-mono text-xs text-blue-900 break-all bg-white p-2.5 rounded border border-blue-200 shadow-2xs font-medium">
                {finalUrl}
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-[11px] text-blue-700">
                  Pre-save rules: Validate NEW &bull; SSRF-check NEW &bull; Check NEW &bull; Save if appropriate
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={handleUseDestination}
                  className="bg-white hover:bg-blue-100 text-blue-800 border-blue-300 text-xs shrink-0 font-semibold shadow-xs"
                >
                  [Use Destination]
                </Button>
              </div>
            </div>
          )}

          {/* New URL Input */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-800 block">
              {finalUrl && finalUrl !== currentUrl ? 'Or Enter Custom Replacement URL' : 'Replacement URL'}{' '}
              <span className="text-red-500">*</span>
            </label>
            <Input
              type="url"
              required={!finalUrl}
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://example.org/new/dataset/endpoint"
              helperText="The replacement URL will be normalized, verified against SSRF, and checked via HEAD/GET prior to saving."
              disabled={isPending}
            />
          </div>

          {/* Reason Input */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-800 block">
              Reason / Change Notes
            </label>
            <Input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Adopted 301 target, Migrated to HTTPS"
              disabled={isPending}
            />
          </div>

          {/* Historical Audit Trail */}
          {audits.length > 0 && (
            <div className="rounded-lg border border-slate-200 p-2.5 bg-slate-50/50 space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
                Replacement History ({audits.length})
              </span>
              <div className="max-h-24 overflow-y-auto space-y-1 text-xs">
                {audits.map((a) => (
                  <div key={a.id} className="text-[11px] text-slate-600 font-mono">
                    <span className="text-slate-400">{new Date(a.createdAt).toLocaleDateString()}:</span>{' '}
                    <span className="line-through text-red-600">{a.oldUrl}</span> &rarr;{' '}
                    <span className="text-emerald-700">{a.newUrl}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* In-Flight / Result Banners */}
          {isPending && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-3 border border-blue-200 text-xs text-blue-800">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent shrink-0" />
              <span>Validating NEW, testing SSRF safety, and executing bounded check...</span>
            </div>
          )}

          {result?.success && (
            <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-200 text-xs text-emerald-800 font-medium animate-fade-in">
              ✓ {result.message}
            </div>
          )}

          {result?.error && (
            <div className="rounded-lg bg-red-50 p-3 border border-red-200 text-xs text-red-800 font-medium">
              ⚠ {result.error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending || !newUrl.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isPending ? 'Verifying & Saving...' : 'Verify & Save Custom URL'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
