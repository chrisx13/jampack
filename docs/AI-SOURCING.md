# Approvisionnement en IA (JAMPACK → Anthropic)

Versant **fournisseur** (JAMPACK achète des tokens Claude), distinct des **crédits vendus au client**
(client → JAMPACK, cf. franchise + crédits dans [RECONNAISSANCE-DOCUMENTS](RECONNAISSANCE-DOCUMENTS.md)).

## Décision (actée)
- **Approvisionnement : pay-as-you-go (postpayé)** sur le compte Anthropic — facturé à l'usage réel,
  **ne tombe jamais à court**, zéro gestion de réserve. **+ alerte de budget** (Console Anthropic).
  - *Repli si le compte impose le prépayé* : **crédits prépayés + auto‑reload** avec un tampon
    ≈ **1–2 semaines** d'usage (résiste à un incident de paiement).
  - Rappel : chez Anthropic, **prépayé et pay‑as‑you‑go coûtent le même prix au token** — le prépayé
    est une question de **trésorerie**, pas de coût.

## Optimisation du coût (leviers)
| Levier | Statut | Détail |
|---|---|---|
| **Modèle Haiku** pour le routinier | ✅ fait | `AI_MODEL` défaut `claude-haiku-4-5-20251001`. |
| **Prompt caching** du system prompt | ✅ câblé | `cache_control: ephemeral` sur le system (reconnaissance + aide). **Gain réel seulement si le prompt dépasse le seuil minimal du modèle** (~2048 tokens Haiku) — **nos prompts sont courts**, donc gain marginal aujourd'hui ; le câblage rend le bénéfice **automatique** s'ils grossissent. Sans effet sinon (aucun inconvénient). |
| **Batch API (−50 %)** pour le non‑interactif | ⏳ à activer si besoin | Pour les traitements **de masse / en arrière-plan** (enrichissement en lot, résumés). **Pas** pour le scan ou le chat **interactifs** (latence). |
| **Engagement de volume** | ⏳ à l'échelle | Uniquement quand le volume le justifie. |
| **Prompts lean** | ✅ principe | Garder les system prompts courts et ciblés (coût input direct). |

## Garde‑fous & marge (métrage intégré)
- Chaque appel IA journalise dans `AiCreditLedger` : **modèle**, **tokens** (input/output) et **tokens
  servis par le cache** — en plus du fait qu'il soit **gratuit (franchise)** ou **payant (crédit)**.
- **Administration ▸ Crédits IA** affiche la **consommation du mois** (gratuites/payantes, tokens,
  cache) → à **réconcilier** avec le coût Anthropic (Console) et le **revenu des crédits vendus**.
- Endpoint : `documents.spendSummary` (admin).

## Configuration
| Variable | Rôle |
|---|---|
| `ANTHROPIC_API_KEY` | Clé du compte Anthropic (secret) — **posée par le porteur**. |
| `AI_MODEL` | Modèle par défaut (Haiku). |
| `AI_FREE_MONTHLY_PER_USER` | Franchise gratuite / utilisateur / mois (revente) — à calibrer prix abo vs coût. |

## À faire (Console Anthropic, hors code)
- [ ] Choisir **pay‑as‑you‑go** (ou prépayé + auto‑reload si imposé) et **poser une alerte de budget**.
- [ ] Poser `ANTHROPIC_API_KEY` en production.
- [ ] Réconcilier mensuellement coût Anthropic ↔ `spendSummary` ↔ crédits vendus.
