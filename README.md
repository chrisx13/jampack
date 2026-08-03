# JAMPACK

Suite de gestion cloud tout-en-un pour TPE/PME françaises — **CRM · Facturation · Comptabilité · Stock**.
Accessible en **web**, **desktop** (Tauri) et **mobile** (PWA), sur une base de code TypeScript partagée.

> Ce dépôt contient le squelette de la **Phase 0** (fondations) : monorepo, socle multi-tenant
> **multi-société**, RBAC et module CRM de démarrage, au thème officiel **Jampack** (Bootstrap 5).
> Voir *Note de cadrage*, *Architecture technique* et *Charte & stack front*.

## Stack

pnpm + Turborepo · NestJS · PostgreSQL 16 · Prisma · tRPC · Zod · React + Vite ·
**Bootstrap 5 + react-bootstrap** (thème Jampack) · Tauri 2 · CASL (RBAC) · Docker · GitHub Actions.

## Structure

```
apps/
  api/       NestJS + tRPC (backend monolithe modulaire)
  web/       React + Vite + react-bootstrap (UI source unique, réutilisée par desktop & mobile)
  desktop/   Tauri 2 (enveloppe le build web)
packages/
  db/        Schéma Prisma, RLS, seed, client
  domain/    Types + schémas Zod + règles CASL partagés
```

## Démarrage — tout en Docker (recommandé)

Une seule commande lance PostgreSQL, l'API (migrations + RLS + rôle applicatif + seed automatiques) et le web :

```bash
docker compose up --build
# Web       : http://localhost:5173
# API       : http://localhost:3000/trpc
# Keycloak  : http://localhost:8080  (admin / admin)
```

Rien d'autre à installer que Docker. Connexion démo : **admin@demo.fr / admin** (rôles Admin + Comptable
sur la Boulangerie, Commercial sur le Studio) ou **compta@demo.fr / compta** (Comptable, Boulangerie seule).
Pour tout arrêter : `docker compose down` (ajouter `-v` pour effacer la base).

## Démarrage — mode dev (hot-reload)

Prérequis : Node ≥ 20 et pnpm (`corepack enable` suffit).

```bash
corepack enable
pnpm install
docker compose -f docker/docker-compose.yml up -d   # Postgres seul
cp .env.example .env
pnpm --filter @jampack/db exec prisma migrate dev --name init
pnpm db:rls        # active le Row-Level Security
pnpm db:seed       # compte "Demo Groupe" + 2 sociétés + CRM de démo
pnpm dev           # API :3000 + Web :5173 (hot-reload)
```

Pour le desktop, voir `apps/desktop/README.md`.

## Hiérarchie des données

**Compte** (`Organization`, le tenant/abonnement) ▸ **Société** (`Societe`, entité juridique) ▸ données CRM.
Un utilisateur appartient à un compte et gère **plusieurs sociétés** ; il bascule via le sélecteur en
barre du haut, ou passe en vue **consolidée** (toutes les sociétés). Compta et facturation seront
cloisonnées par société (FEC par société).

## Authentification & rôles

Authentification **OIDC via Keycloak** (self-hébergé, service `keycloak` du compose). L'API valide la
signature du jeton contre le JWKS de Keycloak (émetteur + audience vérifiés), sans jamais gérer de mot
de passe — `apps/api/src/auth/oidc.ts`. Sans `OIDC_ISSUER` configuré, un **repli dev** (`AUTH_DEV_STUB`)
laisse tourner l'app sans login.

Les **rôles sont par société et cumulables** (`SocieteRole` : `userId × societeId × roleId`). Un même
utilisateur peut avoir plusieurs rôles dans une société et des rôles différents d'une société à l'autre ;
ses **permissions effectives** dans la société active sont l'**union** de ses rôles. Il ne voit que les
sociétés où il a au moins un rôle. La résolution se fait à la connexion dans `apps/api/src/trpc/context.ts`.

## Multi-tenant & sécurité

Isolation par `organizationId` + **Row-Level Security PostgreSQL** : chaque requête passe par
`withTenant(organizationId, …)` qui positionne `app.current_org` dans la transaction ; les policies
RLS filtrent alors chaque table. La société active est un filtre applicatif au-dessus de cette
isolation. L'API tourne avec un rôle SQL **non-propriétaire** (`jampack_app`) pour que le RLS
s'applique réellement — le setup Docker le crée automatiquement.

## État d'avancement

Fait :

- [x] Authentification OIDC (Keycloak) + rôles par société (cumulables) + isolation RLS.
- [x] Permissions appliquées via CASL côté serveur (mutations → FORBIDDEN) et masquage des actions dans l'UI.
- [x] CRM : pipeline kanban (drag & drop), CRUD clients / contacts / opportunités, établissements & adresses.
- [x] Référentiels : articles/services, catégories, taux de TVA, numérotation des pièces.
- [x] Facturation : factures (brouillon → validée → annulée), calcul TVA, PDF ; affacturage, comptes bancaires et conditions de paiement.
- [x] Chaîne **devis → facture → avoir** : devis (envoi, accepté/refusé, conversion en facture) et avoirs (depuis facture), pièces unifiées par `docType`.
- [x] **Règlements & échéancier** : encaissements rattachés aux factures, statut *payée* automatique, échéancier des factures non soldées.
- [x] **Stock** (Jalon 3) : entrepôts, mouvements (entrée/sortie/ajustement), niveaux calculés, **valorisation PMP**.
- [x] **Achats** (Jalon 3) : commandes fournisseurs (fournisseur = tiers `isSupplier`) → **réception** qui alimente automatiquement le stock ; **factures fournisseurs** + échéancier fournisseur (comptes à payer).
- [x] Personnalisation du thème (couleurs de marque) au niveau du compte.

En cours / à venir (Jalon 2 — Ventes) :

- [ ] E-invoicing **Factur-X / PDP** — réception obligatoire 09/2026 (prioritaire ; dépend du choix d'une PDP partenaire).
- [ ] Interface d'administration : inviter des utilisateurs, gérer sociétés et rôles.
- [ ] `tauri init` pour générer la partie native du desktop ; amorcer la PWA mobile.
- [ ] Fournisseurs & achats (au-delà du flag `isSupplier`).

> État détaillé code ↔ spécifications : [`docs/TRACABILITE.md`](docs/TRACABILITE.md).

## Feuille de route

Phase 0 (socle multi-société) ✓ → CRM ✓ → Référentiels ✓ → **Ventes / facturation** (devis → facture → avoir + règlements/échéancier faits ; e-invoicing Factur-X à venir) → **Stock & Achats** (entrepôts/mouvements/niveaux + commandes fournisseurs → réception faits ; valorisation PMP + factures fournisseurs à venir) → Comptabilité (FEC).
