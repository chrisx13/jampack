# Conformité & normes

**Projet :** JAMPACK · **Statut :** En revue · **Version :** 1.0 · **Date :** 3 août 2026

Cartographie des normes, référentiels et obligations applicables, et de leur prise en compte.

## 1. Normes d'ingénierie logicielle
| Norme | Objet | Où c'est traité | État |
|---|---|---|---|
| ISO/IEC/IEEE 29148:2018 | Ingénierie des exigences | [SRS](SRS.md), [RTM](RTM.md) | ✅ appliqué |
| ISO/IEC 25010:2011 | Modèle qualité (NFR) | [SRS](SRS.md) §4 | ✅ appliqué |
| ISO/IEC/IEEE 42010 | Description d'architecture | [SAD](ARCHITECTURE.md) | ✅ appliqué |
| ISO/IEC/IEEE 29119 | Tests logiciels | [Stratégie de test](TEST-STRATEGY.md) | 🔧 en cours |
| BABOK v3 | Analyse d'affaires | [BRD](BRD.md) | ✅ appliqué |

## 2. Sécurité & données
| Référentiel | Objet | Où | État |
|---|---|---|---|
| RGPD (UE 2016/679) | Données personnelles | [Sécurité & RGPD](SECURITE-RGPD.md) | 🔧 |
| ISO/IEC 27001 (contrôles) | SMSI / contrôles sécurité | [Sécurité & RGPD](SECURITE-RGPD.md) | 🔧 alignement |
| OWASP ASVS / Top 10 | Sécurité applicative | Revue de code, [Sécurité](SECURITE-RGPD.md) §7 | 🔧 |

## 3. Obligations réglementaires France

### 3.1 Facturation électronique (réforme 2026-2027)
| Catégorie d'entreprise | Réception | Émission |
|---|---|---|
| Grandes entreprises & ETI | **01/09/2026** | **01/09/2026** |
| PME, TPE, micro | **01/09/2026** | **01/09/2027** |

- **Modèle** : le **PPF** (Portail Public de Facturation) joue le rôle d'annuaire/concentrateur ;
  l'échange passe par une **PDP agréée** (Plateforme de Dématérialisation Partenaire).
- **Formats socle** : **Factur-X** (PDF/A-3 + XML hybride, adapté TPE/PME), **UBL**, **CII**.
- **Décision structurante** : JAMPACK génère le **Factur-X (XML CII, EN 16931)** et expose un
  **connecteur PDP** abstrait (adaptateur « interne » par défaut, adaptateur « partenaire »
  branchable). 🔧
- **Périmètre logiciel vs réglementaire** — ce qui relève du logiciel est **fait** ; le reste est
  **hors périmètre du code** et relève d'un programme réglementaire/contractuel :
  - ✅ **Dans le logiciel** : génération Factur-X CII, modèle `PdpTransmission` (journal des
    transmissions, sous RLS), interface `PdpConnector` + adaptateur interne.
  - ⛔ **Hors périmètre du logiciel** (ne peut pas être « codé ») : **immatriculation PDP auprès de
    la DGFiP**, **raccordement au PPF** (annuaire + concentrateur), **e-reporting** officiel,
    **interopérabilité inter-PDP**, **certification sécurité** (audit, ISO 27001 / SecNumCloud). Tant
    que ces jalons ne sont pas franchis, l'adaptateur interne **n'a pas valeur de PDP agréée** : il
    faut soit obtenir l'immatriculation, soit brancher l'adaptateur d'une **PDP partenaire**.
- **Impact JAMPACK** : générer/consommer Factur-X, connecteur PDP. → FR-VEN-8, REG-1.

### 3.2 Fichier des Écritures Comptables (FEC)
- Exigé dès qu'un module comptable tient les écritures ; format normé (art. A47 A-1 LPF).
- Impact : export FEC conforme. → FR-CPT-6, REG-2. **✅ Jalon 4 livré.**

### 3.3 Logiciels de caisse (NF525)
- Concerne l'encaissement B2C d'espèces. La loi de finances 2026 réadmet l'**attestation individuelle
  de l'éditeur** comme preuve. Amende 7 500 €/système en cas de non-conformité.
- JAMPACK B2B : **hors périmètre** tant qu'il n'y a pas d'encaissement espèces B2C.

### 3.4 Conservation légale
- Pièces comptables (factures) : conservation **10 ans**. Prévaut sur le droit à l'effacement RGPD.

## 4. Accessibilité (cible)
- **RGAA / WCAG 2.1 AA** : cible pour l'UI publique. État : 🔧 à auditer (contrastes du thème,
  navigation clavier, libellés ARIA).

## 5. Matrice de conformité (synthèse)
| Obligation | Exigence liée | Échéance | État |
|---|---|---|---|
| Génération Factur-X (XML CII, EN 16931) | FR-VEN-8 | — | ✅ |
| Connecteur PDP (interface + adaptateur interne + journal `PdpTransmission`) | FR-VEN-8 | — | ✅ |
| Immatriculation PDP DGFiP + raccordement PPF + e-reporting | FR-VEN-8 | 09/2026-09/2027 | ⛔ hors périmètre logiciel |
| Émission/réception via PDP agréée (interne immatriculée **ou** partenaire) | FR-VEN-8 | 09/2027 | ⏳ |
| Export FEC | FR-CPT-6 | À la mise en service compta | ✅ |
| RGPD (registre, UE, effacement) | REG-3 | Continu | 🔧 |
| Hébergement UE | C-1 | Continu | ✅ (choix imposé) |

## 6. Plan de mise en conformité
1. ✅ Générer le **Factur-X (CII)** + poser le **connecteur PDP** abstrait (adaptateur interne). *(fait)*
2. **Trancher la voie PDP** *(décision business)* : soit **s'immatriculer PDP** auprès de la DGFiP et se
   **raccorder au PPF** (programme réglementaire lourd, hors code), soit **brancher une PDP partenaire**
   sur l'adaptateur existant.
3. ✅ Ouvrir le module **Comptabilité** et l'**export FEC**. *(fait)*
4. Compléter le **journal d'audit** et l'outillage RGPD (export/effacement).
5. Audit **RGAA/WCAG** de l'UI.
