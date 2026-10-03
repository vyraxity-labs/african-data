'use client';

import * as React from 'react';
import { useActionState, useTransition } from 'react';

export type LinkType =
  | 'DATA'
  | 'WEBSITE'
  | 'API'
  | 'DOWNLOAD'
  | 'DOCUMENTATION'
  | 'OTHER';

import { Input, Select, Button, Badge } from '@repo/ui';
import { addResourceLink, updateResourceLink, deleteResourceLink, LinkActionState } from './actions';

interface LinkItem {
  id: string;
  url: string;
  linkType: LinkType;
  status: string;
  httpStatus?: number | null;
  lastCheckedAt?: Date | string | null;
}

interface ResourceLinksManagerProps {
  resourceId: string;
  links: LinkItem[];
}

export function ResourceLinksManager({ resourceId, links }: ResourceLinksManagerProps) {
  const [editingLinkId, setEditingLinkId] = React.useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  // Add Link form action
  const addActionWithId = addResourceLink.bind(null, resourceId);
  const [addState, formActionAdd, isAddPending] = useActionState<LinkActionState | undefined, FormData>(
    addActionWithId,
    undefined
  );

  const handleDelete = (linkId: string, url: string) => {
    if (window.confirm(`Are you sure you want to delete this endpoint link?\n${url}`)) {
      startDeleteTransition(async () => {
        const res = await deleteResourceLink(linkId, resourceId);
        if (res?.error) {
          alert(res.error);
        }
      });
    }
  };

  const getHealthBadge = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return <Badge variant="success">HEALTHY</Badge>;
      case 'REDIRECTED':
        return <Badge variant="info">REDIRECTED</Badge>;
      case 'BROKEN':
      case 'TIMEOUT':
      case 'SERVER_ERROR':
        return <Badge variant="danger">{status}</Badge>;
      case 'RATE_LIMITED':
      case 'BLOCKED':
        return <Badge variant="warning">{status}</Badge>;
      default:
        return <Badge variant="default">UNKNOWN</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Existing Links List */}
      <div className="space-y-3">
        {links.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center">
            <p className="text-xs text-slate-500">
              No endpoint URLs currently attached to this dataset. Add one below.
            </p>
          </div>
        ) : (
          links.map((link) => (
            <div
              key={link.id}
              className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-2 transition-colors hover:border-slate-300"
            >
              {editingLinkId === link.id ? (
                <EditLinkForm
                  link={link}
                  resourceId={resourceId}
                  onCancel={() => setEditingLinkId(null)}
                />
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {link.linkType}
                      </span>
                      {getHealthBadge(link.status)}
                      {link.httpStatus && (
                        <span className="text-[11px] font-mono text-slate-500">
                          HTTP {link.httpStatus}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingLinkId(link.id)}
                        className="text-xs text-slate-700 hover:text-slate-900"
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isDeleting}
                        onClick={() => handleDelete(link.id, link.url)}
                        className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>

                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-xs font-mono text-emerald-600 hover:underline break-all"
                  >
                    {link.url}
                  </a>

                  {link.lastCheckedAt && (
                    <div className="text-[11px] text-slate-400">
                      Last verified:{' '}
                      {new Date(link.lastCheckedAt).toLocaleDateString()}
                    </div>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add New Link Card */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
          + Attach New Endpoint URL
        </h4>

        {addState?.error && (
          <div className="rounded-md bg-red-50 p-3 border border-red-200 text-xs text-red-700">
            {addState.error}
          </div>
        )}

        <form action={formActionAdd} className="space-y-3">
          <div>
            <Input
              name="url"
              type="url"
              required
              placeholder="https://example.org/api/v1/data"
              helperText="Endpoint URL will be normalized automatically (protocol, casing, trailing slash)."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Select name="linkType" defaultValue="DATA">
                <option value="DATA">DATA (Direct Dataset)</option>
                <option value="WEBSITE">WEBSITE (Landing Page)</option>
                <option value="API">API (REST / GraphQL)</option>
                <option value="DOWNLOAD">DOWNLOAD (CSV / XLS / ZIP)</option>
                <option value="DOCUMENTATION">DOCUMENTATION</option>
                <option value="OTHER">OTHER</option>
              </Select>
            </div>

            <div className="flex items-center justify-end">
              <Button
                type="submit"
                disabled={isAddPending}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              >
                {isAddPending ? 'Adding...' : 'Attach Endpoint'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditLinkForm({
  link,
  resourceId,
  onCancel,
}: {
  link: LinkItem;
  resourceId: string;
  onCancel: () => void;
}) {
  const updateActionWithIds = updateResourceLink.bind(null, link.id, resourceId);
  const [updateState, formActionUpdate, isUpdatePending] = useActionState<
    LinkActionState | undefined,
    FormData
  >(async (prevState, formData) => {
    const res = await updateActionWithIds(prevState, formData);
    if (res?.success) {
      onCancel();
    }
    return res;
  }, undefined);

  return (
    <form action={formActionUpdate} className="space-y-3 bg-white p-3 rounded border border-emerald-300">
      <div className="text-xs font-bold text-slate-800">Editing Endpoint</div>

      {updateState?.error && (
        <div className="rounded bg-red-50 p-2 border border-red-200 text-xs text-red-700">
          {updateState.error}
        </div>
      )}

      <div>
        <Input
          name="url"
          type="url"
          required
          defaultValue={link.url}
          placeholder="https://example.org/data"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Select name="linkType" defaultValue={link.linkType}>
          <option value="DATA">DATA (Direct Dataset)</option>
          <option value="WEBSITE">WEBSITE (Landing Page)</option>
          <option value="API">API (REST / GraphQL)</option>
          <option value="DOWNLOAD">DOWNLOAD (CSV / XLS / ZIP)</option>
          <option value="DOCUMENTATION">DOCUMENTATION</option>
          <option value="OTHER">OTHER</option>
        </Select>

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isUpdatePending}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isUpdatePending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
          >
            {isUpdatePending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </form>
  );
}
