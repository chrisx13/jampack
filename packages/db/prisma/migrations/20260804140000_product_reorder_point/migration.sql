-- Seuil de réapprovisionnement par article (FR-STK-5).
ALTER TABLE "Product" ADD COLUMN "reorderPoint" DECIMAL(12,3);
