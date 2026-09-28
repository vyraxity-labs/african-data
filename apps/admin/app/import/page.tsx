'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Dialog,
  LoadingState,
  ErrorState,
} from '@repo/ui'
import type { ImportPreviewReport, ImportCommitResult } from '@repo/database'

export default function AdminCsvUploadPage() {
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [isAnalyzing, setIsAnalyzing] = React.useState(false)
  const [isCommitting, setIsCommitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [previewReport, setPreviewReport] =
    React.useState<ImportPreviewReport | null>(null)
  const [commitResult, setCommitResult] =
    React.useState<ImportCommitResult | null>(null)
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = React.useState(false)

  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
      setError(null)
      setPreviewReport(null)
      setCommitResult(null)
    }
  }

  const handleGeneratePreview = async () => {
    if (!selectedFile) return

    setIsAnalyzing(true)
    setError(null)
    setPreviewReport(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const res = await fetch('/api/import/preview', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate import preview')
      }

      setPreviewReport(data.report)
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Unknown error during preview',
      )
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleCommitImport = async () => {
    if (!selectedFile) return

    setIsCommitting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const res = await fetch('/api/import/commit', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Transactional import failed')
      }

      setCommitResult(data.result)
      setIsConfirmDialogOpen(false)
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unknown error during import commit',
      )
    } finally {
      setIsCommitting(false)
    }
  }

  return (
    <div className='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'>
      {/* Page Header */}
      <div className='mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <div className='flex items-center gap-2'>
            <Link
              href='/'
              className='text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors'
            >
              ← Admin Home
            </Link>
          </div>
          <h1 className='mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl'>
            Catalogue CSV Ingestion Pipeline
          </h1>
          <p className='mt-1 text-sm text-slate-500'>
            Upload, validate, normalize, and preview African data sources before
            committing to PostgreSQL.
          </p>
        </div>
      </div>

      {/* Upload & Security Card */}
      <Card className='mb-8'>
        <CardHeader>
          <CardTitle>1. Select & Validate CSV File</CardTitle>
          <CardDescription>
            Files are checked for RFC 4180 compliance, canonical headers, file
            size limits (≤10MB), and formula injection sanitization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex flex-col sm:flex-row items-center gap-4'>
            <input
              ref={fileInputRef}
              type='file'
              accept='.csv'
              onChange={handleFileChange}
              className='block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer'
            />
            <Button
              disabled={!selectedFile || isAnalyzing || isCommitting}
              isLoading={isAnalyzing}
              onClick={handleGeneratePreview}
              className='whitespace-nowrap'
            >
              Inspect & Generate Preview
            </Button>
          </div>

          {selectedFile && (
            <div className='mt-3 flex items-center gap-3 text-xs text-slate-500'>
              <span>
                Selected: <strong>{selectedFile.name}</strong>
              </span>
              <span>•</span>
              <span>{(selectedFile.size / 1024).toFixed(1)} KB</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading state */}
      {isAnalyzing && (
        <div className='my-8'>
          <LoadingState message='Parsing headers, validating URLs, and computing duplicate detection...' />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className='my-6'>
          <ErrorState
            title='Import Error'
            message={error}
            onRetry={handleGeneratePreview}
            retryLabel='Retry Preview'
          />
        </div>
      )}

      {/* Success Banner after Commit */}
      {commitResult && (
        <div className='mb-8 rounded-xl border border-emerald-200 bg-emerald-50 p-6'>
          <div className='flex items-start gap-4'>
            <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600'>
              <svg
                className='h-6 w-6'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M5 13l4 4L19 7'
                />
              </svg>
            </div>
            <div>
              <h3 className='text-lg font-semibold text-emerald-900'>
                Import Transaction Completed Successfully!
              </h3>
              <p className='mt-1 text-sm text-emerald-700'>
                All records have been safely written to PostgreSQL inside an
                atomic Prisma transaction.
              </p>
              <div className='mt-4 flex flex-wrap gap-4 text-sm font-medium text-emerald-800'>
                <span className='rounded-md bg-white/80 px-2.5 py-1 ring-1 ring-emerald-300'>
                  Resources Created:{' '}
                  <strong>{commitResult.resourcesCreated}</strong>
                </span>
                <span className='rounded-md bg-white/80 px-2.5 py-1 ring-1 ring-emerald-300'>
                  Institutions Created:{' '}
                  <strong>{commitResult.institutionsCreated}</strong>
                </span>
                <span className='rounded-md bg-white/80 px-2.5 py-1 ring-1 ring-emerald-300'>
                  Links Attached: <strong>{commitResult.linksCreated}</strong>
                </span>
                <span className='rounded-md bg-white/80 px-2.5 py-1 ring-1 ring-emerald-300'>
                  Duplicates Skipped:{' '}
                  <strong>{commitResult.skippedDuplicates}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Section */}
      {previewReport && !commitResult && (
        <div className='space-y-6'>
          {/* Metrics Overview Cards */}
          <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6'>
            <div className='rounded-xl border border-slate-200 bg-white p-4 shadow-xs'>
              <p className='text-xs font-medium text-slate-500 uppercase tracking-wider'>
                Total Rows
              </p>
              <p className='mt-1 text-2xl font-bold text-slate-900'>
                {previewReport.totalRows}
              </p>
            </div>
            <div className='rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs'>
              <p className='text-xs font-medium text-emerald-700 uppercase tracking-wider'>
                Valid Rows
              </p>
              <p className='mt-1 text-2xl font-bold text-emerald-600'>
                {previewReport.validCount}
              </p>
            </div>
            <div className='rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs'>
              <p className='text-xs font-medium text-amber-700 uppercase tracking-wider'>
                Duplicates
              </p>
              <p className='mt-1 text-2xl font-bold text-amber-600'>
                {previewReport.potentialDuplicatesCount}
              </p>
            </div>
            <div className='rounded-xl border border-red-200 bg-red-50/50 p-4 shadow-xs'>
              <p className='text-xs font-medium text-red-700 uppercase tracking-wider'>
                Invalid URLs
              </p>
              <p className='mt-1 text-2xl font-bold text-red-600'>
                {previewReport.invalidUrlsCount}
              </p>
            </div>
            <div className='rounded-xl border border-red-200 bg-red-50/50 p-4 shadow-xs'>
              <p className='text-xs font-medium text-red-700 uppercase tracking-wider'>
                Missing Fields
              </p>
              <p className='mt-1 text-2xl font-bold text-red-600'>
                {previewReport.missingFieldsCount}
              </p>
            </div>
            <div className='rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-xs'>
              <p className='text-xs font-medium text-blue-700 uppercase tracking-wider'>
                Unknown Values
              </p>
              <p className='mt-1 text-2xl font-bold text-blue-600'>
                {previewReport.unknownValuesCount}
              </p>
            </div>
          </div>

          {/* Action Bar */}
          <div className='flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4'>
            <div>
              <h3 className='text-sm font-semibold text-slate-900'>
                Preview Generated at{' '}
                {new Date(previewReport.generatedAt).toLocaleTimeString()}
              </h3>
              <p className='text-xs text-slate-500'>
                Zero database writes have occurred. Review the rows below before
                proceeding.
              </p>
            </div>
            <Button
              onClick={() => setIsConfirmDialogOpen(true)}
              disabled={previewReport.validCount === 0 || isCommitting}
              className='bg-emerald-600 hover:bg-emerald-700'
            >
              Confirm & Commit Import ({previewReport.validCount} records)
            </Button>
          </div>

          {/* Records Preview Table */}
          <Card>
            <CardHeader>
              <CardTitle>2. Record Inspection Table</CardTitle>
              <CardDescription>
                Showing parsed & normalized catalogue records.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-16'>Row</TableHead>
                    <TableHead>Source Name</TableHead>
                    <TableHead>Institution</TableHead>
                    <TableHead>Primary URL</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Formats</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewReport.records.slice(0, 25).map((rec) => {
                    const isDup = previewReport.potentialDuplicates.some(
                      (d) => d.row === rec._rowNumber,
                    )
                    const isInvalidUrl = !rec.dataLink.isValid
                    const isMissing = previewReport.missingFields.some(
                      (m) => m.row === rec._rowNumber,
                    )

                    return (
                      <TableRow key={rec._rowNumber}>
                        <TableCell className='font-mono text-xs text-slate-500'>
                          #{rec._rowNumber}
                        </TableCell>
                        <TableCell className='font-medium text-slate-900 max-w-xs truncate'>
                          {rec.name}
                        </TableCell>
                        <TableCell className='text-slate-600 max-w-xs truncate'>
                          {rec.institutionName || '—'}
                        </TableCell>
                        <TableCell className='font-mono text-xs text-slate-500 max-w-xs truncate'>
                          <a
                            href={rec.dataLink.raw}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-emerald-600 hover:underline'
                          >
                            {rec.dataLink.raw}
                          </a>
                        </TableCell>
                        <TableCell>
                          <Badge size='sm' variant='default'>
                            {rec.coverage.scope}
                          </Badge>
                        </TableCell>
                        <TableCell className='text-xs text-slate-600'>
                          {rec.formats.slice(0, 3).join(', ')}
                          {rec.formats.length > 3 ? '...' : ''}
                        </TableCell>
                        <TableCell>
                          <Badge
                            size='sm'
                            variant={
                              rec.priority === 'HIGH' ? 'success' : 'default'
                            }
                          >
                            {rec.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isInvalidUrl || isMissing ? (
                            <Badge size='sm' variant='danger'>
                              Invalid
                            </Badge>
                          ) : isDup ? (
                            <Badge size='sm' variant='warning'>
                              Duplicate
                            </Badge>
                          ) : (
                            <Badge size='sm' variant='success'>
                              Valid
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              {previewReport.records.length > 25 && (
                <p className='mt-3 text-center text-xs text-slate-500'>
                  Showing first 25 of {previewReport.records.length} records in
                  preview.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog
        isOpen={isConfirmDialogOpen}
        onClose={() => setIsConfirmDialogOpen(false)}
        title='Confirm Ingestion into PostgreSQL'
        description='Please confirm that you want to execute the transactional import.'
        footer={
          <>
            <Button
              variant='outline'
              onClick={() => setIsConfirmDialogOpen(false)}
              disabled={isCommitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCommitImport}
              isLoading={isCommitting}
              className='bg-emerald-600 hover:bg-emerald-700'
            >
              Proceed with Import
            </Button>
          </>
        }
      >
        <div className='space-y-3 text-sm text-slate-600'>
          <p>
            You are about to import{' '}
            <strong className='text-slate-900'>
              {previewReport?.validCount}
            </strong>{' '}
            valid catalogue resources.
          </p>
          {previewReport && previewReport.potentialDuplicatesCount > 0 && (
            <p className='text-amber-700'>
              ⚠️ <strong>{previewReport.potentialDuplicatesCount}</strong>{' '}
              potential duplicate(s) will be skipped safely.
            </p>
          )}
          <p className='text-xs text-slate-500'>
            This operation runs in a PostgreSQL transaction. If any unhandled
            error occurs, the batch is automatically rolled back.
          </p>
        </div>
      </Dialog>
    </div>
  )
}
