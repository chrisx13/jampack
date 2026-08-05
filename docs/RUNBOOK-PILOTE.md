# Runbook — pilote avec une TPE/PME

**Objet :** confronter JAMPACK à un usage réel (1 à 3 clients pilotes) pour révéler friction IHM, écarts
métier et priorités, avant tout déploiement large. Durée conseillée : **2 à 4 semaines**.

## 1. Cadre
- **Profil pilote** : TPE/PME française, idéalement avec un **expert-comptable** associé au test.
- **Environnement** : instance **de test dédiée** (données réelles → durcissement prod requis, voir
  [RUNBOOK-PRODUCTION](RUNBOOK-PRODUCTION.md)) ; sinon données **anonymisées**.
- **Accès démo pour prise en main** : `admin@demo.fr` (Admin) / `compta@demo.fr` (Comptable) — voir seed.

## 2. Préparation
1. Créer la **société** pilote + paramétrage facturation (SIREN/SIRET/TVA/RCS/APE, IBAN, mentions, logo).
2. Créer 2–3 **utilisateurs** avec rôles (Commercial, Comptable, Admin).
3. Importer le **catalogue** (CSV) et quelques **clients/fournisseurs**.

## 3. Scénarios à dérouler (cocher)
**Ventes**
- [ ] Devis → **signature en ligne** par le client (lien public) → conversion en facture.
- [ ] **Facture d'acompte** puis facture de solde.
- [ ] Facture avec **remise globale** + **grille tarifaire** (prix par quantité/client).
- [ ] **Relance** d'une facture échue (lettre) ; **relevé de compte** client.
- [ ] **Abonnement** mensuel → génération des factures dues.
- [ ] **Factur-X** + **bon de livraison** d'une facture.

**Achats / frais**
- [ ] Commande → réception (stock mis à jour) → facture fournisseur (depuis la commande).
- [ ] **Note de frais** → validation → comptabilisation.

**Compta / pilotage**
- [ ] Comptabiliser ventes/règlements ; **rapprochement bancaire** (import CSV) ; **TVA (CA3)**.
- [ ] **FEC** + **écritures CSV** remis à l'expert-comptable ; **liasse (préparation)**.
- [ ] Tableau de bord : « À traiter », **stock sous seuil**, balance âgée.

**Transverse**
- [ ] **Notes de vue** partagées ; multi-société ; export/anonymisation **RGPD** d'un client.
- [ ] Navigation **clavier** + lecteur d'écran sur 2–3 écrans (RGAA).

## 4. Grille de feedback (par scénario)
| Scénario | Terminé sans aide ? (O/N) | Points de friction | Écart métier / manque | Gravité (1-3) | Verbatim utilisateur |
|---|---|---|---|---|---|
| … | | | | | |

## 5. Indicateurs de succès
- **Autonomie** : ≥ 80 % des scénarios réalisés **sans assistance**.
- **Fiabilité** : 0 incident bloquant ; écarts fiscaux = 0 après validation expert-comptable.
- **Adoption** : le pilote **continue** d'utiliser l'outil après la période (intention de bascule).
- **NPS / satisfaction** recueillis en fin de pilote.

## 6. Sortie de pilote
- Consolider la grille §4 → **backlog priorisé** (corrections IHM d'abord, priorité **simplicité d'usage**).
- Décision **go/no-go** déploiement + plan de bascule (import données, formation, support).
