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
- **Échéancier** : factures non soldées, retard.

## 4. Achats
- **Commandes fournisseurs** : choisir un fournisseur (tiers marqué fournisseur) et un **entrepôt de
  réception** → **Valider & envoyer** (numéro CM-) → **Réceptionner** (entre la marchandise en stock).
- **Factures fournisseurs** : saisir (n° du fournisseur, TVA) → **Valider** → **Marquer payée**.
- **Échéancier fournisseur** : factures à payer, retard.

## 5. Stock
- **Entrepôts** : gérer les lieux de stockage (un par défaut).
- **Mouvements** : entrée / sortie / ajustement (quantité signée pour l'ajustement).
- **Niveaux** : quantité nette par article et entrepôt.

## 6. Administration
- **Paramètres**, **Société (facturation)** (en-tête, mentions légales, CGV), **Facturation** (banques,
  affacturage, conditions de paiement), **Apparence** (couleurs de marque du compte).

## 7. Bonnes pratiques
- Une pièce **validée** n'est plus modifiable (créer un avoir / une nouvelle pièce si besoin).
- Renseigner l'**entrepôt de réception** sur une commande avant de la réceptionner.
- Vérifier les **droits** : certaines actions dépendent de votre rôle sur la société active.
