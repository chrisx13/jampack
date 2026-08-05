# Déclaration d'accessibilité — JAMPACK

> **Statut : brouillon.** Ce document suit le modèle officiel RGAA. Le **taux de conformité** et la liste
> détaillée des non-conformités seront renseignés **après un audit RGAA formel** (grille des 106 critères).
> En l'état, JAMPACK n'a pas encore fait l'objet d'un audit ; des **mesures d'accessibilité** ont été prises
> (voir §4) et la démarche est **en cours**.

## 1. Établissement de cette déclaration
Cette déclaration d'accessibilité s'applique à l'application **JAMPACK** (ERP cloud TPE/PME) et à sa
**page publique de signature de devis** (`/devis/<jeton>`).

- Référentiel : **RGAA 4.1** (transposition de WCAG 2.1 niveau AA).
- Date d'établissement : à compléter.
- Technologies : HTML5, CSS3, JavaScript (React), react-bootstrap.

## 2. État de conformité
**Non conforme** (audit non encore réalisé). Objectif produit : **conformité RGAA / WCAG 2.1 AA**.

## 3. Résultats des tests
Aucun audit de conformité par un tiers n'a encore été mené. Un **auto-diagnostic** est en cours (voir la
cartographie par thématique dans [CONFORMITE.md §4](CONFORMITE.md)).

## 4. Mesures d'accessibilité déjà en place
- **Structure & navigation** : landmarks `nav`/`main`/`aside` nommés, **lien d'évitement**, `aria-current`
  sur le domaine/vue actifs, **navigation clavier** des vues, **focus visible** global (`:focus-visible`).
- **Langue & titres** : `lang="fr"` sur le document ; **titre de page** pertinent (dont la page publique,
  mis à jour selon le n° de devis).
- **Tableaux de données** : en-têtes de colonnes `scope="col"` sur les listes principales ; `<caption>` sur
  la page publique.
- **Formulaires** : étiquettes `<label>` **associées** (via `Form.Group controlId`) sur les principales
  modales de saisie (Clients, Catalogue, Notes de frais, Abonnements, Suivi du temps) et le champ signataire
  de la page publique ; messages d'erreur explicites (`Form.Control.Feedback`) sur SIREN/SIRET/IBAN.
- **Contenus non textuels** : icônes décoratives marquées `aria-hidden`, libellés masqués (`visually-hidden`)
  sur les colonnes d'actions.
- **Réactivité** : responsive dès 360 px, zoom 200 % supporté.

## 5. Contenus non accessibles (connus)
- **Kanban du pipeline** (glisser-déposer) : alternative clavier à fournir.
- **Contrastes** : ratios du thème clair/sombre non encore mesurés systématiquement.
- **PDF générés** (factures, devis, BL) : balisage/accessibilité PDF non vérifié.
- **Modales CRM** (contacts, opportunités) et champs résiduels : association `<label>` à compléter.
- **Audit formel des 106 critères RGAA** : non réalisé.

## 6. Environnement de test recommandé
À compléter après audit (navigateurs + lecteurs d'écran testés, ex. NVDA/Firefox, VoiceOver/Safari).

## 7. Retour d'information et contact
Pour signaler un défaut d'accessibilité et obtenir une alternative : **contact éditeur** (à renseigner par
la société déployant JAMPACK).

## 8. Voies de recours
Si une réponse n'est pas apportée, l'utilisateur peut saisir le **Défenseur des droits**
(formulaire en ligne, courrier postal, ou délégué territorial), conformément à la réglementation française.

---
*Modèle basé sur le canevas officiel de déclaration d'accessibilité RGAA. À finaliser après audit
(§1 date, §2 taux de conformité, §3 résultats, §6 environnement, §7 contact).*
