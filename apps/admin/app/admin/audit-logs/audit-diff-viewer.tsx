'use client';

import * as React from 'react';
import { useState } from 'react';
import { Button, Dialog, Badge } from '@repo/ui';

interface AuditDiffViewerProps {
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  timestamp: string;
  before: any;
  after: any;
}

export function AuditDiffViewer({
  actor,
  action,
  entity,
  entityId,
  timestamp,
  before,
  after,
}: AuditDiffViewerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const hasBefore = before !== null && before !== undefined;
  const hasAfter = after !== null && after !== undefined;

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="text-xs h-7 px-2.5 font-medium hover:bg-slate-100"
      >
        View Details &rarr;
      </Button>

      <Dialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={`Audit Record: ${action}`}
        description={`Recorded on ${new Date(timestamp).toLocaleString()} by ${actor}`}
        className="max-w-3xl"
      >
        <div className="space-y-4">
          {/* Metadata pill grid */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
            <div>
              <span className="font-semibold text-slate-500">Action:</span>{' '}
              <span className="font-mono font-medium text-slate-800">{action}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-500">Actor:</span>{' '}
              <span className="font-mono text-slate-800">{actor}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-500">Entity:</span>{' '}
              <span className="font-medium text-slate-800">{entity}</span>
            </div>
            <div className="truncate">
              <span className="font-semibold text-slate-500">Entity ID:</span>{' '}
              <span className="font-mono text-slate-800">{entityId}</span>
            </div>
          </div>

          {/* Before & After comparison grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Before State */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Before State
                </span>
                {!hasBefore && (
                  <Badge variant="default" size="sm">
                    None (Initial creation)
                  </Badge>
                )}
              </div>
              <div className="bg-slate-900 text-slate-100 rounded-lg p-3 text-xs font-mono overflow-auto max-h-72 border border-slate-800">
                {hasBefore ? (
                  <pre className="whitespace-pre-wrap word-break">
                    {JSON.stringify(before, null, 2)}
                  </pre>
                ) : (
                  <span className="text-slate-500 italic">No previous state recorded</span>
                )}
              </div>
            </div>

            {/* After State */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                  After State
                </span>
                {!hasAfter && (
                  <Badge variant="danger" size="sm">
                    Deleted
                  </Badge>
                )}
              </div>
              <div className="bg-slate-900 text-emerald-300 rounded-lg p-3 text-xs font-mono overflow-auto max-h-72 border border-slate-800">
                {hasAfter ? (
                  <pre className="whitespace-pre-wrap word-break">
                    {JSON.stringify(after, null, 2)}
                  </pre>
                ) : (
                  <span className="text-slate-500 italic">Entity deleted / archived</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => setIsOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
