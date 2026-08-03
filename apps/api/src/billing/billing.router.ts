import { TRPCError } from '@trpc/server';
import { withTenant } from '@jampack/db';
import {
  factorCreate, factorUpdate,
  bankAccountCreate, bankAccountUpdate,
  paymentTermCreate, paymentTermUpdate,
  societeAddressCreate, societeAddressUpdate,
  byId,
} from '@jampack/domain';
import { router, protectedProcedure, authed } from '../trpc/trpc';

const scope = (s: string | null) => (s ? { societeId: s } : {});
function req(s: string | null): string {
  if (!s) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Sélectionnez une société.' });
  return s;
}

export const billingRouter = router({
  // ── Adresses de la société ──
  addresses: router({
    list: protectedProcedure.query(({ ctx }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
        tx.societeAddress.findMany({ where: scope(ctx.societeId), orderBy: [{ isDefault: 'desc' }, { label: 'asc' }] })
      )
    ),
    create: authed('manage', 'all').input(societeAddressCreate).mutation(({ ctx, input }) => {
      const s = req(ctx.societeId);
      return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
        if (input.isDefault) await tx.societeAddress.updateMany({ where: scope(s), data: { isDefault: false } });
        return tx.societeAddress.create({ data: { ...input, organizationId: ctx.user.organizationId, societeId: s } });
      });
    }),
    update: authed('manage', 'all').input(societeAddressUpdate).mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      const s = req(ctx.societeId);
      return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
        if (data.isDefault) await tx.societeAddress.updateMany({ where: { ...scope(s), id: { not: id } }, data: { isDefault: false } });
        return tx.societeAddress.update({ where: { id }, data });
      });
    }),
    archive: authed('manage', 'all').input(byId).mutation(({ ctx, input }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.societeAddress.update({ where: { id: input.id }, data: { isActive: false } }))
    ),
  }),

  // ── Affactureurs ──
  factors: router({
    list: protectedProcedure.query(({ ctx }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
        tx.factor.findMany({ where: scope(ctx.societeId), include: { _count: { select: { companies: true, invoices: true } } }, orderBy: { name: 'asc' } })
      )
    ),
    create: authed('manage', 'all').input(factorCreate).mutation(({ ctx, input }) => {
      const s = req(ctx.societeId);
      return withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.factor.create({ data: { ...input, organizationId: ctx.user.organizationId, societeId: s } }));
    }),
    update: authed('manage', 'all').input(factorUpdate).mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.factor.update({ where: { id }, data }));
    }),
    archive: authed('manage', 'all').input(byId).mutation(({ ctx, input }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.factor.update({ where: { id: input.id }, data: { isActive: false } }))
    ),
  }),

  // ── Coordonnées bancaires ──
  bankAccounts: router({
    list: protectedProcedure.query(({ ctx }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
        tx.bankAccount.findMany({ where: scope(ctx.societeId), orderBy: [{ isDefault: 'desc' }, { label: 'asc' }] })
      )
    ),
    create: authed('manage', 'all').input(bankAccountCreate).mutation(({ ctx, input }) => {
      const s = req(ctx.societeId);
      return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
        if (input.isDefault) await tx.bankAccount.updateMany({ where: scope(s), data: { isDefault: false } });
        return tx.bankAccount.create({ data: { ...input, organizationId: ctx.user.organizationId, societeId: s } });
      });
    }),
    update: authed('manage', 'all').input(bankAccountUpdate).mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      const s = req(ctx.societeId);
      return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
        if (data.isDefault) await tx.bankAccount.updateMany({ where: { ...scope(s), id: { not: id } }, data: { isDefault: false } });
        return tx.bankAccount.update({ where: { id }, data });
      });
    }),
    archive: authed('manage', 'all').input(byId).mutation(({ ctx, input }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.bankAccount.update({ where: { id: input.id }, data: { isActive: false } }))
    ),
  }),

  // ── Conditions de paiement ──
  paymentTerms: router({
    list: protectedProcedure.query(({ ctx }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
        tx.paymentTerm.findMany({ where: scope(ctx.societeId), include: { _count: { select: { companies: true } } }, orderBy: [{ isDefault: 'desc' }, { days: 'asc' }] })
      )
    ),
    create: authed('manage', 'all').input(paymentTermCreate).mutation(({ ctx, input }) => {
      const s = req(ctx.societeId);
      return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
        if (input.isDefault) await tx.paymentTerm.updateMany({ where: scope(s), data: { isDefault: false } });
        return tx.paymentTerm.create({ data: { ...input, organizationId: ctx.user.organizationId, societeId: s } });
      });
    }),
    update: authed('manage', 'all').input(paymentTermUpdate).mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      const s = req(ctx.societeId);
      return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
        if (data.isDefault) await tx.paymentTerm.updateMany({ where: { ...scope(s), id: { not: id } }, data: { isDefault: false } });
        return tx.paymentTerm.update({ where: { id }, data });
      });
    }),
    archive: authed('manage', 'all').input(byId).mutation(({ ctx, input }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.paymentTerm.update({ where: { id: input.id }, data: { isActive: false } }))
    ),
  }),
});
