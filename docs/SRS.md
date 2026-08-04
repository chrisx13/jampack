# SRS — Spécification des exigences logicielles

**Projet :** JAMPACK — ERP cloud multi-société pour TPE/PME françaises
**Référentiel :** ISO/IEC/IEEE 29148:2018 · qualité selon ISO/IEC 25010:2011
**Statut :** En revue · **Version :** 1.0 · **Date :** 3 août 2026

---

## 1. Introduction

### 1.1 Objet
Ce document spécifie les exigences fonctionnelles et non-fonctionnelles de JAMPACK, suite de
gestion cloud tout-en-un (CRM · Ventes/Facturation · Achats · Stock · Comptabilité) destinée aux
TPE/PME françaises, accessible en web (et à terme desktop/mobile).

### 1.2 Portée
Le produit couvre le cycle de gestion de l'entreprise dans un socle unique **multi-tenant** et
**multi-société**, conforme à la réglementation française. Le périmètre est livré par jalons
(voir [BRD](BRD.md) §7). Ce SRS décrit l'état **livré** et **planifié**, chaque exigence portant un statut.

### 1.3 Définitions
Voir le [Glossaire](GLOSSAIRE.md). Termes clés : **Compte** (tenant/abonnement, `Organization`),
**Société** (entité juridique, `Societe`), **Tiers** (`Company`, client et/ou fournisseur), **Pièce de
vente** (devis/facture/avoir).

### 1.4 Références
[BRD](BRD.md) · [SAD](ARCHITECTURE.md) · [Modèle de données](DATA-MODEL.md) · [Sécurité & RGPD](SECURITE-RGPD.md) ·
[Conformité](CONFORMITE.md) · [RTM](RTM.md).

### 1.5 Conventions
Chaque exigence a un identifiant unique (`FR-<module>-<n>` / `NFR-<caractéristique>-<n>`), une
**priorité** (M=Must, S=Should, C=Could — MoSCoW) et un **statut** (✅ livré, 🔧 partiel, ⏳ planifié).

---

## 2. Description générale

### 2.1 Perspective produit
Monolithe modulaire TypeScript (NestJS + tRPC + Prisma + PostgreSQL) exposant une API type-safe à une
SPA React (react-bootstrap, thème Jampack). Isolation par compte via **Row-Level Security** PostgreSQL.
Voir [SAD](ARCHITECTURE.md).

### 2.2 Fonctions principales
Gestion des tiers et du CRM ; chaîne de vente devis→facture→avoir avec règlements et **e-invoicing
Factur-X/PDP** ; achats (commandes→réception→factures **et règlements** fournisseurs) ; stock (entrepôts,
mouvements, niveaux, valorisation PMP) ; **comptabilité** (écritures auto, lettrage, TVA/CA3, FEC) ;
**trésorerie** (prévisionnel) ; référentiels (articles, TVA, numérotation) ; administration (comptes,
sociétés, rôles, thème, journal d'audit).

### 2.3 Classes d'utilisateurs
| Classe | Description | Rôle type |
|---|---|---|
| Administrateur | Gère compte, sociétés, utilisateurs, rôles, paramétrage | `Admin` (manage all) |
| Commercial | CRM, devis, factures, avoirs, stock, achats | `Commercial` |
| Comptable | Lecture ventes + saisie règlements, factures fournisseurs | `Comptable` |
| Lecture seule | Consultation | (rôle dérivé) |

### 2.4 Environnement d'exploitation
Navigateur moderne (SPA) ; backend conteneurisé (Docker) ; PostgreSQL 16 ; IdP Keycloak (OIDC) ;
hébergement UE (RGPD). Voir [Runbook](RUNBOOK.md).

### 2.5 Contraintes de conception
- **C-1** Résidence des données dans l'UE (RGPD).
- **C-2** Isolation multi-tenant garantie par la base (RLS), pas par la seule discipline applicative.
- **C-3** Montant monétaire en `Decimal` (jamais de flottant).
- **C-4** Numérotation des pièces séquentielle, atomique et insécable par société et type.
- **C-5** Stack unique TypeScript (productivité développeur solo).

### 2.6 Hypothèses et dépendances
- **H-1** L'e-invoicing repose sur un **connecteur PDP abstrait** : le logiciel génère le Factur-X et
  transmet via un adaptateur. L'adaptateur « agréé » (PDP interne **immatriculée DGFiP** ou **PDP
  partenaire**) et le raccordement PPF/e-reporting sont **hors périmètre logiciel** (programme
  réglementaire). Voir [Conformité §3.1](CONFORMITE.md).
- **H-2** L'authentification est déléguée à un IdP OIDC (Keycloak).

---

## 3. Exigences fonctionnelles

### 3.1 Socle multi-tenant & IAM
| ID | Exigence | Prio | Statut |
|---|---|---|---|
| FR-IAM-1 | Un **compte** (tenant) regroupe plusieurs **sociétés** ; les données sont isolées par compte. | M | ✅ |
| FR-IAM-2 | Authentification **OIDC** (Keycloak) ; l'API valide signature, émetteur et audience du jeton. | M | ✅ |
| FR-IAM-3 | Repli développeur sans login (`AUTH_DEV_STUB`) désactivable en production. | S | ✅ |
| FR-IAM-4 | **Rôles par société, cumulables** ; permissions effectives = union des rôles sur la société active. | M | ✅ |
| FR-IAM-5 | Un utilisateur ne voit que les sociétés où il a au moins un rôle ; bascule via sélecteur ; vue consolidée. | M | ✅ |
| FR-IAM-6 | Contrôle d'accès **CASL** appliqué côté serveur (mutations → FORBIDDEN) et masquage UI. | M | ✅ |
| FR-IAM-7 | Administration in-app : **inviter des utilisateurs, attribuer/révoquer des rôles par société** (garde-fou dernier admin). | S | ✅ |
| FR-IAM-7b | **Création de sociétés** depuis l'app (accessible au créateur) + édition (paramétrage). | S | ✅ |
| FR-IAM-8 | Éditeur de rôles fin `module.domaine.action` (catalogue `rights.ts`). | C | ⏳ |

### 3.2 CRM
| ID | Exigence | Prio | Statut |
|---|---|---|---|
| FR-CRM-1 | Gérer les **clients** (tiers) : création, modification, suppression, liste par société. | M | ✅ |
| FR-CRM-2 | Gérer les **contacts** rattachés aux clients. | M | ✅ |
| FR-CRM-3 | Gérer les **établissements/adresses** d'un client (siège/facturation/livraison). | M | ✅ |
| FR-CRM-4 | **Pipeline d'opportunités** kanban avec glisser-déposer entre étapes. | M | ✅ |
| FR-CRM-5 | Activités (note/appel/email/rdv/tâche) rattachées à client/contact/opportunité ; tâches à faire (échéance, clôture, retard). | C | ✅ |
| FR-CRM-6 | **Prévisionnel commercial pondéré** : probabilité de conversion par étape ; synthèse du pipeline (nombre, montant, montant pondéré, **taux de conversion** gagné/clôturé). | C | ✅ |

### 3.3 Référentiels
| ID | Exigence | Prio | Statut |
|---|---|---|---|
| FR-REF-1 | Catalogue **articles & services** (par société), catégories. | M | ✅ |
| FR-REF-2 | Taux de **TVA** paramétrables (référentiel compte). | M | ✅ |
| FR-REF-3 | **Numérotation des pièces** par société et type (facture/devis/avoir/commande), atomique. | M | ✅ |
| FR-REF-4 | **Import CSV du catalogue** (`référence ; nom ; prix HT ; unité ; type`) : création + mise à jour par référence (upsert). | C | ✅ |

### 3.4 Ventes
| ID | Exigence | Prio | Statut |
|---|---|---|---|
| FR-VEN-1 | Créer/modifier un **devis** (brouillon) avec lignes, TVA, conditions de paiement. | M | ✅ |
| FR-VEN-2 | Émettre un devis (numéro `DE-`), l'**accepter/refuser**, le **convertir en facture**. | M | ✅ |
| FR-VEN-3 | Créer/valider une **facture** (numéro `FA-`, échéance calculée), générer le **PDF**. | M | ✅ |
| FR-VEN-4 | Créer un **avoir** (numéro `AV-`) depuis une facture (filiation tracée). | M | ✅ |
| FR-VEN-5 | **Affacturage** : mention de subrogation, compte bancaire, condition de paiement résolus par défaut. | S | ✅ |
| FR-VEN-6 | **Règlements** rattachés à une facture ; statut *payée* recalculé (partiel/total). | M | ✅ |
| FR-VEN-7 | **Échéancier client** : factures validées non soldées, reste dû, retard. | M | ✅ |
| FR-VEN-9 | **Relances clients** (dunning) : niveau progressif (rappel → ferme → mise en demeure), lettre de relance, suivi. | S | ✅ |
| FR-VEN-10 | **Validité & expiration des devis** : suivi des devis émis par date de validité (valide / expire bientôt / expiré) pour relance avant caducité. | C | ✅ |
| FR-VEN-11 | **Mention d'escompte** (art. L441-10) : conditions d'escompte pour paiement anticipé sur facture, ou mention « Pas d'escompte » par défaut. | M | ✅ |
| FR-VEN-12 | **Duplication de pièce** : créer un brouillon identique (client, lignes) depuis un devis/facture/avoir. | C | ✅ |
| FR-VEN-8 | **E-invoicing Factur-X / PDP** : génération **Factur-X (XML CII, EN 16931)**, connecteur **PDP** (interface + adaptateur interne), journal des transmissions (`PdpTransmission`, sous RLS). Émission/réception effective via PDP **immatriculée** ou **partenaire**. | M | 🔧 (génération + connecteur ✅ ; immatriculation DGFiP / PPF / e-reporting ⛔ hors périmètre logiciel) |

### 3.5 Achats
| ID | Exigence | Prio | Statut |
|---|---|---|---|
| FR-ACH-1 | Fournisseur = tiers marqué `isSupplier`. | M | ✅ |
| FR-ACH-2 | **Commande fournisseur** (brouillon → envoyée, numéro `CM-`) avec lignes. | M | ✅ |
| FR-ACH-3 | **Réception** d'une commande : génère les **entrées de stock** et passe la commande *réceptionnée*. | M | ✅ |
| FR-ACH-4 | **Factures fournisseurs** (comptes à payer) avec TVA ; validation, marquer payée. | M | ✅ |
| FR-ACH-5 | **Échéancier fournisseur** : factures à payer, reste dû, retard. | M | ✅ |
| FR-ACH-6 | **Règlements fournisseurs** partiels rattachés à une facture ; statut *payée* recalculé au cumul ; comptabilisation (401 débit = 512 crédit). | M | ✅ |
| FR-ACH-7 | **Rapprochement 3 voies** : commande ↔ réception ↔ facture fournisseur ; écarts de montant et de réception signalés. | C | ✅ |
| FR-ACH-8 | **Suivi des commandes en retard** : commandes envoyées non réceptionnées dont la date de livraison prévue est dépassée (jours de retard). | C | ✅ |
| FR-ACH-9 | **Réception partielle** : livraisons échelonnées par ligne (reste dû, statut « réception partielle » puis « réceptionnée »), sans dépassement du reste dû. | C | ✅ |
| FR-ACH-10 | **Duplication de commande** fournisseur en brouillon (commandes récurrentes). | C | ✅ |

### 3.6 Stock
| ID | Exigence | Prio | Statut |
|---|---|---|---|
| FR-STK-1 | Gérer les **entrepôts** (par société), entrepôt par défaut. | M | ✅ |
| FR-STK-2 | Enregistrer des **mouvements** (entrée/sortie/ajustement) signés. | M | ✅ |
| FR-STK-3 | Calculer les **niveaux de stock** nets par article et entrepôt. | M | ✅ |
| FR-STK-4 | **Valorisation PMP** (prix moyen pondéré des entrées) par article. | S | ✅ |
| FR-STK-5 | **Seuil de réapprovisionnement** par article + **alertes de rupture** ; **inventaire physique** (quantité comptée → mouvement d'ajustement). | S | ✅ |
| FR-STK-6 | **Lots / n° de série** + **péremption** (DLC/DDM) : soldes par lot, alertes périmé/bientôt. | C | ✅ |
| FR-STK-7 | Valorisation **FIFO** (premier entré, premier sorti) en plus du **PMP** (méthode au choix). | C | ✅ |
| FR-STK-8 | **Transfert inter-entrepôts** : sortie source + entrée destination atomiques (entrepôts distincts, quantité positive). | C | ✅ |
| FR-STK-9 | **Export CSV des niveaux de stock** (référence ; article ; entrepôt ; quantité ; unité). | C | ✅ |

### 3.7 Comptabilité (Jalon 4)
| ID | Exigence | Prio | Statut |
|---|---|---|---|
| FR-CPT-1 | **Plan comptable** (**PCG standard** TPE/PME, ≈ 52 comptes classes 1-7) et **journaux** par société. | M | ✅ |
| FR-CPT-2 | **Écritures** manuelles multi-lignes, contrôle d'**équilibre** (débit = crédit). | M | ✅ |
| FR-CPT-3 | **Balance générale** (totaux/soldes par compte). | M | ✅ |
| FR-CPT-3b | **Grand livre** : détail des mouvements par compte avec solde progressif. | M | ✅ |
| FR-CPT-4 | Écritures **générées automatiquement** depuis les **factures de vente** (411/707/44571). | M | ✅ |
| FR-CPT-4b | Écritures auto depuis les **règlements clients** (journal banque 512/411), les **factures fournisseurs** (journal achat 607/44566/401) et les **règlements fournisseurs** (journal banque 401/512). | M | ✅ |
| FR-CPT-5 | **Déclaration de TVA (CA3)** : collectée − déductible → à décaisser / crédit. | M | ✅ |
| FR-CPT-5b | **Lettrage** des comptes de tiers (rapprochement débit/crédit équilibré). | M | ✅ |
| FR-CPT-5c | **Écriture de clôture de TVA** (solde 44571/44566 → 44551/44567, journal OD). | M | ✅ |
| FR-CPT-5d | **Rapprochement bancaire** : pointage des lignes du compte 512, soldes comptable/pointé/reste, **import de relevé CSV** (pointage auto par montant). | M | ✅ |
| FR-CPT-6 | Export **FEC** (Fichier des Écritures Comptables) tabulé normé. | M | ✅ |
| FR-CPT-7 | **Immobilisations** amortissables + **plan d'amortissement linéaire** (prorata temporis) + **comptabilisation de la dotation** (681 → 281). | S | ✅ |
| FR-CPT-8 | **États de synthèse** : compte de résultat (produits cl. 7 − charges cl. 6) et bilan simplifié (actif/passif par classe PCG, résultat au passif), dérivés de la balance. | S | ✅ |
| FR-CPT-9 | **Export CSV de la balance générale** (compte ; libellé ; débit ; crédit ; solde) — échange avec l'expert-comptable. | C | ✅ |

### 3.8 Trésorerie (Jalon 5)
| ID | Exigence | Prio | Statut |
|---|---|---|---|
| FR-TRE-1 | **Prévisionnel de trésorerie** : encaissements clients attendus (reste dû) vs décaissements fournisseurs, position nette, mise en évidence des retards. | S | ✅ |
| FR-TRE-4 | **Prévisionnel hebdomadaire** : encaissements/décaissements ventilés par semaine sur N semaines, position nette cumulée (courbe). | C | ✅ |
| FR-TRE-2 | Rapprochement bancaire (relevé ↔ écritures 512). | C | ✅ (voir FR-CPT-5d) |
| FR-TRE-3 | **Balance âgée** clients **et fournisseurs** : créances/dettes non soldées par tranche d'ancienneté (non échu, 1-30, 31-60, 61-90, +90 j). | S | ✅ |

### 3.9 Transverse
| ID | Exigence | Prio | Statut |
|---|---|---|---|
| FR-TRV-1 | Paramétrage société (en-tête facturation, mentions légales, CGV). | M | ✅ |
| FR-TRV-2 | Personnalisation du **thème** (couleurs de marque) au niveau compte. | S | ✅ |
| FR-TRV-3 | Édition **PDF** normalisée des pièces. | M | 🔧 (factures) |
| FR-TRV-4 | **Journal d'audit** des mutations (qui, quoi, quand) via middleware tRPC ; **export CSV** (traçabilité RGPD/sécurité). | S | ✅ |
| FR-TRV-5 | **Tableau de bord** : KPI consolidés (CA facturé, encours clients/fournisseurs, valeur stock, TVA). | S | ✅ |
| FR-TRV-6 | **Agenda consolidé** : échéances et tâches à venir (fenêtre 7/30/90 j) — tâches CRM, échéances factures clients/fournisseurs, livraisons attendues ; retards signalés ; **export iCalendar (.ics)**. | S | ✅ |
| FR-TRV-7 | **Notes de vue** : pense-bêtes partagés ancrés à une vue, visibles par tout utilisateur ayant accès à la vue ; **édition historisée** ; **déplaçables** (ne masquent pas les données) ; plusieurs par vue. | C | ✅ |

---

## 4. Exigences non-fonctionnelles (ISO/IEC 25010)

### 4.1 Adéquation fonctionnelle
- **NFR-FON-1 (M)** Les totaux HT/TVA/TTC sont exacts au centime, arrondis ligne par ligne. ✅
- **NFR-FON-2 (M)** La numérotation ne réattribue jamais deux fois le même numéro (atomicité). ✅

### 4.2 Performance
- **NFR-PER-1 (S)** Les listes principales répondent en < 500 ms pour 10 000 lignes (index en place). 🔧
- **NFR-PER-2 (S)** Génération PDF d'une facture < 3 s. ✅

### 4.3 Compatibilité
- **NFR-CMP-1 (S)** SPA compatible navigateurs evergreen (Chrome/Edge/Firefox/Safari récents). ✅
- **NFR-CMP-2 (C)** UI réutilisable en desktop (Tauri) et mobile (PWA) sans réécriture. ⏳

### 4.4 Utilisabilité
- **NFR-UTI-1 (M)** Interface FR, cohérente (thème Jampack), navigation type VS Code (domaines/onglets). ✅
- **NFR-UTI-2 (S)** Modes clair/sombre. ✅
- **NFR-UTI-3 (S)** Responsive ≥ 360 px ; panneau secondaire épinglé ou à la volée. ✅
- **NFR-UTI-4 (S)** **Accessibilité RGAA 4.1 / WCAG 2.1 AA** (cible produit ; exigée si client public) : contrastes, navigation clavier, labels/ARIA, déclaration d'accessibilité. 🔧 (à auditer — DO-9) — voir [Conformité §4](CONFORMITE.md).

### 4.5 Fiabilité
- **NFR-FIA-1 (M)** Cohérence transactionnelle : chaque opération multi-tables s'exécute dans une transaction. ✅
- **NFR-FIA-2 (S)** Sauvegardes automatisées et chiffrées de la base (voir [Runbook](RUNBOOK.md)). ⏳

### 4.6 Sécurité
- **NFR-SEC-1 (M)** Isolation stricte des comptes par **RLS**, l'API tournant sous un rôle SQL non-propriétaire. ✅
- **NFR-SEC-2 (M)** Aucune donnée personnelle en clair dans les URL ; jetons OIDC vérifiés. ✅
- **NFR-SEC-3 (M)** Autorisation systématique (CASL) sur toute mutation. ✅
- **NFR-SEC-4 (S)** Secrets hors dépôt (variables d'environnement). ✅
- Détail : [Sécurité & RGPD](SECURITE-RGPD.md).

### 4.7 Maintenabilité
- **NFR-MNT-1 (M)** Types et schémas de validation (Zod) partagés front/back (source unique). ✅
- **NFR-MNT-2 (S)** Découpage modulaire (un module métier = frontières nettes). ✅
- **NFR-MNT-3 (S)** `lint` (ESLint) + `typecheck` + **tests (unitaires ≥ 90 % + intégration)** + build verts en CI sur chaque push. ✅

### 4.8 Portabilité
- **NFR-POR-1 (M)** Déploiement conteneurisé reproductible (Docker Compose). ✅
- **NFR-POR-2 (C)** Migration multi-tenant vers schéma/base séparés possible pour gros comptes. ⏳

---

> **Produit franco-français** : JAMPACK cible exclusivement la France et doit respecter **toutes les
> normes et règles françaises en vigueur**. Cartographie complète et statuts dans [Conformité](CONFORMITE.md).

- **REG-1 (M)** Facturation électronique : réception obligatoire **09/2026**, émission échelonnée jusqu'à **09/2027** (Factur-X via PDP). 🔧 (génération Factur-X CII + connecteur PDP interne ✅ ; immatriculation DGFiP/PPF/e-reporting ⛔ hors périmètre logiciel — DO-1) — voir [Conformité](CONFORMITE.md).
- **REG-2 (M)** Export **FEC** dès qu'un module comptable tient les écritures. ✅ — voir FR-CPT-6.
- **REG-3 (M)** **RGPD / CNIL** : registre des traitements, minimisation, hébergement UE, droits des personnes. 🔧 (**tous les droits outillés** ✅ + **aide à la purge** (candidats > 3 ans) ✅ ; reste la purge planifiée automatique) — voir [Sécurité & RGPD](SECURITE-RGPD.md).
- **REG-4 (C)** **NF525** si encaissement B2C d'espèces (attestation éditeur). Hors périmètre B2B actuel.
- **REG-5 (M)** **Mentions obligatoires des factures** (art. 242 nonies A CGI · art. L441-9 C. com.) : identité vendeur/acheteur, SIRET/TVA, numéro séquentiel, date, TVA par taux, mentions spéciales. 🔧 (vendeur/pièce ✅ ; **identifiants acheteur SIREN/TVA ✅** ; **franchise en base (293 B, « E ») ✅** ; **autoliquidation (283-2, « AE ») ✅** ; exonérations spécifiques restantes — DO-7) — voir [Conformité §3.5](CONFORMITE.md).
- **REG-6 (M)** **Délais de paiement (LME)** : date d'échéance, taux de pénalités de retard, indemnité forfaitaire de **40 €**. ✅ (mention LME standard rendue sur chaque facture ; taux configurable par société ⏳) — voir [Conformité §3.6](CONFORMITE.md).
- **REG-7 (M)** **TVA France** : taux 20/10/5,5/2,1 ✅ + **CA3** ✅ + **franchise en base** (293 B) ✅ + **autoliquidation** (283-2) ✅ + **mention TVA sur les encaissements** ✅ ; CA12 et recalcul du timing CA3 (exigibilité à l'encaissement) ⏳ (DO-8) — voir [Conformité §3.7](CONFORMITE.md).
- **REG-8 (M)** **PCG** (ANC 2014-03) + **piste d'audit fiable** (lien pièce ↔ écriture ↔ règlement). 🔧 (PCG minimal + auto-comptabilisation ✅ ; plan complet + intangibilité renforcée ⏳) — voir [Conformité §3.8](CONFORMITE.md).
- **REG-9 (M)** **Archivage à valeur probante** de la facture électronique (NF Z42-013 / eIDAS) : conservation 10 ans, intégrité, authenticité. ⏳ (dépend de la voie PDP — DO-1) — voir [Conformité §3.9](CONFORMITE.md).

---

## 6. Traçabilité
Chaque exigence est reliée à sa conception, son code et ses tests dans la [Matrice de traçabilité (RTM)](RTM.md).
