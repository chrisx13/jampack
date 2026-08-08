# Runbook & DevOps

**Projet :** JAMPACK · **Statut :** En revue · **Version :** 1.0

## 1. Démarrage — démo/dev (tout en Docker)
```bash
docker compose up --build
# Web http://localhost:5173 · API http://localhost:3000/trpc · Keycloak http://localhost:8080 (admin/admin)
# Connexion démo : admin@demo.fr / admin  ·  compta@demo.fr / compta
```
L'entrypoint de `app` applique automatiquement : migrations → RLS → rôle `jampack_app` → seed → API.
Arrêt : `docker compose down` (ajouter `-v` pour réinitialiser la base).

## 2. Dev hot-reload
```bash
corepack enable && pnpm install
docker compose -f docker/docker-compose.yml up -d      # Postgres (+ Adminer)
cp .env.example .env
pnpm --filter @jampack/db exec prisma migrate deploy
pnpm db:rls && pnpm db:seed
pnpm dev                                                # API + Web
```

## 3. Séquence de boot de l'API (conteneur)
`docker/entrypoint.sh` : attend Postgres → `prisma migrate deploy` → `psql -f rls.sql` → crée/greffe le
rôle `jampack_app` → seed idempotent → lance l'API (via `tsx`, rôle applicatif, RLS actif).

## 4. Variables d'environnement clés
| Variable | Rôle |
|---|---|
| `DATABASE_URL_OWNER` / `DATABASE_URL_APP` | Connexions propriétaire (migrations) / applicative (RLS) |
| `AUTH_DEV_STUB` | `false` en prod (jeton OIDC exigé) |
| `OIDC_ISSUER` / `OIDC_JWKS_URL` / `OIDC_AUDIENCE` | Validation des jetons |
| `VITE_OIDC_AUTHORITY` / `VITE_OIDC_CLIENT_ID` | Config OIDC front (figée au build Vite) |

## 5. Exploitation
- **Sauvegardes** : base managée avec sauvegardes chiffrées (quotidiennes / PITR selon offre). Tester
  la restauration périodiquement.
- **Migrations en prod** : `prisma migrate deploy` (jamais `migrate dev`). RLS (`rls.sql`) rejoué (idempotent).
- **Rôle applicatif** : l'API ne doit jamais tourner sous le propriétaire des tables (sinon RLS contourné).

## 6. Supervision (cible)
- Endpoint de santé, métriques (latence P95, taux d'erreur), logs structurés, alerte S1/S2.

## 7. Incidents (procédure)
1. Qualifier la sévérité (voir [SLA](SLA.md) §4).
2. S1 : bascule/restauration selon RTO/RPO ; communiquer.
3. Post-mortem : cause racine, correctif, mise à jour du [Registre des risques](RISK-REGISTER.md).

## 8. Pièges connus (déjà rencontrés)
| Symptôme | Cause | Correctif |
|---|---|---|
| API `exit 127` au boot | `entrypoint.sh` en CRLF | `.gitattributes` LF sur `*.sh` |
| `psql: invalid URI query parameter "schema"` | URL Prisma passée à psql | strip `?schema=...` pour psql |
| API `tsx not found` | tsx absent de `@jampack/api` | exécuter via le tsx de `@jampack/db` |
| Web `502` / nginx `host not found "app"` | upstream résolu au boot | `resolver` DNS Docker + variable |
| Vues inaccessibles < 992px | media query masquait le panneau | overlay + modes épinglé/à la volée |

## 9. CI (conteneurisée — Docker)
La CI **tourne sur Docker** (pas de GitHub Actions). Un Postgres éphémère + un runner rejouent tout le
pipeline : `migrate deploy → rls.sql + rôle applicatif → seed → lint → typecheck → test:cov (unit ≥ 90 %)
→ test:int (Postgres réel, RLS) → build`.

```bash
scripts/ci.sh
# ou : docker compose -f docker-compose.ci.yml up --build --abort-on-container-exit --exit-code-from ci
```

Le code de sortie du conteneur `ci` est propagé (échec = rouge). Voir `ci/run.sh`, `docker-compose.ci.yml`
et la cible Docker `ci`. **À compléter** : SAST, déploiement UE automatisé.
