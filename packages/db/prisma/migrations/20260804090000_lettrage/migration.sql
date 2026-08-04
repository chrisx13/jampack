-- Lettrage comptable : code de rapprochement débit/crédit sur les lignes d'écriture.

-- AlterTable
ALTER TABLE "JournalEntryLine" ADD COLUMN "letter" TEXT;

-- CreateIndex
CREATE INDEX "JournalEntryLine_letter_idx" ON "JournalEntryLine"("letter");
