-- CreateTable
CREATE TABLE "LinkCheck" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "LinkHealthStatus" NOT NULL,
    "httpStatus" INTEGER,
    "finalUrl" TEXT,
    "responseTimeMs" INTEGER,
    "errorType" TEXT,
    "errorMessage" TEXT,

    CONSTRAINT "LinkCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LinkCheck_linkId_checkedAt_idx" ON "LinkCheck"("linkId", "checkedAt");

-- AddForeignKey
ALTER TABLE "LinkCheck" ADD CONSTRAINT "LinkCheck_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "ResourceLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
