export interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  totalItems?: number
  itemsPerPage?: number
  className?: string
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
  className = '',
}: PaginationProps) {
  if (totalPages <= 1) return null

  const getVisiblePages = () => {
    const delta = 2
    const range: number[] = []
    const rangeWithDots: (number | string)[] = []
    let l: number | undefined

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - delta && i <= currentPage + delta)
      ) {
        range.push(i)
      }
    }

    for (const i of range) {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1)
        } else if (i - l !== 1) {
          rangeWithDots.push('...')
        }
      }
      rangeWithDots.push(i)
      l = i
    }

    return rangeWithDots
  }

  const pages = getVisiblePages()

  const startItem =
    totalItems && itemsPerPage
      ? (currentPage - 1) * itemsPerPage + 1
      : undefined
  const endItem =
    totalItems && itemsPerPage
      ? Math.min(currentPage * itemsPerPage, totalItems)
      : undefined

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 py-4 ${className}`}
      aria-label='Pagination Navigation'
    >
      {totalItems !== undefined && (
        <p className='text-sm text-slate-600'>
          Showing{' '}
          <span className='font-semibold text-slate-900'>{startItem}</span> to{' '}
          <span className='font-semibold text-slate-900'>{endItem}</span> of{' '}
          <span className='font-semibold text-slate-900'>{totalItems}</span>{' '}
          results
        </p>
      )}

      <div className='flex items-center gap-1'>
        {/* Previous Button */}
        <button
          type='button'
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className='inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-300 disabled:border-slate-200 disabled:cursor-not-allowed transition-colors'
          aria-label='Previous Page'
        >
          Previous
        </button>

        {/* Page numbers */}
        <div className='flex items-center gap-1'>
          {pages.map((page, idx) => {
            if (page === '...') {
              return (
                <span
                  key={`dots-${idx}`}
                  className='px-2 py-1 text-sm text-slate-400'
                >
                  ...
                </span>
              )
            }

            const pageNum = page as number
            const isCurrent = pageNum === currentPage

            return (
              <button
                key={pageNum}
                type='button'
                onClick={() => onPageChange(pageNum)}
                aria-current={isCurrent ? 'page' : undefined}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                  isCurrent
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {pageNum}
              </button>
            )
          })}
        </div>

        {/* Next Button */}
        <button
          type='button'
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className='inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-300 disabled:border-slate-200 disabled:cursor-not-allowed transition-colors'
          aria-label='Next Page'
        >
          Next
        </button>
      </div>
    </div>
  )
}
