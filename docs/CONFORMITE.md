# Conformité & normes

**Projet :** JAMPACK · **Statut :** En revue · **Version :** 1.1 · **Date :** 4 août 2026

Cartographie des normes, référentiels et obligations applicables, et de leur prise en compte.

> **Produit franco-français.** JAMPACK cible **exclusivement le marché France** et doit respecter
> **l'ensemble des normes et règles françaises en vigueur** applicables à un logiciel de gestion
> (facturation, comptabilité, TVA, données personnelles). Toute évolution touchant une facture, une
> écriture, la TVA ou des données personnelles vérifie et trace ici l'obligation française correspondante.

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

### 3.5 Mentions obligatoires des factures (art. 242 nonies A CGI · art. L441-9 C. com.)
- **Vendeur** : dénomination, forme juridique + capital, adresse, **SIRET/SIREN**, **n° TVA
  intracommunautaire**, RCS/APE. → portés par le gabarit (`invoiceHtml.ts`) depuis les champs société. ✅
- **Contrôle des identifiants** : SIREN (9 chiffres) et SIRET (14 chiffres) **validés par clé de Luhn**
  (`isValidSiren`/`isValidSiret`) ; le **n° de TVA intracommunautaire est calculé automatiquement** depuis le
  SIREN (`frTvaNumber` — clé = (12 + 3 × (SIREN mod 97)) mod 97) et pré-rempli dans les fiches société et client. ✅
- **Coordonnées bancaires** : IBAN **validé par la clé mod-97** (ISO 7064, `isValidIban`) et BIC par format
  ISO 9362 (`isValidBic`) à la saisie (comptes bancaires + affactureurs) ; **IBAN formaté par groupes de 4**
  (`formatIban`) à l'affichage et **sur le RIB de la facture PDF**. ✅
- **Acheteur** : identité + adresse ✅ ; **identifiants SIREN/TVA** (`Company.siren`/`siret`/`tvaNumber`)
  **portés sur la facture PDF et le Factur-X** (BuyerTradeParty : SIREN schemeID 0002, TVA schemeID VA). ✅
- **Référence commande acheteur (BT-13)** : `Invoice.customerReference` → PDF + Factur-X
  (`BuyerOrderReferencedDocument/IssuerAssignedID`). ✅
- **Avoir** : référence **structurée à la facture d'origine** (« Se rapporte à la facture N° … du … »)
  sur le PDF, via `Invoice.source` (numéro + date). ✅
- **Pièce** : numéro **séquentiel chronologique continu**, date d'émission, date de la vente/prestation,
  désignation, quantité, PU HT, **taux de TVA par ligne**, réductions, total HT/TVA/TTC. ✅ (numérotation
  atomique par société/type ; totaux par taux).
- **Mentions spéciales** : **subrogation** (affacturage) ✅ ; **franchise en base** (mention 293 B +
  Factur-X « E », flag société `vatFranchise`) ✅ ; **autoliquidation** (mention « TVA due par le preneur,
  art. 283-2 CGI » + Factur-X **« AE »**, flag facture `vatReverseCharge`) ✅ ; autres exonérations ⏳.
- → FR-VEN-3, FR-TRV-1. **Décision** : exonérations spécifiques restantes (DO-7).

### 3.6 Délais de paiement (LME · art. L441-10 C. com.)
- Délai légal **≤ 60 jours** (ou 45 j fin de mois) ; la facture doit indiquer la **date d'échéance**, le
  **taux des pénalités de retard** et l'**indemnité forfaitaire de recouvrement de 40 €**.
- État : échéance calculée ✅ ; **mention LME standard** (pénalités de retard + **indemnité forfaitaire
  40 €**) **rendue automatiquement sur chaque facture** ✅ (`lmePaymentMention`, `invoiceHtml.ts`).
  Taux des pénalités **configurable par société** (champ `penaltyRate`, défaut « trois fois le taux d'intérêt
  légal ») ✅. **Mention d'escompte** (conditions ou « Pas d'escompte » par défaut) rendue automatiquement ✅
  (`discountMention`, champ société `discountTerms`). → FR-VEN-11, FR-TRV-1, REG-6.

### 3.7 TVA — taux & régimes France
- **Taux** : 20 % / 10 % / 5,5 % / 2,1 % paramétrables (référentiel société). ✅
- **Régimes** : **franchise en base** (293 B, Factur-X « E ») ✅ ; **autoliquidation** (283-2, Factur-X
  « AE ») ✅ ; **CA3** (réel normal) ✅ ; **TVA sur les encaissements** — mention obligatoire « TVA
  acquittée d'après les encaissements » (flag société `vatOnPayments`) ✅ ; **CA12** (réel simplifié
  annuel) et **recalcul du timing CA3** (exigibilité à l'encaissement) ⏳ (décision DO-8). → FR-CPT-5, REG-7.

### 3.8 Plan Comptable Général (PCG — règlement ANC 2014-03)
- Le plan comptable et les journaux suivent le **PCG**. État : **PCG standard TPE/PME** (≈ 52 comptes,
  classes 1 à 7) ✅ ; **immobilisations amortissables** + plan d'amortissement linéaire ✅
  (`FixedAsset`) ; **comptabilité analytique** ⏳.
- Principes : partie double (débit = crédit) ✅, **intangibilité** des écritures validées et **piste
  d'audit fiable** (PAF : lien pièce ↔ écriture ↔ règlement) 🔧 (auto-comptabilisation + journal d'audit).
  → FR-CPT-*, REG-8.

### 3.9 Archivage à valeur probante (NF Z42-013 / eIDAS)
- La facture électronique doit être conservée **10 ans** avec **intégrité, lisibilité et authenticité**.
- État : conservation 10 ans ✅ (règle) ; **coffre à valeur probante / horodatage / cachet** ⏳
  (dépend de la voie PDP — DO-1). → REG-9.

## 4. Accessibilité — RGAA 4.1 / WCAG 2.1 niveau AA

### 4.1 Obligation
- Le **RGAA** (Référentiel Général d'Amélioration de l'Accessibilité) transpose **WCAG 2.1 AA**. L'obligation
  légale (art. 47 loi 2005-102) vise le **secteur public** et les **grandes entreprises** (CA France
  > 250 M€). Un SaaS B2B n'y est pas directement soumis, **mais** dès qu'un **client public** (mairie,
  hôpital, établissement public) l'utilise, la conformité RGAA devient **exigée contractuellement**.
- Cible JAMPACK : **WCAG 2.1 AA** comme standard produit + **déclaration d'accessibilité** publiable.

### 4.2 Cartographie par thématique RGAA (état)
| Thématique RGAA | État | Notes |
|---|---|---|
| 3 Couleurs / contrastes | 🔧 | Thème Jampack clair/sombre à auditer (ratio ≥ 4,5:1 texte, 3:1 UI) ; ne pas véhiculer l'info par la seule couleur (badges de statut portent un libellé). |
| 7 Scripts / composants | 🔧 | Composants react-bootstrap globalement accessibles ; vérifier rôles/états ARIA des menus, modales, onglets, kanban (drag&drop → alternative clavier). |
| 8 Éléments obligatoires | 🔧 | `lang="fr"`, titres de page, structure HTML valide à confirmer. |
| 5 Tableaux | 🔧 | **En-têtes de colonnes `scope="col"`** sur les listes principales ✅ (pièces de vente, Clients, Catalogue, Notes de frais, Abonnements, Suivi du temps, Relances, Grand livre) ; `<caption>` sur la page publique. Reste : caption/summary systématiques. |
| 9 Structuration | 🔧 | **Landmarks `nav`/`main`/`aside` nommés** ✅ (`AppShell`) ; hiérarchie des titres h1→h6 à vérifier par page. |
| 10 Présentation | 🔧 | Zoom 200 %, responsive ≥ 360 px ✅ ; **focus clavier visible** (`:focus-visible`) ✅. |
| 11 Formulaires | 🔧 | **Étiquettes associées** (`Form.Group controlId`) sur les modales **Clients, Catalogue (fiche + grille tarifaire), Contacts**, Notes de frais, Abonnements, Suivi du temps + champ signataire public ✅ ; champs sans label visible (recherche, filtres, formulaire d'activité) dotés d'**`aria-label`** ✅ ; messages d'erreur (`Form.Control.Feedback`) sur SIREN/SIRET/IBAN ✅ ; reste : quelques champs résiduels + explicitation systématique des erreurs. |
| 12 Navigation | 🔧 | **Lien d'évitement** ✅, **`aria-current`** sur domaine/vue actifs ✅, **liens de sous-domaine activables au clavier** ✅ ; ordre de tabulation des onglets à compléter. |
| 13 Consultation | ✅/🔧 | Pas de limite de temps bloquante ; PDF de facture : tag/accessibilité à vérifier. |

**Page publique de signature du devis (`/devis/:token`)** — surface **grand public**, donc RGAA prioritaire.
Traitée : `<main lang="fr">`, **titre de page** dynamique (n° de devis), **h1** (structure) + h2 pour la réponse,
tableau de données avec **`<caption>`** et **`scope="col"`**, **`<label>` associée** au champ signataire
(+ `autocomplete`), **`role="status"`/`role="alert"`** sur les retours, icônes décoratives `aria-hidden`. ✅

### 4.3 Plan
1. **Audit RGAA** (échantillon de pages : connexion, tableau de bord, liste, formulaire facture).
2. Corriger **contrastes**, **focus visible**, **labels**, **landmarks**, **alternatives clavier** (kanban).
3. Publier une **déclaration d'accessibilité** (taux de conformité, dérogations, contact) → **brouillon rédigé** : [DECLARATION-ACCESSIBILITE.md](DECLARATION-ACCESSIBILITE.md) (à finaliser après audit).
- **1er lot livré** (`AppShell` + thème) : lien d'évitement, landmarks nommés, `aria-current`/`aria-expanded`,
  navigation clavier des vues, focus visible global. Reste : contrastes mesurés, formulaires (labels/erreurs),
  onglets au clavier, alternative au kanban, déclaration d'accessibilité.
- État global : **🔧 en cours** (premier incrément fait ; conformité non encore mesurée par audit). → NFR-UTI-4, DO-9.

## 5. Matrice de conformité (synthèse)
| Obligation | Exigence liée | Échéance | État |
|---|---|---|---|
| Génération Factur-X (XML CII, EN 16931) | FR-VEN-8 | — | ✅ |
| Connecteur PDP (interface + adaptateur interne + journal `PdpTransmission`) | FR-VEN-8 | — | ✅ |
| Immatriculation PDP DGFiP + raccordement PPF + e-reporting | FR-VEN-8 | 09/2026-09/2027 | ⛔ hors périmètre logiciel |
| Émission/réception via PDP agréée (interne immatriculée **ou** partenaire) | FR-VEN-8 | 09/2027 | ⏳ |
| Export FEC | FR-CPT-6 | À la mise en service compta | ✅ |
| Mentions obligatoires facture (vendeur, pièce, subrogation) | FR-VEN-3, FR-TRV-1 | Continu | ✅ |
| Identifiants acheteur (SIREN/TVA) sur facture & Factur-X | FR-VEN-3/8 | 09/2026 | ✅ |
| Mentions spéciales TVA — franchise 293 B (« E ») + autoliquidation 283-2 (« AE ») | FR-VEN-3 | Continu | ✅ |
| Mentions spéciales TVA — autres exonérations spécifiques | FR-VEN-3 | Continu | 🔧 (DO-7) |
| Délais de paiement LME (échéance, pénalités, indemnité 40 €) | FR-TRV-1, REG-6 | Continu | ✅ (taux configurable ⏳) |
| TVA — taux FR paramétrables + CA3 | FR-CPT-5, REG-7 | Continu | ✅ |
| TVA — franchise en base (« E ») + autoliquidation (« AE ») | REG-7 | — | ✅ |
| TVA — CA12 / TVA sur débits vs encaissements | REG-7 | — | ⏳ (DO-8) |
| PCG standard (ANC 2014-03, classes 1-7) | FR-CPT-1, REG-8 | Continu | ✅ |
| Piste d'audit fiable (lien pièce ↔ écriture ↔ règlement) | REG-8 | Continu | 🔧 |
| Archivage à valeur probante (NF Z42-013 / eIDAS) | REG-9 | 09/2026 | ⏳ (DO-1) |
| RGPD / CNIL (registre, droits, durées, sous-traitance) | REG-3 | Continu | 🔧 — voir [Sécurité & RGPD §5](SECURITE-RGPD.md) |
| Accessibilité RGAA / WCAG 2.1 AA | NFR-UTI, DO-9 | Selon clients (public) | 🔧 (§4) |
| Hébergement UE | C-1 | Continu | ✅ (choix imposé) |

## 6. Plan de mise en conformité
1. ✅ Générer le **Factur-X (CII)** + poser le **connecteur PDP** abstrait (adaptateur interne). *(fait)*
2. **Trancher la voie PDP** *(décision business)* : soit **s'immatriculer PDP** auprès de la DGFiP et se
   **raccorder au PPF** (programme réglementaire lourd, hors code), soit **brancher une PDP partenaire**
   sur l'adaptateur existant.
3. ✅ Ouvrir le module **Comptabilité** et l'**export FEC**. *(fait)*
4. **Facture** : porter les **identifiants acheteur** (SIREN/TVA) et **structurer les mentions spéciales
   TVA** (autoliquidation, franchise 293 B) + **mentions LME** normalisées (pénalités, indemnité 40 €). (DO-7, REG-5/6)
5. **TVA** : couvrir les régimes FR (CA12, franchise, autoliquidation, débits/encaissements). (DO-8, REG-7)
6. **Comptabilité** : PCG complet + **piste d'audit fiable** et intangibilité renforcée. (REG-8)
7. **Archivage à valeur probante** de l'e-facture (selon la voie PDP retenue). (DO-1, REG-9)
8. Compléter le **journal d'audit** et l'outillage RGPD (export/effacement).
9. Audit **RGAA/WCAG** de l'UI.
