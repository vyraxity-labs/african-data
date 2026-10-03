'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma, ResourceStatus } from '@repo/database';

export interface ActionState {
  error?: string;
  success?: boolean;
}

/**
 * Verify administrator authentication before mutating records.
 */
async function assertAdmin() {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized: Administrator authentication required.');
  }
  return session.user;
}

/**
 * Server Action: Create a new resource manually.
 * Requirement: Must strictly default to DRAFT status.
 */
export async function createResource(
  _prevState: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  let createdId: string | null = null;

  try {
    await assertAdmin();

    const name = (formData.get('name') as string)?.trim();
    if (!name) {
      return { error: 'Resource name is required.' };
    }

    const description = (formData.get('description') as string)?.trim() || null;
    const notes = (formData.get('notes') as string)?.trim() || null;
    const institutionId = (formData.get('institutionId') as string)?.trim() || null;
    const industry = (formData.get('industry') as string)?.trim() || null;
    const category = (formData.get('category') as string)?.trim() || null;
    const countryCoverage = (formData.get('countryCoverage') as string)?.trim() || null;
    const sourceType = (formData.get('sourceType') as string)?.trim() || null;
    const accessType = (formData.get('accessType') as string)?.trim() || null;
    const language = (formData.get('language') as string)?.trim() || null;
    const dataGranularity = (formData.get('dataGranularity') as string)?.trim() || null;
    const updateFrequency = (formData.get('updateFrequency') as string)?.trim() || null;
    const priority = (formData.get('priority') as string)?.trim() || null;
    const apiAvailable = formData.get('apiAvailable') === 'true' || formData.get('apiAvailable') === 'on';

    // Verify institution exists if provided
    if (institutionId) {
      const institution = await prisma.institution.findUnique({
        where: { id: institutionId },
      });
      if (!institution) {
        return { error: 'Selected institution does not exist.' };
      }
    }

    const resource = await prisma.resource.create({
      data: {
        name,
        description,
        notes,
        institutionId,
        industry,
        category,
        countryCoverage,
        sourceType,
        accessType,
        language,
        dataGranularity,
        updateFrequency,
        priority,
        apiAvailable,
        // Mandatory requirement: Manual creation MUST default to DRAFT
        status: ResourceStatus.DRAFT,
      },
    });

    createdId = resource.id;
  } catch (error: any) {
    return { error: error?.message || 'Failed to create resource.' };
  }

  revalidatePath('/admin/resources');
  revalidatePath('/admin');
  redirect(`/admin/resources?created=${encodeURIComponent(createdId)}`);
}

/**
 * Server Action: Update existing resource metadata and attributes.
 */
export async function updateResource(
  id: string,
  _prevState: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  try {
    await assertAdmin();

    const name = (formData.get('name') as string)?.trim();
    if (!name) {
      return { error: 'Resource name is required.' };
    }

    const description = (formData.get('description') as string)?.trim() || null;
    const notes = (formData.get('notes') as string)?.trim() || null;
    const institutionId = (formData.get('institutionId') as string)?.trim() || null;
    const industry = (formData.get('industry') as string)?.trim() || null;
    const category = (formData.get('category') as string)?.trim() || null;
    const countryCoverage = (formData.get('countryCoverage') as string)?.trim() || null;
    const sourceType = (formData.get('sourceType') as string)?.trim() || null;
    const accessType = (formData.get('accessType') as string)?.trim() || null;
    const language = (formData.get('language') as string)?.trim() || null;
    const dataGranularity = (formData.get('dataGranularity') as string)?.trim() || null;
    const updateFrequency = (formData.get('updateFrequency') as string)?.trim() || null;
    const priority = (formData.get('priority') as string)?.trim() || null;
    const apiAvailable = formData.get('apiAvailable') === 'true' || formData.get('apiAvailable') === 'on';

    if (institutionId) {
      const institution = await prisma.institution.findUnique({
        where: { id: institutionId },
      });
      if (!institution) {
        return { error: 'Selected institution does not exist.' };
      }
    }

    await prisma.resource.update({
      where: { id },
      data: {
        name,
        description,
        notes,
        institutionId,
        industry,
        category,
        countryCoverage,
        sourceType,
        accessType,
        language,
        dataGranularity,
        updateFrequency,
        priority,
        apiAvailable,
      },
    });
  } catch (error: any) {
    return { error: error?.message || 'Failed to update resource.' };
  }

  revalidatePath('/admin/resources');
  revalidatePath(`/admin/resources/${id}/edit`);
  revalidatePath('/admin');
  redirect(`/admin/resources?updated=${encodeURIComponent(id)}`);
}

/**
 * Server Action: Update resource lifecycle status (DRAFT <-> ACTIVE <-> ARCHIVED)
 */
export async function updateResourceStatus(
  id: string,
  newStatus: ResourceStatus
): Promise<ActionState> {
  try {
    await assertAdmin();

    if (!Object.values(ResourceStatus).includes(newStatus)) {
      return { error: 'Invalid lifecycle status specified.' };
    }

    await prisma.resource.update({
      where: { id },
      data: { status: newStatus },
    });

    revalidatePath('/admin/resources');
    revalidatePath(`/admin/resources/${id}/edit`);
    revalidatePath('/admin');
    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to update resource status.' };
  }
}

/**
 * Server Action: Delete a resource
 */
export async function deleteResource(id: string): Promise<ActionState> {
  try {
    await assertAdmin();

    // Delete in transaction cascade
    await prisma.$transaction(async (tx) => {
      // Find resource links
      const links = await tx.resourceLink.findMany({
        where: { resourceId: id },
        select: { id: true },
      });
      const linkIds = links.map((l) => l.id);

      if (linkIds.length > 0) {
        // Delete link checks
        await tx.linkCheck.deleteMany({
          where: { linkId: { in: linkIds } },
        });
        // Delete links
        await tx.resourceLink.deleteMany({
          where: { id: { in: linkIds } },
        });
      }

      // Delete the resource
      await tx.resource.delete({
        where: { id },
      });
    });

    revalidatePath('/admin/resources');
    revalidatePath('/admin');
    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to delete resource.' };
  }
}
