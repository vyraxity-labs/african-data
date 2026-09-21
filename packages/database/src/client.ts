import { PrismaClient } from '../generated/prisma/client';
import { PrismaPostgresAdapter } from '@prisma/adapter-ppg';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export function createPrismaClient(): PrismaClient {
  const connectionString =
    process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/african_data_dev';

  // If connecting to Prisma Postgres serverless endpoint (starts with prisma+postgres:// or prisma://)
  // or explicitly configured for ppg adapter, use PrismaPostgresAdapter
  if (
    connectionString.startsWith('prisma+postgres://') ||
    connectionString.startsWith('prisma://') ||
    process.env.PRISMA_POSTGRES_ADAPTER === 'ppg'
  ) {
    const adapter = new PrismaPostgresAdapter({ connectionString });
    return new PrismaClient({ adapter });
  }

  // Local / standard PostgreSQL connection using pg pool driver adapter
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalThis.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

export * from '../generated/prisma/client';
