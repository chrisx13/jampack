-- Comptabilisation des règlements et des factures fournisseurs : lien vers l'écriture générée.

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "journalEntryId" TEXT;
ALTER TABLE "SupplierInvoice" ADD COLUMN "journalEntryId" TEXT;

-- CreateIndex
CREATE INDEX "Payment_journalEntryId_idx" ON "Payment"("journalEntryId");
CREATE INDEX "SupplierInvoice_journalEntryId_idx" ON "SupplierInvoice"("journalEntryId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
