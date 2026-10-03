'use client'

import { useActionState } from 'react'
import { loginAdmin } from './actions'
import { Button, Input } from '@repo/ui'

interface LoginFormProps {
  callbackUrl?: string
}

export function LoginForm({ callbackUrl = '/admin' }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(loginAdmin, undefined)

  return (
    <form action={formAction} className='space-y-4'>
      <input type='hidden' name='callbackUrl' value={callbackUrl} />

      {state?.error && (
        <div className='rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800'>
          ⚠️ {state.error}
        </div>
      )}

      <div>
        <Input
          label='Administrator Email'
          type='email'
          name='email'
          required
          autoComplete='email'
          placeholder='admin@africandata.org'
          defaultValue='admin@africandata.org'
        />
      </div>

      <div>
        <Input
          label='Password'
          type='password'
          name='password'
          required
          autoComplete='current-password'
          placeholder='••••••••••••'
        />
      </div>

      <Button
        type='submit'
        disabled={isPending}
        className='w-full bg-emerald-600 hover:bg-emerald-700 mt-2'
      >
        {isPending ? 'Verifying Credentials...' : 'Sign In as Administrator'}
      </Button>
    </form>
  )
}
