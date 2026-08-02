import { withTenant } from '@jampack/db';
import { router, protectedProcedure } from '../trpc/trpc';

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
});
