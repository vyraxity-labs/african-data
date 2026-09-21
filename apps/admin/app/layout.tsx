import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'African Data Platform — Administration',
  description: 'Administrative portal for catalogue management, link health, and data operations',
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
