// Franchise IA : chaque utilisateur dispose d'un seuil gratuit mensuel (inclus dans l'abonnement).
// Au-delà, l'usage consomme un crédit payant de l'organisation. Décision PURE et testable ; la
// mesure de l'usage et l'enregistrement vivent côté API (ledger). Le seuil est un paramètre à
// calibrer selon le prix de l'abonnement et le coût réel de l'IA (Claude).

export interface AllowanceInput {
  /** Nombre d'analyses IA déjà faites par l'utilisateur ce mois-ci (gratuites + payantes). */
  usedThisMonth: number;
  /** Seuil gratuit mensuel par utilisateur (paramètre de pricing). */
  freeThreshold: number;
  /** Solde de crédits payants de l'organisation. */
  orgBalance: number;
}

export interface AllowanceDecision {
  /** Vrai si l'opération doit consommer un crédit payant (franchise épuisée). */
  charged: boolean;
  /** Vrai si l'opération peut avoir lieu (dans la franchise, ou crédit disponible). */
  canProceed: boolean;
  /** Franchise gratuite restante APRÈS cette opération (0 si payante). */
  freeRemaining: number;
}

/** Décide si une opération IA est gratuite (franchise) ou payante (crédit), et si elle peut avoir lieu. */
export function allowanceDecision(i: AllowanceInput): AllowanceDecision {
  const free = Math.max(0, i.freeThreshold - Math.max(0, i.usedThisMonth));
  if (free > 0) return { charged: false, canProceed: true, freeRemaining: free - 1 };
  return { charged: true, canProceed: i.orgBalance > 0, freeRemaining: 0 };
}
