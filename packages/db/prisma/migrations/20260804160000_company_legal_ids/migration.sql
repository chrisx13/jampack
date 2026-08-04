-- Identifiants légaux acheteur (facture & Factur-X, e-invoicing B2B) — REG-5 / DO-7.
ALTER TABLE "Company" ADD COLUMN "siret" TEXT;
ALTER TABLE "Company" ADD COLUMN "tvaNumber" TEXT;
