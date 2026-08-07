# Scénarios d'utilisation — pas à pas

Parcours types du quotidien, de bout en bout, pour l'utilisateur. Ces scénarios alimentent aussi
l'**aide en ligne** (bouton **?** en bas à droite) et l'**assistant IA**. Voir aussi le
[Guide utilisateur](USER-GUIDE.md).

> Repère : *Domaine ▸ Écran ▸ Action*. L'aide in-app propose la recherche **gratuite** de ces guides,
> et un **assistant IA (Claude)** optionnel (1 crédit) qui répond en s'appuyant sur ce contenu.

## Prise en main (5 min)
1. **Se connecter**, choisir la **société active** (en haut) si vous en gérez plusieurs.
2. *Administration ▸ Société* : renseigner l'identité et la **forme juridique** (les mentions et le
   régime de TVA par défaut s'ajustent).
3. *Administration ▸ Utilisateurs & rôles* : inviter vos collaborateurs et leur attribuer des rôles.

## Scénario 1 — Du client au règlement (cycle de vente complet)
1. **CRM ▸ Clients ▸ Nouveau** : créer le client (SIREN contrôlé, TVA proposée).
2. **Ventes ▸ Devis ▸ Nouveau** : lignes (prix résolu par la grille tarifaire), remise globale au pied.
3. **Faire signer** en ligne : envoyer le lien à jeton ; le client **accepte** (preuve : nom, date, IP).
4. **Convertir en facture**, vérifier, **valider** (la pièce devient non modifiable).
5. **Factur-X** : générer le PDF avec le XML embarqué (EN 16931).
6. **Encaisser** : saisir le règlement → la facture passe **payée** ; **comptabiliser** (512).

## Scénario 2 — Note de frais avec justificatif (mobile + reconnaissance)
1. En déplacement, ouvrir **`/m`** sur le téléphone (installable).
2. Saisir un frais (catégorie, montant, **TVA**) et **prendre une photo** du justificatif.
3. Si l'IA est disponible : **« Reconnaître (1 crédit) »** pré-remplit ; sinon la photo sert de
   justificatif **gratuit**. Enregistrer.
4. Au bureau, *Achats ▸ Notes de frais* : **valider** puis **comptabiliser** (6xx / TVA / 421),
   enfin **marquer remboursée**.

## Scénario 3 — Facture fournisseur (avec « Scanner »)
1. *Achats ▸ Factures fournisseurs ▸ Nouvelle facture* (ou **Scanner** un PDF/photo).
2. **Gratuit** : sur un PDF, JAMPACK extrait fournisseur, montants, date (confiance par champ) et
   pré-remplit ; associer le **fournisseur** et une **commande** (rapprochement 3 voies).
3. **Valider**, **régler**, **comptabiliser** (journal des achats).

## Scénario 4 — Clôture TVA et remise à l'expert-comptable
1. *Comptabilité ▸ Déclaration TVA (CA3)* : vérifier collectée (44571) − déductible (44566) selon le
   régime (franchise 293 B, autoliquidation…). **Clôturer** la période.
2. *Comptabilité ▸ Exports* : exporter le **FEC** + journaux/balance/grand livre en CSV.
3. Transmettre à l'**expert-comptable** (voir [DOSSIER-CONFORMITE-FISCALE](DOSSIER-CONFORMITE-FISCALE.md)).

## Scénario 5 — Paramétrer la forme juridique (mentions correctes)
1. *Administration ▸ Société* : choisir la **forme juridique** (SARL, micro, EI, SAS, SCI…).
2. Les **mentions** (capital, RCS/RNE, « TVA non applicable art. 293 B »…) et le **régime TVA** par
   défaut s'appliquent ; vérifier l'**aperçu**. Elles figureront sur les pièces.

## Scénario 6 — Administration IA & pilotage (selon habilitation)
1. *Administration ▸ Crédits IA* : le **niveau 1** (extraction locale des PDF) est **gratuit** ; le
   **niveau 2** (IA Claude, photos/cas difficiles) consomme **1 crédit**. Recharger, suivre l'historique.
2. *Administration ▸ Pilotage technique* (super-admin) : **État** (mode test/prod + diagnostic),
   **Configuration & clés**, **Opérations** (dry-run + confirmation typée). Voir [PILOTAGE-TECHNIQUE](PILOTAGE-TECHNIQUE.md).

## Utiliser l'aide en ligne
- Bouton **?** (bas à droite) : **rechercher** un guide (gratuit) ou déplier un scénario pas à pas.
- **Assistant IA** (optionnel, 1 crédit) : poser une question ; la réponse s'appuie sur ces guides et
  cite ses **sources**. Il ne donne jamais de conseil juridique/comptable définitif.
