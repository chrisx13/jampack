-- Signature en ligne du devis : jeton public + preuve d'acceptation (horodatage, nom, IP).
ALTER TABLE "Invoice" ADD COLUMN "publicToken" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "acceptedAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN "acceptedByName" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "acceptedIp" TEXT;
CREATE UNIQUE INDEX "Invoice_publicToken_key" ON "Invoice"("publicToken");
