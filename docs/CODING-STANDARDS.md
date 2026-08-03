# Conventions de code

**Projet :** JAMPACK · **Version :** 1.0

## 1. Langage & style
- **TypeScript strict** partout. Pas de `any` sauf frontière justifiée (commentée `eslint-disable`).
- Nommage métier en **français** (domaine), API/technique en anglais (cohérent avec l'existant).
- Fins de ligne **LF** pour les scripts (`.gitattributes` : `*.sh`, `*.sql` en `eol=lf`).

## 2. Backend (NestJS + tRPC)
- Un **module** métier par domaine (`crm`, `invoice`, `purchases`, `stock`, …), frontières nettes.
- Procédures : `authed(action, subject)` pour toute écriture (CASL) ; `protectedProcedure` pour la lecture ouverte.
- **Toujours** passer par `withTenant(orgId, societeId, tx => …)` (jamais de requête hors contexte RLS).
- Ne jamais manipuler `organizationId` « à la main » pour l'isolation : la base (RLS) garantit.
- Entrées validées par des schémas **Zod** de `packages/domain` (source unique front/back).

## 3. Modèle & migrations
- Montants `Decimal(12,2)`, quantités `Decimal(12,3)` ; **jamais** de flottant monétaire.
- Toute nouvelle table métier : `organizationId` (+ `societeId`), index, et **ajout dans `rls.sql`**
  (enable + `org_isolation` + `societe_isolation`).
- Migration SQL écrite dans le style Prisma existant ; nommage `YYYYMMDDHHMMSS_sujet`.

## 4. Frontend (React + react-bootstrap)
- Composants fonctionnels + hooks tRPC (`trpc.<router>.<proc>.useQuery/useMutation`).
- Gating d'affichage via `useCan(action, subject)` ; le serveur reste l'autorité (défense en profondeur).
- Réutiliser le thème Jampack (variables Bootstrap) ; pas de style inline massif.

## 5. Git & revue
- Branches `feat/…`, `fix/…`, `docs/…`. Commits conventionnels (`feat(scope): …`, `fix(scope): …`).
- Ne jamais committer sur `main` directement ; PR + revue.
- Chaque feature : migration + RLS + router + UI + **permissions CASL** + seed démo + **preuve e2e** + doc (SRS/RTM).

## 6. Définition de « terminé » (DoD)
- `typecheck` + build verts ; e2e du parcours vert ; RLS de toute nouvelle table ; RTM/SRS à jour ;
  seed idempotent ; PR ouverte avec description et preuve.
