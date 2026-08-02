import { withTenant } from '@jampack/db';
import { router, protectedProcedure } from '../trpc/trpc';

export const iamRouter = router({
  me: protectedProcedure.query(({ ctx }) => ({
    id: ctx.user.id,
    organizationId: ctx.user.organizationId,
    permissions: ctx.user.permissions,
    accessibleSocietes: ctx.user.accessibleSocietes,
    activeSocieteId: ctx.societeId,
  })),

  /** Membres du compte, avec leurs rôles par société. */
  members: protectedProcedure.query(({ ctx }) =>
    withTenant(ctx.user.organizationId, async (tx) => {
      const [memberships, societeRoles] = await Promise.all([
        tx.membership.findMany({ include: { user: true } }),
        tx.societeRole.findMany({ include: { role: { select: { name: true } }, societe: { select: { name: true } } } }),
      ]);
      return memberships.map((m) => ({
        user: m.user,
        roles: societeRoles
          .filter((s) => s.userId === m.userId)
          .map((s) => ({ societe: s.societe.name, role: s.role.name })),
      }));
    })
  ),
});
