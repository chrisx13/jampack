# Aide à la reconnaissance automatique des documents (factures fournisseurs / frais)

**Objet :** assister la saisie d'une **facture fournisseur** ou d'une **note de frais** à partir d'un **PDF**
ou d'une **photo** : produire un **résumé** + un **brouillon pré-rempli** (mapping des données) que
l'utilisateur **valide** avant création. **Aucune pièce n'est créée/comptabilisée sans validation humaine.**

## 1. Coût — réponse directe
| Voie | Coût par document | Dépendance | Précision |
|---|---|---|---|
| **Factur-X / e-invoice** (XML embarqué dans le PDF) | **0 €** | aucune (parsing local) | **exacte** (données structurées) |
| **PDF natif** (texte embarqué) + **règles FR** | **0 €** | aucune (lib de lecture PDF) | bonne (factures « propres ») |
| **OCR local — Tesseract** (photos/scans) | **0 €** par document | **binaire à embarquer** (coût = build, pas d'usage) | moyenne (dépend de la photo) |
| **Document AI / LLM cloud** (Google/AWS/Azure/Mindee/LLM) | **payant** (par page/appel) | **tiers + identifiants + RGPD** | élevée, y compris sur scans médiocres |

**Conclusion :**
- **Faisable SANS coût par document** via **Factur-X** + **PDF natif + règles** (+ **Tesseract** libre pour les
  photos, au prix d'une dépendance technique, pas d'un coût d'usage).
- **Le coût n'est OBLIGATOIRE que** pour une extraction **robuste sur photos/scans de mauvaise qualité**
  (service payant). C'est **optionnel** et relève de ta décision (budget + identifiants + RGPD : les images
  seraient envoyées à un tiers).

## 2. IA ou pas ?
- **Sans IA (recommandé pour le cœur)** : Factur-X + texte PDF + **règles/regex** + nos **validateurs FR**
  (SIREN/SIRET par clé de Luhn, n° TVA, IBAN mod-97) → **déterministe, explicable, gratuit**.
- **Avec IA** : uniquement pour les **cas difficiles** (photos froissées, mises en page atypiques). Un **LLM**
  ou un **Document AI** améliore le rappel mais introduit **coût + tiers + RGPD**. → **option**, pas le socle.

## 3. Parcours utilisateur (aide + résumé + mapping + validation)
1. Dépôt d'un **PDF** ou d'une **photo** (facture fournisseur ou frais).
2. Tentative en cascade : **(a)** Factur-X embarqué → mapping exact ; **(b)** texte PDF natif → mapping par
   règles ; **(c)** OCR local (si activé) → mapping par règles.
3. Affichage d'un **résumé** (fournisseur, date, n° pièce, HT/TVA/TTC) + **brouillon pré-rempli**, avec un
   **indice de confiance par champ** (ex. IBAN/SIREN **validés** = confiance haute).
4. **Validation humaine obligatoire** : l'utilisateur corrige/confirme → création de la pièce (brouillon).
5. Le **justificatif** (PDF/photo) reste **attaché** à la pièce.

## 4. Plan d'implémentation proposé (par valeur, sans coût d'abord)
- **Étape 1 — Ingestion Factur-X** (parse du XML CII embarqué) : exact, gratuit, **stratégique** (réforme
  2026-2027). *JAMPACK sait déjà **produire** du Factur-X ; il s'agit ici de **lire** l'entrant.*
- **Étape 2 — Extraction PDF natif + règles FR** : fournisseur (via SIREN/TVA détectés + rapprochement au
  répertoire clients/fournisseurs), date, HT/TVA/TTC, n° pièce ; **validation** par nos helpers.
- **Étape 3 (option, libre) — Tesseract** pour photos : ajoute la dépendance binaire ; réutilise le même mapping.
- **Étape 4 (option, PAYANTE — ta décision) — Document AI/LLM** : connecteur découplé pour scans difficiles
  (identifiants + budget + clause RGPD).

## 5. Points de vigilance
- **Fiabilité variable** : toujours **valider** ; ne jamais comptabiliser automatiquement.
- **RGPD** : le socle gratuit traite **localement** (aucune donnée envoyée à un tiers). Un service cloud
  changerait cela → à encadrer.
- **Stockage** des justificatifs : aujourd'hui data-URL en base (volumes TPE) ; **stockage objet** si volumétrie.

## 6. Statut
⏳ **Planifié** (non implémenté). MVP recommandé : **Étapes 1 + 2** (100 % autonome, sans coût). Étapes 3/4 sur
décision. Réf. backlog : [CONCURRENCE](CONCURRENCE.md) · SRS **FR-ACH-12**.
