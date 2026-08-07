import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { withTenant } from '@jampack/db';
import { router, authed } from '../trpc/trpc';
import { OPS_CATALOG, OPS_CATEGORIES, getOp, canExecute } from '@jampack/domain';
import { runOp } from './executor';

// Console super-admin de pilotage technique. Gated par le droit `manage Ops`.
// Catalogue d'opérations PRÉDÉFINIES uniquement (aucun shell arbitraire) — voir opsCatalog (domaine)
// et executor (opérations sûres en-process ; opérations hôte bloquées par défaut). Chaque exécution
// (réelle ou simulée) est journalisée dans OpsExecution.

const runInput = z.object({
  id: z.string().min(1),
  params: z.record(z.unknown()).default({}),
  dryRun: z.boolean().default(false),
  confirmation: z.string().optional(),
  target: z.string().default('local'), // 'local' ou identifiant d'instance (flotte, à venir)
});

export const opsRouter = router({
  /** Catalogue des opérations disponibles + catégories (pour l'IHM). */
  catalogue: authed('manage', 'Ops').query(() => ({ categories: OPS_CATEGORIES, operations: OPS_CATALOG })),

  /** Historique des exécutions (50 dernières), organisation courante. */
  history: authed('manage', 'Ops').query(({ ctx }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const rows = await tx.opsExecution.findMany({ where: { organizationId: ctx.user.organizationId }, orderBy: { createdAt: 'desc' }, take: 50 });
      return { rows };
    })
  ),

  /** Exécute (ou simule) une opération : validation + confirmation typée, puis journalisation. */
  run: authed('manage', 'Ops')
    .input(runInput)
    .mutation(async ({ ctx, input }) => {
      const op = getOp(input.id);
      if (!op) throw new TRPCError({ code: 'NOT_FOUND', message: `Opération inconnue : ${input.id}.` });

      const check = canExecute(op, input.params, { dryRun: input.dryRun, confirmation: input.confirmation });
      if (!check.ok) throw new TRPCError({ code: 'BAD_REQUEST', message: check.errors.join(' ') });

      let result;
      try {
        result = await runOp(op, input.params, { dryRun: input.dryRun });
      } catch (e) {
        result = { status: 'error' as const, summary: `Échec : ${(e as Error).message}` };
      }

      // Journalisation systématique (réel ou simulé), organisation de l'opérateur.
      await withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
        tx.opsExecution.create({
          data: {
            organizationId: ctx.user.organizationId, opId: op.id, target: input.target,
            params: (input.params as object) ?? {}, dryRun: input.dryRun, status: result.status,
            summary: result.summary?.slice(0, 2000) ?? null, createdById: ctx.user.id,
          },
        })
      ).catch(() => { /* l'audit ne doit pas faire échouer l'opération */ });

      return { op: { id: op.id, label: op.label, danger: op.danger }, dryRun: input.dryRun, ...result };
    }),
});
