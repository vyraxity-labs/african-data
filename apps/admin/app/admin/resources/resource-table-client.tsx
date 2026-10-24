'use client';

import * as React from 'react';
import { useTransition } from 'react';
import Link from 'next/link';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  Button,
} from '@repo/ui';
import { ResourceStatusActions } from './resource-status-actions';
import {
  batchUpdateResourceStatus,
  publishAllDraftResources,
} from './actions';

type ResourceStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

interface ResourceItem {
  id: string;
  name: string;
  description: string | null;
  status: ResourceStatus;
  industry: string | null;
  category: string | null;
  countryCoverage: string | null;
  institution: {
    id: string;
    name: string;
  } | null;
  _count: {
    links: number;
  };
}

interface ResourceTableClientProps {
  resources: ResourceItem[];
  currentStatusFilter: string;
  draftCount: number;
}

export function ResourceTableClient({
  resources,
  currentStatusFilter,
  draftCount,
}: ResourceTableClientProps) {
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const allIds = React.useMemo(() => resources.map((r) => r.id), [resources]);
  const isAllSelected = allIds.length > 0 && allIds.every((id) => selectedIds.includes(id));
  const hasSelection = selectedIds.length > 0;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(allIds);
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const handleBatchStatus = (newStatus: ResourceStatus) => {
    if (selectedIds.length === 0) return;
    const actionLabel =
      newStatus === 'ACTIVE'
        ? 'publish'
        : newStatus === 'ARCHIVED'
        ? 'archive'
        : 'move to draft';

    if (
      !window.confirm(
        `Are you sure you want to ${actionLabel} ${selectedIds.length} selected dataset(s)?`
      )
    ) {
      return;
    }

    startTransition(async () => {
      const res = await batchUpdateResourceStatus(selectedIds, newStatus);
      if (res?.error) {
        alert(res.error);
      } else {
        setSelectedIds([]);
      }
    });
  };

  const handlePublishAllDrafts = () => {
    if (draftCount === 0) return;
    if (
      !window.confirm(
        `Are you sure you want to publish ALL ${draftCount} datasets currently in DRAFT status? This will make them immediately visible to the public.`
      )
    ) {
      return;
    }

    startTransition(async () => {
      const res = await publishAllDraftResources();
      if (res?.error) {
        alert(res.error);
      } else {
        setSelectedIds([]);
      }
    });
  };

  const getStatusBadge = (status: ResourceStatus) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="success">Active</Badge>;
      case 'DRAFT':
        return <Badge variant="warning">Draft</Badge>;
      case 'ARCHIVED':
        return <Badge variant="default">Archived</Badge>;
    }
  };

  return (
    <div className="space-y-3">
      {/* Batch Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-100 p-3 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2">
          {hasSelection ? (
            <span className="text-xs font-semibold text-slate-800 bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-md border border-emerald-300">
              {selectedIds.length} selected
            </span>
          ) : (
            <span className="text-xs text-slate-500">
              Select rows to perform batch actions:
            </span>
          )}

          <Button
            size="sm"
            variant="outline"
            disabled={!hasSelection || isPending}
            onClick={() => handleBatchStatus('ACTIVE')}
            className="text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-300"
            title="Publish all selected datasets"
          >
            {isPending ? 'Processing...' : 'Publish Selected'}
          </Button>

          <Button
            size="sm"
            variant="outline"
            disabled={!hasSelection || isPending}
            onClick={() => handleBatchStatus('ARCHIVED')}
            className="text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50 border-amber-300"
            title="Archive all selected datasets"
          >
            Archive Selected
          </Button>

          {hasSelection && (
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => setSelectedIds([])}
              className="text-xs text-slate-600 hover:bg-slate-200 border-slate-300"
            >
              Clear
            </Button>
          )}
        </div>

        {/* Global Publish All Drafts Shortcut */}
        {draftCount > 0 && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={isPending}
              onClick={handlePublishAllDrafts}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
              title="Publish every draft in the catalogue without needing to select them manually"
            >
              🚀 Publish All {draftCount} Drafts
            </Button>
          </div>
        )}
      </div>

      {/* Main Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <input
                type="checkbox"
                aria-label="Select all resources on this page"
                checked={isAllSelected}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
            </TableHead>
            <TableHead className="w-[32%]">Dataset / Resource</TableHead>
            <TableHead>Custodian</TableHead>
            <TableHead>Industry / Category</TableHead>
            <TableHead>Coverage</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Links</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {resources.map((res) => {
            const isSelected = selectedIds.includes(res.id);
            return (
              <TableRow
                key={res.id}
                className={isSelected ? 'bg-emerald-50/50' : undefined}
              >
                <TableCell>
                  <input
                    type="checkbox"
                    aria-label={`Select ${res.name}`}
                    checked={isSelected}
                    onChange={(e) => handleSelectOne(res.id, e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </TableCell>

                <TableCell>
                  <div className="font-semibold text-slate-900 hover:text-emerald-600">
                    <Link href={`/admin/resources/${res.id}/edit`}>{res.name}</Link>
                  </div>
                  {res.description && (
                    <p className="line-clamp-1 text-xs text-slate-500 mt-0.5">
                      {res.description}
                    </p>
                  )}
                </TableCell>

                <TableCell>
                  {res.institution ? (
                    <span className="text-xs font-medium text-slate-700">
                      {res.institution.name}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 italic">None</span>
                  )}
                </TableCell>

                <TableCell>
                  <div className="text-xs text-slate-800">
                    {res.industry || '—'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {res.category || '—'}
                  </div>
                </TableCell>

                <TableCell>
                  <span className="text-xs text-slate-600">
                    {res.countryCoverage || '—'}
                  </span>
                </TableCell>

                <TableCell>{getStatusBadge(res.status)}</TableCell>

                <TableCell>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {res._count.links} endpoints
                  </span>
                </TableCell>

                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link href={`/admin/resources/${res.id}/edit`}>
                      <Button size="sm" variant="outline" className="text-xs">
                        Edit
                      </Button>
                    </Link>
                    <ResourceStatusActions
                      resourceId={res.id}
                      resourceName={res.name}
                      currentStatus={res.status}
                    />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
