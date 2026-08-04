-- Immobilisations amortissables — REG-8 (comptabilité).
CREATE TABLE "FixedAsset" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "societeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountCode" TEXT,
    "amountHt" DECIMAL(14,2) NOT NULL,
    "acquisitionDate" TIMESTAMP(3) NOT NULL,
    "durationYears" INTEGER NOT NULL DEFAULT 5,
    "method" TEXT NOT NULL DEFAULT 'linear',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FixedAsset_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FixedAsset_organizationId_idx" ON "FixedAsset"("organizationId");
CREATE INDEX "FixedAsset_societeId_idx" ON "FixedAsset"("societeId");
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "Societe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
