-- Isolation multi-tenant par Row-Level Security.
-- A exécuter APRÈS `prisma migrate`.
-- Deux niveaux d'isolation :
--   * COMPTE  : policy permissive `org_isolation` sur "organizationId" = app.current_org.
--   * SOCIÉTÉ : policy RESTRICTIVE `societe_isolation` sur "societeId" = app.current_societe
--               (indépendance renforcée entre sociétés d'un même compte). Restrictive = ANDée
--               avec org_isolation. app.current_societe absent/vide → vue consolidée (toutes
--               les sociétés du compte, sous réserve de l'isolation compte).
-- Chaque requête applicative positionne : SELECT set_config('app.current_org', '<id>', true);
-- et, pour une société active : SELECT set_config('app.current_societe', '<id>', true);
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
ALTER TABLE "Invoice"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SocieteAddress"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Factor"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BankAccount"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentTerm"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Warehouse"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockMovement"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseOrder"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierInvoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Journal"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JournalEntry"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PdpTransmission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierPayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FixedAsset"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ViewNote"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ViewNoteRevision"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RecurringInvoice"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Expense"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PriceRule"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TimeEntry"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AiCreditLedger"    ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['Societe','Establishment','Company','Contact','Opportunity','Activity','PipelineStage','Role','Membership','SocieteRole','TaxRate','Product','ProductCategory','SocieteAddress','Factor','BankAccount','PaymentTerm','NumberSequence','Invoice','Payment','Warehouse','StockMovement','PurchaseOrder','SupplierInvoice','Account','Journal','JournalEntry','AuditLog','PdpTransmission','SupplierPayment','FixedAsset','ViewNote','ViewNoteRevision','RecurringInvoice','Expense','PriceRule','TimeEntry','AiCreditLedger']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS org_isolation ON %I;', t);
    EXECUTE format(
      'CREATE POLICY org_isolation ON %I USING ("organizationId" = current_setting(''app.current_org'', true)) WITH CHECK ("organizationId" = current_setting(''app.current_org'', true));',
      t
    );
  END LOOP;
END $$;

-- Isolation SOCIÉTÉ : policies RESTRICTIVES sur les tables portant "societeId".
-- (ANDées avec org_isolation.) NB : TaxRate, PipelineStage, Role, Membership, SocieteRole
-- et Societe restent au niveau COMPTE (référentiels/annuaire mutualisés — choix « indépendance renforcée »).
-- TODO Jalon A : ajouter "societeId" + RLS sur InvoiceLine (aujourd'hui joignable via Invoice).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['Establishment','Company','Contact','Opportunity','Activity','Product','ProductCategory','SocieteAddress','Factor','BankAccount','PaymentTerm','NumberSequence','Invoice','Payment','Warehouse','StockMovement','PurchaseOrder','SupplierInvoice','Account','Journal','JournalEntry','PdpTransmission','SupplierPayment','FixedAsset','ViewNote','RecurringInvoice','Expense','PriceRule','TimeEntry']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS societe_isolation ON %I;', t);
    EXECUTE format(
      'CREATE POLICY societe_isolation ON %I AS RESTRICTIVE '
      'USING (current_setting(''app.current_societe'', true) IS NULL '
      '       OR current_setting(''app.current_societe'', true) = '''' '
      '       OR "societeId" = current_setting(''app.current_societe'', true)) '
      'WITH CHECK (current_setting(''app.current_societe'', true) IS NULL '
      '       OR current_setting(''app.current_societe'', true) = '''' '
      '       OR "societeId" = current_setting(''app.current_societe'', true));',
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

-- Accès PUBLIC par jeton (signature en ligne du devis) : lecture/écriture de la SEULE pièce dont le
-- token correspond à app.public_quote_token. Permissive (OR avec org_isolation) ; la policy société
-- restrictive passe car app.current_societe est absent en contexte public.
DROP POLICY IF EXISTS public_quote_token ON "Invoice";
CREATE POLICY public_quote_token ON "Invoice"
  USING ("publicToken" IS NOT NULL AND "publicToken" = current_setting('app.public_quote_token', true))
  WITH CHECK ("publicToken" IS NOT NULL AND "publicToken" = current_setting('app.public_quote_token', true));

-- La page publique doit lire la société émettrice et le client du devis ciblé (lecture seule).
DROP POLICY IF EXISTS public_quote_societe ON "Societe";
CREATE POLICY public_quote_societe ON "Societe" FOR SELECT
  USING (EXISTS (SELECT 1 FROM "Invoice" i WHERE i."societeId" = "Societe".id AND i."publicToken" IS NOT NULL AND i."publicToken" = current_setting('app.public_quote_token', true)));

DROP POLICY IF EXISTS public_quote_company ON "Company";
CREATE POLICY public_quote_company ON "Company" FOR SELECT
  USING (EXISTS (SELECT 1 FROM "Invoice" i WHERE i."companyId" = "Company".id AND i."publicToken" IS NOT NULL AND i."publicToken" = current_setting('app.public_quote_token', true)));
