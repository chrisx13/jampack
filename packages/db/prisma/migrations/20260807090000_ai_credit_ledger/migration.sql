-- Grand livre des crédits IA (append-only) : mesure l'usage de l'enrichissement Claude (niveau 2).
-- Solde = SUM("delta") par organisation. RLS org appliquée par rls.sql.
CREATE TABLE "AiCreditLedger" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "documentRef" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiCreditLedger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiCreditLedger_organizationId_createdAt_idx" ON "AiCreditLedger"("organizationId", "createdAt");

ALTER TABLE "AiCreditLedger" ADD CONSTRAINT "AiCreditLedger_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
