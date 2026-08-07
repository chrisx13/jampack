import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { withTenant } from '@jampack/db';
import { router, protectedProcedure } from '../trpc/trpc';
import { resolveTier, rawTierOf, requireAny, HOSTING_KEY } from './tier';

// Mode d'exécution de l'instance : `test` ou `prod`. Stocké dans InstanceConfig (INSTANCE_MODE).
// Mode d'hébergement : `self` (serveur du client → super-admin instance actif) ou `jampack` (hébergé
// → seul le général pilote). Le mode d'hébergement est posé par le super-admin GÉNÉRAL (JAMPACK).

const MODE_KEY = 'INSTANCE_MODE';
const modeInput = z.object({ mode: z.enum(['test', 'prod']), confirmation: z.string().optional() });

export const instanceRouter = router({
  /** Statut de l'instance : mode (test/prod), hébergement (self/jampack) + niveau effectif du demandeur. */
  status: protectedProcedure.query(async ({ ctx }) => {
    const t = await resolveTier(ctx); requireAny(t);
    return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const row = await tx.instanceConfig.findUnique({ where: { organizationId_name: { organizationId: ctx.user.organizationId, name: MODE_KEY } } });
      return { mode: (row?.value as 'test' | 'prod') || 'test', hosting: t.hosting, tier: { instance: t.instance, platform: t.platform } };
    });
  }),

  /** Bascule le mode. Passage en PRODUCTION : confirmation typée « PROD » requise. Audité. */
  setMode: protectedProcedure.input(modeInput).mutation(async ({ ctx, input }) => {
    const t = await resolveTier(ctx); requireAny(t);
    if (input.mode === 'prod' && input.confirmation?.trim() !== 'PROD') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Passage en production : saisir « PROD » pour confirmer.' });
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

  /** Définit le mode d'hébergement (self/jampack) — réservé au super-admin GÉNÉRAL (JAMPACK).
   *  `jampack` désactive le super-admin de structure ; `self` (serveur du client) le réactive. */
  setHosting: protectedProcedure.input(z.object({ hosting: z.enum(['self', 'jampack']) })).mutation(async ({ ctx, input }) => {
    // Déclaration de provisioning : autorité BRUTE JAMPACK (indépendante de l'hébergement courant).
    // Un serveur client réellement isolé n'a de toute façon aucun principal PlatformOps.
    if (!rawTierOf(ctx.user.permissions).platform) throw new TRPCError({ code: 'FORBIDDEN', message: 'Réservé au super-admin général JAMPACK.' });
    return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      await tx.instanceConfig.upsert({
        where: { organizationId_name: { organizationId: ctx.user.organizationId, name: HOSTING_KEY } },
        update: { value: input.hosting, secret: false, encrypted: false, updatedById: ctx.user.id },
        create: { organizationId: ctx.user.organizationId, name: HOSTING_KEY, value: input.hosting, secret: false, encrypted: false, description: 'Hébergement (self=client / jampack=hébergé)', updatedById: ctx.user.id },
      });
      await tx.opsExecution.create({
        data: { organizationId: ctx.user.organizationId, opId: 'instance.setHosting', target: 'local', params: { hosting: input.hosting }, dryRun: false, status: 'ok', summary: `Hébergement défini : ${input.hosting}.`, createdById: ctx.user.id },
      }).catch(() => {});
      return { hosting: input.hosting };
    });
  }),
});
