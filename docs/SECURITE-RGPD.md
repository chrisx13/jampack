# Sécurité & RGPD

**Projet :** JAMPACK · **Aligné :** RGPD (UE 2016/679), ISO/IEC 27001 (contrôles) · **Statut :** En revue · **Version :** 1.0

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
- Référence : `packages/db/prisma/rls.sql`, `packages/db/src/index.ts`.

## 4. Protection des données en transit et au repos
- **Transit** : TLS (terminaison au niveau de l'hébergeur/ingress).
- **Repos** : chiffrement disque de la base managée + sauvegardes chiffrées.
- **Données sensibles** : jamais dans les URL/query strings ; pas de secrets en clair.

## 5. RGPD

### 5.1 Rôles
- **Responsable de traitement** : le client (compte) pour les données de ses tiers/contacts.
- **Sous-traitant** (art. 28) : l'éditeur JAMPACK (hébergement, exploitation).

### 5.2 Registre des traitements (extrait)
| Traitement | Données | Finalité | Base légale | Durée de conservation |
|---|---|---|---|---|
| Comptes utilisateurs | email, nom | Authentification, accès | Contrat | Durée du contrat + purge |
| CRM (contacts clients) | nom, email, téléphone | Relation commerciale | Intérêt légitime / contrat | Selon politique du client |
| Facturation | tiers, montants | Obligation légale (compta) | Obligation légale | **10 ans** (obligation comptable) |
| Journal d'audit | userId, action, horodatage | Sécurité, traçabilité | Intérêt légitime | 12 mois (cible) |

### 5.3 Droits des personnes
- Accès, rectification, effacement, portabilité, limitation : opérés par le responsable de traitement
  (le client) via l'application ; l'éditeur fournit les moyens techniques (export, suppression).
- **Réserve légale** : les pièces à valeur comptable (factures) sont conservées 10 ans et ne peuvent
  être effacées avant terme (obligation légale prévalant sur le droit à l'effacement).

### 5.4 Hébergement et transferts
- **Résidence UE obligatoire** (OVHcloud / Scaleway / Clever Cloud). Aucun transfert hors UE par défaut.

### 5.5 DPIA (analyse d'impact)
Une AIPD est requise si un traitement présente un risque élevé. Pour le périmètre actuel (données de
gestion B2B, pas de données sensibles au sens de l'art. 9), une AIPD allégée suffit ; à réévaluer si
ajout de scoring, profilage, ou données sensibles.

## 6. Journalisation & audit
- **✅ Implémenté** : un middleware tRPC journalise chaque **mutation** réussie (utilisateur, action = chemin
  de la procédure, société active, horodatage, référence de la pièce) dans `AuditLog` (isolé par compte, RLS).
  Consultable dans **Administration ▸ Journal d'audit**. Non bloquant (une erreur d'audit n'échoue pas l'opération).
- Reste : immuabilité renforcée (append-only strict / signature), purge/rétention configurable.

## 7. Gestion des vulnérabilités
- Dépendances : audit régulier (`pnpm audit`), mises à jour de sécurité.
- CI : `typecheck` + build sur chaque push ; à compléter par lint + tests + SAST (⏳).
- Divulgation responsable : point de contact sécurité (à définir dans l'offre).

## 8. Conformité sectorielle
- **NF525** : concerne les logiciels d'encaissement B2C d'espèces. JAMPACK B2B en est hors périmètre ;
  l'attestation éditeur devra être produite si un encaissement espèces B2C est ajouté.
- **Facturation électronique / FEC** : voir [Conformité](CONFORMITE.md).

## 9. Écarts connus (registre)
| Écart | Impact | Plan |
|---|---|---|
| Immuabilité stricte du journal d'audit | Falsification théorique | Append-only + signature (à venir) |
| Lint absent de la CI (tests ✅) | Qualité | Ajout du lint en CI |
| InvoiceLine sans RLS société propre | Accès seulement via pièce parente (protégée) | TODO Jalon A (`rls.sql`) |
