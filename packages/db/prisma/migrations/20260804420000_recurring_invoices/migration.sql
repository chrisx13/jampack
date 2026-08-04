-- Factures récurrentes (abonnements) : modèle générant des factures brouillon à échéance.
CREATE TABLE "RecurringInvoice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "societeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "paymentTermId" TEXT,
    "bankAccountId" TEXT,
    "discountType" TEXT NOT NULL DEFAULT 'none',
    "discountValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lines" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RecurringInvoice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecurringInvoice_organizationId_societeId_idx" ON "RecurringInvoice"("organizationId", "societeId");

ALTER TABLE "RecurringInvoice" ADD CONSTRAINT "RecurringInvoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurringInvoice" ADD CONSTRAINT "RecurringInvoice_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "Societe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurringInvoice" ADD CONSTRAINT "RecurringInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
