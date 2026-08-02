import { TRPCError } from '@trpc/server';
import { withTenant } from '@jampack/db';
import {
  productCreate, productUpdate,
  productCategoryCreate, productCategoryUpdate,
  taxRateCreate, taxRateUpdate, byId,
} from '@jampack/domain';
import { router, protectedProcedure, authed } from '../trpc/trpc';

const scope = (societeId: string | null) => (societeId ? { societeId } : {});
function requireSociete(societeId: string | null): string {
  if (!societeId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Sélectionnez une société.' });
  return societeId;
}

export const catalogRouter = router({
  // ── Articles & services (par société) ──
  products: router({
    list: authed('read', 'Product').query(({ ctx }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
        tx.product.findMany({
          where: scope(ctx.societeId),
          include: { taxRate: { select: { name: true, rate: true } }, category: { select: { id: true, name: true } } },
          orderBy: { name: 'asc' },
        })
      )
    ),
    create: authed('create', 'Product').input(productCreate).mutation(({ ctx, input }) => {
      const societeId = requireSociete(ctx.societeId);
      return withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.product.create({ data: { ...input, organizationId: ctx.user.organizationId, societeId } }));
    }),
    update: authed('update', 'Product').input(productUpdate).mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.product.update({ where: { id }, data }));
    }),
    remove: authed('delete', 'Product').input(byId).mutation(({ ctx, input }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.product.delete({ where: { id: input.id } }))
    ),
  }),

  // ── Taux de TVA (lecture ouverte ; écriture réservée à Admin) ──
  taxRates: router({
    list: protectedProcedure.query(({ ctx }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.taxRate.findMany({ orderBy: { rate: 'desc' } }))
    ),
    create: authed('manage', 'all').input(taxRateCreate).mutation(({ ctx, input }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.taxRate.create({ data: { ...input, organizationId: ctx.user.organizationId } }))
    ),
    update: authed('manage', 'all').input(taxRateUpdate).mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.taxRate.update({ where: { id }, data }));
    }),
    remove: authed('manage', 'all').input(byId).mutation(({ ctx, input }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.taxRate.delete({ where: { id: input.id } }))
    ),
  }),

  // ── Catégories d'articles (par société) ──
  categories: router({
    list: protectedProcedure.query(({ ctx }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
        tx.productCategory.findMany({
          where: scope(ctx.societeId),
          include: { _count: { select: { products: true } } },
          orderBy: [{ position: 'asc' }, { name: 'asc' }],
        })
      )
    ),
    create: authed('create', 'Product').input(productCategoryCreate).mutation(({ ctx, input }) => {
      const societeId = requireSociete(ctx.societeId);
      return withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
        tx.productCategory.create({ data: { ...input, organizationId: ctx.user.organizationId, societeId } })
      );
    }),
    update: authed('update', 'Product').input(productCategoryUpdate).mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.productCategory.update({ where: { id }, data }));
    }),
    // Pas de suppression physique : on archive (actif → inactif).
    archive: authed('update', 'Product').input(byId).mutation(({ ctx, input }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.productCategory.update({ where: { id: input.id }, data: { isActive: false } }))
    ),
  }),

  // ── Numérotation des pièces (lecture ; configuration Admin) ──
  sequences: router({
    list: protectedProcedure.query(({ ctx }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.numberSequence.findMany({ where: scope(ctx.societeId), orderBy: { docType: 'asc' } }))
    ),
  }),
});
