'use client'

import * as React from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Button } from '@repo/ui'

export interface ResourceFiltersProps {
  industries: string[]
  categories: string[]
  accessTypes: string[]
  coverages: string[]
  sourceTypes: string[]
  languages: string[]
  granularities: string[]
  currentParams: {
    q?: string
    industry?: string
    category?: string
    coverage?: string
    sourceType?: string
    access?: string
    api?: string
    language?: string
    granularity?: string
    sort?: string
    direction?: string
    pageSize?: string
  }
  className?: string
}

export function ResourceFilters({
  industries,
  categories,
  accessTypes,
  coverages,
  sourceTypes,
  languages,
  granularities,
  currentParams,
  className = '',
}: ResourceFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentQ = currentParams.q || ''
  const [searchTerm, setSearchTerm] = React.useState(currentQ)
  const [prevQ, setPrevQ] = React.useState(currentQ)
  const [isAdvancedOpen, setIsAdvancedOpen] = React.useState(false)

  // Keep local search term synchronized if URL search parameter changes externally
  if (currentQ !== prevQ) {
    setPrevQ(currentQ)
    setSearchTerm(currentQ)
  }

  const updateFilters = (newParams: Record<string, string | undefined>) => {
    const params = new URLSearchParams(
      searchParams ? searchParams.toString() : '',
    )

    // Reset to page 1 whenever filters or search terms change
    params.delete('page')

    Object.entries(newParams).forEach(([key, value]) => {
      if (value === undefined || value === '') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })

    router.push(`${pathname}?${params.toString()}`)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateFilters({ q: searchTerm.trim() || undefined })
  }

  const handleResetFilters = () => {
    setSearchTerm('')
    router.push(pathname)
  }

  const hasAdvancedFilters = Boolean(
    currentParams.coverage ||
    currentParams.sourceType ||
    currentParams.language ||
    currentParams.granularity,
  )

  const hasActiveFilters = Boolean(
    currentParams.q ||
    currentParams.industry ||
    currentParams.category ||
    currentParams.coverage ||
    currentParams.sourceType ||
    currentParams.access ||
    currentParams.api ||
    currentParams.language ||
    currentParams.granularity ||
    (currentParams.sort && currentParams.sort !== 'name'),
  )

  return (
    <div
      className={`space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto overscroll-contain scrollbar-thin [scrollbar-color:#cbd5e1_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400 [&::-webkit-scrollbar-track]:bg-transparent ${className}`}
    >
      {/* Search Input Bar */}
      <form onSubmit={handleSearchSubmit} className='flex gap-2'>
        <div className='relative flex-1'>
          <div className='pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400'>
            <svg
              className='h-4 w-4'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
              />
            </svg>
          </div>
          <input
            type='text'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder='Search keyword, indicator, or custodian...'
            className='w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors'
          />
          {searchTerm && (
            <button
              type='button'
              onClick={() => {
                setSearchTerm('')
                updateFilters({ q: undefined })
              }}
              className='absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600'
            >
              <svg
                className='h-4 w-4'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M6 18L18 6M6 6l12 12'
                />
              </svg>
            </button>
          )}
        </div>
        <Button
          type='submit'
          className='shrink-0 bg-emerald-600 hover:bg-emerald-700'
        >
          Search
        </Button>
      </form>

      {/* Primary Filter Dropdowns */}
      <div className='space-y-3 pt-2 border-t border-slate-100'>
        {/* Industry / Sector Filter */}
        <div>
          <label className='block text-xs font-semibold text-slate-700 mb-1'>
            Sector / Industry
          </label>
          <select
            value={currentParams.industry || ''}
            onChange={(e) =>
              updateFilters({ industry: e.target.value || undefined })
            }
            className='w-full rounded-lg border border-slate-300 bg-white py-1.5 px-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500'
          >
            <option value=''>All Sectors</option>
            {industries.map((ind) => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </select>
        </div>

        {/* Category Filter */}
        <div>
          <label className='block text-xs font-semibold text-slate-700 mb-1'>
            Category
          </label>
          <select
            value={currentParams.category || ''}
            onChange={(e) =>
              updateFilters({ category: e.target.value || undefined })
            }
            className='w-full rounded-lg border border-slate-300 bg-white py-1.5 px-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500'
          >
            <option value=''>All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Access Type Filter */}
        <div>
          <label className='block text-xs font-semibold text-slate-700 mb-1'>
            Access Type
          </label>
          <select
            value={currentParams.access || ''}
            onChange={(e) =>
              updateFilters({ access: e.target.value || undefined })
            }
            className='w-full rounded-lg border border-slate-300 bg-white py-1.5 px-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500'
          >
            <option value=''>All Access Types</option>
            {accessTypes.map((acc) => (
              <option key={acc} value={acc}>
                {acc}
              </option>
            ))}
          </select>
        </div>

        {/* API Available Filter */}
        <div>
          <label className='block text-xs font-semibold text-slate-700 mb-1'>
            API Availability
          </label>
          <select
            value={currentParams.api || ''}
            onChange={(e) =>
              updateFilters({ api: e.target.value || undefined })
            }
            className='w-full rounded-lg border border-slate-300 bg-white py-1.5 px-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500'
          >
            <option value=''>All Resources</option>
            <option value='true'>API Available (Yes)</option>
            <option value='false'>No API</option>
          </select>
        </div>

        {/* Advanced Filters Toggle */}
        <div className='pt-1'>
          <button
            type='button'
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className='flex items-center justify-between w-full text-xs font-semibold text-slate-700 hover:text-emerald-700 py-1'
          >
            <span className='flex items-center gap-1.5'>
              <span>More Filters</span>
              {hasAdvancedFilters && (
                <span className='inline-flex h-2 w-2 rounded-full bg-emerald-500' />
              )}
            </span>
            <span>{isAdvancedOpen ? '▲' : '▼'}</span>
          </button>
        </div>

        {/* Advanced Filter Fields (Coverage, Source Type, Language, Granularity) */}
        {(isAdvancedOpen || hasAdvancedFilters) && (
          <div className='space-y-3 pt-2 border-t border-slate-100'>
            {/* Country / Coverage Filter */}
            <div>
              <label className='block text-xs font-semibold text-slate-700 mb-1'>
                Country / Coverage
              </label>
              <select
                value={currentParams.coverage || ''}
                onChange={(e) =>
                  updateFilters({ coverage: e.target.value || undefined })
                }
                className='w-full rounded-lg border border-slate-300 bg-white py-1.5 px-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500'
              >
                <option value=''>All Coverage Areas</option>
                {coverages.map((cov) => (
                  <option key={cov} value={cov}>
                    {cov}
                  </option>
                ))}
              </select>
            </div>

            {/* Source Type Filter */}
            <div>
              <label className='block text-xs font-semibold text-slate-700 mb-1'>
                Source Type
              </label>
              <select
                value={currentParams.sourceType || ''}
                onChange={(e) =>
                  updateFilters({ sourceType: e.target.value || undefined })
                }
                className='w-full rounded-lg border border-slate-300 bg-white py-1.5 px-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500'
              >
                <option value=''>All Source Types</option>
                {sourceTypes.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            {/* Language Filter */}
            <div>
              <label className='block text-xs font-semibold text-slate-700 mb-1'>
                Language
              </label>
              <select
                value={currentParams.language || ''}
                onChange={(e) =>
                  updateFilters({ language: e.target.value || undefined })
                }
                className='w-full rounded-lg border border-slate-300 bg-white py-1.5 px-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500'
              >
                <option value=''>All Languages</option>
                {languages.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </div>

            {/* Data Granularity Filter */}
            <div>
              <label className='block text-xs font-semibold text-slate-700 mb-1'>
                Data Granularity
              </label>
              <select
                value={currentParams.granularity || ''}
                onChange={(e) =>
                  updateFilters({ granularity: e.target.value || undefined })
                }
                className='w-full rounded-lg border border-slate-300 bg-white py-1.5 px-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500'
              >
                <option value=''>All Granularities</option>
                {granularities.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Sort Options */}
        <div className='pt-2 border-t border-slate-100'>
          <label className='block text-xs font-semibold text-slate-700 mb-1'>
            Sort Order
          </label>
          <select
            value={`${currentParams.sort || 'name'}-${currentParams.direction || 'asc'}`}
            onChange={(e) => {
              const [sort, direction] = e.target.value.split('-')
              updateFilters({ sort, direction })
            }}
            className='w-full rounded-lg border border-slate-300 bg-white py-1.5 px-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500'
          >
            <option value='name-asc'>Name (A → Z)</option>
            <option value='name-desc'>Name (Z → A)</option>
            <option value='createdAt-desc'>Recently Added</option>
            <option value='priority-asc'>Priority Tier</option>
          </select>
        </div>
      </div>

      {/* Active Filter Chips & Reset Bar */}
      {hasActiveFilters && (
        <div className='flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs'>
          <span className='font-semibold text-slate-500'>Active:</span>
          {currentParams.q && (
            <span className='inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-800 ring-1 ring-emerald-600/20'>
              Query: &ldquo;{currentParams.q}&rdquo;
              <button
                type='button'
                onClick={() => updateFilters({ q: undefined })}
                className='hover:text-emerald-950 font-bold ml-0.5'
              >
                &times;
              </button>
            </span>
          )}
          {currentParams.industry && (
            <span className='inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-slate-700'>
              Sector: {currentParams.industry}
              <button
                type='button'
                onClick={() => updateFilters({ industry: undefined })}
                className='hover:text-slate-900 font-bold ml-0.5'
              >
                &times;
              </button>
            </span>
          )}
          {currentParams.category && (
            <span className='inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-slate-700'>
              Category: {currentParams.category}
              <button
                type='button'
                onClick={() => updateFilters({ category: undefined })}
                className='hover:text-slate-900 font-bold ml-0.5'
              >
                &times;
              </button>
            </span>
          )}
          {currentParams.coverage && (
            <span className='inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-slate-700'>
              Coverage: {currentParams.coverage}
              <button
                type='button'
                onClick={() => updateFilters({ coverage: undefined })}
                className='hover:text-slate-900 font-bold ml-0.5'
              >
                &times;
              </button>
            </span>
          )}
          {currentParams.sourceType && (
            <span className='inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-slate-700'>
              Source: {currentParams.sourceType}
              <button
                type='button'
                onClick={() => updateFilters({ sourceType: undefined })}
                className='hover:text-slate-900 font-bold ml-0.5'
              >
                &times;
              </button>
            </span>
          )}
          {currentParams.access && (
            <span className='inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-slate-700'>
              Access: {currentParams.access}
              <button
                type='button'
                onClick={() => updateFilters({ access: undefined })}
                className='hover:text-slate-900 font-bold ml-0.5'
              >
                &times;
              </button>
            </span>
          )}
          {currentParams.api && (
            <span className='inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-slate-700'>
              API: {currentParams.api === 'true' ? 'Yes' : 'No'}
              <button
                type='button'
                onClick={() => updateFilters({ api: undefined })}
                className='hover:text-slate-900 font-bold ml-0.5'
              >
                &times;
              </button>
            </span>
          )}
          {currentParams.language && (
            <span className='inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-slate-700'>
              Language: {currentParams.language}
              <button
                type='button'
                onClick={() => updateFilters({ language: undefined })}
                className='hover:text-slate-900 font-bold ml-0.5'
              >
                &times;
              </button>
            </span>
          )}
          {currentParams.granularity && (
            <span className='inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-slate-700'>
              Granularity: {currentParams.granularity}
              <button
                type='button'
                onClick={() => updateFilters({ granularity: undefined })}
                className='hover:text-slate-900 font-bold ml-0.5'
              >
                &times;
              </button>
            </span>
          )}
          <button
            type='button'
            onClick={handleResetFilters}
            className='text-xs text-red-600 hover:text-red-700 hover:underline ml-auto font-medium'
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}
