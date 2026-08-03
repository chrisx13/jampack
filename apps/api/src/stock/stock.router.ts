import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { withTenant } from '@jampack/db';
import { warehouseCreate, warehouseUpdate, stockMovementCreate, byId } from '@jampack/domain';
import { router, protectedProcedure, authed } from '../trpc/trpc';

const scope = (s: string | null) => (s ? { societeId: s } : {});
function req(s: string | null): string {
  if (!s) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Sélectionnez une société.' });
  return s;
}
const N = (v: unknown) => Number(v as never);

export const stockRouter = router({
  // ── Entrepôts (par société) ──
  warehouses: router({
    list: protectedProcedure.query(({ ctx }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
        tx.warehouse.findMany({ where: scope(ctx.societeId), orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] })
      )
    ),
    create: authed('create', 'Warehouse').input(warehouseCreate).mutation(({ ctx, input }) => {
      const s = req(ctx.societeId);
      return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
        if (input.isDefault) await tx.warehouse.updateMany({ where: scope(s), data: { isDefault: false } });
        return tx.warehouse.create({ data: { ...input, organizationId: ctx.user.organizationId, societeId: s } });
      });
    }),
    update: authed('update', 'Warehouse').input(warehouseUpdate).mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      const s = req(ctx.societeId);
      return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
        if (data.isDefault) await tx.warehouse.updateMany({ where: { ...scope(s), id: { not: id } }, data: { isDefault: false } });
        return tx.warehouse.update({ where: { id }, data });
      });
    }),
    archive: authed('update', 'Warehouse').input(byId).mutation(({ ctx, input }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.warehouse.update({ where: { id: input.id }, data: { isActive: false } }))
    ),
  }),

  // ── Mouvements de stock ──
  movements: router({
    list: authed('read', 'StockMovement').input(z.object({ warehouseId: z.string().optional(), productId: z.string().optional() }).optional()).query(({ ctx, input }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
        tx.stockMovement.findMany({
          where: { ...scope(ctx.societeId), ...(input?.warehouseId ? { warehouseId: input.warehouseId } : {}), ...(input?.productId ? { productId: input.productId } : {}) },
          include: { product: { select: { name: true, unit: true } }, warehouse: { select: { name: true } } },
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          take: 200,
        })
      )
    ),
    create: authed('create', 'StockMovement').input(stockMovementCreate).mutation(({ ctx, input }) => {
      const societeId = req(ctx.societeId);
      const { quantity, kind, date, ...rest } = input;
      // Signe dérivé du type : entrée = +, sortie = −, ajustement = valeur saisie (signée).
      const signed = kind === 'sortie' ? -Math.abs(quantity) : kind === 'entree' ? Math.abs(quantity) : quantity;
      return withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
        tx.stockMovement.create({
          data: { ...rest, kind, quantity: signed, organizationId: ctx.user.organizationId, societeId, createdById: ctx.user.id, date: date ? new Date(date) : undefined },
        })
      );
    }),
    remove: authed('delete', 'StockMovement').input(byId).mutation(({ ctx, input }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.stockMovement.delete({ where: { id: input.id } }))
    ),
  }),

  /** Niveaux de stock : quantité nette par article et par entrepôt (somme des mouvements signés). */
  levels: authed('read', 'StockMovement').query(({ ctx }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const grouped = await tx.stockMovement.groupBy({ by: ['productId', 'warehouseId'], where: scope(ctx.societeId), _sum: { quantity: true } });
      if (grouped.length === 0) return [];
      const [products, warehouses] = await Promise.all([
        tx.product.findMany({ where: scope(ctx.societeId), select: { id: true, name: true, unit: true, reference: true } }),
        tx.warehouse.findMany({ where: scope(ctx.societeId), select: { id: true, name: true } }),
      ]);
      const pById = new Map(products.map((p) => [p.id, p]));
      const wById = new Map(warehouses.map((w) => [w.id, w]));
      return grouped
        .map((g) => ({
          productId: g.productId,
          productName: pById.get(g.productId)?.name ?? '—',
          reference: pById.get(g.productId)?.reference ?? null,
          unit: pById.get(g.productId)?.unit ?? '',
          warehouseId: g.warehouseId,
          warehouseName: wById.get(g.warehouseId)?.name ?? '—',
          quantity: N(g._sum.quantity),
        }))
        .sort((a, b) => a.productName.localeCompare(b.productName) || a.warehouseName.localeCompare(b.warehouseName));
    })
  ),
});
