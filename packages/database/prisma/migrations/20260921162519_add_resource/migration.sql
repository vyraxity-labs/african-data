-- CreateEnum
CREATE TYPE "ResourceStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "institutionId" TEXT,
    "sourceType" TEXT,
    "industry" TEXT,
    "category" TEXT,
    "countryCoverage" TEXT,
    "dataGranularity" TEXT,
    "language" TEXT,
    "accessType" TEXT,
    "updateFrequency" TEXT,
    "apiAvailable" BOOLEAN NOT NULL DEFAULT false,
    "priority" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "status" "ResourceStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Resource_name_idx" ON "Resource"("name");

-- CreateIndex
CREATE INDEX "Resource_institutionId_idx" ON "Resource"("institutionId");

-- CreateIndex
CREATE INDEX "Resource_industry_idx" ON "Resource"("industry");

-- CreateIndex
CREATE INDEX "Resource_category_idx" ON "Resource"("category");

-- CreateIndex
CREATE INDEX "Resource_sourceType_idx" ON "Resource"("sourceType");

-- CreateIndex
CREATE INDEX "Resource_accessType_idx" ON "Resource"("accessType");

-- CreateIndex
CREATE INDEX "Resource_apiAvailable_idx" ON "Resource"("apiAvailable");

-- CreateIndex
CREATE INDEX "Resource_status_idx" ON "Resource"("status");

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
