-- Droit d'opposition RGPD (art. 21) : exclure un tiers de la prospection — REG-3.
ALTER TABLE "Company" ADD COLUMN "doNotProspect" BOOLEAN NOT NULL DEFAULT false;
