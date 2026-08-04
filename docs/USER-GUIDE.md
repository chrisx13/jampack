# Guide utilisateur

**Projet :** JAMPACK · **Public :** utilisateurs finaux · **Version :** 1.0

## 1. Connexion & navigation
- Se connecter via **Se connecter** (OIDC/Keycloak). Démo : `admin@demo.fr / admin`.
- **Sélecteur de société** (barre du haut) : basculer entre sociétés ou vue **consolidée**.
- Navigation type VS Code : **barre d'activité** (domaines à gauche) → **panneau** (vues) → **onglets**.
  Le panneau peut être **épinglé** (statique) ou **à la volée** (se referme après sélection).

## 2. CRM
- **Clients** / **Contacts** : créer, modifier ; rattacher contacts et établissements (siège/facturation/livraison).
- **Pipeline** : glisser-déposer les opportunités entre étapes.

## 3. Ventes
- **Catalogue** : articles/services, catégories, taux de TVA.
- **Devis** : créer → **Envoyer** (numéro DE-) → **Accepter/Refuser** → **Convertir en facture**.
- **Factures** : créer → **Valider** (numéro FA-, échéance) → **PDF**. Depuis une facture validée :
  **Créer un avoir** ; saisir des **Règlements** (acompte, reste dû, passage *payée*).
- **Facturation électronique** : sur une facture validée, **Factur-X** (télécharge le XML CII/EN 16931) et
  **Envoyer via PDP** ; le **statut de transmission** s'affiche ensuite sur la facture.
- **Échéancier** : factures non soldées, retard.
- **Relances** : factures échues non soldées, triées par niveau. Bouton **Relancer** (rappel → relance ferme →
  mise en demeure) et téléchargement de la **lettre de relance** conforme (mention pénalités + indemnité forfaitaire 40 €).

## 4. Achats
- **Commandes fournisseurs** : choisir un fournisseur (tiers marqué fournisseur) et un **entrepôt de
  réception** → **Valider & envoyer** (numéro CM-) → **Réceptionner** (entre la marchandise en stock).
- **Factures fournisseurs** : saisir (n° du fournisseur, TVA) → **Valider** → **Marquer payée**.
- **Règlements fournisseurs** : enregistrer les paiements émis (acompte, solde) et suivre le reste dû.
- **Échéancier fournisseur** : factures à payer, reste dû, retard.

## 5. Stock
- **Entrepôts** : gérer les lieux de stockage (un par défaut).
- **Mouvements** : entrée / sortie / ajustement (quantité signée pour l'ajustement).
- **Niveaux** : quantité nette par article et entrepôt ; **inventaire** (bouton par ligne : saisir la
  quantité comptée, un ajustement est généré) ; **alerte de rupture** pour les articles sous leur seuil.
- **Valorisation** : valeur du stock au **PMP** (prix moyen pondéré) ou en **FIFO** (premier entré, premier sorti) — méthode au choix.
- **Lots & péremption** : renseignez un **n° de lot/série** et une **date de péremption** sur un mouvement ;
  la vue *Lots & péremption* affiche les soldes par lot et alerte sur les lots périmés ou bientôt périmés.
- **Seuil de réapprovisionnement** : se définit sur la fiche article (Catalogue).

## 6. Comptabilité
- **Plan comptable** : consulter/gérer les comptes (PCG).
- **Écritures** : saisir et consulter les écritures (générées automatiquement depuis les pièces validées).
- **Balance** : soldes par compte.
- **Grand livre** : détail des mouvements d'un compte avec solde progressif.
- **Lettrage** : rapprocher débits/crédits d'un même tiers.
- **Rapprochement bancaire** : pointer les écritures du compte banque (512) au relevé (soldes comptable/pointé/reste), ou **importer un relevé CSV** (`date ; libellé ; montant`) pour un pointage automatique par montant.
- **Déclaration de TVA (CA3)** : collectée − déductible ; écriture de clôture.
- **Immobilisations** : enregistrer les biens amortissables, consulter leur **plan d'amortissement** (linéaire) et **comptabiliser la dotation** de chaque exercice (681 → 281).
- **FEC** : export du Fichier des Écritures Comptables.

## 7. Trésorerie
- **Prévisionnel** : projection des encaissements et décaissements à partir des échéanciers client et fournisseur (position nette, retards).
- **Balance âgée** : créances clients non soldées ventilées par ancienneté (non échu, 1-30, 31-60, 61-90, +90 jours) — pilotage du recouvrement.

## 8. Administration
- **Paramètres**, **Société (facturation)** (en-tête, mentions légales, CGV), **Facturation** (banques,
  affacturage, conditions de paiement), **Apparence** (couleurs de marque du compte).
- **Sociétés** : gérer les sociétés du compte.
- **Utilisateurs & rôles** : gérer les membres et leurs rôles par société (RBAC cumulable).
- **Journal d'audit** : consulter les mutations tracées (utilisateur, action, société, horodatage).

## 9. Bonnes pratiques
- Une pièce **validée** n'est plus modifiable (créer un avoir / une nouvelle pièce si besoin).
- Renseigner l'**entrepôt de réception** sur une commande avant de la réceptionner.
- Vérifier les **droits** : certaines actions dépendent de votre rôle sur la société active.
