import { PrismaClient } from '../generated/prisma/client';
import { PrismaPostgresAdapter } from '@prisma/adapter-ppg';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export function createPrismaClient(): PrismaClient {
  const connectionString =
    process.env.DATABASE_URL ?? 'postgresql://app:app@localhost:5432/african_data';
  const adapter = new PrismaPostgresAdapter({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalThis.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

export * from '../generated/prisma/client';
