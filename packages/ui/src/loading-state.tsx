export interface LoadingStateProps {
  message?: string
  variant?: 'spinner' | 'skeleton'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const spinnerSizes = {
  sm: 'h-5 w-5',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
}

export function LoadingState({
  message = 'Loading...',
  variant = 'spinner',
  size = 'md',
  className = '',
}: LoadingStateProps) {
  if (variant === 'skeleton') {
    return (
      <div
        className={`space-y-4 w-full animate-pulse p-4 ${className}`}
        aria-busy='true'
        aria-live='polite'
      >
        <div className='h-4 bg-slate-200 rounded-md w-3/4' />
        <div className='space-y-2'>
          <div className='h-3 bg-slate-200 rounded-md' />
          <div className='h-3 bg-slate-200 rounded-md w-5/6' />
        </div>
      </div>
    )
  }

  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center ${className}`}
      role='status'
      aria-live='polite'
    >
      <svg
        className={`animate-spin text-emerald-600 ${spinnerSizes[size]}`}
        xmlns='http://www.w3.org/2000/svg'
        fill='none'
        viewBox='0 0 24 24'
        aria-hidden='true'
      >
        <circle
          className='opacity-25'
          cx='12'
          cy='12'
          r='10'
          stroke='currentColor'
          strokeWidth='4'
        />
        <path
          className='opacity-75'
          fill='currentColor'
          d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
        />
      </svg>
      {message && (
        <p className='mt-3 text-sm font-medium text-slate-600'>{message}</p>
      )}
      <span className='sr-only'>Loading</span>
    </div>
  )
}
