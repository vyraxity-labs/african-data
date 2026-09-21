-- CreateEnum
CREATE TYPE "LinkType" AS ENUM ('DATA', 'WEBSITE', 'API', 'DOWNLOAD', 'DOCUMENTATION', 'OTHER');

-- CreateEnum
CREATE TYPE "LinkHealthStatus" AS ENUM ('UNKNOWN', 'HEALTHY', 'REDIRECTED', 'BROKEN', 'TIMEOUT', 'RATE_LIMITED', 'BLOCKED', 'SERVER_ERROR');

-- CreateTable
CREATE TABLE "ResourceLink" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "linkType" "LinkType" NOT NULL,
    "status" "LinkHealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "httpStatus" INTEGER,
    "finalUrl" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "lastSuccessfulCheckAt" TIMESTAMP(3),
    "responseTimeMs" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResourceLink_resourceId_idx" ON "ResourceLink"("resourceId");

-- CreateIndex
CREATE INDEX "ResourceLink_status_idx" ON "ResourceLink"("status");

-- CreateIndex
CREATE INDEX "ResourceLink_lastCheckedAt_idx" ON "ResourceLink"("lastCheckedAt");

-- AddForeignKey
ALTER TABLE "ResourceLink" ADD CONSTRAINT "ResourceLink_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
