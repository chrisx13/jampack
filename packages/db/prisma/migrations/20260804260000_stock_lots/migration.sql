-- Traçabilité stock : n° de lot/série + péremption sur les mouvements — FR-STK-6.
ALTER TABLE "StockMovement" ADD COLUMN "lotNumber" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN "expiryDate" TIMESTAMP(3);
CREATE INDEX "StockMovement_lotNumber_idx" ON "StockMovement"("lotNumber");
