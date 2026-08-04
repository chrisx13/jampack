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
| ADR-8 | E-invoicing : génération **Factur-X (CII/EN 16931)** + **connecteur PDP** abstrait (adaptateur interne + partenaire branchable), journal `PdpTransmission`. Immatriculation DGFiP / raccordement PPF / e-reporting **hors périmètre logiciel** | Actée (connecteur ✅ ; voie réglementaire ⤵ ouverte) |

### Décisions ouvertes (à prendre)
Ces choix ne sont pas encore tranchés ; ils sont suivis ici et dans les documents liés.

| # | Décision à prendre | Impact | Où |
|---|---|---|---|
| DO-1 | **Voie PDP réglementaire** : s'immatriculer PDP (DGFiP + raccordement PPF, e-reporting) **ou** brancher une **PDP partenaire** sur le connecteur existant | Conformité e-invoicing 2026-2027 | [Conformité §3.1](CONFORMITE.md), `apps/api/src/invoice/pdp.ts` |
| DO-2 | **API publique REST/OpenAPI** en complément de tRPC (intégrations tierces) | Écosystème/partenaires | ADR-3 |
| DO-3 | **Hébergeur UE définitif** (Scaleway vs OVHcloud) | RGPD, exploitation | [Runbook](RUNBOOK.md) |
| DO-4 | **Rapprochement bancaire** : import de relevés (format, source) ↔ écritures 512 | Compta/trésorerie | [Traçabilité §5](TRACABILITE.md) |
| DO-5 | **Stock** : valorisation **FIFO** + **lots/n° série** (aujourd'hui PMP) | Stock avancé | [Traçabilité §5](TRACABILITE.md) |
| DO-6 | **Rapprochement 3 voies** achats (commande ↔ réception ↔ facture) | Contrôle achats | SRS FR-ACH-7 |

## 3. Vue de contexte (C4 niveau 1)
```
Utilisateur ─▶ SPA React (nginx) ─▶ API NestJS/tRPC ─▶ PostgreSQL 16 (RLS)
                    │                     │
                    └── OIDC ──▶ Keycloak ┘
Sortant : Factur-X (CII) généré en interne ─▶ connecteur PDP (adaptateur interne ; PDP partenaire branchable)
Externe (à venir) : PPF/PDP agréée (dépôt/e-reporting — hors code), expert-comptable (FEC)
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
(devis/facture/avoir + paiements + **Factur-X/PDP**) · `purchases` (commandes, réceptions, factures
**et règlements** fournisseurs) · `stock` · `accounting` (journaux, écritures auto, lettrage, TVA/CA3,
FEC) · `analytics` (**trésorerie**, KPI) · `societe` · `iam` · `settings` · `billing`.
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
- CI complète (lint → typecheck → `test:cov` ≥ 90 % → `test:int` → build) — voir `.github/workflows/ci.yml`.
- `InvoiceLine`/lignes filles hors RLS société propre (accès via pièce parente protégée) — TODO.
- E-invoicing : le connecteur PDP interne **ne vaut pas PDP agréée** tant que l'immatriculation DGFiP /
  raccordement PPF n'est pas réalisé (voir DO-1, [Conformité §3.1](CONFORMITE.md)).
