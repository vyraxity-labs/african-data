import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@repo/database';
import { ResourceForm } from '../resource-form';
import { createResource } from '../actions';

export const dynamic = 'force-dynamic';

export default async function NewResourcePage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/admin/login?callbackUrl=/admin/resources/new');
  }

  // Fetch institutions for dropdown
  const institutions = await prisma.institution.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Top Navigation */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/resources"
              className="text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors"
            >
              &larr; Back to Datasets
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-bold text-slate-900">New Resource</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Register New Data Resource
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Create an entry manually. Datasets are initiated as <strong>DRAFT</strong> until reviewed and published.
          </p>
        </div>

        <ResourceForm
          mode="create"
          institutions={institutions}
          action={createResource}
        />
      </main>
    </div>
  );
}
