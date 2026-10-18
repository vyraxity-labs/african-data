import { buildCsv } from './csv-sanitizer';

export interface ExportableLink {
  url: string;
  linkType?: string;
  status?: string;
  httpStatus?: number | null;
  responseTimeMs?: number | null;
  lastCheckedAt?: Date | string | null;
  finalUrl?: string | null;
}

export interface ExportableInstitution {
  name: string;
  country?: string | null;
  website?: string | null;
  type?: string | null;
}

export interface ExportableResource {
  id?: string;
  name: string;
  description?: string | null;
  sourceType?: string | null;
  industry?: string | null;
  category?: string | null;
  countryCoverage?: string | null;
  dataGranularity?: string | null;
  language?: string | null;
  accessType?: string | null;
  updateFrequency?: string | null;
  apiAvailable?: boolean;
  priority?: string | null;
  notes?: string | null;
  status?: string;
  updatedAt?: Date | string;
  institution?: ExportableInstitution | null;
  links?: ExportableLink[];
}

export const CATALOGUE_CSV_HEADERS = [
  'S/N',
  'Source Name',
  'Data Link',
  'Source Website',
  'Country / Coverage',
  'Link Description',
  'Source Type',
  'Industry',
  'Institution Name',
  'Access Type',
  'Update Frequency',
  'Category',
  'Data Granularity',
  'Language',
  'API Available',
  'Link Status',
  'HTTP Status',
  'Response Time (ms)',
  'Last Checked',
  'Priority for Platform',
  'Catalogue Status',
  'Notes',
] as const;

/**
 * Transforms an array of database resource items into a sanitized, RFC 4180 CSV export.
 * Automatically mitigates spreadsheet formula injection on all fields.
 */
export function exportCatalogueToCsv(resources: ExportableResource[]): string {
  const rows: unknown[][] = resources.map((resource, index) => {
    // Determine primary data link and website link
    const primaryDataLink =
      resource.links?.find((l) => l.linkType === 'DATA' || l.linkType === 'DOWNLOAD') ||
      resource.links?.[0];

    const websiteLink =
      resource.links?.find((l) => l.linkType === 'WEBSITE') ||
      resource.institution?.website ||
      '';

    const lastCheckedStr = primaryDataLink?.lastCheckedAt
      ? new Date(primaryDataLink.lastCheckedAt).toISOString().split('T')[0]
      : '';

    return [
      index + 1, // S/N
      resource.name || '',
      primaryDataLink?.url || '',
      typeof websiteLink === 'string' ? websiteLink : (websiteLink as any)?.url || '',
      resource.countryCoverage || '',
      resource.description || '',
      resource.sourceType || '',
      resource.industry || '',
      resource.institution?.name || '',
      resource.accessType || '',
      resource.updateFrequency || '',
      resource.category || '',
      resource.dataGranularity || '',
      resource.language || '',
      resource.apiAvailable ? 'Yes' : 'No',
      primaryDataLink?.status || 'UNKNOWN',
      primaryDataLink?.httpStatus !== null && primaryDataLink?.httpStatus !== undefined
        ? primaryDataLink.httpStatus
        : '',
      primaryDataLink?.responseTimeMs !== null && primaryDataLink?.responseTimeMs !== undefined
        ? primaryDataLink.responseTimeMs
        : '',
      lastCheckedStr,
      resource.priority || '',
      resource.status || 'ACTIVE',
      resource.notes || '',
    ];
  });

  return buildCsv(rows, [...CATALOGUE_CSV_HEADERS]);
}
