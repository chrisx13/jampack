# Glossaire

**Projet :** JAMPACK · **Version :** 1.0

## Métier
| Terme | Définition |
|---|---|
| Compte | Tenant / abonnement (`Organization`). Regroupe plusieurs sociétés. |
| Société | Entité juridique (`Societe`) au sein d'un compte ; compta/facturation cloisonnées. |
| Tiers | Personne morale (`Company`), **client** (`isCustomer`) et/ou **fournisseur** (`isSupplier`). |
| Établissement | Adresse d'un tiers (siège, facturation, livraison). |
| Pièce de vente | Devis, facture ou avoir (modèle unique `Invoice` discriminé par `docType`). |
| Devis | Proposition commerciale (numéro `DE-`), convertible en facture. |
| Avoir | Note de crédit (numéro `AV-`) émise depuis une facture. |
| Règlement | Encaissement (`Payment`) rattaché à une facture client. |
| Échéancier | Liste des pièces non soldées avec reste dû et retard (client ou fournisseur). |
| Affacturage / Subrogation | Cession de créance : le règlement va à l'**affactureur** (mention obligatoire). |
| Commande fournisseur | Bon de commande (numéro `CM-`) ; sa **réception** entre la marchandise en stock. |
| Facture fournisseur | Facture reçue d'un fournisseur (compte à payer). |
| Mouvement de stock | Entrée / sortie / ajustement (quantité **signée**). |
| Niveau de stock | Quantité nette (somme des mouvements) par article et entrepôt. |
| Vue consolidée | Vue multi-sociétés (toutes les sociétés accessibles du compte). |

## Technique
| Terme | Définition |
|---|---|
| RLS | Row-Level Security PostgreSQL : filtrage par ligne selon le contexte tenant. |
| tRPC | Framework d'API TypeScript type-safe (contrat partagé front/back). |
| CASL | Bibliothèque d'autorisation (règles action×subject). |
| OIDC | OpenID Connect (authentification déléguée à Keycloak). |
| Zod | Bibliothèque de validation de schémas (partagée `packages/domain`). |
| `withTenant` | Ouvre une transaction et positionne le contexte RLS (`app.current_org`/`current_societe`). |
| Seed | Jeu de données de démonstration déterministe. |

## Réglementaire
| Terme | Définition |
|---|---|
| Factur-X | Format de facture électronique hybride (PDF/A-3 + XML CII). |
| PPF | Portail Public de Facturation (annuaire/concentrateur). |
| PDP | Plateforme de Dématérialisation Partenaire (agréée) pour l'échange des factures. |
| FEC | Fichier des Écritures Comptables (format normé d'export). |
| NF525 | Certification des logiciels d'encaissement (B2C espèces). |
| RGPD | Règlement Général sur la Protection des Données (UE 2016/679). |
| CA3 | Déclaration de TVA (régime réel normal). |
