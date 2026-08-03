# Stratégie de test

**Projet :** JAMPACK · **Référentiel :** ISO/IEC/IEEE 29119 · **Statut :** En construction · **Version :** 1.0

## 1. Objectifs
Garantir l'exactitude métier (totaux, numérotation, statuts, intégration achats↔stock), la sécurité
(isolation multi-tenant, autorisation) et la non-régression.

## 2. Niveaux de test
| Niveau | Portée | Outillage cible | État |
|---|---|---|---|
| Statique | Types, contrats | `tsc --noEmit` (5 packages) en CI | ✅ |
| Statique | Style/qualité | ESLint | ⏳ (script présent, hors CI) |
| Composant/intégration | Routeurs tRPC via `createCaller` + DB réelle | Vitest + Postgres éphémère | 🔧 (scripts e2e manuels réalisés) |
| Bout-en-bout UI | Parcours web authentifié | Playwright | ⏳ |
| Sécurité | Isolation RLS, FORBIDDEN | Cas dédiés | 🔧 |

## 3. Preuves déjà produites (callers tRPC, RLS actif)
| Domaine | Scénario vérifié |
|---|---|
| Ventes | devis→sent→accepted→converted ; facture FA-0001 validée ; avoir source=facture ; totaux exacts |
| Règlements | acompte→validée+échéancier ; solde→payée+hors échéancier ; suppression→retour validée |
| Stock | niveau net = +100−30−5 = 65 ; sorties en négatif |
| Achats | commande CM-0001 → réception → stock +200 ; quantité reçue = 200 |
| Factures fournisseurs | validée→échéancier ; payée→date+hors échéancier ; TTC=240 |

> Ces scénarios ont été exécutés comme scripts jetables contre la base de la stack Docker (nettoyés
> après exécution). **Prochaine étape** : les pérenniser en tests Vitest versionnés + DB éphémère en CI.

## 4. Environnements
- **Local/démo** : Docker Compose (db+keycloak+app+web), base seedée.
- **CI** (cible) : Postgres éphémère, `migrate deploy` + `rls.sql`, suite Vitest.

## 5. Données de test
Seed déterministe (`packages/db/prisma/seed.ts`) : compte *Demo Groupe*, 2 sociétés, CRM, référentiels,
pièces démo (facture, devis, commande, facture fournisseur), entrepôt + stock initial.

## 6. Critères d'entrée/sortie
- **Entrée** : build + typecheck verts.
- **Sortie (release)** : tous les tests Must verts, aucun défaut S1/S2 ouvert, RTM à jour.

## 7. Backlog test
1. Wiring Vitest + Postgres éphémère en CI (+ lint).
2. Pérenniser les e2e tRPC ci-dessus.
3. Tests d'isolation (société A ≠ société B) et d'autorisation (FORBIDDEN).
4. Tests UI Playwright des parcours clés (devis→facture→règlement, commande→réception).
