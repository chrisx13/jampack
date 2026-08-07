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
| Règlement fournisseur | Décaissement (`SupplierPayment`) rattaché à une facture fournisseur (compte à payer). |
| Échéancier | Liste des pièces non soldées avec reste dû et retard (client ou fournisseur). |
| Lettrage | Rapprochement des règlements avec les pièces (soldé / partiellement soldé), code `letter`. |
| PMP | Prix Moyen Pondéré : méthode de valorisation du stock (coût unitaire moyen des entrées). |
| Trésorerie prévisionnelle | Projection des encaissements/décaissements attendus à partir des échéanciers client et fournisseur. |
| Affacturage / Subrogation | Cession de créance : le règlement va à l'**affactureur** (mention obligatoire). |
| Commande fournisseur | Bon de commande (numéro `CM-`) ; sa **réception** entre la marchandise en stock. |
| Facture fournisseur | Facture reçue d'un fournisseur (compte à payer). |
| Mouvement de stock | Entrée / sortie / ajustement (quantité **signée**). |
| Niveau de stock | Quantité nette (somme des mouvements) par article et entrepôt. |
| Seuil de réapprovisionnement | Quantité minimale (`reorderPoint`) sous laquelle un article est signalé en rupture. |
| Inventaire physique | Comptage réel d'un article ; l'écart avec le stock théorique génère un mouvement d'ajustement. |
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
| Super-admin général | Technicien de la société JAMPACK (`manage:PlatformOps`) : pilote la flotte ; voit les secrets **tronqués**. |
| Technicien de structure | Super-admin d'une instance côté client (`manage:Ops`) : actif **uniquement si serveur du client** (`HOSTING_MODE=self`) ; révèle les secrets en clair. |
| `HOSTING_MODE` | Mode d'hébergement d'une instance : `self` (serveur du client) ou `jampack` (hébergé) — détermine le niveau super-admin effectif (isolation absolue). |
| `INSTANCE_MODE` | Mode d'exécution : `test` ou `prod` (passage en prod = confirmation typée). |
| `OpsExecution` | Journal **append-only** des opérations de pilotage (qui, opération, cible, dry-run/réel, résultat). |
| Opération hôte / `OPS_HOST_RUNNER` | Opération nécessitant un accès système (sauvegarde/restauration/redémarrage) ; **désactivée par défaut**. |
| Dry-run | Simulation d'une opération sans effet (aperçu de ce qui serait fait). |
| Confirmation typée | Jeton à saisir exactement (ex. `RESTAURER`, `PROD`) pour exécuter une action sensible. |
| `SECRETS_KEY` | Clé (32 octets) activant le **chiffrement au repos** des secrets d'instance (AES-256-GCM). |
| Crédit IA (`AiCreditLedger`) | Unité de consommation de l'enrichissement IA (Claude) : 1 crédit/document ; le **niveau 1 est gratuit et local**. |

## Réglementaire
| Terme | Définition |
|---|---|
| Factur-X | Format de facture électronique hybride (PDF/A-3 + XML CII). |
| CII | Cross Industry Invoice : sémantique XML UN/CEFACT portée par le XML de Factur-X. |
| EN 16931 | Norme européenne de facture électronique (modèle sémantique) implémentée par Factur-X. |
| PPF | Portail Public de Facturation (annuaire/concentrateur). |
| PDP | Plateforme de Dématérialisation Partenaire (agréée) pour l'échange des factures. |
| PdpTransmission | Entité de suivi d'une transmission de facture vers la PDP (`provider`, `status`, `providerRef`). |
| e-reporting | Transmission à l'administration des données de transactions/paiements (hors e-invoicing B2B domestique). |
| FEC | Fichier des Écritures Comptables (format normé d'export). |
| NF525 | Certification des logiciels d'encaissement (B2C espèces). |
| RGPD | Règlement Général sur la Protection des Données (UE 2016/679). |
| CA3 | Déclaration de TVA (régime réel normal). |
