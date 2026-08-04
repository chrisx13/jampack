-- Remise globale (pied de pièce) : type (none|percent|amount) + valeur.
ALTER TABLE "Invoice" ADD COLUMN "discountType" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "Invoice" ADD COLUMN "discountValue" DECIMAL(12,2) NOT NULL DEFAULT 0;
