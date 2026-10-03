'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@repo/database';
import { normalizeUrl, InvalidUrlError } from '@repo/validation';

export interface InstitutionActionState {
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
 * Server Action: Create a new institution.
 */
export async function createInstitution(
  _prevState: InstitutionActionState | undefined,
  formData: FormData
): Promise<InstitutionActionState> {
  let createdId: string | null = null;

  try {
    await assertAdmin();

    const name = (formData.get('name') as string)?.trim();
    if (!name) {
      return { error: 'Institution name is required.' };
    }

    const description = (formData.get('description') as string)?.trim() || null;
    const type = (formData.get('type') as string)?.trim() || null;
    const country = (formData.get('country') as string)?.trim() || null;
    const rawWebsite = (formData.get('website') as string)?.trim() || null;

    let website: string | null = null;
    if (rawWebsite) {
      try {
        website = normalizeUrl(rawWebsite);
      } catch (err) {
        if (err instanceof InvalidUrlError) {
          return { error: `Invalid website URL: ${err.message}` };
        }
        return { error: 'Invalid website URL format.' };
      }
    }

    // Check duplicate institution name
    const existing = await prisma.institution.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });

    if (existing) {
      return { error: `An institution named "${name}" already exists.` };
    }

    const institution = await prisma.institution.create({
      data: {
        name,
        description,
        type,
        country,
        website,
      },
    });

    createdId = institution.id;
  } catch (error: any) {
    return { error: error?.message || 'Failed to create institution.' };
  }

  revalidatePath('/admin/institutions');
  revalidatePath('/admin');
  redirect(`/admin/institutions?created=${encodeURIComponent(createdId)}`);
}

/**
 * Server Action: Update existing institution attributes.
 */
export async function updateInstitution(
  id: string,
  _prevState: InstitutionActionState | undefined,
  formData: FormData
): Promise<InstitutionActionState> {
  try {
    await assertAdmin();

    const name = (formData.get('name') as string)?.trim();
    if (!name) {
      return { error: 'Institution name is required.' };
    }

    const description = (formData.get('description') as string)?.trim() || null;
    const type = (formData.get('type') as string)?.trim() || null;
    const country = (formData.get('country') as string)?.trim() || null;
    const rawWebsite = (formData.get('website') as string)?.trim() || null;

    let website: string | null = null;
    if (rawWebsite) {
      try {
        website = normalizeUrl(rawWebsite);
      } catch (err) {
        if (err instanceof InvalidUrlError) {
          return { error: `Invalid website URL: ${err.message}` };
        }
        return { error: 'Invalid website URL format.' };
      }
    }

    // Verify not colliding with another institution's name
    const duplicate = await prisma.institution.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        id: { not: id },
      },
    });

    if (duplicate) {
      return { error: `Another institution named "${name}" already exists.` };
    }

    await prisma.institution.update({
      where: { id },
      data: {
        name,
        description,
        type,
        country,
        website,
      },
    });
  } catch (error: any) {
    return { error: error?.message || 'Failed to update institution.' };
  }

  revalidatePath('/admin/institutions');
  revalidatePath(`/admin/institutions/${id}/edit`);
  revalidatePath(`/institutions/${id}`);
  revalidatePath('/admin');
  redirect(`/admin/institutions?updated=${encodeURIComponent(id)}`);
}

/**
 * Server Action: Delete an institution.
 * Safely unlinks associated resources by nullifying institutionId so datasets are preserved.
 */
export async function deleteInstitution(id: string): Promise<InstitutionActionState> {
  try {
    await assertAdmin();

    await prisma.$transaction(async (tx) => {
      // Unlink resources to preserve catalogue records
      await tx.resource.updateMany({
        where: { institutionId: id },
        data: { institutionId: null },
      });

      // Delete the institution
      await tx.institution.delete({
        where: { id },
      });
    });

    revalidatePath('/admin/institutions');
    revalidatePath('/admin');
    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to delete institution.' };
  }
}
