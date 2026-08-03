/*
  Warnings:

  - You are about to drop the column `bic` on the `Societe` table. All the data in the column will be lost.
  - You are about to drop the column `factorIban` on the `Societe` table. All the data in the column will be lost.
  - You are about to drop the column `factorName` on the `Societe` table. All the data in the column will be lost.
  - You are about to drop the column `iban` on the `Societe` table. All the data in the column will be lost.
  - You are about to drop the column `paymentTerms` on the `Societe` table. All the data in the column will be lost.
  - You are about to drop the column `subrogation` on the `Societe` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "factorId" TEXT,
ADD COLUMN     "factorMandatory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentTermId" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "bankAccountId" TEXT,
ADD COLUMN     "factorId" TEXT,
ADD COLUMN     "paymentTermId" TEXT;

-- AlterTable
ALTER TABLE "Societe" DROP COLUMN "bic",
DROP COLUMN "factorIban",
DROP COLUMN "factorName",
DROP COLUMN "iban",
DROP COLUMN "paymentTerms",
DROP COLUMN "subrogation";

-- CreateTable
CREATE TABLE "SocieteAddress" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "societeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "country" TEXT,
    "isHeadquarters" BOOLEAN NOT NULL DEFAULT false,
    "isBilling" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocieteAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Factor" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "societeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "iban" TEXT,
    "bic" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Factor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "societeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "bic" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTerm" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "societeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "days" INTEGER NOT NULL DEFAULT 30,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentTerm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SocieteAddress_organizationId_idx" ON "SocieteAddress"("organizationId");

-- CreateIndex
CREATE INDEX "SocieteAddress_societeId_idx" ON "SocieteAddress"("societeId");

-- CreateIndex
CREATE INDEX "Factor_organizationId_idx" ON "Factor"("organizationId");

-- CreateIndex
CREATE INDEX "Factor_societeId_idx" ON "Factor"("societeId");

-- CreateIndex
CREATE INDEX "BankAccount_organizationId_idx" ON "BankAccount"("organizationId");

-- CreateIndex
CREATE INDEX "BankAccount_societeId_idx" ON "BankAccount"("societeId");

-- CreateIndex
CREATE INDEX "PaymentTerm_organizationId_idx" ON "PaymentTerm"("organizationId");

-- CreateIndex
CREATE INDEX "PaymentTerm_societeId_idx" ON "PaymentTerm"("societeId");

-- CreateIndex
CREATE INDEX "Company_factorId_idx" ON "Company"("factorId");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_factorId_fkey" FOREIGN KEY ("factorId") REFERENCES "Factor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_paymentTermId_fkey" FOREIGN KEY ("paymentTermId") REFERENCES "PaymentTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocieteAddress" ADD CONSTRAINT "SocieteAddress_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocieteAddress" ADD CONSTRAINT "SocieteAddress_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "Societe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factor" ADD CONSTRAINT "Factor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factor" ADD CONSTRAINT "Factor_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "Societe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "Societe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTerm" ADD CONSTRAINT "PaymentTerm_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTerm" ADD CONSTRAINT "PaymentTerm_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "Societe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_factorId_fkey" FOREIGN KEY ("factorId") REFERENCES "Factor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_paymentTermId_fkey" FOREIGN KEY ("paymentTermId") REFERENCES "PaymentTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
