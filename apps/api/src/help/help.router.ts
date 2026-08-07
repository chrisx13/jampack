import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { withTenant } from '@jampack/db';
import { router, protectedProcedure } from '../trpc/trpc';
import { HELP_ARTICLES, HELP_CATEGORIES, searchHelp } from '@jampack/domain';
import { aiConfigFromEnv, type AiExtractorConfig, type AiUsage } from '../documents/aiExtractor';
import { checkAiAllowance, recordAiUsage, allowanceStatus } from '../ai/allowance';

// Aide à l'utilisation. NIVEAU 1 (gratuit, local) : recherche dans la base de connaissances +
// scénarios pas à pas. NIVEAU 2 (option, IA Claude, 1 crédit) : assistant qui répond en s'ANCRANT
// sur les articles d'aide (pas d'invention). Même mécanique de crédits que la reconnaissance de docs.

const SYSTEM = [
  "Tu es l'assistant d'aide de JAMPACK, un ERP de gestion français (CRM, ventes, achats, compta).",
  'Réponds en français, de façon concise et pratique, en t\'appuyant UNIQUEMENT sur les articles d\'aide fournis.',
  "Donne des étapes concrètes (où cliquer). Si l'information n'est pas dans les articles, dis-le et oriente vers l'article le plus proche.",
  "Ne donne jamais de conseil juridique, fiscal ou comptable définitif : renvoie vers un expert-comptable pour toute validation réglementaire.",
].join('\n');

/** Appelle Claude pour répondre à une question d'aide, ancré sur les articles fournis. */
async function claudeAnswer(question: string, context: string, cfg: AiExtractorConfig): Promise<{ answer: string; usage?: AiUsage }> {
  const doFetch = cfg.fetchImpl ?? fetch;
  const res = await doFetch((cfg.baseUrl ?? 'https://api.anthropic.com') + '/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: cfg.model, max_tokens: 700, system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: `Articles d'aide pertinents :\n${context}\n\nQuestion de l'utilisateur : ${question}` }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
  const body = (await res.json()) as { content?: { type: string; text?: string }[]; usage?: AiUsage };
  const answer = (body.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('').trim();
  return { answer, usage: body.usage };
}

export const helpRouter = router({
  /** Catalogue complet des articles d'aide + catégories (gratuit). */
  topics: protectedProcedure.query(() => ({ categories: HELP_CATEGORIES, articles: HELP_ARTICLES })),

  /** Recherche locale gratuite dans la base de connaissances. */
  search: protectedProcedure.input(z.object({ query: z.string().max(300), limit: z.number().int().min(1).max(12).optional() }))
    .query(({ input }) => ({ results: searchHelp(input.query, input.limit ?? 6) })),

  /** État de l'assistant IA : activé (clé) + solde de crédits. */
  aiStatus: protectedProcedure.query(({ ctx }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const cfg = aiConfigFromEnv();
      const a = await allowanceStatus(tx, ctx.user.organizationId, ctx.user.id);
      return { enabled: !!cfg, balance: a.balance, freeRemaining: a.freeRemaining, freeThreshold: a.freeThreshold };
    })
  ),

  /** Assistant IA (Claude) ancré sur l'aide : consomme 1 crédit. */
  ask: protectedProcedure.input(z.object({ question: z.string().min(3).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      const cfg = aiConfigFromEnv();
      if (!cfg) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Assistant IA désactivé (aucune clé configurée). La recherche d’aide reste disponible.' });
      const articles = searchHelp(input.question, 4);
      const context = articles.map((a) => `# ${a.title} (${a.screen})\n${a.summary}\nÉtapes : ${a.steps.join(' | ')}`).join('\n\n') || 'Aucun article directement pertinent.';
      return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
        const allow = await checkAiAllowance(tx, ctx.user.organizationId, ctx.user.id);
        const r = await claudeAnswer(input.question, context, cfg).catch((e: Error) => {
          throw new TRPCError({ code: 'BAD_GATEWAY', message: `Assistant indisponible : ${e.message}` });
        });
        await recordAiUsage(tx, ctx.user.organizationId, ctx.user.id, allow.charged, 'aide', { model: cfg.model, ...r.usage });
        return { answer: r.answer, sources: articles.map((a) => ({ id: a.id, title: a.title, screen: a.screen })), charged: allow.charged, freeRemaining: allow.freeRemaining, balance: allow.charged ? allow.balance - 1 : allow.balance };
      });
    }),
});
