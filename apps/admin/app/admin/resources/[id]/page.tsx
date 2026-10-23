import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Route handler for /admin/resources/[id].
 * Redirects administrators to the dedicated dataset management & edit console.
 */
export default async function AdminResourceDetailPage(props: PageProps) {
  const { id } = await props.params;
  redirect(`/admin/resources/${id}/edit`);
}
