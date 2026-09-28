import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'African Data Discovery Platform',
  description:
    'Discover, understand, and navigate African data sources, indicators, and authoritative repositories.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900 font-sans">
        {/* Global Navigation Header */}
        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            {/* Brand Logo & Title */}
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs group-hover:bg-emerald-700 transition-colors">
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 12h20" />
                    <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6" />
                    <path d="m4 8 8-5 8 5" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </div>
                <div>
                  <span className="font-bold tracking-tight text-slate-900 text-base sm:text-lg">
                    African Data
                  </span>
                  <span className="ml-1 text-xs font-semibold uppercase tracking-wider text-emerald-600">
                    Discovery
                  </span>
                </div>
              </Link>
            </div>

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
              <Link href="/" className="hover:text-emerald-600 transition-colors">
                Home
              </Link>
              <Link href="/resources" className="hover:text-emerald-600 transition-colors">
                Browse Catalogue
              </Link>
              <a
                href="http://localhost:3001"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-slate-900 transition-colors inline-flex items-center gap-1 text-slate-500"
              >
                Admin Portal
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </nav>

            {/* Header Right Action */}
            <div className="flex items-center gap-3">
              <Link
                href="/resources"
                className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
              >
                Explore Data
              </Link>
            </div>
          </div>
        </header>

        {/* Main Application Container */}
        <div className="flex-1">{children}</div>

        {/* Global Footer */}
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {/* Mission column */}
              <div className="md:col-span-2 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-white">
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="3" />
                      <path d="M2 12h20" />
                    </svg>
                  </div>
                  <span className="font-bold text-slate-900">African Data Discovery Platform</span>
                </div>
                <p className="text-sm text-slate-600 max-w-md leading-relaxed">
                  The central catalogue for discovering where relevant African data exists,
                  understanding what each authoritative source provides, and navigating to primary
                  custodians.
                </p>
                <p className="text-xs text-slate-400">
                  Data index maintained with continuous health monitoring and verification.
                </p>
              </div>

              {/* Quick Links */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900 mb-3">
                  Catalogue
                </h3>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li>
                    <Link href="/resources" className="hover:text-emerald-600 transition-colors">
                      All Resources
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/resources?category=Pan-African%20Source"
                      className="hover:text-emerald-600 transition-colors"
                    >
                      Pan-African Sources
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/resources?api=true"
                      className="hover:text-emerald-600 transition-colors"
                    >
                      Open APIs
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/resources?access=Free"
                      className="hover:text-emerald-600 transition-colors"
                    >
                      Free Access Data
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Focus Areas */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900 mb-3">
                  Sectors
                </h3>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li>
                    <Link
                      href="/resources?industry=Trade"
                      className="hover:text-emerald-600 transition-colors"
                    >
                      Trade & Economics
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/resources?industry=Health"
                      className="hover:text-emerald-600 transition-colors"
                    >
                      Health & Epidemiology
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/resources?industry=Finance"
                      className="hover:text-emerald-600 transition-colors"
                    >
                      Finance & Capital Markets
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/resources?industry=Agriculture"
                      className="hover:text-emerald-600 transition-colors"
                    >
                      Agriculture & Food Security
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-8 border-t border-slate-100 pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
              <p>© {new Date().getFullYear()} African Data Discovery Platform. Open metadata index.</p>
              <div className="flex gap-6">
                <span>PostgreSQL & Prisma 7</span>
                <span>•</span>
                <span>Next.js 16 App Router</span>
                <span>•</span>
                <span>Tailwind CSS 4</span>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
