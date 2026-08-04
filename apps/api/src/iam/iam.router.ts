import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { withTenant } from '@jampack/db';
import { router, protectedProcedure, authed } from '../trpc/trpc';

const roleRef = z.object({ userId: z.string().min(1), societeId: z.string().min(1), roleId: z.string().min(1) });

export const iamRouter = router({
  me: protectedProcedure.query(({ ctx }) => ({
    id: ctx.user.id,
    organizationId: ctx.user.organizationId,
    permissions: ctx.user.permissions,
    accessibleSocietes: ctx.user.accessibleSocietes,
    activeSocieteId: ctx.societeId,
  })),

  /** Membres du compte, avec leurs rôles par société (ids inclus pour l'administration). */
  members: protectedProcedure.query(({ ctx }) =>
    withTenant(ctx.user.organizationId, async (tx) => {
      const [memberships, societeRoles] = await Promise.all([
        tx.membership.findMany({ include: { user: { select: { id: true, email: true, name: true } } } }),
        tx.societeRole.findMany({ include: { role: { select: { id: true, name: true } }, societe: { select: { id: true, name: true } } } }),
      ]);
      return memberships.map((m) => ({
        user: m.user,
        roles: societeRoles
          .filter((s) => s.userId === m.user.id)
          .map((s) => ({ userId: s.userId, societeId: s.societe.id, societe: s.societe.name, roleId: s.role.id, role: s.role.name })),
      }));
    })
  ),

  /** Rôles définis au niveau du compte. */
  roles: authed('manage', 'all').query(({ ctx }) =>
    withTenant(ctx.user.organizationId, (tx) => tx.role.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }))
  ),

  /** Sociétés du compte (toutes, pour l'attribution de rôles). */
  societes: authed('manage', 'all').query(({ ctx }) =>
    withTenant(ctx.user.organizationId, (tx) => tx.societe.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }))
  ),

  /** Invite un utilisateur (crée le compte utilisateur au besoin + l'appartenance au compte). */
  invite: authed('manage', 'all').input(z.object({ email: z.string().email(), name: z.string().optional() })).mutation(({ ctx, input }) =>
    withTenant(ctx.user.organizationId, async (tx) => {
      const user = await tx.user.upsert({ where: { email: input.email }, update: input.name ? { name: input.name } : {}, create: { email: input.email, name: input.name } });
      await tx.membership.upsert({ where: { userId_organizationId: { userId: user.id, organizationId: ctx.user.organizationId } }, update: {}, create: { userId: user.id, organizationId: ctx.user.organizationId } });
      return { id: user.id, email: user.email };
    })
  ),

  /** Attribue un rôle à un utilisateur sur une société. */
  grantRole: authed('manage', 'all').input(roleRef).mutation(({ ctx, input }) =>
    withTenant(ctx.user.organizationId, (tx) =>
      tx.societeRole.upsert({
        where: { userId_societeId_roleId: input },
        update: {},
        create: { ...input, organizationId: ctx.user.organizationId },
      })
    )
  ),

  /** Révoque un rôle (garde-fou : au moins un administrateur doit subsister). */
  revokeRole: authed('manage', 'all').input(roleRef).mutation(({ ctx, input }) =>
    withTenant(ctx.user.organizationId, async (tx) => {
      const role = await tx.role.findUniqueOrThrow({ where: { id: input.roleId }, include: { permissions: { select: { action: true, subject: true } } } });
      const isAdmin = role.permissions.some((p) => p.action === 'manage' && p.subject === 'all');
      if (isAdmin) {
        const adminRoleIds = (await tx.role.findMany({ where: { permissions: { some: { action: 'manage', subject: 'all' } } }, select: { id: true } })).map((r) => r.id);
        const others = await tx.societeRole.count({ where: { roleId: { in: adminRoleIds }, NOT: input } });
        if (others === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Impossible : au moins un administrateur doit subsister sur le compte.' });
      }
      await tx.societeRole.delete({ where: { userId_societeId_roleId: input } });
      return { ok: true };
    })
  ),
});
