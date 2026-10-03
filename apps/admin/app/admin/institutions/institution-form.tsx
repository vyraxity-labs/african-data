'use client';

import * as React from 'react';
import { useActionState } from 'react';
import Link from 'next/link';
import { Input, Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@repo/ui';
import { InstitutionActionState } from './actions';

interface InstitutionFormData {
  id?: string;
  name?: string;
  website?: string | null;
  description?: string | null;
  type?: string | null;
  country?: string | null;
}

interface InstitutionFormProps {
  initialData?: InstitutionFormData;
  action: (_state: InstitutionActionState | undefined, _formData: FormData) => Promise<InstitutionActionState>;
  mode: 'create' | 'edit';
}

export function InstitutionForm({
  initialData,
  action,
  mode,
}: InstitutionFormProps) {
  const [state, formAction, isPending] = useActionState(action, undefined);

  return (
    <Card className="max-w-3xl border-slate-200">
      <CardHeader>
        <CardTitle>
          {mode === 'create' ? 'Register New Custodian Institution' : `Edit: ${initialData?.name}`}
        </CardTitle>
        <CardDescription>
          {mode === 'create'
            ? 'Add a data-publishing body, national statistical bureau, central bank, or research institute.'
            : 'Update institution profile, website link, and classification.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state?.error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 border border-red-200 text-sm text-red-700">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Input
                label="Institution Name"
                name="name"
                required
                defaultValue={initialData?.name || ''}
                placeholder="e.g. National Bureau of Statistics (NBS) Nigeria"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Institution Type / Classification"
                name="type"
                defaultValue={initialData?.type || ''}
                placeholder="e.g. Statistical Office, Central Bank, NGO"
              />

              <Input
                label="Primary Country / Jurisdiction"
                name="country"
                defaultValue={initialData?.country || ''}
                placeholder="e.g. Nigeria, South Africa, Regional"
              />
            </div>

            <div>
              <Input
                label="Official Website URL"
                name="website"
                type="url"
                defaultValue={initialData?.website || ''}
                placeholder="https://example.gov"
                helperText="Must be a valid HTTP/HTTPS address. Normalized automatically upon submission."
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-1.5">
                Description / Mission Scope
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                defaultValue={initialData?.description || ''}
                placeholder="Summary of institutional mandate, data dissemination policies, and jurisdiction..."
                className="block w-full rounded-lg border border-slate-300 py-2 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6 flex items-center justify-end gap-3">
            <Link href="/admin/institutions">
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
                  ? 'Register Institution'
                  : 'Save Changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
