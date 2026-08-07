import { TRPCError } from '@trpc/server';
import { allowanceDecision } from '@jampack/domain';

// Franchise IA par utilisateur + crédits payants org, adossés au grand livre AiCreditLedger.
// Chaque opération IA est journalisée : gratuite → delta 0 (reason 'free') ; payante → delta -1
// (reason 'analyze'). Le solde org = somme des delta ; l'usage mensuel = nombre d'opérations de
// l'utilisateur ce mois (free + analyse). Ordre : franchise utilisateur d'abord, puis crédits org.

/** Seuil gratuit mensuel par utilisateur (paramètre de pricing). Défaut 20. */
export function freeThreshold(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.AI_FREE_MONTHLY_PER_USER);
  return Number.isFinite(n) && n >= 0 ? n : 20;
}

function monthStart(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function usedThisMonth(tx: any, organizationId: string, userId: string): Promise<number> {
  return tx.aiCreditLedger.count({ where: { organizationId, createdById: userId, reason: { in: ['free', 'analyze'] }, createdAt: { gte: monthStart() } } });
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function orgBalance(tx: any, organizationId: string): Promise<number> {
  const agg = await tx.aiCreditLedger.aggregate({ _sum: { delta: true }, where: { organizationId } });
  return agg._sum.delta ?? 0;
}

export interface AllowanceCheck { charged: boolean; freeRemaining: number; freeThreshold: number; balance: number }

/** Vérifie qu'une opération IA peut avoir lieu (franchise ou crédit) ; lève sinon. Ne journalise PAS. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function checkAiAllowance(tx: any, organizationId: string, userId: string): Promise<AllowanceCheck> {
  const t = freeThreshold();
  const [used, balance] = [await usedThisMonth(tx, organizationId, userId), await orgBalance(tx, organizationId)];
  const d = allowanceDecision({ usedThisMonth: used, freeThreshold: t, orgBalance: balance });
  if (!d.canProceed) throw new TRPCError({ code: 'FORBIDDEN', message: 'Franchise IA du mois épuisée et aucun crédit disponible. Rechargez pour continuer.' });
  return { charged: d.charged, freeRemaining: d.freeRemaining, freeThreshold: t, balance };
}

export interface AiUsageMeta {
  model?: string | null;
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
}

/** Journalise la consommation APRÈS succès de l'appel IA (gratuite ou payante) + le coût fournisseur. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function recordAiUsage(tx: any, organizationId: string, userId: string, charged: boolean, ref: string | null, usage?: AiUsageMeta): Promise<void> {
  await tx.aiCreditLedger.create({
    data: {
      organizationId, delta: charged ? -1 : 0, reason: charged ? 'analyze' : 'free', documentRef: ref, createdById: userId,
      model: usage?.model ?? null, inputTokens: usage?.input_tokens ?? null, outputTokens: usage?.output_tokens ?? null, cacheReadTokens: usage?.cache_read_input_tokens ?? null,
    },
  });
}

/** État de franchise pour l'utilisateur (affichage) : franchise restante + solde payant. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function allowanceStatus(tx: any, organizationId: string, userId: string): Promise<{ freeThreshold: number; freeRemaining: number; balance: number }> {
  const t = freeThreshold();
  const [used, balance] = [await usedThisMonth(tx, organizationId, userId), await orgBalance(tx, organizationId)];
  return { freeThreshold: t, freeRemaining: Math.max(0, t - used), balance };
}
