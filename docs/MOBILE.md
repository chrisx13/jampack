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

## Limites levées (v1.1)
- **Droits** : la **saisie** d'une note de frais relève désormais du sujet CASL **`Expense`** (accordé au
  Commercial, au Comptable, à l'Admin) — un salarié en déplacement peut saisir ; la **validation/
  comptabilisation/remboursement** restent réservées à `Accounting` (Comptable).
- **Justificatif photo** : capture depuis l'appareil photo (`capture="environment"`), **compressée côté client**
  (canvas, ≤ 1280 px, JPEG q0.7) et stockée en **data-URL** sur la note (`Expense.receipt`, ≤ ~2,7 Mo) — **sans
  stockage de fichiers externe**. Visualisation via l'icône trombone (desktop).
- **Sélecteur de société** : présent dans l'en-tête mobile si l'utilisateur a accès à plusieurs sociétés.
- **Reconnaissance IA du justificatif** : après la photo, bouton **« Reconnaître (IA, 1 crédit) »**
  (visible seulement si l'IA est activée et créditée) → pré-remplit catégorie / montant / description
  via **Claude** (voir [RECONNAISSANCE-DOCUMENTS](RECONNAISSANCE-DOCUMENTS.md)). En déplacement les
  justificatifs sont des photos → l'IA est le chemin adapté ; la saisie reste **validable** avant envoi.

> Note stockage : les justificatifs sont conservés **en base** (data-URL). Acceptable pour des volumes TPE.
> Pour de gros volumes, prévoir un **stockage objet** (S3) — décision infra.

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
