# Revue de sécurité — mise en production

**Objet :** revue ciblée avant tout usage avec des **données réelles**. Complète [SECURITE-RGPD](SECURITE-RGPD.md).
**Méthode :** lecture du code (auth, contexte, route publique, serveur) + configuration (`docker-compose.yml`,
`nginx.conf`). **Statut :** à traiter avant prod.

## Synthèse des constats
| # | Constat | Gravité | Correctif recommandé |
|---|---|---|---|
| S1 | Route publique non authentifiée `/devis/:token` sans limitation de débit | Élevée | **✅ baseline en place** : `limit_req` nginx (`publicQuote.*` = 10 r/min, burst 5). À compléter en prod : verrouillage après N échecs. Jeton déjà non devinable (24 octets). |
| S2 | CORS | Moyenne | **✅ traité** : CORS restreint à `WEB_ORIGIN` (liste d'origines) si la variable est définie ; réflexion seulement en dev. `x-powered-by` désactivé, en-têtes de sécurité posés aussi côté API. |
| S3 | En-têtes de sécurité | Moyenne | **✅ baseline en place** : `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` (nginx). À compléter : **CSP** stricte + **HSTS** (avec TLS). |
| S4 | **Secrets par défaut faibles** : `POSTGRES_PASSWORD=jampack`, `jampack_app` même mot de passe, admin Keycloak `admin/admin` | Élevée | Secrets forts injectés (gestionnaire de secrets / `.env` hors dépôt) ; rotation |
| S5 | **Repli DEV d'authentification** (`AUTH_DEV_STUB`) — stub « manage all » sans jeton | Critique **si activé** | ✅ déjà `AUTH_DEV_STUB="false"` dans `docker-compose.yml` ; **vérifier** qu'il l'est sur chaque environnement réel |
| S6 | **OIDC en HTTP** (`OIDC_ISSUER=http://localhost:8080`) | Élevée | Keycloak derrière **HTTPS**, issuer/JWKS en `https://`, realm durci (MFA admin, politiques de mot de passe) |
| S7 | **Pas de TLS applicatif** (nginx sert en HTTP dans la stack de démo) | Élevée | Terminaison **TLS** (reverse proxy / certificats), redirection 80→443, HSTS |
| S8 | Sauvegardes | Élevée | **✅ outillé** : `scripts/db-backup.sh` (dump compressé + rotation) et `scripts/db-restore.sh`. À **planifier** (cron), **stocker hors serveur** et **tester** régulièrement. |
| S9 | **Journalisation/supervision** minimales | Moyenne | Logs structurés, métriques, alerte sur erreurs 5xx et pics sur `/devis/*` |
| S10 | **PDF via Chromium (Playwright)** rend du HTML échappé | Faible | ✅ échappement en place (`esc`) ; garder `--no-sandbox` isolé, pas d'entrée utilisateur non échappée |

## Points positifs (déjà en place)
- **Isolation multi-tenant RLS réelle** : rôle applicatif `jampack_app` **sans BYPASSRLS**, policies compte + société,
  **prouvée par test d'intégration** (`rls-isolation.int.test.ts`).
- **Route publique restreinte par jeton via RLS** (`public_quote_token` + policies société/client en lecture seule) :
  une requête publique ne voit **que** la pièce du jeton.
- **CASL** serveur (`authed`) sur chaque mutation sensible ; **journal d'audit** des mutations.
- **RGPD** : anonymisation, export, purge, droits d'opposition/limitation.
- **Paramètres liés** (pas d'injection SQL) via `set_config` et Prisma.

## Actions prioritaires (avant données réelles)
1. **S4/S5/S6/S7** — secrets forts, `AUTH_DEV_STUB=false` vérifié, **HTTPS partout** (app + Keycloak).
2. **S1** — rate-limiting sur `/devis/*` (nginx `limit_req` recommandé, ou middleware applicatif).
3. **S8** — sauvegardes planifiées + **restauration testée**.
4. **S2/S3/S9** — CORS restreint, Helmet/CSP/HSTS, supervision.

> Ces correctifs relèvent surtout de la **configuration de déploiement** (hors code applicatif) et de secrets ;
> ils sont détaillés en checklist dans [RUNBOOK-PRODUCTION](RUNBOOK-PRODUCTION.md).
