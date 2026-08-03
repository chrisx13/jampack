-- Comptabilisation des ventes : lien optionnel facture → écriture comptable générée.

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "journalEntryId" TEXT;

-- CreateIndex
CREATE INDEX "Invoice_journalEntryId_idx" ON "Invoice"("journalEntryId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
