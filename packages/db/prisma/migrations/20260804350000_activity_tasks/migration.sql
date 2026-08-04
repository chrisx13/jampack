-- Suivi d'activité CRM : lien direct au client + état fait/à faire (tâches de relance)
ALTER TABLE "Activity" ADD COLUMN "done" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Activity" ADD COLUMN "doneAt" TIMESTAMP(3);
ALTER TABLE "Activity" ADD COLUMN "companyId" TEXT;

ALTER TABLE "Activity" ADD CONSTRAINT "Activity_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Activity_companyId_idx" ON "Activity"("companyId");
