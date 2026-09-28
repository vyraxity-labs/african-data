import * as React from 'react';
import Link from 'next/link';

export interface ResourcePaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  searchParams: Record<string, string | undefined>;
}

export function ResourcePagination({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  searchParams,
}: ResourcePaginationProps) {
  if (totalPages <= 1) return null;

  const buildPageUrl = (page: number) => {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && k !== 'page') {
        params.set(k, v);
      }
    });
    params.set('page', String(page));
    return `/resources?${params.toString()}`;
  };

  const getVisiblePages = () => {
    const delta = 2;
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];
    let l: number | undefined;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i);
      }
    }

    for (const i of range) {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    return rangeWithDots;
  };

  const pages = getVisiblePages();
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6 border-t border-slate-200 mt-8">
      <p className="text-sm text-slate-600">
        Showing <span className="font-semibold text-slate-900">{startItem}</span> to{' '}
        <span className="font-semibold text-slate-900">{endItem}</span> of{' '}
        <span className="font-semibold text-slate-900">{totalCount}</span> resources
      </p>

      <div className="flex items-center gap-1.5">
        {/* Previous Button */}
        {currentPage > 1 ? (
          <Link
            href={buildPageUrl(currentPage - 1)}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            ← Previous
          </Link>
        ) : (
          <span className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-300 cursor-not-allowed">
            ← Previous
          </span>
        )}

        {/* Page Number Buttons */}
        <div className="flex items-center gap-1">
          {pages.map((page, idx) => {
            if (page === '...') {
              return (
                <span key={`dots-${idx}`} className="px-2 py-1 text-sm text-slate-400">
                  ...
                </span>
              );
            }

            const pageNum = page as number;
            const isCurrent = pageNum === currentPage;

            return isCurrent ? (
              <span
                key={pageNum}
                aria-current="page"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-sm font-semibold text-white shadow-xs"
              >
                {pageNum}
              </span>
            ) : (
              <Link
                key={pageNum}
                href={buildPageUrl(pageNum)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                {pageNum}
              </Link>
            );
          })}
        </div>

        {/* Next Button */}
        {currentPage < totalPages ? (
          <Link
            href={buildPageUrl(currentPage + 1)}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            Next →
          </Link>
        ) : (
          <span className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-300 cursor-not-allowed">
            Next →
          </span>
        )}
      </div>
    </div>
  );
}
