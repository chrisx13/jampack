# ─────────────────────────────────────────────────────────────
# JAMPACK — image multi-étage (API + build web) pour exécution locale Docker
# ─────────────────────────────────────────────────────────────

# ---- base : monorepo installé + client Prisma généré ----
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="/pnpm:$PATH"
RUN corepack enable \
  && apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @jampack/db exec prisma generate
RUN chmod +x docker/entrypoint.sh

# ---- API (NestJS + tRPC via tsx) ----
FROM base AS api
EXPOSE 3000
CMD ["docker/entrypoint.sh"]

# ---- build du front (Vite) ----
FROM base AS web-build
# Config OIDC injectée au build (Vite fige les VITE_* à la compilation)
ARG VITE_OIDC_AUTHORITY=""
ARG VITE_OIDC_CLIENT_ID="jampack-web"
ENV VITE_OIDC_AUTHORITY=$VITE_OIDC_AUTHORITY
ENV VITE_OIDC_CLIENT_ID=$VITE_OIDC_CLIENT_ID
RUN pnpm --filter @jampack/web build

# ---- Web servi par nginx (proxy /trpc vers l'API) ----
FROM nginx:alpine AS web
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
