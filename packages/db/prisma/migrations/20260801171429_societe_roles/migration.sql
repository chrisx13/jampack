/*
  Warnings:

  - You are about to drop the column `roleId` on the `Membership` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Membership" DROP CONSTRAINT "Membership_roleId_fkey";

-- AlterTable
ALTER TABLE "Membership" DROP COLUMN "roleId";

-- CreateTable
CREATE TABLE "SocieteRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "societeId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocieteRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SocieteRole_organizationId_idx" ON "SocieteRole"("organizationId");

-- CreateIndex
CREATE INDEX "SocieteRole_userId_idx" ON "SocieteRole"("userId");

-- CreateIndex
CREATE INDEX "SocieteRole_societeId_idx" ON "SocieteRole"("societeId");

-- CreateIndex
CREATE UNIQUE INDEX "SocieteRole_userId_societeId_roleId_key" ON "SocieteRole"("userId", "societeId", "roleId");

-- AddForeignKey
ALTER TABLE "SocieteRole" ADD CONSTRAINT "SocieteRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocieteRole" ADD CONSTRAINT "SocieteRole_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "Societe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocieteRole" ADD CONSTRAINT "SocieteRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocieteRole" ADD CONSTRAINT "SocieteRole_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
