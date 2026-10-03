import * as React from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export default async function ImportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/admin/login?callbackUrl=/import');
  }

  return <>{children}</>;
}
