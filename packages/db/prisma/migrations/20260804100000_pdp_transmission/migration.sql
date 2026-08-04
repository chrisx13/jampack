-- E-invoicing : suivi des transmissions de factures via la PDP (interne ou partenaire).

-- CreateTable
CREATE TABLE "PdpTransmission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "societeId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "providerRef" TEXT,
    "format" TEXT NOT NULL DEFAULT 'factur-x',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PdpTransmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PdpTransmission_organizationId_idx" ON "PdpTransmission"("organizationId");
CREATE INDEX "PdpTransmission_societeId_idx" ON "PdpTransmission"("societeId");
CREATE INDEX "PdpTransmission_invoiceId_idx" ON "PdpTransmission"("invoiceId");

-- AddForeignKey
ALTER TABLE "PdpTransmission" ADD CONSTRAINT "PdpTransmission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PdpTransmission" ADD CONSTRAINT "PdpTransmission_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "Societe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PdpTransmission" ADD CONSTRAINT "PdpTransmission_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
