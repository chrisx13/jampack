-- Grille tarifaire : prix par quantité (palier) et/ou par client, pour un article.
CREATE TABLE "PriceRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "societeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "companyId" TEXT,
    "minQuantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "unitPriceHt" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PriceRule_organizationId_societeId_idx" ON "PriceRule"("organizationId", "societeId");
CREATE INDEX "PriceRule_productId_idx" ON "PriceRule"("productId");

ALTER TABLE "PriceRule" ADD CONSTRAINT "PriceRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PriceRule" ADD CONSTRAINT "PriceRule_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "Societe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PriceRule" ADD CONSTRAINT "PriceRule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PriceRule" ADD CONSTRAINT "PriceRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
