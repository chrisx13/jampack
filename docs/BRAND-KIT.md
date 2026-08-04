# JAMPACK — Kit de marque

**Version :** 1.0 · **Date :** 4 août 2026 · **Nature :** identité visuelle officielle du produit.

Ce document est la **source de vérité** de l'identité JAMPACK. Il complète et fait évoluer la *Charte &
stack front* (`.docx`) : le système est désormais **« Slate + Indigo »** (Inter, Bootstrap 5), plus premium
que le thème initial. Les tokens décrits ici sont ceux réellement appliqués dans
[`apps/web/src/theme/theme.scss`](../apps/web/src/theme/theme.scss).

## 1. Logo

- **Signe (mark)** : tuile arrondie (rayon 11/40) en **violet-ardoise `#3E3A52`** (couleur de marque),
  portant **trois barres ascendantes en dégradé indigo→sky** — la croissance et les modules d'un ERP
  unifiés en un « pack ». Un liseré indigo discret assure la lisibilité sur fond sombre.
- **Logotype (wordmark)** : `JAMPACK` en **Inter 700**, interlettrage serré (‑0,02em). « JAM » en encre
  (`#0F172A`), « PACK » en indigo (`#4F46E5`).
- **Fichiers** : [`jampack-mark.svg`](../apps/web/public/brand/jampack-mark.svg) (signe seul, favicon,
  barre repliée), [`jampack-logo.svg`](../apps/web/public/brand/jampack-logo.svg) (lockup complet),
  [`favicon.svg`](../apps/web/public/favicon.svg).
- **Zone de protection** : au moins la hauteur d'une barre autour du logo. **Taille mini** : signe 20 px,
  lockup 120 px de large.
- **À éviter** : déformer, recolorer le signe hors palette, poser le lockup sombre sur fond sombre (utiliser
  la version claire), ajouter ombre/contour au wordmark.

## 2. Couleurs

### Marque
| Rôle | Token | Hex |
|---|---|---|
| Primaire (Indigo) | `$indigo` / `--bs-primary` | `#4F46E5` |
| Dégradé de marque | mark / accents | `#6366F1 → #0EA5E9` |
| Succès (Emerald) | `$success` | `#10B981` |
| Info (Sky) | `$info` | `#0EA5E9` |
| Alerte (Amber) | `$warning` | `#F59E0B` |
| Danger (Rose) | `$danger` | `#EF4444` |

### Neutres — ardoise (Slate)
`#F8FAFC` (fond app) · `#F1F5F9` · `#E2E8F0` (bordures) · `#CBD5E1` · `#94A3B8` · `#64748B` (texte
secondaire) · `#475569` · `#334155` · `#1E293B` · `#0F172A` (encre / texte principal).

**Contraste** : viser AA (≥ 4,5:1 texte, ≥ 3:1 UI). L'indigo `#4F46E5` sur blanc = 7,0:1 ✅.

## 3. Typographie

- **Police** : **Inter** (chargée via `@fontsource/inter`). Repli : `system-ui, Segoe UI, Roboto`.
- **Titres** : poids **600**, interlettrage négatif léger. **Corps** : 400/500. **Labels de tableau** :
  600, majuscules, `letter-spacing .04em`.
- **Échelle** (rem) : 0,72 (labels) · 0,875 (small) · 1 (corps) · 1,12 (marque) · 1,25 · 1,5 (h4) · 2 (h1).

## 4. Formes, espacement, élévation

- **Rayons** : sm .5rem · base .625rem · card .75rem · lg .875rem · xl 1rem.
- **Espacement** : trame 4 px (Bootstrap `.25rem`). Gouttières cartes/sections : 1rem.
- **Élévation** : ombres douces basées slate (`rgba(2,6,23,.06→.18)`) ; jamais d'ombre dure noire.
- **Bordures** : 1px `#E2E8F0`. Le signe porte une ombre indigo discrète (`rgba(79,70,229,.28)`).

## 5. Iconographie

- **Bootstrap Icons** (`bootstrap-icons`), trait régulier, taille alignée sur le texte. Une icône ne porte
  jamais seule une information critique (toujours doublée d'un libellé — cf. RGAA).

## 6. Composants (principes)

- **Boutons** : poids 500, rayon base ; primaire indigo plein, secondaire `outline` sur neutres.
- **Cartes** : fond surface, bordure slate, rayon .75rem, en-tête transparent.
- **Badges de statut** : fond `-subtle` + texte de la même teinte + **libellé explicite**.
- **Tableaux** : en-têtes majuscules discrètes, lignes séparées par bordure slate fine.
- **Focus clavier** : contour indigo visible (`:focus-visible`) — accessibilité (RGAA 10.7).

## 7. Modèles de documents

Gabarit commun (facture / devis / avoir) — [`invoiceHtml.ts`](../apps/api/src/invoice/invoiceHtml.ts) :

- **Barre d'accent** dégradé indigo→sky en tête de page.
- En-tête : **identité de la société émettrice** (logo `logoUrl` ou raison sociale, coordonnées) à gauche,
  **type + numéro + dates** à droite (titre en indigo).
- Parties : bloc « Facturé à » avec identité et **identifiants acheteur** (SIRET, TVA).
- Lignes : filet indigo sous l'en-tête de tableau ; totaux avec filet TTC indigo.
- Mentions légales françaises : **subrogation** (affacturage), **LME** (pénalités + indemnité 40 €),
  **franchise 293 B** le cas échéant.
- Pied de page : mentions légales société + **attribution discrète « Édité avec JAMPACK »** (mini-signe).

Le document reste **à la marque de la société cliente** ; JAMPACK n'appose qu'une attribution discrète.

## 8. Application produit

- **Barre supérieure** : signe + wordmark (le wordmark s'adapte au thème clair/sombre).
- **Favicon / onglet** : signe dégradé.
- **Modes clair et sombre** pilotés par `data-bs-theme` (variables `--bs-*` et surfaces `--*`).
