import * as React from 'react'

export function Card({
  title,
  children,
  className = '',
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-6 shadow-sm ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <div className="mt-2 text-sm text-gray-600">{children}</div>
    </div>
  )
}
