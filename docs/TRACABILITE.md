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
| CI GitHub Actions | présent, **sans lint ni test** | ⚠️ | `.github/workflows/ci.yml` = migrate→typecheck→build |
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

## 5. Feuille de route ERP (Cartographie) — état réel

| Jalon | Élément | Statut | Preuve |
|---|---|---|---|
| **Fait** | Socle multi-société + RLS + OIDC + RBAC | ✅ | cf. §1–3 |
| **Fait** | CRM (clients, contacts, opportunités, pipeline kanban) | ✅ | `apps/api/src/crm/crm.router.ts`, `apps/web/src/pages/Pipeline.tsx` |
| **Fait** | Établissements & adresses clients | ✅ | `crm.router.ts` (`establishments`) |
| **1 Référentiels** | Articles/services | ✅ | `catalog.router.ts` (`products`) |
| **1 Référentiels** | Taxes (TVA) | ✅ | `catalog.router.ts` (`taxRates`) |
| **1 Référentiels** | Numérotation des pièces | ✅ | `NumberSequence`, `nextDocumentNumber` |
| **1 Référentiels** | Modèles PDF | ✅ | `apps/api/src/invoice/invoiceHtml.ts` → PDF Chromium |
| **1 Référentiels** | **Fournisseurs** | ⚠️ | seul `Company.isSupplier` existe ; pas de module achats |
| **2 Ventes** | Factures (brouillon→validée→annulée) + PDF | ✅ | `invoice.router.ts` (`validate`, `cancel`, `pdf`) |
| **2 Ventes** | TVA par ligne + totaux | ✅ | `computeInvoiceTotals`, `InvoiceLine.taxRatePct` |
| **2 Ventes** | Affacturage / banques / conditions de paiement | ✅ ➕ | `billing.router.ts` (hors périmètre explicite de la roadmap) |
| **2 Ventes** | **Devis** (+ conversion en facture) | ✅ | `quote.router.ts` (`convertToInvoice`, `accept`/`refuse`), `Invoice.docType='devis'` |
| **2 Ventes** | **Avoirs** (depuis facture) | ✅ | `creditNote.router.ts`, `invoices.createCreditNote`, `Invoice.docType='avoir'` |
| **2 Ventes** | **Règlements / échéancier** | ✅ | `payment.router.ts` (`create`/`remove`/`echeancier`), modèle `Payment`, statut facture recalculé (validée ⇄ payée) |
| **2 Ventes** | **E-invoicing Factur-X / PDP** | ❌ | PDF simple (pas hybride Factur-X) ; aucune intégration PDP — **point réglementaire n°1, non commencé** |
| **3 Stock** | Entrepôts + mouvements (entrée/sortie/ajustement) + niveaux calculés | ✅ | `stock.router.ts` (`warehouses`, `movements`, `levels`), modèles `Warehouse`/`StockMovement` |
| **3 Stock** | **Valorisation PMP** (par article) | ✅ | `stock.router.ts` (`valuation`) — PMP des entrées × quantité nette |
| **3 Stock** | Inventaires, FIFO, lots/seuils | ❌ | phase future |
| **3 Achats** | Commandes fournisseurs → **réceptions** (génèrent les entrées de stock) | ✅ | `purchase.router.ts` (`orders.validate`/`receive`), modèles `PurchaseOrder`/`PurchaseOrderLine` ; fournisseur = `Company.isSupplier` |
| **3 Achats** | **Factures fournisseurs** + échéancier fournisseur | ✅ | `supplierInvoice.router.ts` (`validate`/`markPaid`/`echeancier`), modèles `SupplierInvoice`/`SupplierInvoiceLine` |
| **3 Achats** | Rapprochement commande/réception/facture, règlements fournisseurs partiels | ❌ | phase future (lien `SupplierInvoice.purchaseOrderId` déjà présent) |
| **4 Compta** | Plan comptable + journaux + écritures équilibrées + balance | ✅ | `accounting.router.ts` (`accounts`/`journals`/`entries`/`balance`), contrôle débit=crédit |
| **4 Compta** | **Comptabilisation auto** : ventes (411/707/44571), règlements (512/411), factures fournisseurs (607/44566/401) | ✅ | `accounting.postSalesInvoice`/`postPayment`/`postSupplierInvoice`, liens `journalEntryId` |
| **4 Compta** | **Export FEC** (Fichier des Écritures Comptables, tabulé normé) | ✅ | `accounting.fec` — bouton « Exporter le FEC » (Balance) |
| **4 Compta** | TVA/CA3, lettrage, rapprochement bancaire | ❌ | phase future |
| **5** | Trésorerie & BI | ❌ | phase future |
| transverse | Administration in-app (inviter users, gérer sociétés/rôles) | ⚠️ | lecture seule (`iam.members`) ; pas d'invitation ni d'édition de rôles |

**Position actuelle : Jalon 2 (Ventes) quasi complet.** Chaîne devis → facture → avoir + **règlements
et échéancier client** opérationnels (un seul modèle `Invoice` discriminé par `docType`, PDF partagé,
numérotation par type ; `Payment` rattaché à la facture, statut payée automatique). Reste au Jalon 2 :
**Factur-X / PDP** (échéance réception 09/2026), qui dépend du choix d'une PDP partenaire (décision business).

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
| CI lint → typecheck → **test** → migrate → build | migrate → typecheck → build | ⚠️ pas de `lint` ni de `test` en CI (aucun test écrit) |

## 8. Backlog d'alignement (issu de cet audit)

- [ ] Câbler `rights.ts` (éditeur de rôles fin) côté serveur, ou le remplacer par le modèle CASL.
- [ ] Ajouter `lint` (et des tests) à la CI pour tenir la promesse de l'Archi §9.
- [ ] Fournisseurs : passer du flag `isSupplier` à un vrai périmètre achats.
- [x] Devis + conversion en facture, avoirs (chaîne Ventes).
- [x] Règlements + échéancier client (statut payée automatique).
- [ ] Factur-X / intégration PDP (conformité e-invoicing — prioritaire, dépend du choix PDP).
- [ ] Générer la partie native Tauri (`tauri init`) ; amorcer la PWA.
- [ ] Administration in-app : invitation d'utilisateurs, édition sociétés/rôles.
