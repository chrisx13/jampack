-- Configuration d'instance (réglages + clés/secrets). secret=true → valeur sensible (masquée pour le
-- super-admin général, révélable par le technicien) ; chiffrée au repos si SECRETS_KEY. RLS org.
CREATE TABLE "InstanceConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "secret" BOOLEAN NOT NULL DEFAULT true,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InstanceConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InstanceConfig_organizationId_name_key" ON "InstanceConfig"("organizationId", "name");

ALTER TABLE "InstanceConfig" ADD CONSTRAINT "InstanceConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
