# BRD — Document de besoins métier

**Projet :** JAMPACK — ERP cloud multi-société pour TPE/PME françaises
**Référentiel :** BABOK v3 (analyse d'affaires) · **Statut :** En revue · **Version :** 1.0 · **Date :** 3 août 2026

---

## 1. Contexte et enjeu métier
Les TPE/PME françaises utilisent souvent plusieurs outils déconnectés (CRM, facturation, stock,
compta), avec ressaisies, erreurs et manque de vision consolidée. JAMPACK vise un **socle unique
intégré** couvrant tout le cycle — de l'opportunité commerciale à l'écriture comptable — avec une
**conformité française de premier ordre** (facturation électronique, FEC, RGPD).

Le différenciateur n'est pas un module isolé (marché occupé) mais **l'intégration native de bout en
bout** : une opportunité devient un devis, puis une facture, puis un règlement et une écriture, sans
ressaisie ; un achat devient une réception qui alimente le stock.

## 2. Objectifs métier (mesurables)
| ID | Objectif | Indicateur de succès |
|---|---|---|
| OBJ-1 | Réduire la ressaisie inter-modules | 0 double-saisie devis→facture→règlement |
| OBJ-2 | Être commercialisable tôt | MVP CRM + Ventes vendable dès le Jalon 2 |
| OBJ-3 | Conformité e-invoicing | Réception Factur-X opérationnelle avant 09/2026 |
| OBJ-4 | Multi-société | Un compte gère N sociétés cloisonnées |
| OBJ-5 | Time-to-value | Prise en main d'un module < 30 min (démo seedée) |

## 3. Parties prenantes (stakeholders)
| Partie prenante | Intérêt | Besoins clés |
|---|---|---|
| Dirigeant TPE/PME | Piloter l'activité | Vision consolidée, simplicité, conformité |
| Commercial | Vendre | CRM, devis, factures rapides |
| Comptable / cabinet | Tenir les comptes | FEC, TVA, échéanciers, export expert-comptable |
| Gestionnaire stock/achats | Approvisionner | Commandes, réceptions, niveaux de stock |
| Éditeur (dev solo) | Livrer et maintenir | Productivité, réutilisation, dette maîtrisée |
| Administration fiscale | Contrôle | Formats normés (Factur-X, FEC) |

## 4. Périmètre métier

### 4.1 Dans le périmètre
Tiers & CRM · Ventes (devis→facture→avoir, règlements) · Achats (commandes→réception, factures
fournisseurs) · Stock (entrepôts, mouvements, niveaux) · Référentiels · Administration multi-société ·
e-invoicing (Factur-X + connecteur PDP) · comptabilité (écritures auto, TVA/CA3, FEC) · trésorerie (prévisionnel).

### 4.2 Hors périmètre (initial)
Paie/RH (externalisée), production/MRP (optionnel/tardif), devenir soi-même une PDP, moteur comptable
« maison » complet (privilégier passerelle/PDP agréée).

## 5. Processus métier cibles (BPMN simplifié)

### 5.1 Cycle de vente
`Opportunité → Devis → (accepté) → Facture → Règlement → (Avoir si besoin) → Écriture comptable`

### 5.2 Cycle d'achat
`Commande fournisseur → Réception (→ entrée de stock) → Facture fournisseur → Règlement → Écriture`

### 5.3 Règles de gestion (extraits)
- **RG-1** Une pièce validée (facture/devis émis) n'est plus modifiable.
- **RG-2** Le numéro de pièce est attribué à la validation, insécable et unique par société/type.
- **RG-3** Une facture passe *payée* automatiquement quand le cumul des règlements atteint le TTC.
- **RG-4** Une réception de commande génère les mouvements d'entrée en stock correspondants.
- **RG-5** L'affactureur peut être **imposé** par le client (mention de subrogation obligatoire).
- **RG-6** Les données sont cloisonnées par société ; la compta/le FEC seront tenus par société.

## 6. Besoins métier (Business Requirements)
| ID | Besoin | Priorité | Se décline en (SRS) |
|---|---|---|---|
| BRD-1 | Gérer plusieurs sociétés dans un compte, avec cloisonnement | Must | FR-IAM-1, FR-IAM-4/5 |
| BRD-2 | Gérer clients, contacts, opportunités | Must | FR-CRM-1..4 |
| BRD-3 | Émettre devis, factures, avoirs sans ressaisie | Must | FR-VEN-1..4 |
| BRD-4 | Suivre les encaissements et les impayés | Must | FR-VEN-6/7 |
| BRD-5 | Passer commandes et réceptionner en stock | Must | FR-ACH-1..3, FR-STK-1..3 |
| BRD-6 | Suivre les factures fournisseurs à payer | Must | FR-ACH-4/5 |
| BRD-7 | Être conforme à la facturation électronique | Must | FR-VEN-8, REG-1 |
| BRD-8 | Produire le FEC et les déclarations de TVA | Must | FR-CPT-5/5c, FR-CPT-6, REG-2 |
| BRD-9 | Respecter le RGPD | Must | REG-3, NFR-SEC-* |
| BRD-10 | Personnaliser l'identité visuelle par compte | Should | FR-TRV-2 |

## 7. Feuille de route (jalons métier)
| Jalon | Contenu | Valeur | État |
|---|---|---|---|
| 0 — Socle | Multi-société, auth OIDC, RBAC, RLS | Fondations sûres | ✅ |
| 1 — CRM & Référentiels | Clients/contacts/pipeline, articles/TVA/numérotation | Produit démontrable | ✅ |
| 2 — Ventes | Devis→facture→avoir, règlements, e-invoicing | Valeur commerciale + conformité | 🔧 (Factur-X + connecteur PDP ✅ ; immatriculation DGFiP/PPF ⛔ hors périmètre logiciel) |
| 3 — Achats & Stock | Commandes→réception, factures & règlements fournisseurs, rapprochement 3 voies, mouvements/niveaux/valorisation PMP, seuils/inventaire | Cycle marchandises | ✅ (FIFO/lots ⏳ DO-5) |
| 4 — Comptabilité | Écritures auto, TVA/CA3, lettrage, clôture TVA, FEC | Domaine réglementé | ✅ (rapprochement bancaire ⏳ DO-4) |
| 5 — Trésorerie & BI | Prévisionnel encaissements/décaissements, tableaux de bord | Pilotage | ✅ (rapprochement bancaire ⏳ DO-4) |

## 8. Risques métier (synthèse)
Voir le [Registre des risques](RISK-REGISTER.md). Principaux : périmètre trop large pour un dev solo
(→ séquencement strict), dépendance PDP pour l'e-invoicing, risque réglementaire compta (→ s'appuyer
sur pièces validées et partenaires).

## 9. Critères d'acceptation métier (exemples)
- **AC-1** Depuis une opportunité gagnée, produire une facture PDF conforme en < 5 clics.
- **AC-2** Un règlement partiel met à jour le reste dû et l'échéancier.
- **AC-3** Une réception de commande fait apparaître la quantité en stock dans le bon entrepôt.
- **AC-4** Un utilisateur d'une société A ne peut jamais accéder aux données d'une société B.
