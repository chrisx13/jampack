#!/usr/bin/env bash
# CI conteneurisée JAMPACK — rejoue tout le pipeline de validation dans Docker (pas de GitHub Actions).
# Étapes : préparation BDD (migrate + RLS + rôle applicatif + seed) → lint → typecheck →
# tests unitaires (couverture ≥ 90 %) → tests d'intégration (Postgres réel, RLS) → build.
set -euo pipefail

DB_HOST="${DB_HOST:-ci-db}"
DB_PORT="${DB_PORT:-5432}"
export DATABASE_URL="${DATABASE_URL:-postgresql://jampack:jampack@${DB_HOST}:${DB_PORT}/jampack?schema=public}"
PSQL_URL="${DATABASE_URL%%\?*}"          # libpq ne comprend pas « ?schema=public »
APP_PWD="${APP_DB_PASSWORD:-jampack}"

echo "⏳ Attente de PostgreSQL ($DB_HOST:$DB_PORT)…"
until pg_isready -h "$DB_HOST" -p "$DB_PORT" >/dev/null 2>&1; do sleep 1; done

echo "▶ 1/8 Migrations Prisma"
pnpm --filter @jampack/db exec prisma migrate deploy

echo "▶ 2/8 Row-Level Security + rôle applicatif non-propriétaire (pour le test d'isolation RLS)"
psql "$PSQL_URL" -v ON_ERROR_STOP=1 -f packages/db/prisma/rls.sql
psql "$PSQL_URL" -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'jampack_app') THEN
    CREATE ROLE jampack_app LOGIN PASSWORD '${APP_PWD}';
  END IF;
END \$\$;
GRANT USAGE ON SCHEMA public TO jampack_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO jampack_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO jampack_app;
SQL

echo "▶ 3/8 Seed (idempotent)"
pnpm --filter @jampack/db exec tsx prisma/seed.ts

echo "▶ 4/8 Lint (ESLint)"
pnpm lint

echo "▶ 5/8 Typecheck (tsc, 5 packages)"
pnpm typecheck

echo "▶ 6/8 Tests unitaires + couverture (seuil ≥ 90 %)"
pnpm test:cov

echo "▶ 7/8 Tests d'intégration (Postgres réel, RLS actif)"
pnpm test:int

echo "▶ 8/8 Build (front Vite)"
pnpm build

echo "✅ CI Docker : pipeline complet au vert."
