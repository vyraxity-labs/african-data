'use client';

import { useState, useTransition } from 'react';
import { Button } from '@repo/ui';
import { triggerManualBatchCheck, ManualCheckResult } from './actions';

export function ManualCheckButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ManualCheckResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRunCheck = () => {
    setErrorMessage(null);
    setResult(null);

    startTransition(async () => {
      try {
        const res = await triggerManualBatchCheck(25);
        setResult(res);
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to trigger link check');
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={handleRunCheck}
          className="bg-white hover:bg-slate-50 border-slate-300 text-slate-700 shadow-xs"
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
              Scanning Endpoints...
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span>⚡</span> Check Due Batch Now
            </span>
          )}
        </Button>
      </div>

      {result && (
        <span className="text-xs text-emerald-700 font-medium animate-fade-in">
          ✓ {result.message}
        </span>
      )}

      {errorMessage && (
        <span className="text-xs text-red-600 font-medium">
          ⚠ {errorMessage}
        </span>
      )}
    </div>
  );
}
