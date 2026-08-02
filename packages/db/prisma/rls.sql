-- Isolation multi-tenant par Row-Level Security.
-- A exécuter APRÈS `prisma migrate`.
-- Chaque requête applicative positionne : SELECT set_config('app.current_org', '<id>', true);
--
-- IMPORTANT : le propriétaire des tables contourne le RLS. Pour une isolation réelle,
-- l'application doit se connecter avec un rôle dédié NON-propriétaire, p. ex. :
--   CREATE ROLE jampack_app LOGIN PASSWORD '...';
--   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO jampack_app;
-- puis pointer DATABASE_URL (runtime) sur ce rôle. Les migrations restent faites par le propriétaire.

ALTER TABLE "Societe"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Establishment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Company"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Contact"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Opportunity"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Activity"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PipelineStage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Role"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Membership"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SocieteRole"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaxRate"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NumberSequence" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['Societe','Establishment','Company','Contact','Opportunity','Activity','PipelineStage','Role','Membership','SocieteRole','TaxRate','Product','NumberSequence']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS org_isolation ON %I;', t);
    EXECUTE format(
      'CREATE POLICY org_isolation ON %I USING ("organizationId" = current_setting(''app.current_org'', true)) WITH CHECK ("organizationId" = current_setting(''app.current_org'', true));',
      t
    );
  END LOOP;
END $$;

-- Policy additionnelle (permissive, OR) : un utilisateur peut lire SES appartenances
-- pour l'amorçage d'auth (résoudre son compte avant toute sélection d'organisation).
DROP POLICY IF EXISTS membership_self ON "Membership";
CREATE POLICY membership_self ON "Membership"
  USING ("userId" = current_setting('app.current_user', true));

DROP POLICY IF EXISTS societerole_self ON "SocieteRole";
CREATE POLICY societerole_self ON "SocieteRole"
  USING ("userId" = current_setting('app.current_user', true));
