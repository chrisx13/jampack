# Registre des risques

**Projet :** JAMPACK · **Aligné :** ISO 31000 · **Statut :** Vivant · **Version :** 1.0

Échelles : Probabilité P (1 faible → 5 élevée), Impact I (1 → 5), Criticité = P×I.

| ID | Risque | Catégorie | P | I | Crit. | Mitigation | État |
|---|---|---|---|---|---|---|---|
| RT-1 | Périmètre trop large pour un dev solo | Projet | 5 | 5 | 25 | Séquencement strict par jalons ; commercialiser tôt (CRM+Ventes) | Actif |
| RT-2 | Non-conformité e-invoicing 09/2026 | Réglementaire | 2 | 5 | 10 | Génération Factur-X (CII/EN 16931) et connecteur PDP livrés ; reste la voie réglementaire (immatriculation/raccordement PDP — DO-1) | Surveillé |
| RT-3 | Erreur module comptable (FEC/TVA) | Réglementaire | 3 | 5 | 15 | S'appuyer sur pièces validées ; partenaire/expert-comptable | Surveillé |
| RT-4 | Fuite inter-tenant (isolation) | Sécurité | 2 | 5 | 10 | RLS + rôle non-propriétaire ; tests d'isolation ; **isolation absolue** du super-admin général sur les instances hors hébergement JAMPACK | Maîtrisé |
| RT-5 | Régression sans tests automatisés | Qualité | 2 | 3 | 6 | **CI conteneurisée (Docker)** : lint, typecheck, tests unitaires (couv. ≥ 90 %) + intégration DB réelle/RLS + build (`scripts/ci.sh`) ; reste : e2e UI Playwright | Maîtrisé |
| RT-6 | Dépendance PDP / IdP / hébergeur | Fournisseur | 3 | 4 | 12 | Contrats/SLA tiers ; abstraction du connecteur PDP | Surveillé |
| RT-7 | RGPD : effacement vs conservation légale | Conformité | 2 | 4 | 8 | Politique 10 ans pièces comptables ; outillage export/effacement | Actif |
| RT-8 | Perte de données (sauvegarde/restauration) | Exploitation | 2 | 5 | 10 | Sauvegardes chiffrées + tests de restauration (RPO/RTO) | Surveillé |
| RT-9 | Dette technique (tsx en prod) | Technique | 3 | 2 | 6 | Validation locale (lint, typecheck, tests unit+intégration, build) ; reste : build/runtime API de prod (sortir de tsx) | Surveillé |
| RT-10 | Adoption/UX insuffisante | Produit | 3 | 3 | 9 | Démo seedée, guide utilisateur, itérations | Surveillé |
| RT-11 | Mentions facture/LME & régimes TVA FR incomplets | Réglementaire | 3 | 4 | 12 | Structurer mentions spéciales TVA + identifiants acheteur + LME (DO-7) ; couvrir régimes TVA (DO-8) — voir [Conformité](CONFORMITE.md) | Actif |
| RT-12 | Surface d'exécution de la console de pilotage (RCE) | Sécurité | 2 | 5 | 10 | **Aucun shell arbitraire** : catalogue d'opérations prédéfinies ; rôle super-admin dédié ; **confirmation typée** + dry-run + **audit** (`OpsExecution`) ; opérations hôte **bloquées par défaut** (runner désactivé) — voir [PILOTAGE-TECHNIQUE](PILOTAGE-TECHNIQUE.md) | Maîtrisé |
| RT-13 | Exposition des secrets d'instance | Sécurité | 2 | 4 | 8 | Secrets **chiffrés au repos** (AES-GCM si `SECRETS_KEY`) ; **jamais renvoyés en clair** au super-admin général (tronqués) ; révélation par le technicien **explicite et auditée** ; défaut « non chiffré » signalé par le diagnostic | Surveillé |
| RT-14 | Envoi de documents à un tiers IA (Anthropic) | Conformité | 2 | 3 | 6 | Enrichissement IA **désactivé par défaut** ; niveau 1 100 % local ; usage **mesuré** (crédits) ; à encadrer par une clause de sous-traitance | Surveillé |

## Revue
Registre revu à chaque fin de jalon et après tout incident S1/S2 (post-mortem → mise à jour).
