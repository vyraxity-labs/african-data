'use client';

import * as React from 'react';
import { useTransition } from 'react';
import { Button } from '@repo/ui';
import { updateResourceStatus, deleteResource } from './actions';

type ResourceStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

interface ResourceStatusActionsProps {
  resourceId: string;
  resourceName: string;
  currentStatus: ResourceStatus | string;
}

export function ResourceStatusActions({
  resourceId,
  resourceName,
  currentStatus,
}: ResourceStatusActionsProps) {
  const [isPending, startTransition] = useTransition();

  const handleStatusChange = (newStatus: ResourceStatus) => {
    startTransition(async () => {
      const res = await updateResourceStatus(resourceId, newStatus);
      if (res?.error) {
        alert(res.error);
      }
    });
  };

  const handleDelete = () => {
    if (
      window.confirm(
        `Are you sure you want to permanently delete "${resourceName}"? This will remove all associated links and validation records.`
      )
    ) {
      startTransition(async () => {
        const res = await deleteResource(resourceId);
        if (res?.error) {
          alert(res.error);
        }
      });
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      {currentStatus === 'DRAFT' && (
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => handleStatusChange('ACTIVE')}
          className="text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-300"
          title="Publish resource to make it publicly visible in the catalogue"
        >
          {isPending ? 'Publishing...' : 'Publish'}
        </Button>
      )}

      {currentStatus === 'ACTIVE' && (
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => handleStatusChange('ARCHIVED')}
          className="text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50 border-amber-300"
          title="Archive resource to remove it from public search without deleting"
        >
          {isPending ? 'Archiving...' : 'Archive'}
        </Button>
      )}

      {currentStatus === 'ARCHIVED' && (
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => handleStatusChange('DRAFT')}
          className="text-xs text-slate-700 hover:text-slate-800 hover:bg-slate-100"
          title="Revert back to Draft for review"
        >
          {isPending ? 'Reverting...' : 'Revert to Draft'}
        </Button>
      )}

      <Button
        size="sm"
        variant="ghost"
        disabled={isPending}
        onClick={handleDelete}
        className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
        title="Permanently delete dataset"
      >
        Delete
      </Button>
    </div>
  );
}
