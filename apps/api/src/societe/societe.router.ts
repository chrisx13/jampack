import { TRPCError } from '@trpc/server';
import { withTenant } from '@jampack/db';
import { societeSettingsUpdate, societeCreate } from '@jampack/domain';
import { router, protectedProcedure, authed } from '../trpc/trpc';

function requireSociete(societeId: string | null): string {
  if (!societeId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Sélectionnez une société.' });
  return societeId;
}

export const societeRouter = router({
  /** Sociétés ACCESSIBLES à l'utilisateur (celles où il a au moins un rôle). */
  list: protectedProcedure.query(({ ctx }) =>
    withTenant(ctx.user.organizationId, (tx) =>
      tx.societe.findMany({
        where: ctx.user.accessibleSocietes ? { id: { in: ctx.user.accessibleSocietes } } : {},
        orderBy: { name: 'asc' },
        select: { id: true, name: true, city: true, siret: true },
      })
    )
  ),
  /** Société active courante (résolue côté serveur), pour l'UI. */
  active: protectedProcedure.query(({ ctx }) => ({ societeId: ctx.societeId })),

  /** Toutes les sociétés du compte (administration). */
  listAll: authed('manage', 'all').query(({ ctx }) =>
    withTenant(ctx.user.organizationId, (tx) => tx.societe.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, city: true, siret: true, siren: true } }))
  ),

  /** Crée une société et la rend accessible à son créateur (rôle Admin). */
  create: authed('manage', 'all').input(societeCreate).mutation(({ ctx, input }) =>
    withTenant(ctx.user.organizationId, async (tx) => {
      const soc = await tx.societe.create({ data: { ...input, organizationId: ctx.user.organizationId } });
      const adminRole = await tx.role.findFirst({ where: { permissions: { some: { action: 'manage', subject: 'all' } } } });
      if (adminRole) await tx.societeRole.create({ data: { userId: ctx.user.id, societeId: soc.id, roleId: adminRole.id, organizationId: ctx.user.organizationId } });
      return soc;
    })
  ),

  /** Paramétrage complet de la société active (en-tête de facturation…). */
  settings: protectedProcedure.query(({ ctx }) => {
    const societeId = requireSociete(ctx.societeId);
    return withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
      tx.societe.findUniqueOrThrow({ where: { id: societeId } })
    );
  }),

  /** Mise à jour du paramétrage société (réservé à l'administration). */
  updateSettings: authed('manage', 'all').input(societeSettingsUpdate).mutation(({ ctx, input }) => {
    const societeId = requireSociete(ctx.societeId);
    return withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
      tx.societe.update({ where: { id: societeId }, data: input })
    );
  }),
});
