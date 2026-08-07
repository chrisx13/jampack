import { z } from 'zod';
import { withTenant } from '@jampack/db';
import { router, protectedProcedure } from '../trpc/trpc';
import { tierOf, requireAny } from './tier';

// Mode d'exécution de l'instance : `test` ou `prod`. Stocké dans InstanceConfig (INSTANCE_MODE, non-secret).
//  - le TECHNICIEN bascule le mode de SON instance ;
//  - le super-admin GÉNÉRAL peut aussi le pousser (flotte).
// Le provisionnement de nouvelles instances est l'opération `instance.provision` (catalogue, tier platform).

const MODE_KEY = 'INSTANCE_MODE';
const modeInput = z.object({ mode: z.enum(['test', 'prod']), confirmation: z.string().optional() });

export const instanceRouter = router({
  /** Statut de l'instance : mode courant + niveau du demandeur. */
  status: protectedProcedure.query(({ ctx }) => {
    const t = tierOf(ctx.user.permissions); requireAny(t);
    return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const row = await tx.instanceConfig.findUnique({ where: { organizationId_name: { organizationId: ctx.user.organizationId, name: MODE_KEY } } });
      return { mode: (row?.value as 'test' | 'prod') || 'test', tier: t };
    });
  }),

  /** Bascule le mode. Passage en PRODUCTION : confirmation typée « PROD » requise. Audité. */
  setMode: protectedProcedure.input(modeInput).mutation(({ ctx, input }) => {
    const t = tierOf(ctx.user.permissions); requireAny(t);
    if (input.mode === 'prod' && input.confirmation?.trim() !== 'PROD') {
      throw new Error('Passage en production : saisir « PROD » pour confirmer.');
    }
    return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      await tx.instanceConfig.upsert({
        where: { organizationId_name: { organizationId: ctx.user.organizationId, name: MODE_KEY } },
        update: { value: input.mode, secret: false, encrypted: false, updatedById: ctx.user.id },
        create: { organizationId: ctx.user.organizationId, name: MODE_KEY, value: input.mode, secret: false, encrypted: false, description: 'Mode d’exécution (test/prod)', updatedById: ctx.user.id },
      });
      await tx.opsExecution.create({
        data: { organizationId: ctx.user.organizationId, opId: 'instance.setMode', target: 'local', params: { mode: input.mode }, dryRun: false, status: 'ok', summary: `Mode basculé en ${input.mode}.`, createdById: ctx.user.id },
      }).catch(() => { /* audit best-effort */ });
      return { mode: input.mode };
    });
  }),
});
