-- Pièces de vente : le modèle Invoice porte désormais un docType (devis | facture | avoir)
-- et une filiation (source) pour la conversion devis → facture → avoir.

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "docType" TEXT NOT NULL DEFAULT 'facture',
ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "validUntil" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Invoice_societeId_docType_idx" ON "Invoice"("societeId", "docType");

-- CreateIndex
CREATE INDEX "Invoice_sourceId_idx" ON "Invoice"("sourceId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
