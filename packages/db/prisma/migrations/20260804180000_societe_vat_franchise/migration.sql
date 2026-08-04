-- Franchise en base de TVA (art. 293 B CGI) + taux de pénalités LME configurable — REG-6/REG-7.
ALTER TABLE "Societe" ADD COLUMN "vatFranchise" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Societe" ADD COLUMN "penaltyRate" TEXT;
