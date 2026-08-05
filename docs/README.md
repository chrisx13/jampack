# JAMPACK — Documentation d'entreprise

Suite documentaire du projet **JAMPACK** (ERP cloud multi-société pour TPE/PME françaises).
Documents versionnés avec le code, tenus à jour à chaque incrément.

> Codes de référence : **BRD-x** (besoins métier), **FR-x** (exigences fonctionnelles),
> **NFR-x** (exigences non-fonctionnelles), **RT-x** (risques), **TC-x** (cas de test).

## Cartographie des documents

| # | Document | Objet | Norme de référence |
|---|---|---|---|
| — | [Vision & cadrage](../../../OneDrive/Documents/jampack/Note%20de%20cadrage%20JAMPACK.docx) | Vision produit, périmètre, contexte réglementaire | — |
| 01 | [BRD](BRD.md) | Besoins métier, parties prenantes, processus, objectifs | BABOK v3 |
| 02 | [SRS](SRS.md) | Exigences logicielles (fonctionnelles + non-fonctionnelles) | ISO/IEC/IEEE 29148 · ISO 25010 |
| 03 | [SAD — Architecture](ARCHITECTURE.md) | Architecture logicielle, **registre de décisions (ADR-1..8 + décisions ouvertes DO-1..6, §2)**, vues C4 | ISO/IEC/IEEE 42010 |
| 04 | [Modèle de données](DATA-MODEL.md) | Entités, relations, isolation multi-tenant | — |
| 05 | [API Reference](API.md) | Routeurs tRPC, procédures, contrats | — |
| 06 | [Sécurité & RGPD](SECURITE-RGPD.md) | Menaces, contrôles, registre des traitements, DPIA | RGPD · ISO 27001 (aligné) |
| 07 | [Stratégie de test](TEST-STRATEGY.md) | Niveaux, couverture, environnements | ISO/IEC/IEEE 29119 |
| 08 | [Matrice de traçabilité (RTM)](RTM.md) | Exigence → conception → code → test | ISO/IEC/IEEE 29148 §5.2.8 |
| 09 | [SLA](SLA.md) | Niveaux de service, disponibilité, support | ITIL 4 (aligné) |
| 10 | [Runbook & DevOps](RUNBOOK.md) | Déploiement, exploitation, sauvegardes, incidents | — |
| 11 | [Guide utilisateur](USER-GUIDE.md) | Prise en main fonctionnelle | — |
| 12 | [Registre des risques](RISK-REGISTER.md) | Risques, probabilité, impact, mitigation | ISO 31000 (aligné) |
| 13 | [Conformité & normes](CONFORMITE.md) | Cartographie des normes applicables | multi-normes |
| 14 | [Conventions de code](CODING-STANDARDS.md) | Style, conventions, revue | — |
| 15 | [Glossaire](GLOSSAIRE.md) | Terminologie métier & technique | — |
| 16 | [Kit de marque](BRAND-KIT.md) | Identité visuelle : logo, palette, typo, composants, modèles de documents | — |
| 17 | [Journal des évolutions](CHANGELOG.md) | Récapitulatif fonctionnel des livraisons | — |
| 18 | [Revue concurrentielle](CONCURRENCE.md) | Positionnement vs marché + backlog priorisé | — |
| 19 | [Interop expert-comptable](CONNECTEURS-EXPERT-COMPTABLE.md) | Échange fichiers (FEC/CSV) + API découplées | — |
| 20 | [Liasse fiscale](LIASSE-FISCALE.md) | Préparation + analyse faisabilité (Teledec/EDI-TDFC) | — |
| 21 | [Déclaration d'accessibilité](DECLARATION-ACCESSIBILITE.md) | RGAA — état de conformité | RGAA 4.1 |
| 22 | [Revue de sécurité prod](SECURITE-REVUE-PROD.md) | Constats + correctifs avant données réelles | — |
| 23 | [Runbook production](RUNBOOK-PRODUCTION.md) | Checklist de déploiement | — |
| 24 | [Dossier de conformité fiscale](DOSSIER-CONFORMITE-FISCALE.md) | À faire valider par un expert-comptable | — |
| 25 | [Runbook pilote](RUNBOOK-PILOTE.md) | Plan de pilote TPE/PME + grille de feedback | — |
| 26 | [Application mobile (PWA)](MOBILE.md) | Interface mobile déplacements (frais/tâches) | — |
| — | [Traçabilité code ↔ specs](TRACABILITE.md) | État d'avancement code vs spécifications | — |

## Normes et référentiels couverts

- **ISO/IEC/IEEE 29148:2018** — ingénierie des exigences (SRS, RTM).
- **ISO/IEC 25010:2011** — qualité logicielle (caractéristiques des NFR).
- **ISO/IEC/IEEE 42010** — description d'architecture (SAD).
- **ISO/IEC/IEEE 29119** — tests logiciels (stratégie de test).
- **BABOK v3** — analyse d'affaires (BRD).
- **RGPD (UE 2016/679)** — protection des données personnelles (registre, DPIA).
- **ISO 27001 / 31000 / ITIL 4** — sécurité, risques, gestion de service (alignement).
- **Réglementation France** : facturation électronique **Factur-X / PPF-PDP** (2026-2027), **FEC**, **NF525** (le cas échéant).

## Gouvernance documentaire

- Source unique : ce dépôt (`docs/`). Toute évolution fonctionnelle met à jour SRS + RTM + doc impactée.
- Statut des documents : `Brouillon` → `En revue` → `Approuvé`. Versionnés via git (historique = journal des modifications).
- Les documents de cadrage historiques (`.docx`) restent dans `D:\OneDrive\Documents\jampack` (référence figée).
