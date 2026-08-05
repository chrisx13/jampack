# Runbook — mise en production

Checklist de déploiement d'un environnement JAMPACK **avec données réelles**. À dérouler intégralement.
Réf. sécurité : [SECURITE-REVUE-PROD](SECURITE-REVUE-PROD.md).

## 0. Pré-requis
- Serveur Linux (Docker + Docker Compose), nom de domaine, certificat TLS (Let's Encrypt ou équivalent).
- Un **gestionnaire de secrets** (fichier `.env` hors dépôt a minima ; idéalement Vault/SSM).

## 1. Secrets (⚠️ ne jamais laisser les valeurs de démo)
- [ ] `POSTGRES_PASSWORD` fort et unique.
- [ ] `jampack_app` : mot de passe fort **distinct** (mettre à jour `ALTER ROLE jampack_app PASSWORD '…'` + `DATABASE_URL_APP`).
- [ ] Keycloak : admin fort (pas `admin/admin`), politique de mot de passe, **MFA** sur les comptes admin.
- [ ] Aucune valeur secrète dans le dépôt Git.

## 2. Authentification
- [ ] `AUTH_DEV_STUB="false"` sur **chaque** service API (déjà en `docker-compose.yml` — **vérifier**).
- [ ] `OIDC_ISSUER` / `OIDC_JWKS_URL` en **`https://`** (Keycloak derrière TLS).
- [ ] Realm Keycloak : durée de session, refresh, verrouillage après échecs, e-mails vérifiés.

## 3. Réseau / TLS
- [ ] Terminaison **TLS** (reverse proxy) ; redirection 80→443 ; **HSTS**.
- [ ] CORS API restreint : définir **`WEB_ORIGIN`** (origine(s) du front) sur le service API (sinon réflexion = dev).
- [ ] En-têtes de sécurité : posés par nginx **et** l'API (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, CSP) ; ajouter **HSTS** avec le TLS.
- [ ] **Rate-limiting** sur `/trpc/publicQuote.*` (route publique) — ex. nginx `limit_req_zone`.

## 4. Base de données
- [ ] Migrations appliquées : `prisma migrate deploy` (au boot via l'entrypoint).
- [ ] **RLS appliqué** : `rls.sql` exécuté (entrypoint) ; vérifier via `rls-isolation.int.test.ts` sur une copie.
- [ ] `GRANT` à `jampack_app` sur toutes les tables (entrypoint).
- [ ] **Sauvegardes** : planifier `scripts/db-backup.sh` (cron), rétention `KEEP_DAILY` (défaut 7), **stockage hors serveur** (règle 3-2-1).
- [ ] **Restauration testée** via `scripts/db-restore.sh` au moins une fois (RTO/RPO documentés).

## 5. Observabilité
- [ ] Logs structurés centralisés ; niveau d'erreur remonté.
- [ ] Métriques (CPU/mémoire/latence) + **alerte** sur 5xx et pics de trafic sur `/devis/*`.
- [ ] Healthcheck des conteneurs (db `pg_isready` déjà présent).

## 6. Conformité (rappel)
- [ ] Sorties fiscales **validées par un expert-comptable** avant émission réelle
  (voir [DOSSIER-CONFORMITE-FISCALE](DOSSIER-CONFORMITE-FISCALE.md)).
- [ ] Mentions légales société renseignées (SIREN/SIRET/TVA/RCS/APE, IBAN).
- [ ] Registre RGPD / durées de conservation documentés (pièces comptables 10 ans).

## 7. Go / No-go
Passer en production **uniquement** si : sections 1–4 cochées **entièrement**, sauvegarde+restauration testées,
et validation expert-comptable obtenue. Sinon → **No-go**.

## 8. Rollback
- Images taguées par version ; `docker compose up -d <service>` sur l'image précédente.
- Migration : ne jamais supprimer de colonne en une étape ; restauration BDD depuis la dernière sauvegarde saine.
