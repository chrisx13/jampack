-- Rapprochement bancaire : pointage des lignes du compte 512 au relevé — REG-8/DO-4.
ALTER TABLE "JournalEntryLine" ADD COLUMN "reconciled" BOOLEAN NOT NULL DEFAULT false;
