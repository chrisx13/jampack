# Dossier de conformité fiscale — à faire valider par un expert-comptable

**Objet :** rassembler ce que JAMPACK produit sur le plan fiscal/comptable et **comment le faire valider**
par un professionnel et par les **outils officiels**, avant tout usage réel. JAMPACK **ne se substitue pas**
à un expert-comptable.

## 1. Éléments à faire valider
| Sortie | Où | Norme / référence | À contrôler |
|---|---|---|---|
| **FEC** (Fichier des Écritures Comptables) | Comptabilité ▸ export FEC (`accounting.fec`) | Arrêté 29/07/2013 (art. A47 A-1 LPF) | 18 colonnes normées, séparateur, écritures équilibrées, cohérence balance |
| **Factur-X** (facture électronique) | Facture ▸ Factur-X (`invoices.facturx`) | EN 16931 / CII (réforme 2026-2027) | Identifiants vendeur/acheteur (SIREN 0002, TVA VA), catégories TVA (S/E/AE), totaux, BT-13 |
| **Écritures / balance / grand livre** | Comptabilité ▸ exports CSV | PCG (ANC 2014-03) | Imputations, sens débit/crédit, lettrage |
| **Déclaration TVA (CA3)** | Comptabilité ▸ Déclaration TVA | CGI | Collectée (44571) − déductible (44566), régimes (franchise 293 B, autoliquidation 283-2) |
| **Immobilisations / amortissements** | Comptabilité ▸ Immobilisations | PCG | Base, durée, prorata, dotation 681/281 |
| **Liasse fiscale (préparation)** | Comptabilité ▸ Liasse fiscale | Imprimés 2050…/2033… | Bilan, compte de résultat, **résultat FISCAL à établir par le pro** ([LIASSE-FISCALE](LIASSE-FISCALE.md)) |
| **Mentions légales des factures** | Gabarit PDF | art. 242 nonies A CGI · L441-9 C. com. | Vendeur/acheteur, LME, escompte, franchise/autoliquidation |
| **Mentions par forme juridique** | Paramétrage société + gabarit PDF (`legalForms`) | Code de commerce (R123-237…) · décret 2022 (EI) | « FORME au capital de … », RCS/RNE, tag « EI », 293 B, encaissements, AGA ; **régime de compta par forme** (micro/trésorerie/engagement) à confirmer |

## 2. Comment valider (outils officiels)
- **FEC** → outil **« Test Compta Demat »** de la DGFiP (contrôle de structure et de cohérence du FEC).
- **Factur-X / EN 16931** → un **validateur EN 16931** (ex. validateur en ligne CII/UBL, ou l'outil de la
  plateforme partenaire retenue). Vérifier schéma + règles métier (BR-*).
- **Balance / grand livre / TVA** → **relecture par l'expert-comptable** sur un jeu de données réel.
- **Liasse** → le professionnel établit le **résultat fiscal** et remplit/télétransmet (Teledec payant ou EDI).

## 3. Procédure de préparation du jeu de validation
1. Sur un environnement de **test** (données non réelles ou anonymisées), saisir un cycle complet :
   devis → facture (dont une avec **franchise** et une avec **autoliquidation**) → règlement → avoir.
2. Comptabiliser (ventes, règlements, achats), passer une **immobilisation** + dotation.
3. Exporter : **FEC**, **écritures CSV**, **balance**, un **Factur-X** de facture standard + un « E » + un « AE ».
4. Remettre ces fichiers + le présent dossier à l'expert-comptable et passer le FEC/Factur-X dans les outils du §2.

## 4. Périmètre assumé (non couvert par le logiciel seul)
- **Résultat fiscal** (réintégrations/déductions, 2058-A) : expert-comptable.
- **Remplissage des CERFA officiels** + **télétransmission EDI-TDFC** : expert-comptable ou service agréé payant.
- **Régimes particuliers** (groupes, crédits d'impôt, spécificités sectorielles) : expert-comptable.

## 5. Registre des validations (à compléter)
| Sortie | Outil / valideur | Date | Résultat | Réserves |
|---|---|---|---|---|
| FEC | Test Compta Demat DGFiP | | | |
| Factur-X standard | Validateur EN 16931 | | | |
| Factur-X franchise « E » | Validateur EN 16931 | | | |
| Factur-X autoliquidation « AE » | Validateur EN 16931 | | | |
| Balance / TVA / immos | Expert-comptable | | | |
| Liasse (préparation) | Expert-comptable | | | |
