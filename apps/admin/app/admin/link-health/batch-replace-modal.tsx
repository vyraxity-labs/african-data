'use client';

import * as React from 'react';
import { useState, useTransition } from 'react';
import { Button, Dialog, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@repo/ui';
import {
  previewBatchReplacementAction,
  applyBatchReplacementAction,
} from './actions';
import type { BatchPreviewSummary } from '@repo/link-checker';

const SAMPLE_CSV = `link_id,new_url
cmv1234567890,https://data.example.org/v2/indicators.csv
cmv0987654321,https://api.example.org/v2/health-metrics
`;

export function BatchReplaceModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [reason, setReason] = useState('Bulk URL migration / Portal update');
  const [preview, setPreview] = useState<BatchPreviewSummary | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPreviewPending, startPreviewTransition] = useTransition();
  const [isApplyPending, startApplyTransition] = useTransition();

  const handleOpen = () => {
    setCsvText('');
    setPreview(null);
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsOpen(true);
  };

  const handleClose = () => {
    if (isApplyPending || isPreviewPending) return;
    setIsOpen(false);
  };

  const handleDownloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'link_replacement_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setCsvText(content);
        setPreview(null);
        setErrorMsg(null);
      }
    };
    reader.readAsText(file);
  };

  const handlePreview = () => {
    if (!csvText.trim()) {
      setErrorMsg('Please paste or upload CSV content before validating.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);

    startPreviewTransition(async () => {
      const res = await previewBatchReplacementAction(csvText);
      if (!res.success || !res.preview) {
        setErrorMsg(res.error || 'Failed to parse and validate CSV batch.');
        setPreview(null);
      } else {
        setPreview(res.preview);
      }
    });
  };

  const handleApply = () => {
    if (!preview || !preview.canApply) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    startApplyTransition(async () => {
      const res = await applyBatchReplacementAction(csvText, reason);
      if (!res.success || !res.result) {
        setErrorMsg(res.error || 'Failed to apply batch replacement.');
      } else {
        setSuccessMsg(res.result.message);
        setTimeout(() => {
          setIsOpen(false);
        }, 2000);
      }
    });
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={handleOpen}
        className="bg-white hover:bg-slate-50 border-slate-300 text-slate-700 shadow-xs text-xs flex items-center gap-1.5"
      >
        <span>📁</span> Batch Replace (CSV)
      </Button>

      <Dialog
        isOpen={isOpen}
        onClose={handleClose}
        title="Batch URL Replacement Pipeline"
        description="Upload or paste a CSV file to validate, preview, and atomically update multiple endpoint links."
        size="xl"
      >
        <div className="space-y-4">
          {/* Instructions and Format Guide */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">
                Required CSV Schema: <code className="bg-slate-200 px-1.5 py-0.5 rounded text-[11px]">link_id,new_url</code>
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleDownloadSample}
                className="text-[11px] text-emerald-700 hover:text-emerald-800"
              >
                Download Sample CSV
              </Button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              In accordance with platform safety rules, invalid batches will <strong>never be silently partially applied</strong>.
              Every modified URL is audited in platform history and queued for scheduled monitoring.
            </p>
          </div>

          {/* Input Controls */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-slate-700">Paste CSV or Upload File</label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                disabled={isPreviewPending || isApplyPending}
                className="text-[11px] text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[11px] file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300 cursor-pointer"
              />
            </div>
            <textarea
              rows={4}
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                setPreview(null);
              }}
              placeholder={`link_id,new_url\nabc123,https://example.org/new/data.csv\ndef456,https://example.org/api/v2`}
              disabled={isPreviewPending || isApplyPending}
              className="w-full font-mono text-xs rounded-lg border border-slate-300 p-2.5 text-slate-900 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Reason Input */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 block">
              Audit Reason / Notes
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Bulk URL migration, Domain migration"
              disabled={isPreviewPending || isApplyPending}
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-1.5 text-slate-900 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Action Row: Validate & Preview Button */}
          <div className="flex items-center justify-between pt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPreviewPending || isApplyPending || !csvText.trim()}
              onClick={handlePreview}
              className="text-xs font-medium"
            >
              {isPreviewPending ? 'Validating Batch...' : '🔍 Validate & Preview Batch'}
            </Button>

            {preview && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">Total: {preview.totalRows}</span>
                <span className="text-emerald-700 font-semibold">✓ {preview.validCount} valid</span>
                {preview.invalidCount > 0 && (
                  <span className="text-red-600 font-semibold">⚠ {preview.invalidCount} invalid</span>
                )}
              </div>
            )}
          </div>

          {/* Error & Success Messages */}
          {errorMsg && (
            <div className="rounded-lg bg-red-50 p-3 border border-red-200 text-xs text-red-800 font-medium">
              ⚠ {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-200 text-xs text-emerald-800 font-medium animate-fade-in">
              ✓ {successMsg}
            </div>
          )}

          {/* Preview Table & Safety Warning */}
          {preview && (
            <div className="space-y-3">
              {!preview.canApply && (
                <div className="rounded-lg bg-amber-50 p-3 border border-amber-300 text-xs text-amber-900">
                  <strong>⚠️ Atomic Safety Guarantee:</strong> Partial application is blocked because this batch contains{' '}
                  {preview.invalidCount} invalid row(s). You must correct all flagged rows before applying.
                </div>
              )}

              <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="w-12 text-center">Row</TableHead>
                      <TableHead className="w-28">Link ID</TableHead>
                      <TableHead className="w-32">Dataset</TableHead>
                      <TableHead className="w-40">Old URL</TableHead>
                      <TableHead className="w-48">New URL (Normalized)</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.items.map((item) => (
                      <TableRow
                        key={item.rowNumber}
                        className={item.isValid ? 'hover:bg-slate-50/50' : 'bg-red-50/40'}
                      >
                        <TableCell className="text-center font-mono text-[11px] text-slate-500">
                          {item.rowNumber}
                        </TableCell>
                        <TableCell className="font-mono text-[11px] text-slate-800 truncate max-w-28">
                          {item.linkId || '—'}
                        </TableCell>
                        <TableCell className="text-xs text-slate-700 truncate max-w-32">
                          {item.datasetName || '—'}
                        </TableCell>
                        <TableCell className="font-mono text-[11px] text-slate-500 truncate max-w-40" title={item.oldUrl}>
                          {item.oldUrl || '—'}
                        </TableCell>
                        <TableCell className="font-mono text-[11px] text-slate-900 truncate max-w-48 font-medium" title={item.normalizedNewUrl || item.rawNewUrl}>
                          {item.normalizedNewUrl || item.rawNewUrl}
                        </TableCell>
                        <TableCell>
                          {item.isValid ? (
                            <Badge variant="success" size="sm">Valid</Badge>
                          ) : (
                            <div className="space-y-0.5">
                              <Badge variant="danger" size="sm">Invalid</Badge>
                              {item.error && (
                                <span className="block text-[10px] text-red-600 truncate max-w-36" title={item.error}>
                                  {item.error}
                                </span>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Modal Footer Controls */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={isApplyPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isApplyPending || !preview?.canApply}
              onClick={handleApply}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs disabled:opacity-50"
            >
              {isApplyPending ? 'Applying Transactionally...' : 'Confirm & Apply Transactionally'}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
