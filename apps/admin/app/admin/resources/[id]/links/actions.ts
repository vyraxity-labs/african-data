'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { prisma, LinkType } from '@repo/database';
import { normalizeUrl, InvalidUrlError } from '@repo/validation';
import { remediateLinkIndividual } from '@repo/link-checker';

export interface LinkActionState {
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
 * Server Action: Add a new link to an existing resource.
 */
export async function addResourceLink(
  resourceId: string,
  _prevState: LinkActionState | undefined,
  formData: FormData
): Promise<LinkActionState> {
  try {
    await assertAdmin();

    const rawUrl = (formData.get('url') as string)?.trim();
    if (!rawUrl) {
      return { error: 'URL is required.' };
    }

    let url: string;
    try {
      url = normalizeUrl(rawUrl);
    } catch (err) {
      if (err instanceof InvalidUrlError) {
        return { error: `Invalid URL: ${err.message}` };
      }
      return { error: 'Invalid URL format.' };
    }

    const linkTypeStr = (formData.get('linkType') as string)?.toUpperCase();
    if (!linkTypeStr || !Object.values(LinkType).includes(linkTypeStr as LinkType)) {
      return { error: 'Invalid link type selected.' };
    }
    const linkType = linkTypeStr as LinkType;

    // Check duplicate URL on the same resource
    const existing = await prisma.resourceLink.findFirst({
      where: {
        resourceId,
        url,
      },
    });

    if (existing) {
      return { error: 'This URL is already attached to this dataset.' };
    }

    await prisma.resourceLink.create({
      data: {
        resourceId,
        url,
        linkType,
      },
    });

    revalidatePath(`/admin/resources/${resourceId}/edit`);
    revalidatePath(`/admin/resources/${resourceId}/links`);
    revalidatePath(`/admin/resources`);
    revalidatePath(`/resources/${resourceId}`);
    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to add link.' };
  }
}

/**
 * Server Action: Update an existing resource link URL or type.
 */
export async function updateResourceLink(
  linkId: string,
  resourceId: string,
  _prevState: LinkActionState | undefined,
  formData: FormData
): Promise<LinkActionState> {
  try {
    const user = await assertAdmin();

    const rawUrl = (formData.get('url') as string)?.trim();
    if (!rawUrl) {
      return { error: 'URL is required.' };
    }

    const currentLink = await prisma.resourceLink.findUnique({
      where: { id: linkId },
    });
    if (!currentLink) {
      return { error: 'Link endpoint not found.' };
    }

    const linkTypeStr = (formData.get('linkType') as string)?.toUpperCase();
    if (!linkTypeStr || !Object.values(LinkType).includes(linkTypeStr as LinkType)) {
      return { error: 'Invalid link type selected.' };
    }
    const linkType = linkTypeStr as LinkType;

    // If URL is being replaced, route through individual remediation engine (Normalize -> Validate -> Check -> Save -> Audit)
    if (rawUrl !== currentLink.url) {
      await remediateLinkIndividual(prisma, {
        linkId,
        newUrl: rawUrl,
        linkType,
        reason: (formData.get('reason') as string) || 'MANUAL_EDIT',
        adminIdentifier: user.email || 'admin',
      });
    } else {
      // Only linkType changed
      await prisma.resourceLink.update({
        where: { id: linkId },
        data: { linkType },
      });
    }

    revalidatePath(`/admin/resources/${resourceId}/edit`);
    revalidatePath(`/admin/resources/${resourceId}/links`);
    revalidatePath(`/admin/link-health`);
    revalidatePath(`/resources/${resourceId}`);
    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to update link.' };
  }
}

/**
 * Server Action: Delete a resource link and its historical check records.
 */
export async function deleteResourceLink(
  linkId: string,
  resourceId: string
): Promise<LinkActionState> {
  try {
    await assertAdmin();

    await prisma.$transaction(async (tx) => {
      await tx.linkCheck.deleteMany({
        where: { linkId },
      });
      await tx.resourceLink.delete({
        where: { id: linkId },
      });
    });

    revalidatePath(`/admin/resources/${resourceId}/edit`);
    revalidatePath(`/admin/resources/${resourceId}/links`);
    revalidatePath(`/admin/resources`);
    revalidatePath(`/resources/${resourceId}`);
    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to delete link.' };
  }
}
