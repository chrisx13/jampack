# Application mobile (PWA) — utilisateurs en déplacement

**Objet :** interface **mobile minimaliste** pour les collaborateurs en déplacement, centrée sur les
**actions rapides** : saisir une **note de frais** et traiter ses **tâches**. Livrée comme **PWA**
(Progressive Web App) installable, réutilisant l'API, l'authentification et l'isolation RLS existantes.

## Accès & installation
- URL : **`/m`** (ex. `https://<domaine>/m`), authentifiée (Keycloak) comme le reste de l'app.
- **Installable** : « Ajouter à l'écran d'accueil » (Android/Chrome, iOS/Safari) → s'ouvre en plein écran,
  icône dédiée, sans barre de navigateur (`display: standalone`, `start_url: /m`).
- **Hors-ligne** : coquille applicative mise en cache (service worker) ; les **données (API `/trpc`)
  ne sont jamais mises en cache** (fraîcheur + sécurité).

## Écrans (volontairement minimalistes)
- **Frais** : catégorie, montant HT, description → **1 bouton** pour enregistrer ; liste des derniers frais.
  Nécessite le droit `create Accounting`.
- **Tâches** : mes tâches en cours, **action unique** « fait » (droit `update Opportunity`).
- Barre d'onglets en bas (Frais / Tâches), gros boutons tactiles, une seule colonne, zones de sécurité iOS.

## Choix d'architecture
- **PWA** plutôt qu'un binaire natif d'emblée : livraison immédiate, **réutilisation** de tout l'existant
  (React, tRPC, OIDC, RLS), maintenance unifiée avec le web. Pas de store à gérer.
- **Natif (React Native / App Store / Play Store)** = **piste séparée** à décider si une distribution store,
  des capacités natives (appareil photo pour justificatifs, notifications push) ou un usage hors-ligne étendu
  deviennent nécessaires.

## Pistes d'extension (si besoin)
- **Justificatif photo** sur la note de frais → nécessite un **stockage de fichiers** (objet/S3) — décision infra.
- **Notifications push** (tâches, relances) → nécessite un service de push + natif ou Web Push.
- Sélecteur de **société** sur mobile (multi-société) ; agenda du jour ; pointage de temps rapide.
