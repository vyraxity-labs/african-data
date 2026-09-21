import { Card } from '@repo/ui/card'
import { Button } from '@repo/ui/button'

export default function HomePage() {
  return (
    <main className='mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8'>
      <div className='mb-8'>
        <h1 className='text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl'>
          African Data Discovery Platform
        </h1>
        <p className='mt-2 text-lg text-gray-600'>
          Public Catalogue — Discover African data sources, indicators, and
          authoritative repositories.
        </p>
      </div>

      <div className='grid gap-6 sm:grid-cols-2'>
        <Card title='Featured Catalogs'>
          Discover verified economic, health, and climate datasets spanning all
          54 African nations.
        </Card>
        <Card title='Platform Mission'>
          Helping researchers, analysts, and developers find authoritative
          African data sources.
        </Card>
      </div>

      <div className='mt-8 flex gap-4'>
        <Button>Explore Catalogue</Button>
      </div>
    </main>
  )
}
