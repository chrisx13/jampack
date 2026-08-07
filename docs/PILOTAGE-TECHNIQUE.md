# Console super-admin de pilotage technique

**Objet :** réaliser les actions d'exploitation **sans SSH ni console de tiers** (hébergement, base…)
depuis l'application, via un **catalogue d'opérations prédéfinies**. **Statut : socle livré.**

## Principe de sécurité (non négociable)
- **Aucun shell arbitraire.** Seules des **opérations enregistrées** (catalogue) sont exposées.
- Chaque opération porte : **niveau de danger** (sûre / attention / sensible), **avertissements**,
  paramètres **validés**, support du **dry-run**, et — pour les actions sensibles — une **confirmation
  typée** (jeton à saisir, ex. `RESTAURER`, `RESEED`, `REDEMARRER`).
- Accès réservé au droit CASL **`manage Ops`** (rôle super-admin).
- **Journal d'audit** systématique (`OpsExecution`, append-only, RLS org) : qui, quelle opération,
  cible, dry-run ou réel, résultat.

## Deux natures d'opérations
| Nature | Exécution | Exemples | Runner |
|---|---|---|---|
| **En ligne (sûre)** | en-process / requêtes BDD en lecture | `app.info`, `db.health`, `migrations.status`, `rls.verify` | aucun |
| **Hôte** | nécessite un accès système | `db.backup`, `db.restore`, `demo.reseed`, `app.restart` | **`OPS_HOST_RUNNER`** (désactivé par défaut) |

Les opérations **hôte** sont **bloquées par défaut** : le **dry-run** décrit ce qui serait fait ; en
réel, tant qu'aucun runner n'est configuré, l'opération renvoie `blocked` (aucune commande lancée).
Ce socle **ne lance délibérément aucune commande hôte** — l'activation du runner est une étape
d'infrastructure ultérieure, à cadrer (privilèges, isolation).

## Périmètre : instance **et** flotte
La cible d'exécution est abstraite (`target`, défaut `local`). Le socle agit sur **l'instance
courante** ; l'ajout d'instances distantes (flotte SaaS) réutilisera le même catalogue + audit via un
**exécuteur distant** par instance (à venir).

## Composants
- **Domaine (pur, testé)** : `opsCatalog.ts` — catalogue, validation des paramètres, confirmation typée.
- **API** : `ops.router` (`catalogue` / `run` / `history`, gated `manage Ops`) + `executor.ts`
  (opérations sûres ; opérations hôte bloquées).
- **Web** : *Administration ▸ Pilotage technique* — catalogue par catégorie, modal d'exécution
  (avertissements, dry-run, confirmation, résultat), historique.

## Tests
- Unitaires : `opsCatalog.test.ts` (9) — métadonnées, validation, confirmation typée, dry-run.
- Intégration : `ops.int.test.ts` (10) — catalogue, opérations sûres, refus sans confirmation,
  dry-run d'une opération hôte, blocage réel, audit.
