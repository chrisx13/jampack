# Revue concurrentielle — JAMPACK

**Objet :** positionner JAMPACK face aux logiciels de gestion/ERP du marché TPE/PME (surtout France) et
en déduire un **backlog priorisé** des fonctionnalités à implémenter. **Version :** 1.0 · **Statut :** vivant.

**Cadre produit (contraintes JAMPACK) :** franco-français (EUR, normes FR), multi-société, cloud +
auto-hébergeable, **sans dépendance à un service externe exigeant des identifiants sensibles** (pas de
prélèvement/paiement en propre, pas d'envoi de mail à la place de l'utilisateur sans son accord). Les
fonctionnalités impliquant un tiers (paiement en ligne, relevé bancaire automatique) sont modélisées de
façon **découplée** (champ/lien/import) plutôt qu'intégrées à un prestataire.

## 1. Concurrents de référence
| Éditeur | Cible | Signature |
|---|---|---|
| **EBP / Ciel / Sage** | TPE/PME FR | Gestion commerciale + compta + paie, très complet, franco-français |
| **Cegid** | PME/ETI | Compta/fiscalité, expert-comptable |
| **Pennylane** | TPE/PME + experts | Pré-compta, synchro bancaire, collaboration expert |
| **Henrri / Facture.net** | TPE/indépendants | Facturation gratuite simple |
| **Axonaut / Sellsy** | TPE/PME | CRM + facturation + trésorerie tout-en-un |
| **Zoho / Odoo** | PME | Suite modulaire (CRM, invoicing, stock, projet) |
| **QuickBooks** | TPE | Compta simple + rapprochement |

## 2. Cartographie par domaine — JAMPACK vs marché

### Ventes / Facturation
| Fonction | Marché | JAMPACK | Écart |
|---|---|---|---|
| Devis → facture, avoirs | ✔ tous | ✔ | — |
| Numérotation légale, mentions FR | ✔ | ✔ | — |
| Factur-X / e-invoicing (réforme 2026) | ✔ (récent) | ✔ (CII + PDP interne) | — |
| Relances clients multi-niveaux | ✔ | ✔ | — |
| Remise **globale** (pied de facture) | ✔ tous | ✖ (remise par ligne seulement) | **P1** |
| **Facture d'acompte** + facture de solde | ✔ tous FR | ✖ | **P1** |
| **Factures récurrentes / abonnements** | ✔ (Sellsy, Axonaut, Zoho) | ✖ | **P1** |
| **Bon de livraison** (BL) + bon de commande client | ✔ (EBP, Sage) | ✖ | **P2** |
| Signature électronique du devis en ligne | ✔ (Sellsy, Axonaut) | ~ (« Bon pour accord » papier) | **P2** |
| Lien de **paiement en ligne** sur facture | ✔ | ✖ (hors périmètre paiement ; champ lien possible) | **P3** |
| Envoi de la facture par e-mail | ✔ | ✖ (nécessite accord/serveur mail) | **P3** |
| Escompte, pénalités LME | ✔ | ✔ | — |

### Achats
| Fonction | Marché | JAMPACK | Écart |
|---|---|---|---|
| Commande → réception → facture fournisseur | ✔ | ✔ | — |
| Réception partielle, rapprochement 3 voies | ✔ | ✔ | — |
| **Demande de prix / appel d'offres** | ✔ (Odoo) | ✖ | **P3** |
| **Notes de frais** (dépenses salariés) | ✔ (Sellsy, Zoho, Pennylane) | ✖ | **P2** |

### Stock
| Fonction | Marché | JAMPACK | Écart |
|---|---|---|---|
| Multi-entrepôts, mouvements, valorisation PMP/FIFO | ✔ | ✔ | — |
| Lots / péremption / n° série | ✔ | ✔ (lots) | ~ (n° série P3) |
| Inventaire, seuil de réappro. | ✔ | ✔ | — |
| **Variantes d'article** (taille/couleur) | ✔ (Odoo) | ✖ | **P3** |
| **Tarifs par quantité / par client** | ✔ | ✖ | **P2** |

### Compta / Finance
| Fonction | Marché | JAMPACK | Écart |
|---|---|---|---|
| PCG, écritures, balance, grand livre, FEC | ✔ | ✔ | — |
| Lettrage, rapprochement bancaire, TVA (CA3) | ✔ | ✔ | — |
| Immobilisations + amortissements | ✔ | ✔ | — |
| Compte de résultat / bilan | ✔ | ✔ (simplifié) | — |
| **Synchro bancaire automatique** | ✔ (Pennylane) | ✖ (import CSV) | **P3** (dépend d'un agrégateur) |
| **Multi-devises** | ✔ | ✖ | hors périmètre (franco-français EUR) |
| **Journaux / grand livre export** | ✔ | ✔ (CSV) | — |

### CRM / Pilotage
| Fonction | Marché | JAMPACK | Écart |
|---|---|---|---|
| Clients, contacts, pipeline, activités/tâches | ✔ | ✔ | — |
| Prévisionnel pondéré, taux de conversion | ✔ | ✔ | — |
| Tableau de bord, balance âgée, trésorerie | ✔ | ✔ | — |
| Agenda + export iCalendar | ✔ | ✔ | — |
| **Campagnes / e-mailing** | ✔ (Sellsy) | ✖ | hors périmètre (envoi) |
| **Suivi du temps / facturation au temps** | ✔ (Odoo, Zoho) | ✖ | **P2** |

### Transverse
| Fonction | Marché | JAMPACK | Écart |
|---|---|---|---|
| Multi-société, rôles/permissions | ✔ | ✔ | — |
| Journal d'audit, RGPD (droits, purge) | ✔ | ✔ | — |
| Notes / annotations partagées | ~ | ✔ (notes de vue historisées) | avantage JAMPACK |
| Personnalisation documents (charte) | ✔ | ✔ (kit de marque) | — |
| Accessibilité RGAA | rare | ~ (1er lot) | à poursuivre |
| **Application mobile** | ✔ | ✖ | hors périmètre court terme |

## 3. Backlog priorisé (implémentable sans intervention externe)
**P1 — cœur facturation, attendu de tous les concurrents FR :**
1. **Remise globale** en pied de pièce (montant ou %), répercutée sur totaux + TVA + PDF + Factur-X.
2. **Facture d'acompte** puis facture de solde (déduction de l'acompte), mentions FR.
3. **Factures récurrentes / abonnements** : modèle + génération des factures dues en brouillon (sans cron externe).

**P2 — différenciateurs gestion commerciale / PME :**
4. **Bon de livraison** (depuis commande/facture) + suivi des livraisons.
5. **Notes de frais** (dépenses salariés → comptabilisation 625/421).
6. **Tarifs par quantité / par client** (grille tarifaire).
7. **Suivi du temps** rattaché à un client/opportunité → facturation au temps.
8. **Signature électronique du devis** (acceptation en ligne via lien-jeton, sans prestataire).

**P3 — dépendances externes ou niche (modélisation découplée) :**
9. Lien de paiement en ligne (champ URL sur facture, sans traitement du paiement).
10. Synchro bancaire (connecteur d'agrégateur — standby, hors périmètre logiciel).
11. Variantes d'article, n° de série, demande de prix fournisseur.

**Hors périmètre assumé :** multi-devises, e-mailing/campagnes, paie, application mobile (court terme).

## 4. Suivi d'implémentation
| # | Fonction | Priorité | État | Réf. SRS |
|---|---|---|---|---|
| 1 | Remise globale (pied) | P1 | ✅ | FR-VEN-15 |
| 2 | Facture d'acompte / solde | P1 | ✅ | FR-VEN-16 |
| 3 | Factures récurrentes | P1 | ✅ | FR-VEN-17 |
| 4 | Bon de livraison | P2 | ✅ | FR-VEN-18 |
| 5 | Notes de frais | P2 | ✅ | FR-ACH-11 |
| 6 | Grille tarifaire (quantité/client) | P2 | ✅ | FR-REF-5 |
| 7 | Suivi du temps | P2 | ⏳ | FR-VEN-19 |
| 8 | Signature en ligne du devis | P2 | ⏳ | FR-VEN-20 |

> Ce document est mis à jour au fil des implémentations (colonne « État »).
