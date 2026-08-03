import { TRPCError } from '@trpc/server';
import { withTenant } from '@jampack/db';
import { societeSettingsUpdate } from '@jampack/domain';
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
