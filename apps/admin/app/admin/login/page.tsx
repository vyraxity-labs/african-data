import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { LoginForm } from './login-form'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@repo/ui'

export const metadata: Metadata = {
  title: 'Administrator Login | African Data Directory',
  description: 'Sign in to access platform administration and data management.',
}

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string }>
}

export default async function AdminLoginPage(props: LoginPageProps) {
  const session = await auth()
  const searchParams = await props.searchParams
  const callbackUrl = searchParams.callbackUrl || '/admin'

  if (session?.user) {
    redirect(callbackUrl)
  }

  return (
    <div className='flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8'>
      <div className='w-full max-w-md'>
        <div className='text-center mb-8'>
          <div className='mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-3xl text-white shadow-md'>
            🛡️
          </div>
          <h1 className='mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl'>
            Admin Authentication
          </h1>
          <p className='mt-1 text-sm text-slate-500'>
            Sign in with authorized credentials to access the management
            console.
          </p>
        </div>

        <Card className='border-slate-200 shadow-sm'>
          <CardHeader>
            <CardTitle className='text-base'>Administrative Access</CardTitle>
            <CardDescription>
              Protected administrative functionality and catalogue operations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm callbackUrl={callbackUrl} />
          </CardContent>
        </Card>

        <p className='mt-6 text-center text-xs text-slate-400'>
          Unauthorized access attempts are monitored and logged.
        </p>
      </div>
    </div>
  )
}
