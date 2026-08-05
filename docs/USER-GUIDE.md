# Guide utilisateur

**Projet :** JAMPACK · **Public :** utilisateurs finaux · **Version :** 1.0

## 1. Connexion & navigation
- Se connecter via **Se connecter** (OIDC/Keycloak). Démo : `admin@demo.fr / admin`.
- **Sélecteur de société** (barre du haut) : basculer entre sociétés ou vue **consolidée**.
- Navigation type VS Code : **barre d'activité** (domaines à gauche) → **panneau** (vues) → **onglets**.
  Le panneau peut être **épinglé** (statique) ou **à la volée** (se referme après sélection).
- **Tableau de bord** : indicateurs clés (CRM + finances) et panneau **« À traiter »** (échéances et tâches
  des 14 prochains jours, retards signalés) — l'essentiel visible sans naviguer.
- **Notes de vue** (bouton **Note**, en bas à droite de chaque vue) : pense-bêtes **partagés** — visibles par
  tous les utilisateurs ayant accès à la vue. On peut en créer **plusieurs**, les **déplacer** (glisser l'en-tête)
  pour ne pas masquer les données, changer leur **couleur**, et consulter l'**historique** des modifications
  (chaque enregistrement est tracé : qui, quand, quel contenu). Le compteur permet de les masquer/afficher.

## 2. CRM
- **Clients** / **Contacts** : créer, modifier ; rattacher contacts et établissements (siège/facturation/livraison).
- **Pipeline** : glisser-déposer les opportunités entre étapes. Chaque étape porte une **probabilité de conversion** ;
  le bandeau affiche le nombre d'affaires, le montant total, le **prévisionnel pondéré** (montant × probabilité)
  et le **taux de conversion** (affaires gagnées / affaires clôturées).
- **Activités & tâches** : consigner notes, appels, e-mails, rendez-vous et **tâches** rattachés à un client.
  Les tâches à faire s'affichent triées par échéance (les **en retard** signalées) ; bouton ✓ pour les clôturer.

## 3. Ventes
- **Catalogue** : articles/services, catégories, taux de TVA. **Importer CSV** (`référence ; nom ; prix HT ;
  unité ; type`) : crée les nouveaux articles et met à jour ceux dont la référence existe déjà — idéal pour l'onboarding.
- **Devis** : créer → **Envoyer** (numéro DE-) → **Accepter/Refuser** → **Convertir en facture**.
- **Devis à échéance** : liste des devis émis par date de validité (valide / expire sous 7 j / expiré) — pour relancer avant caducité de l'offre.
- **Dupliquer** : depuis une pièce ouverte, le bouton **Dupliquer** crée un brouillon identique (client, lignes) — pratique pour une facturation récurrente.
- **Réf. commande client** : saisir le n° de bon de commande / marché du client ; il apparaît sur le PDF (exigence fréquente en B2B).
- **Remise globale** : dans le bloc des totaux, choisir « Remise % » ou « Remise € » et saisir la valeur ; elle
  s'applique à toute la pièce (la TVA par taux reste exacte) et apparaît sur le PDF (sous-total, remise, net).
- **Facture d'acompte** : sur un devis émis, bouton **Facture d'acompte** → saisir le pourcentage ; une facture
  d'acompte (brouillon) est créée, ventilée par taux de TVA. À la **conversion** du devis en facture, les acomptes
  déjà facturés (validés) sont **automatiquement déduits** : la facture obtenue est la facture de solde.
- **Grille tarifaire** : dans le Catalogue, bouton **Tarifs** (icône étiquettes) sur un article → définir des prix
  par **palier de quantité** et/ou par **client**. À la saisie d'une pièce, le prix unitaire est résolu
  automatiquement (tarif client prioritaire, puis palier de quantité atteint ; sinon prix de base).
- **Bon de livraison** : sur une facture validée, bouton **Bon de livraison** → télécharge un BL (PDF) numéroté
  (BL-…), sans prix (désignation, quantités, adresse de livraison, cartouche « Reçu conforme » à signer par le client).
- **Abonnements** (Ventes ▸ Abonnements) : définir un modèle récurrent (client, lignes, fréquence, prochaine
  échéance). Le bouton **Générer les factures dues** crée en brouillon les factures des abonnements arrivés à
  échéance (les périodes en retard sont rattrapées) et reporte automatiquement la prochaine échéance.
- **Suivi du temps** (Ventes ▸ Suivi du temps) : saisir le temps passé par client (durée, taux horaire). Le
  bandeau « À facturer » propose, par client, de générer une facture (brouillon) regroupant ses temps ouverts
  facturables (une ligne par temps) ; les temps sont alors marqués **facturés**.
- **Devis** : le PDF porte la **date de validité**, les **CGV** et un cartouche **« Bon pour accord »** (date + signature) pour l'acceptation par le client.
- **Escompte** (Administration ▸ Société) : renseigner vos conditions d'escompte pour paiement anticipé ; laissé vide,
  la facture porte automatiquement la mention légale « Pas d'escompte pour paiement anticipé » (art. L441-10).
- **Factures** : créer → **Valider** (numéro FA-, échéance) → **PDF**. Depuis une facture validée :
  **Créer un avoir** ; saisir des **Règlements** (acompte, reste dû, passage *payée*).
- **Facturation électronique** : sur une facture validée, **Factur-X** (télécharge le XML CII/EN 16931) et
  **Envoyer via PDP** ; le **statut de transmission** s'affiche ensuite sur la facture.
- **Échéancier** : factures non soldées, retard.
- **Relances** : factures échues non soldées, triées par niveau. Bouton **Relancer** (rappel → relance ferme →
  mise en demeure) et téléchargement de la **lettre de relance** conforme (mention pénalités + indemnité forfaitaire 40 €).

### Notes de frais (Achats ▸ Notes de frais)
- Saisir une dépense (date, catégorie, description, HT, TVA). Après **Valider**, la note peut être
  **comptabilisée** (charge 6xx + TVA déductible au débit, compte 421 « dû au salarié » au crédit),
  puis marquée **remboursée**. Les comptes PCG nécessaires sont créés automatiquement s'ils manquent.

## 4. Achats
- **Commandes fournisseurs** : choisir un fournisseur (tiers marqué fournisseur) et un **entrepôt de
  réception** → **Valider & envoyer** (numéro CM-) → **Tout réceptionner** (entre la marchandise en stock).
  **Réception échelonnée** : saisir les quantités reçues par ligne (reste dû affiché) ; la commande passe en
  *réception partielle* puis *réceptionnée* une fois toutes les lignes soldées.
- **Commandes en retard** : commandes envoyées non encore réceptionnées dont la date de livraison prévue
  est dépassée, avec le nombre de jours de retard — pour relancer le fournisseur.
- **Dupliquer** : depuis une commande ouverte, recrée un brouillon identique — pratique pour les réassorts récurrents.
- **Factures fournisseurs** : saisir (n° du fournisseur, TVA) → **Valider** → **Marquer payée**.
- **Règlements fournisseurs** : enregistrer les paiements émis (acompte, solde) et suivre le reste dû.
- **Échéancier fournisseur** : factures à payer, reste dû, retard.

## 5. Stock
- **Entrepôts** : gérer les lieux de stockage (un par défaut).
- **Mouvements** : entrée / sortie / ajustement (quantité signée pour l'ajustement). **Transfert inter-entrepôts**
  (carte dédiée) : déplace une quantité d'un entrepôt à un autre en générant automatiquement la sortie et l'entrée.
- **Niveaux** : quantité nette par article et entrepôt ; **inventaire** (bouton par ligne : saisir la
  quantité comptée, un ajustement est généré) ; **alerte de rupture** pour les articles sous leur seuil ;
  **Exporter CSV** des niveaux (référence ; article ; entrepôt ; quantité ; unité).
- **Valorisation** : valeur du stock au **PMP** (prix moyen pondéré) ou en **FIFO** (premier entré, premier sorti) — méthode au choix.
- **Lots & péremption** : renseignez un **n° de lot/série** et une **date de péremption** sur un mouvement ;
  la vue *Lots & péremption* affiche les soldes par lot et alerte sur les lots périmés ou bientôt périmés.
- **Seuil de réapprovisionnement** : se définit sur la fiche article (Catalogue).

## 6. Comptabilité
- **Plan comptable** : consulter/gérer les comptes (PCG).
- **Écritures** : saisir et consulter les écritures (générées automatiquement depuis les pièces validées).
- **Balance** : soldes par compte ; **Exporter CSV** (compte ; libellé ; débit ; crédit ; solde) ou **le FEC**.
- **Grand livre** : détail des mouvements d'un compte avec solde progressif.
- **États financiers** : **compte de résultat** (produits − charges → bénéfice/perte) et **bilan simplifié**
  (actif/passif par classe, résultat de l'exercice) — vue de gestion, sans se substituer à la liasse fiscale.
- **Lettrage** : rapprocher débits/crédits d'un même tiers.
- **Rapprochement bancaire** : pointer les écritures du compte banque (512) au relevé (soldes comptable/pointé/reste), ou **importer un relevé CSV** (`date ; libellé ; montant`) pour un pointage automatique par montant.
- **Déclaration de TVA (CA3)** : collectée − déductible ; écriture de clôture.
- **Immobilisations** : enregistrer les biens amortissables, consulter leur **plan d'amortissement** (linéaire) et **comptabiliser la dotation** de chaque exercice (681 → 281).
- **FEC** : export du Fichier des Écritures Comptables.

## 7. Trésorerie
- **Prévisionnel** : projection des encaissements et décaissements à partir des échéanciers client et fournisseur (position nette, retards). **Courbe hebdomadaire** sur 8 semaines avec position de trésorerie cumulée (les échéances en retard sont imputées à la semaine en cours).
- **Balance âgée** : créances clients non soldées ventilées par ancienneté (non échu, 1-30, 31-60, 61-90, +90 jours) — pilotage du recouvrement.

## 7 bis. Gestion — Agenda
- **Agenda** : vue consolidée des échéances et tâches à venir sur **7 / 30 / 90 jours**, regroupées par jour :
  tâches CRM, encaissements (factures clients), décaissements (factures fournisseurs) et livraisons attendues.
  Les éléments **en retard** sont signalés en rouge. Bouton **ICS** : exporter l'agenda au format iCalendar
  pour l'importer dans Outlook, Google Agenda ou Apple Calendrier.

## 8. Administration
- **Paramètres**, **Société (facturation)** (en-tête, mentions légales, CGV), **Facturation** (banques,
  affacturage, conditions de paiement), **Apparence** (couleurs de marque du compte).
- **Sociétés** : gérer les sociétés du compte.
- **Utilisateurs & rôles** : gérer les membres et leurs rôles par société (RBAC cumulable).
- **Journal d'audit** : consulter les mutations tracées (utilisateur, action, société, horodatage) ; **Exporter CSV** pour archivage/contrôle.

## 9. Bonnes pratiques
- Une pièce **validée** n'est plus modifiable (créer un avoir / une nouvelle pièce si besoin).
- Renseigner l'**entrepôt de réception** sur une commande avant de la réceptionner.
- Vérifier les **droits** : certaines actions dépendent de votre rôle sur la société active.
