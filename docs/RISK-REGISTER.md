# Registre des risques

**Projet :** JAMPACK · **Aligné :** ISO 31000 · **Statut :** Vivant · **Version :** 1.0

Échelles : Probabilité P (1 faible → 5 élevée), Impact I (1 → 5), Criticité = P×I.

| ID | Risque | Catégorie | P | I | Crit. | Mitigation | État |
|---|---|---|---|---|---|---|---|
| RT-1 | Périmètre trop large pour un dev solo | Projet | 5 | 5 | 25 | Séquencement strict par jalons ; commercialiser tôt (CRM+Ventes) | Actif |
| RT-2 | Non-conformité e-invoicing 09/2026 | Réglementaire | 3 | 5 | 15 | Choisir une PDP tôt ; Factur-X prioritaire | Actif |
| RT-3 | Erreur module comptable (FEC/TVA) | Réglementaire | 3 | 5 | 15 | S'appuyer sur pièces validées ; partenaire/expert-comptable | Surveillé |
| RT-4 | Fuite inter-tenant (isolation) | Sécurité | 2 | 5 | 10 | RLS + rôle non-propriétaire ; tests d'isolation | Maîtrisé |
| RT-5 | Régression sans tests automatisés | Qualité | 4 | 3 | 12 | Pérenniser e2e + lint en CI | Actif |
| RT-6 | Dépendance PDP / IdP / hébergeur | Fournisseur | 3 | 4 | 12 | Contrats/SLA tiers ; abstraction du connecteur PDP | Surveillé |
| RT-7 | RGPD : effacement vs conservation légale | Conformité | 2 | 4 | 8 | Politique 10 ans pièces comptables ; outillage export/effacement | Actif |
| RT-8 | Perte de données (sauvegarde/restauration) | Exploitation | 2 | 5 | 10 | Sauvegardes chiffrées + tests de restauration (RPO/RTO) | Surveillé |
| RT-9 | Dette technique (tsx en prod, CI partielle) | Technique | 3 | 3 | 9 | Plan d'industrialisation (build API, CI complète) | Actif |
| RT-10 | Adoption/UX insuffisante | Produit | 3 | 3 | 9 | Démo seedée, guide utilisateur, itérations | Surveillé |

## Revue
Registre revu à chaque fin de jalon et après tout incident S1/S2 (post-mortem → mise à jour).
