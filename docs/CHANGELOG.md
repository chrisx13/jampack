# Journal des évolutions — JAMPACK

> Récapitulatif fonctionnel des livraisons. Détail exigences dans [SRS](SRS.md), traçabilité dans [RTM](RTM.md).
> Chaque livraison est couverte par des tests (unitaires domaine + intégration RLS réel) et documentée.

## Cycle « parité concurrentielle » (revue [CONCURRENCE](CONCURRENCE.md))
Après cartographie face à EBP, Sage, Ciel, Cegid, Pennylane, Henrri, Axonaut, Sellsy, Zoho, Odoo, QuickBooks,
le backlog **implémentable sans dépendance externe (8/8)** a été livré :

### Ventes / Facturation
- **Remise globale** en pied de pièce (% ou montant), TVA par taux préservée, répercutée sur totaux, paiements,
  comptabilisation, PDF et Factur-X (FR-VEN-15).
- **Facture d'acompte** ventilée par taux de TVA + **facture de solde** déduisant les acomptes (FR-VEN-16).
- **Factures récurrentes / abonnements** : génération à la demande des factures dues, rattrapage des échéances
  (FR-VEN-17) ; **duplication** d'un abonnement.
- **Bon de livraison** (n° BL séquentiel, PDF sans prix, cartouche « Reçu conforme ») (FR-VEN-18).
- **Suivi du temps** + **facturation au temps** (facture depuis les temps facturables) (FR-VEN-19).
- **Signature en ligne du devis** : page publique à jeton (RLS dédié), **acceptation ou refus** avec preuve
  (nom, horodatage, IP) (FR-VEN-20).
- **Lien de paiement en ligne** sur la facture (champ découplé, aucun traitement de paiement) (FR-VEN-21).
- **Relevé de compte client** (PDF : factures/avoirs/règlements + solde dû).
- **Grille tarifaire** : prix par quantité et/ou par client, résolus à la saisie (FR-REF-5).

### Achats / Comptabilité
- **Notes de frais** : dépenses salariés → comptabilisation 6xx/44566 ↔ 421 (FR-ACH-11).
- **Reconnaissance de documents** (facture fournisseur / frais, PDF/photo) — FR-ACH-12 :
  - **Niveau 1 gratuit** : extraction **locale** (pdf.js : texte PDF + pièce jointe **Factur-X**) +
    **règles françaises** (SIREN/SIRET/TVA/IBAN **validés**) → **résumé + brouillon pré-rempli +
    indice de confiance par champ** + contrôle de cohérence des totaux. Aucune donnée ne sort.
  - **Niveau 2 (option)** : enrichissement **IA Claude** (Anthropic) pour photos/scans, **mesuré en
    crédits** (`AiCreditLedger`), **désactivé par défaut**. Le structuré local **prime** sur l'IA.
  - IHM : bouton **« Scanner »** sur les **notes de frais** *et* les **factures fournisseurs** →
    pré-remplissage à **valider** (frais : photo en justificatif ; facture : fournisseur associé par
    nom + ligne depuis les totaux).
  - Administration ▸ **Crédits IA** : solde, statut (modèle Claude), **recharge** (décision admin) et
    **historique** tracé.

## Conformité franco-française
- Validation **SIREN/SIRET** (clé de Luhn) + **calcul auto du n° de TVA intracommunautaire** (règle DGFiP).
- Validation **IBAN** (mod-97) / **BIC** + formatage du RIB sur la facture.
- Mentions **devis** (validité, CGV, « Bon pour accord »), **avoir** référençant la facture d'origine,
  **référence commande client** (BT-13) portée sur PDF et Factur-X.

## Interopérabilité expert-comptable ([CONNECTEURS-EXPERT-COMPTABLE](CONNECTEURS-EXPERT-COMPTABLE.md))
- Échange par **fichiers** (sans identifiants) : **FEC** + **export CSV des écritures** (importable par Sage,
  Cegid/Quadratus, EBP, Ciel, Pennylane…). API en ligne modélisées **découplées** (OAuth partenaire requis).
- **Liasse fiscale (préparation)** : bilan + compte de résultat + agrégats simplifiés (esprit 2033-B), export,
  **avertissements** (option Teledec payante, expert-comptable recommandé). Télétransmission EDI-TDFC hors
  périmètre (agrément DGFiP) — voir [LIASSE-FISCALE](LIASSE-FISCALE.md).
- **Exports CSV** généralisés : écritures, balance, grand livre, balance âgée, journal d'audit, niveaux et
  **mouvements de stock**, notes de frais, suivi du temps.

## Accessibilité (RGAA — voir [CONFORMITE](CONFORMITE.md) §4)
- **Tableaux** : `scope="col"` sur la **totalité** des tableaux (34 écrans).
- **Formulaires** : `<label>` associées (`Form.Group controlId`) + `aria-label` sur les champs sans label visible.
- **Structure/Navigation** : landmarks nommés, `aria-current`, lien d'évitement, focus visible, **lignes de liste
  opérables au clavier**.
- **Page publique de signature** entièrement accessibilisée ; **déclaration d'accessibilité** ([DECLARATION-ACCESSIBILITE](DECLARATION-ACCESSIBILITE.md)).

## Transverse / UX
- **Notes de vue** : pense-bêtes partagés par vue, historisés, déplaçables (FR-TRV-7).
- **Tableau de bord** : panneau « À traiter » **cliquable** (ouvre l'écran concerné) + carte **« Stock sous seuil »**.
- **Listes harmonisées** : recherche instantanée, états vides avec appel à l'action (Ventes, Achats, Clients, Catalogue).
- **CRM** : activités & tâches (filtre par client, rouvrir/clôturer), prévisionnel pondéré, taux de conversion.
