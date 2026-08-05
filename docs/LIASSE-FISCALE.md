# Liasse fiscale — préparation & télétransmission

> ⚠️ **À lire avant d'activer cette option.**
> - **Rien ne remplace un expert-comptable.** L'établissement d'une liasse fiscale engage la responsabilité
>   du déclarant ; le résultat **fiscal** (réintégrations/déductions, régimes, crédits d'impôt) ne se déduit
>   pas mécaniquement de la comptabilité et requiert une **compétence professionnelle**.
> - La **télétransmission** de la liasse via un service comme **Teledec est PAYANTE** (abonnement/à l'acte
>   chez l'éditeur du service). JAMPACK ne facture pas ce service et n'en garantit pas le tarif.

## 1. Ce qu'est la liasse fiscale
Ensemble des **imprimés fiscaux** annexés à la déclaration de résultat, transmis à la DGFiP par **EDI-TDFC** :
- **Régime réel normal (IS/BIC)** : bilan **2050/2051**, compte de résultat **2052/2053**, annexes **2054–2057**,
  détermination du résultat fiscal **2058-A**, etc.
- **Régime réel simplifié** : série **2033-A à 2033-G**.

## 2. Teledec — API disponible ?
- **Teledec** (teledec.fr) est un **service en ligne payant** de saisie/contrôle et de **télétransmission**
  EDI-TDFC de la liasse.
- **API publique** : **non confirmée.** À ce jour, il n'existe pas de documentation d'API développeur publique
  et stable que l'on puisse intégrer de façon fiable. **On n'invente pas d'API.** Toute intégration en ligne
  supposerait une **convention + des identifiants** (partenariat/EDI), à ta main.
- La **télétransmission EDI-TDFC** elle-même passe par un **partenaire EDI** agréé DGFiP (souvent l'expert-
  comptable ou l'OGA) : **hors périmètre logiciel** sans agrément/identifiants.

## 3. Ce que JAMPACK fait (autonome, sans dépendance)
- **Préparation** : JAMPACK produit, à partir de la comptabilité, les **états qui alimentent la liasse** :
  **bilan** (actif/passif) et **compte de résultat** (déjà calculés : `accounting.balanceSheet`,
  `accounting.incomeStatement`), plus le **résultat comptable**.
- **Export** pour l'expert-comptable / le service de télédéclaration : **FEC** (`accounting.fec`),
  **écritures CSV** (`accounting.entries.exportCsv`), bilan/compte de résultat (page **Liasse fiscale**).
- **Écran « Liasse fiscale (préparation) »** : présentation bilan + compte de résultat + résultat comptable,
  avec **avertissements** (option payante Teledec, recommandation d'un expert-comptable) et export.

## 4. Ce que JAMPACK ne fait pas (assumé)
- Le **résultat fiscal** (réintégrations/déductions du 2058-A) : nécessite un expert-comptable.
- Le **remplissage des CERFA officiels** (2050…, 2033…) et la **télétransmission EDI-TDFC** : via Teledec
  (payant) ou l'expert-comptable / OGA. Un connecteur en ligne ne sera ajouté qu'avec une **API officielle
  documentée + tes identifiants**.

## 5b. « Faire nous-mêmes ce que Teledec propose » — analyse de faisabilité
Teledec = (a) **édition/contrôle** de la liasse + (b) **télétransmission EDI-TDFC** à la DGFiP.

| Volet | Faisable en autonomie ? | Détail |
|---|---|---|
| **Agrégats de la liasse** (bilan, compte de résultat simplifié type 2033) calculés depuis la compta | **✅ oui** | Regroupement des comptes PCG en postes standard (CA, achats, charges externes, impôts & taxes, personnel, dotations, résultat). **Livré** (écran Liasse fiscale). |
| **Remplissage exact des CERFA** (codes de cases 2050…/2033-A…G) | **🔶 partiel, sous condition** | Faisable **uniquement d'après la notice officielle DGFiP** de chaque imprimé (on **n'invente pas** les codes de cases). Chantier spec-lourd à cadrer form par form. |
| **Résultat fiscal** (2058-A : réintégrations/déductions) | **⛔ non (métier)** | Nécessite l'appréciation d'un **expert-comptable**. |
| **Télétransmission EDI-TDFC** à la DGFiP | **⛔ non (réglementaire)** | Exige d'être/passer par un **partenaire EDI agréé DGFiP**, de produire le **message EDI-TDFC** au format officiel et un **point de dépôt** conventionné. **Barrière d'agrément + identifiants**, pas de code seul. |

**Conclusion.** Nous pouvons **produire et éditer les états** qui composent la liasse (fait), et, sur fourniture
des **notices officielles**, remplir les **CERFA** case à case. En revanche, **la télétransmission EDI-TDFC
n'est pas réalisable sans agrément DGFiP + identifiants** : ce volet reste, par nature, celui d'un
**expert-comptable** ou d'un **service agréé payant (ex. Teledec)**. C'est aussi pourquoi l'avertissement
« rien ne vaut un expert-comptable » est affiché dans l'application.

## 5. Parcours recommandé
1. Tenir la comptabilité dans JAMPACK (écritures, TVA, immobilisations…).
2. Exporter **FEC** + **écritures CSV** + **bilan/compte de résultat**.
3. Confier au **expert-comptable** l'établissement du résultat fiscal et de la liasse, **ou** saisir/
   contrôler/télétransmettre via un service payant type **Teledec** — en connaissance de son coût.
