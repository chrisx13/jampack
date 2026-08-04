-- Régime « TVA sur les encaissements » (mention obligatoire sur les factures) — REG-7.
ALTER TABLE "Societe" ADD COLUMN "vatOnPayments" BOOLEAN NOT NULL DEFAULT false;
