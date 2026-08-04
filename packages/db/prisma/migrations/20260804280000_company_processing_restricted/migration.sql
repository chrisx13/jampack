-- Droit de limitation du traitement RGPD (art. 18) : donnees gelees — REG-3.
ALTER TABLE "Company" ADD COLUMN "processingRestricted" BOOLEAN NOT NULL DEFAULT false;
