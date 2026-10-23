import { prisma } from '../index';

export async function applyPerformanceIndexes() {
  console.log('⚡ Applying PostgreSQL performance indexes & updating table statistics...');

  // 1. Vacuum analyze tables
  await prisma.$executeRawUnsafe('VACUUM ANALYZE "Resource";');
  await prisma.$executeRawUnsafe('VACUUM ANALYZE "ResourceLink";');
  await prisma.$executeRawUnsafe('VACUUM ANALYZE "Institution";');

  // 2. Add high-performance indexes
  // CreatedAt sorting
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Resource_createdAt_idx" ON "Resource"("createdAt" DESC);');

  // UpdatedAt sorting (Admin table)
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Resource_updatedAt_idx" ON "Resource"("updatedAt" DESC);');

  // Compound filter + sort (status + name) for deep pagination
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Resource_status_name_idx" ON "Resource"("status", "name" ASC);');

  // Compound filter + sort (status + createdAt)
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Resource_status_createdAt_idx" ON "Resource"("status", "createdAt" DESC);');

  // Compound scheduler monitoring claim index
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "ResourceLink_lastChecked_lock_idx" ON "ResourceLink"("lastCheckedAt" ASC NULLS FIRST, "checkLockedUntil");');

  // Compound status + lastCheckedAt for health audits
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "ResourceLink_status_lastChecked_idx" ON "ResourceLink"("status", "lastCheckedAt");');

  console.log('✅ PostgreSQL performance indexes applied and catalog statistics analyzed.');
}

if (require.main === module) {
  applyPerformanceIndexes()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
