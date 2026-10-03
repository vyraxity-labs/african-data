import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma, ResourceStatus } from '@repo/database';
import { ResourceForm } from '../../resource-form';
import { updateResource } from '../../actions';
import { ResourceStatusActions } from '../../resource-status-actions';
import { Badge, Card, CardHeader, CardTitle, CardContent } from '@repo/ui';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditResourcePage(props: PageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect('/admin/login?callbackUrl=/admin/resources');
  }

  const { id } = await props.params;

  const [resource, institutions] = await Promise.all([
    prisma.resource.findUnique({
      where: { id },
      include: {
        institution: { select: { id: true, name: true } },
        links: {
          include: {
            checks: {
              take: 1,
              orderBy: { checkedAt: 'desc' },
            },
          },
        },
      },
    }),
    prisma.institution.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  if (!resource) {
    notFound();
  }

  const boundUpdateAction = updateResource.bind(null, id);

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Header */}
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
            <span className="text-sm font-bold text-slate-900">Edit Dataset</span>
          </div>

          <div className="flex items-center gap-3">
            <ResourceStatusActions
              resourceId={resource.id}
              resourceName={resource.name}
              currentStatus={resource.status}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {resource.name}
              </h1>
              {resource.status === ResourceStatus.ACTIVE && (
                <Badge variant="success">Active (Public)</Badge>
              )}
              {resource.status === ResourceStatus.DRAFT && (
                <Badge variant="warning">Draft (Internal)</Badge>
              )}
              {resource.status === ResourceStatus.ARCHIVED && (
                <Badge variant="default">Archived</Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500 font-mono">
              ID: {resource.id} &bull; Created {new Date(resource.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Main Edit Form */}
          <div className="lg:col-span-2">
            <ResourceForm
              mode="edit"
              initialData={{
                id: resource.id,
                name: resource.name,
                description: resource.description,
                notes: resource.notes,
                institutionId: resource.institutionId,
                industry: resource.industry,
                category: resource.category,
                countryCoverage: resource.countryCoverage,
                sourceType: resource.sourceType,
                accessType: resource.accessType,
                language: resource.language,
                dataGranularity: resource.dataGranularity,
                updateFrequency: resource.updateFrequency,
                priority: resource.priority,
                apiAvailable: resource.apiAvailable,
                status: resource.status,
              }}
              institutions={institutions}
              action={boundUpdateAction}
            />
          </div>

          {/* Sidebar: Associated Endpoints & Summary */}
          <div className="space-y-6">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base">Linked Endpoints ({resource.links.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {resource.links.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">
                    No endpoint URLs currently attached to this dataset.
                  </p>
                ) : (
                  resource.links.map((link) => (
                    <div
                      key={link.id}
                      className="rounded-lg border border-slate-200 p-3 bg-slate-50 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">{link.linkType}</span>
                        <Badge
                          variant={
                            link.status === 'HEALTHY'
                              ? 'success'
                              : link.status === 'BROKEN'
                                ? 'danger'
                                : 'default'
                          }
                          size="sm"
                        >
                          {link.status}
                        </Badge>
                      </div>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-xs text-emerald-600 hover:underline truncate"
                      >
                        {link.url}
                      </a>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base">Lifecycle Governance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-slate-600 leading-relaxed">
                <p>
                  <strong>DRAFT:</strong> Editable by administrators. Hidden from the public catalogue and API queries.
                </p>
                <p>
                  <strong>ACTIVE:</strong> Publicly queryable in the African data index and featured in search.
                </p>
                <p>
                  <strong>ARCHIVED:</strong> Preserved in the database for historical audit, but removed from live public listings.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
