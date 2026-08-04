# SAD — Document d'architecture logicielle

**Projet :** JAMPACK · **Référentiel :** ISO/IEC/IEEE 42010 · **Statut :** En revue · **Version :** 1.0

> Complète le document historique *Architecture technique JAMPACK* (`.docx`) et acte les décisions réelles.

## 1. Facteurs déterminants (drivers)
Développeur unique visant un produit ambitieux → **productivité et réutilisation** priment. Conformité
France et isolation multi-tenant **dans les fondations**. Séquencement strict par jalons.

## 2. Décisions d'architecture (ADR — synthèse)
| ADR | Décision | Statut |
|---|---|---|
| ADR-1 | Monolithe **modulaire** (pas de microservices au départ) | Actée |
| ADR-2 | Stack **100 % TypeScript** partagée (back → front) | Actée |
| ADR-3 | API **tRPC** type-safe (REST/OpenAPI ajouté plus tard si API publique) | Actée |
| ADR-4 | Multi-tenant = **base partagée + RLS PostgreSQL** (rôle app non-propriétaire) | Actée |
| ADR-5 | Auth **Keycloak (OIDC)** (retenu vs better-auth) | Actée |
| ADR-6 | Front **Bootstrap 5 + react-bootstrap** (thème Jampack) — remplace Tailwind/shadcn | Actée |
| ADR-7 | UI unique React réutilisée par desktop (Tauri) et mobile (PWA) | Actée (desktop/PWA ⏳) |

## 3. Vue de contexte (C4 niveau 1)
```
Utilisateur ─▶ SPA React (nginx) ─▶ API NestJS/tRPC ─▶ PostgreSQL 16 (RLS)
                    │                     │
                    └── OIDC ──▶ Keycloak ┘
Externe (à venir) : PDP agréée (Factur-X), expert-comptable (FEC)
```

## 4. Vue conteneurs (C4 niveau 2)
| Conteneur | Techno | Rôle |
|---|---|---|
| `web` | React + Vite, servi par nginx | SPA + proxy `/trpc` → API |
| `app` | NestJS + tRPC (via tsx) | API métier, autorisation CASL, transactions RLS |
| `db` | PostgreSQL 16 | Données, Row-Level Security |
| `keycloak` | Keycloak 26 | Fournisseur d'identité OIDC |

## 5. Vue composants (backend)
`apps/api/src/` : `auth` (OIDC) · `trpc` (contexte, routeur racine) · `crm` · `catalog` · `invoice`
(devis/facture/avoir + paiements) · `purchases` (commandes, réceptions, factures fournisseurs) ·
`stock` · `societe` · `iam` · `settings` · `billing`.
Packages partagés : `packages/db` (Prisma, RLS, seed, `withTenant`) · `packages/domain` (Zod, CASL, droits).

## 6. Vue données & isolation
Voir [Modèle de données](DATA-MODEL.md). Chaque requête ouvre une transaction et positionne
`app.current_org` (+ `app.current_societe`) ; les policies RLS filtrent. L'API se connecte sous le rôle
non-propriétaire `jampack_app`.

## 7. Vue déploiement
Docker Compose (dev et démo) : `db + keycloak + app + web`. L'entrypoint de `app` applique au boot :
migrations Prisma → RLS → rôle applicatif → seed → démarrage API. Cible prod : hébergeur UE, PostgreSQL
managé, secrets en variables d'environnement. Voir [Runbook](RUNBOOK.md).

## 8. Attributs qualité (tactiques)
| Attribut | Tactique |
|---|---|
| Sécurité | RLS + rôle non-propriétaire ; CASL ; OIDC ; secrets hors dépôt |
| Maintenabilité | Types/Zod partagés ; modules à frontières nettes ; monorepo Turborepo |
| Fiabilité | Transactions ; `Decimal` monétaire ; numérotation atomique |
| Portabilité | Conteneurs ; migration multi-tenant possible |
| Performance | Index par `organizationId`/`societeId` ; requêtes ciblées |

## 9. Risques techniques & dette
- tsx en exécution (pas de build JS de l'API) — acceptable, à réévaluer pour la prod.
- CI sans lint/tests — à compléter.
- `InvoiceLine`/lignes filles hors RLS société propre (accès via pièce parente protégée) — TODO.
