'use server';

import { signIn, signOut } from '@/auth';
import { AuthError } from 'next-auth';

export async function loginAdmin(
  _prevState: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  try {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const callbackUrl = (formData.get('callbackUrl') as string) || '/admin';

    await signIn('credentials', {
      email,
      password,
      redirectTo: callbackUrl,
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return { error: 'Invalid administrator email or password.' };
        default:
          return { error: 'Authentication error occurred. Please try again.' };
      }
    }
    // Next.js redirection throws an internal NEXT_REDIRECT error which must not be caught
    throw error;
  }
}

export async function logoutAdmin(): Promise<void> {
  await signOut({ redirectTo: '/admin/login' });
}
