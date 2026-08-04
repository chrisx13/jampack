-- Facture d'acompte : marqueur pour distinguer les acomptes (déduits à la facture de solde).
ALTER TABLE "Invoice" ADD COLUMN "isDeposit" BOOLEAN NOT NULL DEFAULT false;
