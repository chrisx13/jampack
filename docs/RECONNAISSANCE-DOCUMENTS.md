# Reconnaissance automatique des documents (factures fournisseurs / frais)

**Objet :** assister la saisie d'une **facture fournisseur** ou d'une **note de frais** à partir d'un
**PDF** ou d'une **photo** : produire un **résumé**, un **brouillon pré-rempli** (mapping) et un
**indice de confiance par champ** que l'utilisateur **valide** avant création.
**Aucune pièce n'est créée/comptabilisée sans validation humaine.**

**Statut : livré (niveau 1 gratuit + niveau 2 IA en option).** Réf. SRS **FR-ACH-12**.

## 1. Deux niveaux

| Niveau | Ce qu'il fait | Coût | Dépendance / tiers |
|---|---|---|---|
| **1 — Socle (par défaut)** | Factur-X (XML CII embarqué) + **texte PDF natif** + **règles FR** (SIREN/SIRET/TVA/IBAN **validés**) → résumé + brouillon + confiance | **0 €**, illimité | **aucune** — tout est **local** (pdf.js côté navigateur, règles côté serveur) |
| **2 — Enrichissement IA (option)** | **photos/scans** et cas difficiles : extraction par **Claude** (vision + texte) | **crédits** (1 / document) | **Anthropic (Claude)** — **seul** fournisseur IA ; désactivé par défaut |

Le niveau 1 « fait déjà beaucoup » : sur une **facture PDF** (native ou Factur-X), il extrait
fournisseur, identifiants **contrôlés**, n° de pièce, date et totaux HT/TVA/TTC avec cohérence
vérifiée. Le niveau 2 se **branche par-dessus** pour affiner (surtout les **photos**), et ne
s'active que si une clé est configurée **et** que l'organisation a des crédits.

## 2. Architecture

```
        Navigateur (gratuit, local)                Serveur JAMPACK                   Option payante
   ┌───────────────────────────────┐        ┌──────────────────────────┐        ┌────────────────┐
   │ pdf.js : texte PDF + Factur-X │──────▶│ documents.analyze        │        │  Claude        │
   │ (aucun envoi réseau)          │        │  → règles FR (validées)  │        │  (Anthropic)   │
   └───────────────────────────────┘        │  → résumé + brouillon    │        └───────▲────────┘
                                            │  + confiance par champ   │                │ 1 crédit
   ┌───────────────────────────────┐        ├──────────────────────────┤   texte/image  │
   │ photo → data-URL (compressée) │──────▶│ documents.aiAnalyze ─────┼────────────────┘
   └───────────────────────────────┘        │  fusion (le structuré    │  puis re-validation LOCALE
                                            │  local PRIME sur l'IA)   │  des identifiants
                                            └──────────────────────────┘
```

- **Moteur pur** (`packages/domain/docExtract.ts`) : cascade **Factur-X > texte PDF > OCR > apport IA**,
  chaque champ portant `source` + `confidence` (`high|medium|low`) + `valid` (identifiants). Le champ
  de plus haute confiance l'emporte → **le structuré local prime toujours sur le modèle**.
- **Mapping IA** (`packages/domain/aiFields.ts`) : convertit la sortie de Claude en champs, puis
  **re-valide** SIREN/SIRET/TVA/IBAN avec **nos** contrôles → la validité ne dépend **jamais** du modèle.
- **Connecteur** (`apps/api/documents/aiExtractor.ts`) : appel HTTP direct à l'API Messages d'Anthropic
  (sans SDK, découplé), `ANTHROPIC_API_KEY` requis.
- **Crédits** (`AiCreditLedger`, append-only, RLS org) : 1 crédit / document ; recharge = décision
  d'**administration** (hors périmètre paiement).

## 3. Parcours utilisateur (Notes de frais → « Scanner »)
1. Dépôt d'un **PDF** ou d'une **photo**.
2. **PDF** → extraction **locale gratuite** (texte + Factur-X) → **résumé + brouillon + confiance**.
   **Photo** → aperçu ; l'extraction fine passe par l'IA (le socle lit surtout les PDF).
3. Option **« Affiner avec l'IA (1 crédit) »** si activée & créditée → fusion avec le local.
4. **« Pré-remplir »** → le formulaire de note de frais s'ouvre pré-rempli (photo jointe en justificatif).
5. L'utilisateur **corrige/valide** puis enregistre. Rien n'est créé avant cette validation.

## 4. Configuration (niveau 2)
| Variable | Rôle | Défaut |
|---|---|---|
| `ANTHROPIC_API_KEY` | Active l'IA (absente = **niveau 1 seul**) | — (désactivé) |
| `AI_MODEL` | Modèle Claude d'extraction | `claude-haiku-4-5-20251001` (rapide/économique) |
| `ANTHROPIC_BASE_URL` | URL de l'API (proxy/tests) | `https://api.anthropic.com` |

Recharge de crédits : `documents.creditsTopup` (rôle **administrateur**). Solde : `documents.aiStatus`.

## 5. Points de vigilance
- **Validation humaine obligatoire** : jamais de comptabilisation automatique.
- **RGPD** : le **niveau 1 traite tout localement** (aucune donnée ne sort). Le **niveau 2** est le
  **seul** chemin où un document est envoyé à un tiers (**Anthropic**) — explicite, mesuré, désactivé
  par défaut ; **à encadrer par une clause de sous-traitance**.
- **Stockage** des justificatifs : data-URL en base (volumes TPE) ; **stockage objet** si volumétrie.
- **Fiabilité** : les identifiants (SIREN/SIRET/TVA/IBAN) sont **contrôlés** (Luhn / clé DGFiP / mod-97) ;
  les montants sont **recoupés** (HT + TVA = TTC) et signalés si incohérents.

## 6. Tests
- **Unitaires** (déterministes) : `docExtract.test.ts` (37) + `aiFields.test.ts` (9) — parsing FR,
  Factur-X, règles, cascade, validation, mapping IA.
- **Intégration** : `documents.int.test.ts` (7) — analyse gratuite, crédits, `fetch` Anthropic mocké,
  consommation d'1 crédit, primauté du structuré local.
