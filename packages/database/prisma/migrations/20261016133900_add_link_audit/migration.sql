-- CreateTable
CREATE TABLE "LinkAudit" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "oldUrl" TEXT NOT NULL,
    "newUrl" TEXT NOT NULL,
    "reason" TEXT,
    "changedBy" TEXT,
    "statusBefore" "LinkHealthStatus",
    "statusAfter" "LinkHealthStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LinkAudit_linkId_idx" ON "LinkAudit"("linkId");

-- CreateIndex
CREATE INDEX "LinkAudit_createdAt_idx" ON "LinkAudit"("createdAt");

-- AddForeignKey
ALTER TABLE "LinkAudit" ADD CONSTRAINT "LinkAudit_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "ResourceLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
