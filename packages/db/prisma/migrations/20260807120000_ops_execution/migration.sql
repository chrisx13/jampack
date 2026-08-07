-- Journal des exécutions d'opérations techniques (console super-admin). Append-only, RLS org.
CREATE TABLE "OpsExecution" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "opId" TEXT NOT NULL,
    "target" TEXT NOT NULL DEFAULT 'local',
    "params" JSONB,
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL,
    "summary" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OpsExecution_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OpsExecution_organizationId_createdAt_idx" ON "OpsExecution"("organizationId", "createdAt");

ALTER TABLE "OpsExecution" ADD CONSTRAINT "OpsExecution_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
