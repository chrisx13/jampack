# Console super-admin de pilotage technique

**Objet :** réaliser les actions d'exploitation **sans SSH ni console de tiers** (hébergement, base…)
depuis l'application, via un **catalogue d'opérations prédéfinies**. **Statut : socle livré.**

## Deux niveaux de super-admin
| Niveau | Qui | Droit | Peut |
|---|---|---|---|
| **Technicien d'instance** | technicien de la structure cliente | `manage:Ops` | gérer **toute la conf de SON instance** ; **révéler** les clés en clair ; basculer **prod/test** ; opérations d'instance |
| **Général (JAMPACK)** | société JAMPACK (opérateur flotte) | `manage:PlatformOps` | **pousser** de la conf/clés vers les instances (secrets **tronqués**, jamais en clair) ; **générer des instances** ; basculer **prod/test** |

Le mécanisme des **clés** est identique partout : `secret=true` → chiffré au repos (si `SECRETS_KEY`),
**révélable en clair par le technicien** de l'instance, **tronqué** pour le général ; `secret=false`
→ réglage visible en clair par les deux niveaux. Le général peut **positionner** une clé sans jamais
la relire en clair.

## Capacités
- **Configuration & clés** (`config.*`) : gestion intégrale de la conf d'instance (réglages + secrets),
  avec la visibilité à deux niveaux ci-dessus.
- **Diagnostic** (`ops.diagnostics`) : détection des **défauts de configuration** (auth de dév en prod,
  migrations/RLS, chiffrement des secrets, CORS, sauvegardes, identifiants légaux…), triés par gravité,
  avec remédiation. Portée : instance courante (agrégat flotte à venir pour le général).
- **Mode d'instance** (`instance.status` / `instance.setMode`) : bascule **test ↔ prod** (passage en
  prod = confirmation typée « PROD »), auditée. Accessible aux deux niveaux.
- **Provisionnement** (`instance.provision`, catalogue, `tier=platform`) : génération d'une instance —
  réservé au général, opération hôte **bloquée par défaut** (orchestrateur de flotte à venir).

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
