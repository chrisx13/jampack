# JAMPACK — Traçabilité doc ↔ code

> Mise en relation des **spécifications** (documents de référence dans
> `D:\OneDrive\Documents\jampack\*.docx`) avec le **code** (`D:\Dev\jampack`).
> Actualisé le **3 août 2026**. Ce fichier est la source de vérité de l'état d'avancement ;
> les `.docx` portent la vision, le code porte l'implémentation.

## Sources de référence

| Document | Rôle |
|---|---|
| `Note de cadrage JAMPACK.docx` | Vision, périmètre, contexte réglementaire, roadmap initiale |
| `Architecture technique JAMPACK.docx` | Stack, monorepo, modèle de données socle, RLS, RBAC |
| `Cartographie ERP JAMPACK.docx` | Périmètre ERP cible + feuille de route séquencée (fait foi) |
| `Charte et stack front JAMPACK.docx` | Look & feel Jampack (Bootstrap 5), hiérarchie Compte▸Société |

**Légende statut** : ✅ conforme · ⚠️ partiel · ❌ absent · ➕ au-delà de la doc · ✱ divergence tranchée

## 1. Stack & architecture

| Exigence (doc) | Code | Statut | Preuve |
|---|---|---|---|
| Monorepo pnpm + Turborepo | idem | ✅ | `pnpm-workspace.yaml`, `turbo.json` |
| Backend NestJS monolithe modulaire | idem | ✅ | `apps/api/src/app.module.ts` |
| PostgreSQL 16 + Prisma | idem | ✅ | `packages/db/prisma/schema.prisma` |
| API tRPC type-safe | idem | ✅ | `apps/api/src/trpc/router.ts` |
| Validation Zod partagée | idem | ✅ | `packages/domain/src/schemas.ts` |
| React 18 + Vite | idem | ✅ | `apps/web/vite.config.ts` |
| **Composants Tailwind + shadcn/ui** (Archi §2) | **Bootstrap 5 + react-bootstrap** | ✱ | remplacé par la *Charte* ; `apps/web/src/theme/theme.scss` |
| **Auth : better-auth OU Keycloak** (Archi §2) | **Keycloak OIDC** (tranché) | ✱ | `keycloak/realm-jampack.json`, `apps/api/src/auth/oidc.ts` |
| Desktop Tauri 2 (enveloppe web) | scaffold, `tauri init` non lancé | ⚠️ | `apps/desktop/README.md` (partie native à générer) |
| Mobile PWA | absent | ❌ | pas d'app mobile ni de `vite-plugin-pwa` |
| Docker + Compose | idem | ✅ | `docker-compose.yml`, `docker/docker-compose.yml` |
| CI GitHub Actions | **lint + typecheck + tests unitaires & intégration + build** | ✅ | `.github/workflows/ci.yml` = install→migrate→seed→lint→typecheck→`test:cov`→`test:int`→build |
| Hébergement UE (Scaleway/OVH) | non applicable au repo | — | décision infra, hors code |

### Packages du monorepo

Archi §3 prévoyait 5 packages ; le code en a **2** (simplification assumée) :

| Package prévu (doc) | Réalité |
|---|---|
| `packages/db` | ✅ présent |
| `packages/domain` | ✅ présent (contient aussi les types de contrat tRPC) |
| `packages/api-contract` | ✱ fusionné dans `domain` (`export type AppRouter`) |
| `packages/ui` | ✱ inutile (react-bootstrap fournit les composants) |
| `packages/config` | ✱ inliné (`tsconfig.base.json` à la racine) |

### Modules backend

Archi §4 : `common, iam, crm, billing, stock, accounting, trpc`. Réalité :

| Module code | Correspondance doc |
|---|---|
| `crm/` | ✅ crm |
| `iam/` | ✅ iam (allégé : `me`, `members`) |
| `societe/` | ➕ multi-société (postérieur à l'Archi §4) |
| `catalog/` | ➕ référentiels (articles, TVA, catégories, numérotation) |
| `settings/` | ➕ thème du compte |
| `invoice/` | = `billing` de la doc (factures) — **renommé** |
| `billing/` | ➕ affacturage / banques / conditions de paiement / adresses |
| `auth/` | ➕ vérification OIDC (pas un module NestJS listé dans l'Archi) |
| `stock/`, `accounting/` | ❌ phases futures |
| `common/` | ✱ la transaction RLS vit dans `@jampack/db` (`withTenant`), pas dans un `common/` |

## 2. Multi-tenant & isolation (RLS)

| Exigence (Archi §6) | Code | Statut |
|---|---|---|
| Base partagée + `organizationId` par table | idem | ✅ |
| `SET LOCAL app.current_org` par transaction | `withTenant()` | ✅ `packages/db/src/index.ts` |
| Policies RLS d'isolation | idem | ✅ `packages/db/prisma/rls.sql` |
| Rôle SQL non-propriétaire pour que le RLS s'applique | `jampack_app` (créé au boot Docker) | ➕ renforcement absent de la doc |

## 3. RBAC

| Exigence (Archi §7) | Code | Statut |
|---|---|---|
| Modèle Rôle → Permissions (action × subject) | idem | ✅ `Role`, `Permission` |
| CASL serveur + UI, écrit une fois dans `domain` | idem | ✅ `packages/domain/src/ability.ts` (identique au snippet doc) |
| Rôles par défaut Admin/Commercial/Comptable/Lecture seule | Admin/Commercial/Comptable (seed) | ✅ `packages/db/prisma/seed.ts` |
| **Rôle porté par le `Membership`** (Archi §5) | **`SocieteRole` : rôles par société cumulables** | ✱ suit la *Cartographie*, pas l'Archi §5 (périmée) |
| Arbre de droits fin `module.domaine.action` (Achats/Stock/Compta/IA…) | **présent mais non branché** aux routers | ⚠️ **modèle cible** : `packages/domain/src/rights.ts` — futur éditeur de rôles, reste à câbler côté serveur (les routers utilisent aujourd'hui CASL `action/subject`) |

## 4. Modèle de données

Le socle IAM+CRM de l'Archi §5 est **dépassé** par le multi-société. Modèles réels
(`packages/db/prisma/schema.prisma`) :

| Doc §5 | Code | Écart |
|---|---|---|
| Organization, User, Membership(**roleId**), Role, Permission | Organization(**+theme**), User, Membership(**sans role**), Role, **SocieteRole**, Permission | rôles déplacés sur `SocieteRole` |
| — | **Societe** | ➕ entité juridique (compte ▸ société) |
| Company, Contact, PipelineStage, Opportunity, Activity | idem + `Company.isSupplier` | ➕ flag fournisseur |
| — | **Establishment**, **SocieteAddress** | ➕ établissements & adresses (siège/facturation/livraison) |
| — | **TaxRate, Product, ProductCategory, NumberSequence** | ➕ référentiels (Jalon 1) |
| — | **Invoice, InvoiceLine, Factor, BankAccount, PaymentTerm** | ➕ facturation & encaissement (Jalon 2 partiel) |
| — | **InstanceConfig, OpsExecution, AiCreditLedger** | ➕ pilotage super-admin (config/secrets chiffrés, audit d'opérations) + crédits IA — au-delà de la doc socle |

## 5. Feuille de route ERP (Cartographie) — état réel

| Jalon | Élément | Statut | Preuve |
|---|---|---|---|
| **Fait** | Socle multi-société + RLS + OIDC + RBAC | ✅ | cf. §1–3 |
| **Fait** | CRM (clients, contacts, opportunités, pipeline kanban) | ✅ | `apps/api/src/crm/crm.router.ts`, `apps/web/src/pages/Pipeline.tsx` |
| **Fait** | CRM — activités & tâches (note/appel/email/rdv/tâche, échéance, clôture) | ✅ | `crm.router.ts` (`activities.*`), `Activity` (+`companyId`/`done`/`doneAt`), `apps/web/src/pages/Activities.tsx` |
| **Fait** | Établissements & adresses clients | ✅ | `crm.router.ts` (`establishments`) |
| **1 Référentiels** | Articles/services | ✅ | `catalog.router.ts` (`products`) |
| **1 Référentiels** | **Import CSV du catalogue** (upsert par référence) | ✅ | `catalog.products.importCsv`, `parseProductsCsv`, bouton import `Catalogue.tsx` |
| **1 CRM** | **Prévisionnel commercial pondéré** (probabilité par étape) | ✅ | `crm.opportunities.pipelineSummary`, `PipelineStage.probability`, bandeau `Pipeline.tsx` |
| **1 Référentiels** | Taxes (TVA) | ✅ | `catalog.router.ts` (`taxRates`) |
| **1 Référentiels** | Numérotation des pièces | ✅ | `NumberSequence`, `nextDocumentNumber` |
| **1 Référentiels** | Modèles PDF | ✅ | `apps/api/src/invoice/invoiceHtml.ts` → PDF Chromium |
| **1 Référentiels** | **Fournisseurs** | ⚠️ | seul `Company.isSupplier` existe ; pas de module achats |
| **2 Ventes** | Factures (brouillon→validée→annulée) + PDF | ✅ | `invoice.router.ts` (`validate`, `cancel`, `pdf`) |
| **2 Ventes** | TVA par ligne + totaux | ✅ | `computeInvoiceTotals`, `InvoiceLine.taxRatePct` |
| **2 Ventes** | Affacturage / banques / conditions de paiement | ✅ ➕ | `billing.router.ts` (hors périmètre explicite de la roadmap) |
| **2 Ventes** | **Devis** (+ conversion en facture) | ✅ | `quote.router.ts` (`convertToInvoice`, `accept`/`refuse`), `Invoice.docType='devis'` |
| **2 Ventes** | **Validité & expiration des devis** (relance avant caducité) | ✅ | `quote.router.ts` (`expiring`), `isQuoteExpired`/`quoteDaysToExpiry`, `Invoice.validUntil`, `QuotesExpiring.tsx` |
| **2 Ventes** | **Mention d'escompte** (L441-10, « Pas d'escompte » par défaut) | ✅ | `discountMention`, `Societe.discountTerms`, `invoiceHtml.ts`, champ `SocieteSettings.tsx` |
| **2 Ventes** | **Avoirs** (depuis facture) | ✅ | `creditNote.router.ts`, `invoices.createCreditNote`, `Invoice.docType='avoir'` |
| **2 Ventes** | **Règlements / échéancier** | ✅ | `payment.router.ts` (`create`/`remove`/`echeancier`), modèle `Payment`, statut facture recalculé (validée ⇄ payée) |
| **2 Ventes** | **Relances clients** (dunning) | ✅ | `payment.router.ts` (`reminders`/`recordReminder`/`reminderLetter`), `Invoice.reminderLevel`/`lastReminderAt`, `dunningMessage`, `Reminders.tsx` — niveau progressif + lettre conforme LME (pénalités + 40 €) |
| **2 Ventes** | **E-invoicing Factur-X / PDP** | 🔧 | Génération **Factur-X (XML CII, EN 16931)** (`facturx.ts`), connecteur **PDP** abstrait + adaptateur interne (`pdp.ts`), procédures `facturx`/`sendToPdp`/`transmissions`, journal `PdpTransmission` (RLS), UI (bouton Factur-X + « Envoyer via PDP » + statut). **Reste hors périmètre logiciel** : immatriculation PDP DGFiP, raccordement PPF, e-reporting, certification — voir [Conformité §3.1](CONFORMITE.md) |
| **3 Stock** | Entrepôts + mouvements (entrée/sortie/ajustement) + niveaux calculés | ✅ | `stock.router.ts` (`warehouses`, `movements`, `levels`), modèles `Warehouse`/`StockMovement` |
| **3 Stock** | **Valorisation PMP** (par article) | ✅ | `stock.router.ts` (`valuation`) — PMP des entrées × quantité nette |
| **3 Stock** | **Seuils de réapprovisionnement** + alertes rupture + **inventaire physique** | ✅ | `Product.reorderPoint`, `stock.router.ts` (`inventory`, `lowStock`), `StockLevels.tsx` (alerte + action inventaire) |
| **3 Stock** | **Lots / n° de série** + péremption (DLC/DDM) | ✅ | `stock.lots`, `StockMovement.lotNumber`/`expiryDate`, `StockLots.tsx` (alertes périmé/bientôt) |
| **3 Stock** | **Transfert inter-entrepôts** (sortie + entrée atomiques) | ✅ | `stock.movements.transfer`, `stockTransfer`, carte transfert `StockMovements.tsx` |
| **3 Stock** | **Export CSV des niveaux de stock** | ✅ | `stock.exportLevels`, `stockLevelsCsv`, bouton export `StockLevels.tsx` |
| **3 Stock** | Valorisation **FIFO** (au choix, en plus du PMP) | ✅ | `stock.valuation({method:'fifo'})`, bascule PMP/FIFO dans `StockValuation.tsx` |
| **3 Achats** | Commandes fournisseurs → **réceptions** (génèrent les entrées de stock) | ✅ | `purchase.router.ts` (`orders.validate`/`receive`), modèles `PurchaseOrder`/`PurchaseOrderLine` ; fournisseur = `Company.isSupplier` |
| **3 Achats** | **Factures fournisseurs** + échéancier fournisseur (reste dû) | ✅ | `supplierInvoice.router.ts` (`validate`/`markPaid`/`echeancier`), modèles `SupplierInvoice`/`SupplierInvoiceLine` |
| **3 Achats** | **Règlements fournisseurs partiels** + comptabilisation (401=512) | ✅ | `supplierPayment.router.ts` (`create`/`remove`/`listForInvoice`), modèle `SupplierPayment` (RLS), statut piloté par le cumul, `accounting.postSupplierPayment`, UI (panneau règlements + échéancier reste dû) |
| **3 Achats** | **Rapprochement 3 voies** commande ↔ réception ↔ facture | ✅ | `supplierInvoices.match` (commandé/facturé/écart/réception), panneau dans `SupplierInvoices.tsx` |
| **3 Achats** | **Suivi des commandes en retard** (livraison prévue dépassée) | ✅ | `purchases.orders.overdue`, `isPurchaseOrderOverdue`/`purchaseOrderDaysLate`, `OverduePurchaseOrders.tsx` |
| **3 Achats** | **Réception partielle** (livraisons échelonnées, statut partial → received) | ✅ | `purchases.orders.receivePartial`, `purchaseReceipt`, `PurchaseOrderLine.quantityReceived`, panneau `PurchaseOrders.tsx` |
| **4 Compta** | Plan comptable + journaux + écritures équilibrées + balance + **grand livre** | ✅ | `accounting.router.ts` (`accounts`/`journals`/`entries`/`balance`/`ledger`), contrôle débit=crédit |
| **4 Compta** | **États de synthèse** : compte de résultat + bilan simplifié (classes PCG) | ✅ | `accounting.incomeStatement`/`balanceSheet`, `FinancialStatements.tsx` — actif=passif+résultat |
| **4 Compta** | **Export CSV de la balance générale** | ✅ | `accounting.exportBalance`, `balanceCsv`, bouton `TrialBalance.tsx` |
| **4 Compta** | **Comptabilisation auto** : ventes (411/707/44571), règlements clients (512/411), factures fournisseurs (607/44566/401), règlements fournisseurs (401/512) | ✅ | `accounting.postSalesInvoice`/`postPayment`/`postSupplierInvoice`/`postSupplierPayment`, liens `journalEntryId` |
| **4 Compta** | **Export FEC** (Fichier des Écritures Comptables, tabulé normé) | ✅ | `accounting.fec` — bouton « Exporter le FEC » (Balance) |
| **4 Compta** | **Déclaration de TVA (CA3)** | ✅ | `accounting.vatReturn` — collectée (44571) − déductible (44566) |
| **4 Compta** | **Lettrage** (rapprochement débit/crédit) + **clôture TVA** (OD) | ✅ | `accounting` (`letter`/lettrage, écriture de clôture 44571/44566→44551/44567), page `Lettrage.tsx` |
| **4 Compta** | **Rapprochement bancaire** : pointage + **import de relevé CSV** (pointage auto par montant) | ✅ | `accounting.bankLines`/`reconcile`/`importBankStatement`, `parseBankStatementCsv`, `JournalEntryLine.reconciled`, `BankReconciliation.tsx` |
| **4 Compta** | **Immobilisations** + plan d'amortissement linéaire + **comptabilisation de la dotation** (681/281) | ✅ | `accounting.fixedAssets` (`schedule`/`postDepreciation`), `depreciationSchedule`, `FixedAsset`, `FixedAssets.tsx` |
| **5 Trésorerie** | **Prévisionnel de trésorerie** : encaissements clients vs décaissements fournisseurs, position nette, retards | ✅ | `analytics.tresorerie`, page `Tresorerie.tsx` (domaine Trésorerie) |
| **5 Trésorerie** | **Balance âgée** clients **et fournisseurs** (par tranche d'ancienneté) | ✅ | `analytics.agedReceivables`/`agedPayables`, `AgedReceivables.tsx` |
| **5 Trésorerie** | **Prévisionnel hebdomadaire** (courbe encaissements/décaissements + cumul) | ✅ | `analytics.cashflowForecast`, courbe dans `Tresorerie.tsx` |
| **6 Gestion** | **Agenda consolidé** (échéances & tâches à venir, 7/30/90 j, retards) + **export ICS** | ✅ | `analytics.agenda`/`agendaIcs`, `buildAgendaIcs` (RFC 5545), `Agenda.tsx` (domaine Gestion) |
| **5 BI** | Tableaux de bord analytiques avancés (séries temporelles, marges) | 🔧 | KPI consolidés via `analytics.summary` (Dashboard) ; BI approfondie = phase future |
| transverse | Administration in-app : inviter users, attribuer/révoquer rôles | ✅ | `iam.router` (`invite`/`grantRole`/`revokeRole`), garde-fou dernier admin, page `Members.tsx` |
| transverse | **Journal d'audit** des mutations + **export CSV** | ✅ | middleware `auditMiddleware`, `audit.router` (`list`/`exportCsv`), `auditLogCsv`, `AuditLog.tsx` |
| transverse | **Reconnaissance de documents** (niveau 1 gratuit local + niveau 2 IA Claude par crédits) | ✅ | `docExtract.ts`/`aiFields.ts`, `documents.router`, `AiCreditLedger`, `DocumentScanner.tsx`, `AiCredits.tsx` |
| transverse | **Console de pilotage super-admin** (opérations, config/secrets, diagnostic, mode/hébergement, isolation absolue) | ✅ | `opsCatalog.ts`/`configChecks.ts`, `ops`+`config`+`instance` routers, `executor.ts`/`crypto.ts`/`tier.ts`, `InstanceConfig`/`OpsExecution`, `OpsConsole.tsx` |

**Position actuelle : Jalons 0 à 5 livrés (socle → trésorerie).** Ventes (devis → facture → avoir,
règlements + échéancier client, un seul modèle `Invoice` discriminé par `docType`), **e-invoicing**
(Factur-X CII + connecteur PDP interne, `PdpTransmission`), Achats (commandes → réception → stock,
factures **et règlements fournisseurs**), Stock (mouvements, niveaux, valorisation PMP), Comptabilité
(écritures auto ventes/achats/règlements, lettrage, TVA/CA3, clôture TVA, FEC) et **Trésorerie**
(prévisionnel encaissements/décaissements) sont opérationnels.

**Décisions restant à prendre** (voir [ARCHITECTURE §2 ▸ Décisions ouvertes](ARCHITECTURE.md)) :
**voie PDP réglementaire** (immatriculation DGFiP/PPF *ou* PDP partenaire — le connecteur interne ne vaut
pas PDP agréée), rapprochement bancaire, valorisation FIFO/lots, rapprochement 3 voies achats, API
publique REST, hébergeur UE définitif. Restent en phase future : desktop (Tauri), PWA mobile, BI avancée.

## 6. Charte front

| Exigence (Charte) | Code | Statut |
|---|---|---|
| Look Jampack (Bootstrap 5, DM Sans, teal #007D88, hk-*) | idem | ✅ `apps/web/src/theme/theme.scss`, `AppShell.tsx` |
| Modes clair/sombre (`data-bs-theme`) | idem | ✅ `applyTheme.ts` |
| Hiérarchie Compte ▸ Société ▸ données + sélecteur | idem | ✅ `activeSociete.ts`, `AppShell.tsx` |
| **« Pas de thème par client »** | **thème personnalisable par compte** | ✱ **arbitrage : on garde le code, la Charte est amendée** (personnalisation des couleurs au niveau compte, sans white-label complet) — `settings.router.ts` (`setTheme`), `Organization.theme`, `apps/web/src/pages/Appearance.tsx` |
| Widgets jQuery → équivalents React | partiel (au fil des pages) | ⚠️ kanban `@hello-pangea/dnd` fait ; agenda/tables à venir |

## 7. DevOps

| Exigence | Code | Statut |
|---|---|---|
| `docker compose up` lève Postgres + Adminer (dev) | idem | ✅ `docker/docker-compose.yml` (service `adminer`) |
| Stack complète en un `docker compose up --build` | db + keycloak + app + web | ✅ ➕ `docker-compose.yml` |
| CI lint → typecheck → **test** → build | **CI conteneurisée (Docker)** : migrate + RLS + seed → lint → typecheck → **test:cov (≥ 90 %) → test:int** → build | ✅ `scripts/ci.sh`, `docker-compose.ci.yml`, `ci/run.sh` (cible Docker `ci`) — **pas de GitHub Actions** |

## 8. Backlog d'alignement (issu de cet audit)

Réalisé depuis l'audit initial :
- [x] Devis + conversion en facture, avoirs (chaîne Ventes).
- [x] Règlements + échéancier client (statut payée automatique).
- [x] **Factur-X + connecteur PDP interne** (`invoice/facturx.ts`, `invoice/pdp.ts`, `PdpTransmission`).
- [x] **Achats** : commandes → réception → stock, factures **et règlements fournisseurs**.
- [x] **Comptabilité** : écritures auto, lettrage, TVA/CA3, clôture TVA, FEC.
- [x] **Trésorerie** : prévisionnel encaissements/décaissements.
- [x] **CI conteneurisée (Docker)** : `scripts/ci.sh` rejoue lint + typecheck + tests unit/int + build (pas de GitHub Actions).
- [x] Administration in-app : invitation d'utilisateurs, édition sociétés/rôles.
- [x] **Reconnaissance de documents** (niveau 1 gratuit local + niveau 2 IA Claude par crédits) — FR-ACH-12.
- [x] **Console de pilotage super-admin** : opérations prédéfinies, config/secrets chiffrés, diagnostic, mode/hébergement, isolation absolue — FR-OPS-1..5.

Reste ouvert (décisions ou phases futures — voir [ARCHITECTURE §2 ▸ Décisions ouvertes](ARCHITECTURE.md)) :
- [ ] **Voie PDP réglementaire** : immatriculation DGFiP/PPF **ou** PDP partenaire (DO-1).
- [ ] Câbler `rights.ts` (éditeur de rôles fin) côté serveur, ou le remplacer par le modèle CASL.
- [ ] Rapprochement bancaire (DO-4) ; valorisation FIFO/lots (DO-5) ; rapprochement 3 voies achats (DO-6).
- [ ] Générer la partie native Tauri (`tauri init`) ; amorcer la PWA.
