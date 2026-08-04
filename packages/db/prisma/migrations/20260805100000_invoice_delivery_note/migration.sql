-- Bon de livraison : n° BL + date de livraison, portés par la facture.
ALTER TABLE "Invoice" ADD COLUMN "deliveryNumber" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "deliveredAt" TIMESTAMP(3);
