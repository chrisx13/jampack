-- Relances clients (dunning) : niveau et date de dernière relance sur la facture.
ALTER TABLE "Invoice" ADD COLUMN "reminderLevel" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "lastReminderAt" TIMESTAMP(3);
