-- AlterTable
ALTER TABLE "ResourceLink" ADD COLUMN     "checkAttemptedAt" TIMESTAMP(3),
ADD COLUMN     "checkLockToken" TEXT,
ADD COLUMN     "checkLockedUntil" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ResourceLink_checkLockedUntil_idx" ON "ResourceLink"("checkLockedUntil");
