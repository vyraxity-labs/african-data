'use client';

import * as React from 'react';
import { useTransition } from 'react';
import { Button } from '@repo/ui';
import { deleteInstitution } from './actions';

interface InstitutionRowActionsProps {
  institutionId: string;
  institutionName: string;
  associatedResourcesCount: number;
}

export function InstitutionRowActions({
  institutionId,
  institutionName,
  associatedResourcesCount,
}: InstitutionRowActionsProps) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    const message =
      associatedResourcesCount > 0
        ? `"${institutionName}" is linked to ${associatedResourcesCount} dataset(s). Deleting it will detach it from these datasets (the datasets themselves will be preserved). Are you sure?`
        : `Are you sure you want to delete "${institutionName}"?`;

    if (window.confirm(message)) {
      startTransition(async () => {
        const res = await deleteInstitution(institutionId);
        if (res?.error) {
          alert(res.error);
        }
      });
    }
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={isPending}
      onClick={handleDelete}
      className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
      title="Delete institution"
    >
      {isPending ? 'Deleting...' : 'Delete'}
    </Button>
  );
}
