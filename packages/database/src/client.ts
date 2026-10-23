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

function getPrismaClient(): PrismaClient {
  if (process.env.NODE_ENV !== 'production') {
    if (globalThis.prisma && !('auditLog' in globalThis.prisma)) {
      globalThis.prisma = undefined;
    }
    if (!globalThis.prisma) {
      globalThis.prisma = createPrismaClient();
    }
    return globalThis.prisma;
  }
  return globalThis.prisma ?? createPrismaClient();
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    let client = getPrismaClient();
    if (
      process.env.NODE_ENV !== 'production' &&
      typeof prop === 'string' &&
      !(prop in client) &&
      prop !== 'then'
    ) {
      globalThis.prisma = createPrismaClient();
      client = globalThis.prisma;
    }
    const val = Reflect.get(client, prop, receiver);
    if (typeof val === 'function') {
      return val.bind(client);
    }
    return val;
  },
});

export * from '../generated/prisma/client';
