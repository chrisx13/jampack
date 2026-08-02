/*
  Warnings:

  - Added the required column `societeId` to the `Activity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `societeId` to the `Company` table without a default value. This is not possible if the table is not empty.
  - Added the required column `societeId` to the `Contact` table without a default value. This is not possible if the table is not empty.
  - Added the required column `societeId` to the `Opportunity` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "societeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "societeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "societeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "societeId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Societe" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "siren" TEXT,
    "siret" TEXT,
    "tvaNumber" TEXT,
    "city" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Societe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Societe_organizationId_idx" ON "Societe"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Societe_organizationId_name_key" ON "Societe"("organizationId", "name");

-- CreateIndex
CREATE INDEX "Activity_societeId_idx" ON "Activity"("societeId");

-- CreateIndex
CREATE INDEX "Company_societeId_idx" ON "Company"("societeId");

-- CreateIndex
CREATE INDEX "Contact_societeId_idx" ON "Contact"("societeId");

-- CreateIndex
CREATE INDEX "Opportunity_societeId_idx" ON "Opportunity"("societeId");

-- AddForeignKey
ALTER TABLE "Societe" ADD CONSTRAINT "Societe_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "Societe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "Societe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "Societe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "Societe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
