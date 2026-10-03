'use client';

import * as React from 'react';
import { useActionState } from 'react';
import Link from 'next/link';
import { Input, Select, Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@repo/ui';
import { ActionState } from './actions';

interface InstitutionOption {
  id: string;
  name: string;
}

interface ResourceFormData {
  id?: string;
  name?: string;
  description?: string | null;
  notes?: string | null;
  institutionId?: string | null;
  industry?: string | null;
  category?: string | null;
  countryCoverage?: string | null;
  sourceType?: string | null;
  accessType?: string | null;
  language?: string | null;
  dataGranularity?: string | null;
  updateFrequency?: string | null;
  priority?: string | null;
  apiAvailable?: boolean;
  status?: string;
}

interface ResourceFormProps {
  initialData?: ResourceFormData;
  institutions: InstitutionOption[];
  action: (_state: ActionState | undefined, _formData: FormData) => Promise<ActionState>;
  mode: 'create' | 'edit';
}

export function ResourceForm({
  initialData,
  institutions,
  action,
  mode,
}: ResourceFormProps) {
  const [state, formAction, isPending] = useActionState(action, undefined);

  return (
    <Card className="max-w-4xl border-slate-200">
      <CardHeader>
        <CardTitle>{mode === 'create' ? 'Create New Dataset Resource' : `Edit: ${initialData?.name}`}</CardTitle>
        <CardDescription>
          {mode === 'create'
            ? 'New datasets are saved in DRAFT mode by default until reviewed and activated.'
            : 'Update metadata attributes, coverage, categorization, or technical details.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state?.error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 border border-red-200 text-sm text-red-700">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-6">
          {/* Core Identification */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
              Core Identity
            </h3>

            <div>
              <Input
                label="Resource / Dataset Name"
                name="name"
                required
                defaultValue={initialData?.name || ''}
                placeholder="e.g. Central Bank of Kenya Exchange Rates Portal"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-1.5">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={initialData?.description || ''}
                placeholder="Provide a summary of data scope, indicators covered, and relevance..."
                className="block w-full rounded-lg border border-slate-300 py-2 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <Select
                label="Custodian Institution"
                name="institutionId"
                defaultValue={initialData?.institutionId || ''}
              >
                <option value="">-- No specific custodian institution --</option>
                {institutions.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Categorization & Domain */}
          <div className="border-t border-slate-200 pt-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
              Categorization & Coverage
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Industry / Domain"
                name="industry"
                defaultValue={initialData?.industry || ''}
                placeholder="e.g. Finance, Agriculture, Health"
              />
              <Input
                label="Category"
                name="category"
                defaultValue={initialData?.category || ''}
                placeholder="e.g. Macroeconomics, Demographics"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Country / Geographic Coverage"
                name="countryCoverage"
                defaultValue={initialData?.countryCoverage || ''}
                placeholder="e.g. Kenya, Regional, Africa-wide"
              />
              <Input
                label="Source Type"
                name="sourceType"
                defaultValue={initialData?.sourceType || ''}
                placeholder="e.g. Central Bank, Statistics Office"
              />
            </div>
          </div>

          {/* Technical & Access Characteristics */}
          <div className="border-t border-slate-200 pt-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
              Access & Technical Details
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Access Type"
                name="accessType"
                defaultValue={initialData?.accessType || ''}
                placeholder="e.g. Open Access, Subscription, Restricted"
              />
              <Input
                label="Language"
                name="language"
                defaultValue={initialData?.language || 'English'}
                placeholder="e.g. English, French, Portuguese"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Data Granularity"
                name="dataGranularity"
                defaultValue={initialData?.dataGranularity || ''}
                placeholder="e.g. National, Provincial, Microdata"
              />
              <Input
                label="Update Frequency"
                name="updateFrequency"
                defaultValue={initialData?.updateFrequency || ''}
                placeholder="e.g. Daily, Monthly, Annual"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Cataloguing Priority"
                name="priority"
                defaultValue={initialData?.priority || 'Medium'}
                placeholder="e.g. High, Medium, Low"
              />

              <div className="flex items-center pt-6">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    name="apiAvailable"
                    defaultChecked={initialData?.apiAvailable || false}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>REST / SOAP API Available</span>
                </label>
              </div>
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1.5">
                Internal Operational Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                defaultValue={initialData?.notes || ''}
                placeholder="Notes for platform maintainers or data curators..."
                className="block w-full rounded-lg border border-slate-300 py-2 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="border-t border-slate-200 pt-6 flex items-center justify-end gap-3">
            <Link href="/admin/resources">
              <Button type="button" variant="outline" disabled={isPending}>
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isPending
                ? 'Saving...'
                : mode === 'create'
                  ? 'Create Resource (as Draft)'
                  : 'Save Changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
