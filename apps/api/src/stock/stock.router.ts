import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { withTenant } from '@jampack/db';
import { warehouseCreate, warehouseUpdate, stockMovementCreate, stockInventory, byId } from '@jampack/domain';
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
      const { quantity, kind, date, expiryDate, ...rest } = input;
      // Signe dérivé du type : entrée = +, sortie = −, ajustement = valeur saisie (signée).
      const signed = kind === 'sortie' ? -Math.abs(quantity) : kind === 'entree' ? Math.abs(quantity) : quantity;
      return withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
        tx.stockMovement.create({
          data: { ...rest, kind, quantity: signed, organizationId: ctx.user.organizationId, societeId, createdById: ctx.user.id, date: date ? new Date(date) : undefined, expiryDate: expiryDate ? new Date(expiryDate) : undefined },
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

  /** Valorisation du stock par article — méthode **PMP** (prix moyen pondéré) ou **FIFO** (premier entré, premier sorti). */
  valuation: authed('read', 'StockMovement').input(z.object({ method: z.enum(['pmp', 'fifo']).optional() }).optional()).query(({ ctx, input }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const method = input?.method ?? 'pmp';
      const movements = await tx.stockMovement.findMany({ where: scope(ctx.societeId), select: { productId: true, quantity: true, kind: true, unitCost: true, date: true }, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] });
      if (movements.length === 0) return { rows: [], total: 0, method };
      const agg = new Map<string, { qty: number; entryQty: number; entryValue: number; layers: { qty: number; cost: number }[] }>();
      for (const m of movements) {
        const e = agg.get(m.productId) ?? { qty: 0, entryQty: 0, entryValue: 0, layers: [] };
        e.qty += N(m.quantity);
        if (m.kind === 'entree' && m.unitCost != null) { const q = N(m.quantity), c = N(m.unitCost); e.entryQty += q; e.entryValue += q * c; e.layers.push({ qty: q, cost: c }); }
        agg.set(m.productId, e);
      }
      // FIFO : l'en-stock correspond aux couches d'entrée les plus récentes (les plus anciennes sont sorties d'abord).
      const fifoValue = (qty: number, layers: { qty: number; cost: number }[]) => {
        let remaining = qty, value = 0;
        for (let i = layers.length - 1; i >= 0 && remaining > 1e-6; i--) { const take = Math.min(layers[i].qty, remaining); value += take * layers[i].cost; remaining -= take; }
        if (remaining > 1e-6 && layers.length) value += remaining * layers[layers.length - 1].cost; // au-delà des entrées connues : dernier coût
        return value;
      };
      const products = await tx.product.findMany({ where: scope(ctx.societeId), select: { id: true, name: true, unit: true, reference: true } });
      const pById = new Map(products.map((p) => [p.id, p]));
      const r2 = (v: number) => Math.round(v * 100) / 100;
      const r3 = (v: number) => Math.round(v * 1000) / 1000;
      const rows = [...agg.entries()]
        .map(([productId, e]) => {
          const pmp = e.entryQty > 0 ? e.entryValue / e.entryQty : 0;
          const value = method === 'fifo' ? fifoValue(Math.max(e.qty, 0), e.layers) : e.qty * pmp;
          const unitCost = e.qty !== 0 ? value / e.qty : pmp;
          return {
            productId,
            productName: pById.get(productId)?.name ?? '—',
            reference: pById.get(productId)?.reference ?? null,
            unit: pById.get(productId)?.unit ?? '',
            quantity: r3(e.qty),
            pmp: r2(unitCost),
            value: r2(value),
          };
        })
        .filter((r) => Math.abs(r.quantity) > 0.0005 || r.value !== 0)
        .sort((a, b) => a.productName.localeCompare(b.productName));
      return { rows, total: r2(rows.reduce((s, r) => s + r.value, 0)), method };
    })
  ),

  /** Inventaire physique : aligne le stock d'un article/entrepôt sur la quantité comptée via un ajustement. */
  inventory: authed('create', 'StockMovement').input(stockInventory).mutation(({ ctx, input }) => {
    const societeId = req(ctx.societeId);
    return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const agg = await tx.stockMovement.aggregate({ where: { ...scope(ctx.societeId), warehouseId: input.warehouseId, productId: input.productId }, _sum: { quantity: true } });
      const current = N(agg._sum.quantity);
      const delta = Math.round((input.countedQuantity - current) * 1000) / 1000;
      if (Math.abs(delta) < 0.0005) return { delta: 0, current, counted: input.countedQuantity, movementId: null };
      const mv = await tx.stockMovement.create({
        data: {
          warehouseId: input.warehouseId, productId: input.productId, kind: 'ajustement', quantity: delta,
          note: input.note ?? `Inventaire : compté ${input.countedQuantity}`,
          organizationId: ctx.user.organizationId, societeId, createdById: ctx.user.id,
        },
      });
      return { delta, current, counted: input.countedQuantity, movementId: mv.id };
    });
  }),

  /** Articles sous leur seuil de réapprovisionnement (quantité nette totale < `reorderPoint`). */
  lowStock: authed('read', 'StockMovement').query(({ ctx }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const withThreshold = await tx.product.findMany({ where: { ...scope(ctx.societeId), reorderPoint: { not: null } }, select: { id: true, name: true, unit: true, reference: true, reorderPoint: true } });
      if (withThreshold.length === 0) return [];
      const grouped = await tx.stockMovement.groupBy({ by: ['productId'], where: { ...scope(ctx.societeId), productId: { in: withThreshold.map((p) => p.id) } }, _sum: { quantity: true } });
      const qtyById = new Map(grouped.map((g) => [g.productId, N(g._sum.quantity)]));
      return withThreshold
        .map((p) => {
          const quantity = Math.round((qtyById.get(p.id) ?? 0) * 1000) / 1000;
          const reorderPoint = N(p.reorderPoint);
          return { productId: p.id, productName: p.name, reference: p.reference, unit: p.unit, quantity, reorderPoint, manque: Math.round((reorderPoint - quantity) * 1000) / 1000 };
        })
        .filter((r) => r.quantity < r.reorderPoint)
        .sort((a, b) => b.manque - a.manque);
    })
  ),

  /** Soldes par lot/n° de série (quantité nette) + statut de péremption. */
  lots: authed('read', 'StockMovement').query(({ ctx }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const grouped = await tx.stockMovement.groupBy({ by: ['productId', 'warehouseId', 'lotNumber'], where: { ...scope(ctx.societeId), lotNumber: { not: null } }, _sum: { quantity: true }, _max: { expiryDate: true } });
      if (grouped.length === 0) return [];
      const [products, warehouses] = await Promise.all([
        tx.product.findMany({ where: scope(ctx.societeId), select: { id: true, name: true, unit: true } }),
        tx.warehouse.findMany({ where: scope(ctx.societeId), select: { id: true, name: true } }),
      ]);
      const pById = new Map(products.map((p) => [p.id, p]));
      const wById = new Map(warehouses.map((w) => [w.id, w]));
      const now = Date.now();
      const soon = now + 30 * 86400000;
      return grouped
        .map((g) => {
          const expiry = g._max.expiryDate ? new Date(g._max.expiryDate) : null;
          const exp = expiry ? expiry.getTime() : null;
          return {
            productId: g.productId, productName: pById.get(g.productId)?.name ?? '—', unit: pById.get(g.productId)?.unit ?? '',
            warehouseId: g.warehouseId, warehouseName: wById.get(g.warehouseId)?.name ?? '—',
            lotNumber: g.lotNumber, quantity: Math.round(N(g._sum.quantity) * 1000) / 1000, expiryDate: expiry,
            expired: exp != null && exp < now, expiringSoon: exp != null && exp >= now && exp <= soon,
          };
        })
        .filter((r) => Math.abs(r.quantity) > 0.0005)
        .sort((a, b) => (a.expiryDate?.getTime() ?? Infinity) - (b.expiryDate?.getTime() ?? Infinity) || a.productName.localeCompare(b.productName));
    })
  ),
});
