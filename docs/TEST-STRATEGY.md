# Stratégie de test

**Projet :** JAMPACK · **Référentiel :** ISO/IEC/IEEE 29119 · **Statut :** En construction · **Version :** 1.0

## 1. Objectifs
Garantir l'exactitude métier (totaux, numérotation, statuts, intégration achats↔stock), la sécurité
(isolation multi-tenant, autorisation) et la non-régression.

## 2. Niveaux de test
| Niveau | Portée | Outillage | État |
|---|---|---|---|
| Statique | Types, contrats | `tsc --noEmit` (5 packages), en local | ✅ |
| Statique | Style/qualité | ESLint (flat config), en local | ✅ |
| **Unitaire** | **Logique métier (`packages/domain`)** | **Vitest + couverture v8, en local** | ✅ **≥ 90 % (seuil), 171 tests** |
| **Intégration** | **Routeurs tRPC via `createCaller` + DB PostgreSQL réelle (RLS actif)** | **Vitest (config dédiée), exécution séquentielle** | ✅ **112 tests** (ventes, achats/stock, IAM/RLS, notes, exports, reconnaissance de documents, crédits IA, pilotage/config/isolation) |
| Bout-en-bout UI | Parcours web authentifié | Playwright | ⏳ |
| Sécurité | Isolation RLS, FORBIDDEN (IAM) | `iam.int.test.ts` (RLS actif) | 🟡 partiel |

### 2.1 Couverture unitaire (objectif ≥ 90 %)
Mesurée sur `packages/domain` (calculs de totaux, arbre de droits, validation Zod, garde-fous admin) —
le cœur de correction. Seuils appliqués dans `vitest.config.ts` : lignes/fonctions/instructions **90 %**,
branches **85 %**. Résultat courant : **100 % statements / 98 % branches / 100 % functions** (41 tests).
Fichiers : `packages/domain/src/*.test.ts`. Commande : `pnpm test:cov`.
L'intégration des routeurs (DB réelle) est en place (§3). **Prochaine extension** : composants React
(Testing Library) et couverture serveur pour élargir le périmètre au-delà du domaine.

## 3. Preuves déjà produites (callers tRPC, RLS actif)
| Domaine | Scénario vérifié |
|---|---|
| Ventes | devis→sent→accepted→converted ; facture FA-0001 validée ; avoir source=facture ; totaux exacts |
| Règlements | acompte→validée+échéancier ; solde→payée+hors échéancier ; suppression→retour validée |
| Stock | niveau net = +100−30−5 = 65 ; sorties en négatif |
| Achats | commande CM-0001 → réception → stock +200 ; quantité reçue = 200 |
| Factures fournisseurs | validée→échéancier ; payée→date+hors échéancier ; TTC=240 |
| Règlements fournisseurs | partiel→reste dû ; solde→payée ; écriture 401=512 ; suppression→validée |
| E-invoicing | facture validée → Factur-X CII (`<rsm:CrossIndustryInvoice>`, EN 16931) ; transmission PDP acceptée + journalisée |
| Trésorerie | agrégation reste dû clients (encaissements) + fournisseurs (décaissements), position nette |
| IAM / RLS | isolation société A ≠ société B ; `FORBIDDEN` sans droit |

> Ces scénarios sont **pérennisés** en tests Vitest versionnés (`apps/api/src/tests/*.int.test.ts`,
> config `vitest.integration.config.ts`), idempotents (auto-nettoyage). Commande : `pnpm test:int`
> (nécessite `DATABASE_URL` + base migrée/seedée). **Exécution locale** avant commit ; workflow CI
> présent mais **en standby** (décision projet). **Reste** : mesurer la couverture serveur.

## 4. Environnements
- **Local/démo** : Docker Compose (db+keycloak+app+web), base seedée.
- **CI** (en place) : service Postgres 16 éphémère, `prisma generate` + `migrate deploy` + seed, puis `lint` → `typecheck` → `test:cov` → `test:int` → `build`.

## 5. Données de test
Seed déterministe (`packages/db/prisma/seed.ts`) : compte *Demo Groupe*, 2 sociétés, CRM, référentiels,
pièces démo (facture, devis, commande, facture fournisseur), entrepôt + stock initial.

## 6. Critères d'entrée/sortie
- **Entrée** : build + typecheck verts.
- **Sortie (release)** : tous les tests Must verts, aucun défaut S1/S2 ouvert, RTM à jour.

## 7. Backlog test
1. Mesurer la couverture serveur (routeurs/API) en plus du domaine.
2. Tests UI Playwright des parcours clés (devis→facture→règlement, commande→réception).
3. SAST et analyse de dépendances en CI.
