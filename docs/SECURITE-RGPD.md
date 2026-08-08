# Sécurité & RGPD

**Projet :** JAMPACK · **Aligné :** RGPD (UE 2016/679), loi Informatique et Libertés (78-17), référentiels CNIL, ISO/IEC 27001 (contrôles) · **Statut :** En revue · **Version :** 1.1

---

## 1. Principes de sécurité
- **Défense en profondeur** : authentification (OIDC) → autorisation (CASL) → isolation base (RLS).
- **Sécurité par construction** : l'isolation multi-tenant ne repose pas sur la discipline du code mais
  sur la base de données (Row-Level Security), l'API tournant sous un rôle SQL **non-propriétaire**.
- **Moindre privilège** : rôles par société, permissions minimales par défaut.
- **Secrets hors dépôt** : uniquement en variables d'environnement de la plateforme.

## 2. Authentification & autorisation
| Contrôle | Mise en œuvre |
|---|---|
| Authentification | OIDC (Keycloak) ; l'API valide signature (JWKS), émetteur et audience — `apps/api/src/auth/oidc.ts` |
| Sessions | Jeton porté par le client, jamais persisté côté serveur |
| Autorisation | CASL sur chaque mutation (serveur) + masquage UI — `packages/domain/src/ability.ts` |
| Rôles | Par société, cumulables ; résolus à la connexion — `apps/api/src/trpc/context.ts` |

## 3. Isolation des données (multi-tenant)
- **Compte** : policy `org_isolation` (`organizationId = app.current_org`) sur chaque table métier.
- **Société** : policy restrictive `societe_isolation` (`societeId = app.current_societe`).
- Contexte positionné par transaction via `withTenant()` (paramètre lié, pas d'injection).
- Rôle applicatif `jampack_app` non-propriétaire → le RLS s'applique réellement.
- Les **notes de vue** (`ViewNote` org+société, `ViewNoteRevision` org) sont soumises aux mêmes policies :
  un pense-bête n'est visible que dans son compte et sa société.
- **Signature en ligne du devis** : une policy permissive `public_quote_token` (+ `public_quote_societe`/
  `public_quote_company` en lecture) autorise l'accès **à la seule pièce** dont le jeton correspond à
  `app.public_quote_token` — sans contexte tenant. Le jeton (24 octets aléatoires) est non devinable ;
  l'acceptation conserve **nom, horodatage et IP** comme preuve (`withPublicToken`, `publicQuote.router`).
- **Pilotage super-admin — isolation absolue** : le niveau effectif dépend de l'hébergement
  (`InstanceConfig.HOSTING_MODE`). Sur une instance **hors hébergement JAMPACK** (`self`, serveur du
  client), le super-admin **général JAMPACK n'a AUCUN accès effectif** — et un tel serveur n'a de toute
  façon aucun principal `manage:PlatformOps`. Sur une instance hébergée (`jampack`), le technicien de
  structure n'existe pas. Réf. `apps/api/src/ops/tier.ts` (`resolveTier`).
- Référence : `packages/db/prisma/rls.sql`, `packages/db/src/index.ts`.

## 4. Protection des données en transit et au repos
- **Transit** : TLS (terminaison au niveau de l'hébergeur/ingress).
- **Repos** : chiffrement disque de la base managée + sauvegardes chiffrées.
- **Secrets d'instance** (`InstanceConfig`, `secret=true`) : **chiffrés au repos en applicatif**
  (AES-256-GCM) dès que `SECRETS_KEY` est défini ; **jamais renvoyés en clair** au super-admin général
  (valeurs **tronqués**, `maskSecret`) ; **révélation** réservée au technicien de l'instance, explicite.
  L'absence de `SECRETS_KEY` (stockage en clair) est **signalée par le diagnostic** de configuration.
  Réf. `apps/api/src/ops/crypto.ts`.
- **Données sensibles** : jamais dans les URL/query strings ; pas de secrets en clair.

## 5. RGPD / CNIL

Produit **franco-français** : le RGPD (UE 2016/679), la **loi Informatique et Libertés** (n° 78-17
modifiée) et les **lignes directrices / référentiels de la CNIL** s'appliquent pleinement. Le CRM traite
des **données personnelles** (contacts des tiers, utilisateurs) ; la conformité est posée *by design*.

### 5.1 Rôles et responsabilités
- **Responsable de traitement** : le **client** (compte) pour les données de ses tiers, contacts et
  prospects (il en définit finalités et durées).
- **Sous-traitant** (art. 28) : **l'éditeur JAMPACK** (hébergement, exploitation, maintenance). Un
  **contrat de sous-traitance** (DPA) encadre les instructions, la sécurité, la confidentialité, l'aide
  aux droits et la restitution/suppression en fin de contrat.
- **DPO** : désignation non obligatoire pour ce profil (pas de suivi régulier à grande échelle ni de
  données sensibles), mais **recommandée** ; à défaut, un point de contact « données personnelles ».

### 5.2 Registre des traitements (art. 30)
| Traitement | Données personnelles | Finalité | Base légale (art. 6) | Conservation |
|---|---|---|---|---|
| Comptes utilisateurs (IdP) | email, nom | Authentification, accès, RBAC | Contrat | Durée du contrat + purge |
| CRM — contacts clients | nom, prénom, email, téléphone | Relation commerciale | Contrat / intérêt légitime | Relation + **3 ans** après dernier contact |
| CRM — prospects | nom, email, téléphone | Prospection commerciale | Intérêt légitime (opposition possible) | **3 ans** en base active (réf. CNIL) |
| CRM — activités / notes | contenu libre, échéances | Suivi des échanges | Intérêt légitime | Idem contact |
| Établissements / adresses | email, téléphone, adresse | Facturation, livraison | Contrat / obligation légale | Idem tiers |
| Facturation / comptabilité | identité tiers, montants | Obligation comptable et fiscale | **Obligation légale** | **10 ans** (prévaut sur l'effacement) |
| Journal d'audit | userId, action, horodatage | Sécurité, traçabilité | Intérêt légitime | **12 mois** (cible) |
| Journal des opérations (`OpsExecution`) | userId, opération, cible | Sécurité, exploitation | Intérêt légitime | À définir (append-only) |
| E-invoicing (transmission PDP) | données de facture | Obligation légale (e-invoicing) | Obligation légale | Selon PDP / 10 ans |
| **Reconnaissance de documents — IA** (option niveau 2, **désactivée par défaut**) | contenu du document (texte/image) transmis à **Anthropic** | Assistance à la saisie (facture/frais) | Intérêt légitime + **consentement/CCT** (transfert hors UE) | Non conservé par JAMPACK ; usage tracé (`AiCreditLedger`) — cf. §5.6/5.7 |

### 5.3 Principes (art. 5) & privacy by design/default (art. 25)
- **Minimisation** : seules les données utiles à la gestion sont collectées (pas de données sensibles
  art. 9, pas de profilage). **Exactitude** : édition/rectification en libre-service.
- **Protection par défaut** : isolation multi-tenant par **RLS**, RBAC au moindre privilège, secrets hors
  dépôt, pas de données personnelles dans les URL/logs applicatifs.

### 5.4 Durées de conservation (référentiel CNIL « gestion commerciale »)
- **Prospects** : 3 ans à compter du dernier contact (base active) puis suppression/anonymisation.
- **Clients** : durée de la relation + 3 ans (prospection) ; **pièces comptables 10 ans** (obligation).
- **Journal d'audit** : 12 mois (cible ; configurable — voir §6).
- **Aide à la purge** : la vue *Administration ▸ Purge RGPD* (`crm.companies.purgeCandidates`) liste les tiers
  sans activité depuis > 3 ans, à anonymiser. Purge **planifiée automatique** = suivi (⏳).

### 5.5 Droits des personnes (art. 15-22)
| Droit | Mécanisme dans JAMPACK | État |
|---|---|---|
| Accès / portabilité | **Export JSON** des données détenues sur un tiers (`crm.companies.exportData`, bouton « Export RGPD » sur la fiche client) | ✅ |
| Rectification | Édition en libre-service (fiches tiers/contacts) | ✅ |
| Effacement (art. 17) | **Anonymisation** du tiers (`crm.companies.anonymize` : identité + contacts effacés) **en conservant les pièces comptables** (réserve légale 10 ans) | ✅ |
| Opposition (prospection) | Drapeau **« ne pas prospecter »** (`Company.doNotProspect`, art. 21) | ✅ |
| Limitation (art. 18) | Drapeau **« traitement limité »** (`Company.processingRestricted`) : données gelées, **aucune nouvelle pièce** (rejet à la création) | ✅ |
- **Réserve légale** : les factures (valeur comptable) sont conservées 10 ans et ne peuvent être effacées
  avant terme — l'effacement porte alors sur les données non nécessaires à l'obligation.

### 5.6 Sous-traitance (art. 28) & sous-traitants ultérieurs
- **Hébergeur UE** (OVHcloud / Scaleway / Clever Cloud) : sous-traitant ultérieur, DPA + résidence UE.
- **Fournisseur d'identité** (Keycloak auto-hébergé par l'éditeur) : traité dans le même périmètre.
- **PDP partenaire** (si retenue — DO-1) : sous-traitant pour la transmission des factures ; DPA requis.
- **Anthropic (Claude)** — **uniquement si** l'enrichissement IA (niveau 2 de la reconnaissance de
  documents) est **activé** (désactivé par défaut) : sous-traitant ultérieur ; le document (texte/image)
  lui est transmis. Fournisseur **hors UE** → voir §5.7. DPA + clause à mettre en place avant activation.
- Tenir à jour la **liste des sous-traitants** et informer le client de tout changement.

### 5.7 Transferts hors UE
- **Résidence UE obligatoire** ; **aucun transfert hors UE** par défaut. Tout sous-traitant doit être UE
  (ou encadré par des garanties appropriées — à proscrire ici pour un produit franco-français).
- **Exception encadrée — IA (Anthropic, hors UE)** : le niveau 2 de la reconnaissance de documents est
  **désactivé par défaut** ; le **niveau 1 traite tout localement** (aucun transfert). L'activation
  implique un transfert hors UE → **garanties appropriées (CCT) + DPA + information des personnes**
  requis, et usage **mesuré** (`AiCreditLedger`). Voir [RECONNAISSANCE-DOCUMENTS](RECONNAISSANCE-DOCUMENTS.md).

### 5.8 Information des personnes (art. 13/14)
- **Politique de confidentialité** et mentions d'information à fournir (responsable = le client) ; JAMPACK
  fournit le gabarit et les emplacements (CGV, pied de facture). ⏳ à outiller.

### 5.9 Cookies & traceurs (ePrivacy / lignes directrices CNIL)
- SaaS **B2B derrière authentification** : seuls des **cookies strictement nécessaires** (session,
  préférence de thème) — **pas de traceurs marketing ni de mesure d'audience tierce** → pas de bandeau de
  consentement requis en l'état. À réévaluer si ajout d'analytics.

### 5.10 Violation de données (art. 33/34)
- Procédure : détection → qualification → **notification CNIL sous 72 h** si risque pour les personnes →
  information des personnes si risque élevé → **registre des violations**. Le journal d'audit et la
  supervision alimentent la détection. Procédure formelle à documenter (⏳).

### 5.11 DPIA / AIPD (art. 35)
Une AIPD est requise en cas de risque élevé. Périmètre actuel (données de gestion B2B, **pas de données
sensibles** art. 9, **pas de profilage**) : AIPD **allégée** suffisante ; à refaire si ajout de scoring,
profilage, décision automatisée ou données sensibles.

## 6. Journalisation & audit
- **✅ Implémenté** : un middleware tRPC journalise chaque **mutation** réussie (utilisateur, action = chemin
  de la procédure, société active, horodatage, référence de la pièce) dans `AuditLog` (isolé par compte, RLS).
  Consultable dans **Administration ▸ Journal d'audit**. Non bloquant (une erreur d'audit n'échoue pas l'opération).
- **✅ Opérations de pilotage** : chaque exécution (réelle ou simulée) et changement de mode/hébergement
  est tracé dans `OpsExecution` (**append-only**, RLS org : qui, opération, cible, dry-run/réel, résultat).
  L'usage IA est tracé dans `AiCreditLedger`.
- Reste : immuabilité renforcée (append-only strict / signature), purge/rétention configurable.

## 7. Gestion des vulnérabilités
- **Audit des dépendances** (`pnpm audit`, script `security:audit`) : correctifs des transitives
  vulnérables **runtime** forcés via `pnpm.overrides` (body-parser, qs, nanoid, multer, tmp, glob,
  file-type) → **27 → 14** vulnérabilités (hautes 9→2). Le reliquat est **dev-only** (vite/vitest/esbuild,
  bumps majeurs) sans impact sur la production (qui sert des **fichiers statiques** derrière nginx).
- **SAST statique** (`eslint-plugin-security`, offline) intégré au lint : détecte `child_process`/`eval`/
  `require` dynamique, buffers non sûrs, PRNG faible, caractères bidi et **regex ReDoS** — appliqué au
  parsing de **contenu utilisateur** (reconnaissance de documents). ✅
- **Actions destructrices** : **confirmation** requise avant toute suppression (listes, clés de config…).
- Validation avant commit : **CI conteneurisée (Docker)** — lint (dont SAST) + typecheck + tests
  unitaires (couv. ≥ 90 %) + intégration (Postgres réel/RLS) + build (`scripts/ci.sh`, pas de GitHub Actions).
- Divulgation responsable : point de contact sécurité (à définir dans l'offre).

## 8. Conformité sectorielle
- **NF525** : concerne les logiciels d'encaissement B2C d'espèces. JAMPACK B2B en est hors périmètre ;
  l'attestation éditeur devra être produite si un encaissement espèces B2C est ajouté.
- **Facturation électronique / FEC** : voir [Conformité](CONFORMITE.md).

## 9. Écarts connus (registre)
| Écart | Impact | Plan |
|---|---|---|
| Immuabilité stricte du journal d'audit | Falsification théorique | Append-only + signature (à venir) |
| InvoiceLine sans RLS société propre | Accès seulement via pièce parente (protégée) | TODO Jalon A (`rls.sql`) |
| Droits RGPD : **tous outillés** ✅ ; aide à la purge (candidats > 3 ans) ✅ | — | Purge **planifiée automatique** (scheduler) restante (⏳) |
| Purge/anonymisation à échéance (prospects 3 ans, audit 12 mois) | Sur-conservation | Tâche de purge configurable (⏳) |
| Procédure de violation de données formelle | Délai de notification 72 h | Runbook + registre des violations (⏳) |
| Politique de confidentialité / mentions d'information | Information des personnes | Gabarit + emplacements (⏳) |
| Audit de dépendances en CI | Vulnérabilités transitives non détectées | `pnpm audit` bloquant (⏳ — réseau requis) ; **SAST statique livré** (eslint-plugin-security) |
