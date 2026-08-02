#!/usr/bin/env bash
# Entrypoint de l'API en conteneur : prépare la base puis démarre l'API.
set -e

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
OWNER_URL="${DATABASE_URL_OWNER:?DATABASE_URL_OWNER manquant}"
APP_URL="${DATABASE_URL_APP:?DATABASE_URL_APP manquant}"
APP_PWD="${APP_DB_PASSWORD:-jampack}"

echo "⏳ Attente de PostgreSQL ($DB_HOST:$DB_PORT)…"
until pg_isready -h "$DB_HOST" -p "$DB_PORT" >/dev/null 2>&1; do sleep 1; done

echo "▶ Migrations Prisma…"
DATABASE_URL="$OWNER_URL" pnpm --filter @jampack/db exec prisma migrate deploy

echo "▶ Row-Level Security…"
psql "$OWNER_URL" -v ON_ERROR_STOP=1 -f packages/db/prisma/rls.sql

echo "▶ Rôle applicatif non-propriétaire + droits…"
psql "$OWNER_URL" -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'jampack_app') THEN
    CREATE ROLE jampack_app LOGIN PASSWORD '${APP_PWD}';
  END IF;
END \$\$;
GRANT USAGE ON SCHEMA public TO jampack_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO jampack_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO jampack_app;
SQL

echo "▶ Seed (idempotent)…"
DATABASE_URL="$OWNER_URL" pnpm --filter @jampack/db exec tsx prisma/seed.ts || echo "seed ignoré"

echo "🚀 API JAMPACK (rôle applicatif, RLS actif)"
export DATABASE_URL="$APP_URL"
exec pnpm --filter @jampack/api exec tsx src/main.ts
