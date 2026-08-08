import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { withTenant } from '@jampack/db';
import { router, authed, protectedProcedure } from '../trpc/trpc';
import { analyzeDocument, toExpenseDraft, toSupplierInvoiceDraft, aiCreditsCsv } from '@jampack/domain';
import { claudeExtract, aiConfigFromEnv } from './aiExtractor';
import { checkAiAllowance, recordAiUsage, allowanceStatus } from '../ai/allowance';

// Reconnaissance de documents.
// NIVEAU 1 (gratuit, déterministe, local) : le client fournit ce qu'il a extrait localement, SANS
// aucun envoi à un tiers — `facturxXml` (pièce jointe Factur-X), `text` (couche PDF natif), `ocrText`
// (OCR local option). Le serveur applique les règles FR (SIREN/TVA/IBAN validés) et renvoie un résumé
// + un brouillon pré-rempli à FAIRE VALIDER. Aucune pièce n'est créée ici.
// NIVEAU 2 (enrichissement IA = Claude, mesuré en crédits) : `aiAnalyze` — envoie texte/image à
// Claude, désactivé par défaut (aucune clé = niveau 1 seul), consomme 1 crédit par document.

const analyzeInput = z.object({
  text: z.string().max(200_000).optional(),
  facturxXml: z.string().max(2_000_000).optional(),
  ocrText: z.string().max(200_000).optional(),
});
const aiInput = analyzeInput.extend({
  imageDataUrl: z.string().regex(/^data:image\//).max(7_000_000).optional(),
});

/** Solde de crédits IA de l'organisation (somme du grand livre). Filtre explicite (défense en profondeur
 *  au-delà du RLS : correct aussi pour un rôle propriétaire qui contournerait le RLS). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function creditBalance(tx: any, organizationId: string): Promise<number> {
  const agg = await tx.aiCreditLedger.aggregate({ _sum: { delta: true }, where: { organizationId } });
  return agg._sum.delta ?? 0;
}

export const documentsRouter = router({
  /** Analyse locale gratuite : Factur-X / texte PDF / OCR → résumé + brouillons + confiance. */
  analyze: protectedProcedure
    .input(analyzeInput)
    .mutation(({ input }) => {
      const result = analyzeDocument({ text: input.text, facturxXml: input.facturxXml, ocrText: input.ocrText });
      const raw = input.text ?? input.ocrText ?? null;
      return { result, expenseDraft: toExpenseDraft(result, raw), supplierInvoiceDraft: toSupplierInvoiceDraft(result) };
    }),

  /** État de l'enrichissement IA : activé (clé présente) et solde de crédits de l'organisation. */
  aiStatus: protectedProcedure.query(({ ctx }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const cfg = aiConfigFromEnv();
      const a = await allowanceStatus(tx, ctx.user.organizationId, ctx.user.id);
      return { enabled: !!cfg, model: cfg?.model ?? null, balance: a.balance, freeRemaining: a.freeRemaining, freeThreshold: a.freeThreshold };
    })
  ),

  /** Enrichissement IA (Claude) : consomme 1 crédit. Fusionné avec l'extraction locale (le structuré prime). */
  aiAnalyze: protectedProcedure
    .input(aiInput)
    .mutation(async ({ ctx, input }) => {
      const cfg = aiConfigFromEnv();
      if (!cfg) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Enrichissement IA désactivé (aucune clé configurée).' });
      if (!input.text && !input.imageDataUrl && !input.ocrText) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Fournir un texte ou une image.' });
      return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
        const allow = await checkAiAllowance(tx, ctx.user.organizationId, ctx.user.id);
        const ai = await claudeExtract({ text: input.text ?? input.ocrText, imageDataUrl: input.imageDataUrl }, cfg).catch((e: Error) => {
          throw new TRPCError({ code: 'BAD_GATEWAY', message: `Échec de l’enrichissement IA : ${e.message}` });
        });
        const result = analyzeDocument({ text: input.text, facturxXml: input.facturxXml, ocrText: input.ocrText, aiFields: ai.fields });
        await recordAiUsage(tx, ctx.user.organizationId, ctx.user.id, allow.charged, result.fields.supplierName?.value?.slice(0, 120) ?? null, { model: cfg.model, ...ai.usage });
        const raw = input.text ?? input.ocrText ?? null;
        return { result, expenseDraft: toExpenseDraft(result, raw), supplierInvoiceDraft: toSupplierInvoiceDraft(result), charged: allow.charged, freeRemaining: allow.freeRemaining, balance: allow.charged ? allow.balance - 1 : allow.balance, usage: ai.usage };
      });
    }),

  /** Historique du grand livre de crédits IA (administration). */
  creditsHistory: authed('manage', 'all').query(({ ctx }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const rows = await tx.aiCreditLedger.findMany({ where: { organizationId: ctx.user.organizationId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return { balance: await creditBalance(tx, ctx.user.organizationId), rows };
    })
  ),

  /** Export CSV du grand livre des crédits IA (admin) — réconciliation coût ↔ revenu. */
  creditsCsv: authed('manage', 'all').query(({ ctx }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const rows = await tx.aiCreditLedger.findMany({ where: { organizationId: ctx.user.organizationId }, orderBy: { createdAt: 'desc' } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const content = aiCreditsCsv(rows.map((r: any) => ({ date: r.createdAt, reason: r.reason, documentRef: r.documentRef, model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens, cacheReadTokens: r.cacheReadTokens, delta: r.delta })));
      return { filename: 'credits-ia.csv', content };
    })
  ),

  /** Synthèse de dépense IA du mois (admin) : tokens consommés + analyses gratuites/payantes + crédits.
   *  Sert à réconcilier le coût fournisseur (Anthropic) avec le revenu des crédits vendus. */
  spendSummary: authed('manage', 'all').query(({ ctx }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const rows = await tx.aiCreditLedger.findMany({
        where: { organizationId: ctx.user.organizationId, createdAt: { gte: start } },
        select: { reason: true, delta: true, inputTokens: true, outputTokens: true, cacheReadTokens: true, model: true },
      });
      let inputTokens = 0, outputTokens = 0, cacheReadTokens = 0, freeAnalyses = 0, paidAnalyses = 0, creditsAdded = 0;
      const models = new Set<string>();
      for (const r of rows) {
        inputTokens += r.inputTokens ?? 0; outputTokens += r.outputTokens ?? 0; cacheReadTokens += r.cacheReadTokens ?? 0;
        if (r.model) models.add(r.model);
        if (r.reason === 'free') freeAnalyses++;
        else if (r.reason === 'analyze') paidAnalyses++;
        else if (r.reason === 'topup') creditsAdded += r.delta;
      }
      return { since: start, inputTokens, outputTokens, cacheReadTokens, freeAnalyses, paidAnalyses, creditsAdded, balance: await creditBalance(tx, ctx.user.organizationId), models: [...models] };
    })
  ),

  /** Recharge de crédits IA (administration). Hors périmètre paiement : décision d'admin. */
  creditsTopup: authed('manage', 'all')
    .input(z.object({ amount: z.number().int().min(1).max(100_000), note: z.string().max(200).optional() }))
    .mutation(({ ctx, input }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
        await tx.aiCreditLedger.create({ data: { organizationId: ctx.user.organizationId, delta: input.amount, reason: 'topup', documentRef: input.note ?? null, createdById: ctx.user.id } });
        return { balance: await creditBalance(tx, ctx.user.organizationId) };
      })
    ),
});
