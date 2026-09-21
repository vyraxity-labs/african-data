import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'African Data Discovery Platform',
  description: 'Discover and navigate African data sources and repositories',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
