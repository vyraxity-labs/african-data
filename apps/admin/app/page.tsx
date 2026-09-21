import { Card } from '@repo/ui/card'
import { Button } from '@repo/ui/button'

export default function AdminHomePage() {
  return (
    <main className='mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8'>
      <div className='mb-8'>
        <h1 className='text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl'>
          Platform Administration
        </h1>
        <p className='mt-2 text-lg text-slate-600'>
          Manage data sources, monitor link health, and perform catalogue
          ingestion.
        </p>
      </div>

      <div className='grid gap-6 sm:grid-cols-2'>
        <Card title='Catalogue Operations'>
          Create, edit, archive resources, and validate batch CSV data imports.
        </Card>
        <Card title='Link Health Monitoring'>
          Review automated link checks, handle redirects, and initiate scheduled
          verification jobs.
        </Card>
      </div>

      <div className='mt-8 flex gap-4'>
        <Button>Launch Link Monitor</Button>
      </div>
    </main>
  )
}
