-- Notes de vue : pense-bêtes partagés par vue + société, historisés et déplaçables.
CREATE TABLE "ViewNote" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "societeId" TEXT NOT NULL,
    "viewKey" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT 'amber',
    "x" INTEGER NOT NULL DEFAULT 24,
    "y" INTEGER NOT NULL DEFAULT 24,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ViewNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ViewNoteRevision" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ViewNoteRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ViewNote_organizationId_societeId_viewKey_idx" ON "ViewNote"("organizationId", "societeId", "viewKey");
CREATE INDEX "ViewNoteRevision_noteId_createdAt_idx" ON "ViewNoteRevision"("noteId", "createdAt");

ALTER TABLE "ViewNote" ADD CONSTRAINT "ViewNote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ViewNote" ADD CONSTRAINT "ViewNote_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "Societe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ViewNote" ADD CONSTRAINT "ViewNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ViewNoteRevision" ADD CONSTRAINT "ViewNoteRevision_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ViewNoteRevision" ADD CONSTRAINT "ViewNoteRevision_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "ViewNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ViewNoteRevision" ADD CONSTRAINT "ViewNoteRevision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
