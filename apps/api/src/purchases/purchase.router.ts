import { TRPCError } from '@trpc/server';
import { withTenant, nextDocumentNumber } from '@jampack/db';
import { purchaseOrderCreate, purchaseOrderUpdate, purchaseReceipt, byId } from '@jampack/domain';
import { router, protectedProcedure, authed } from '../trpc/trpc';

const scope = (s: string | null) => (s ? { societeId: s } : {});
function req(s: string | null): string {
  if (!s) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Sélectionnez une société.' });
  return s;
}
const n = (v: unknown) => Number(v as never);
const lineData = (l: { productId?: string; label: string; quantity: number; unitPriceHt: number; position?: number }, i: number) => ({
  productId: l.productId || undefined,
  label: l.label,
  quantity: l.quantity,
  unitPriceHt: l.unitPriceHt,
  position: l.position ?? i,
});
const fullInclude = {
  lines: { orderBy: { position: 'asc' as const } },
  supplier: { select: { name: true } },
  warehouse: { select: { name: true } },
};

export const purchaseRouter = router({
  /** Fournisseurs = tiers marqués isSupplier (pour le sélecteur de commande). */
  suppliers: protectedProcedure.query(({ ctx }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
      tx.company.findMany({ where: { ...scope(ctx.societeId), isSupplier: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
    )
  ),

  orders: router({
    list: authed('read', 'PurchaseOrder').query(({ ctx }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
        const rows = await tx.purchaseOrder.findMany({
          where: scope(ctx.societeId),
          include: { supplier: { select: { name: true } }, lines: { select: { quantity: true, unitPriceHt: true } } },
          orderBy: [{ createdAt: 'desc' }],
        });
        return rows.map((r) => ({
          id: r.id, number: r.number, status: r.status, orderDate: r.orderDate, expectedDate: r.expectedDate,
          supplierId: r.supplierId, supplier: r.supplier,
          totalHt: Math.round(r.lines.reduce((s, l) => s + n(l.quantity) * n(l.unitPriceHt), 0) * 100) / 100,
        }));
      })
    ),

    /** Commandes en retard : envoyées, non réceptionnées, date de livraison prévue dépassée (plus en retard d'abord). */
    overdue: authed('read', 'PurchaseOrder').query(({ ctx }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
        const now = new Date();
        const rows = await tx.purchaseOrder.findMany({
          where: { ...scope(ctx.societeId), status: { in: ['sent', 'partial'] }, expectedDate: { lt: now } },
          include: { supplier: { select: { name: true } }, lines: { select: { quantity: true, unitPriceHt: true } } },
          orderBy: [{ expectedDate: 'asc' }],
        });
        return rows.map((r) => ({
          id: r.id, number: r.number, expectedDate: r.expectedDate, supplierId: r.supplierId, supplier: r.supplier,
          daysLate: Math.floor((now.getTime() - new Date(r.expectedDate as Date).getTime()) / 86400000),
          totalHt: Math.round(r.lines.reduce((s, l) => s + n(l.quantity) * n(l.unitPriceHt), 0) * 100) / 100,
        }));
      })
    ),

    get: authed('read', 'PurchaseOrder').input(byId).query(({ ctx, input }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.purchaseOrder.findUniqueOrThrow({ where: { id: input.id }, include: fullInclude }))
    ),

    create: authed('create', 'PurchaseOrder').input(purchaseOrderCreate).mutation(({ ctx, input }) => {
      const societeId = req(ctx.societeId);
      const { lines, orderDate, expectedDate, ...rest } = input;
      return withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
        tx.purchaseOrder.create({
          data: {
            ...rest,
            organizationId: ctx.user.organizationId,
            societeId,
            createdById: ctx.user.id,
            orderDate: orderDate ? new Date(orderDate) : undefined,
            expectedDate: expectedDate ? new Date(expectedDate) : undefined,
            lines: { create: lines.map(lineData) },
          },
          include: { lines: true },
        })
      );
    }),

    update: authed('update', 'PurchaseOrder').input(purchaseOrderUpdate).mutation(({ ctx, input }) => {
      const { id, lines, orderDate, expectedDate, warehouseId, ...rest } = input;
      return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
        const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id }, select: { status: true } });
        if (po.status !== 'draft') throw new TRPCError({ code: 'BAD_REQUEST', message: "Une commande envoyée n'est plus modifiable." });
        if (lines) await tx.purchaseOrderLine.deleteMany({ where: { orderId: id } });
        return tx.purchaseOrder.update({
          where: { id },
          data: {
            ...rest,
            ...(warehouseId !== undefined ? { warehouseId } : {}),
            ...(orderDate !== undefined ? { orderDate: orderDate ? new Date(orderDate) : null } : {}),
            ...(expectedDate !== undefined ? { expectedDate: expectedDate ? new Date(expectedDate) : null } : {}),
            ...(lines ? { lines: { create: lines.map(lineData) } } : {}),
          },
          include: { lines: true },
        });
      });
    }),

    /** Validation : numéro atomique (séquence « commande »), statut envoyée. */
    validate: authed('update', 'PurchaseOrder').input(byId).mutation(({ ctx, input }) => {
      const societeId = req(ctx.societeId);
      return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
        const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: input.id }, include: { lines: true } });
        if (po.status !== 'draft') return po;
        if (po.lines.length === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ajoutez au moins une ligne.' });
        const number = po.number ?? (await nextDocumentNumber(tx, societeId, 'commande'));
        return tx.purchaseOrder.update({ where: { id: input.id }, data: { status: 'sent', number, orderDate: po.orderDate ?? new Date() }, include: { lines: true } });
      });
    }),

    cancel: authed('update', 'PurchaseOrder').input(byId).mutation(({ ctx, input }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.purchaseOrder.update({ where: { id: input.id }, data: { status: 'cancelled' } }))
    ),

    /** Réception : entre en stock les quantités restantes et passe la commande « réceptionnée ». */
    receive: authed('update', 'PurchaseOrder').input(byId).mutation(({ ctx, input }) => {
      const societeId = req(ctx.societeId);
      return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
        const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: input.id }, include: { lines: true } });
        if (po.status === 'draft') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Validez la commande avant réception.' });
        if (po.status === 'cancelled') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Commande annulée.' });
        if (!po.warehouseId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Renseignez un entrepôt de destination.' });
        for (const l of po.lines) {
          const outstanding = n(l.quantity) - n(l.quantityReceived);
          if (outstanding > 0 && l.productId) {
            await tx.stockMovement.create({
              data: {
                organizationId: po.organizationId, societeId, warehouseId: po.warehouseId, productId: l.productId,
                kind: 'entree', quantity: outstanding, unitCost: l.unitPriceHt, note: `Réception ${po.number ?? ''}`.trim(), createdById: ctx.user.id,
              },
            });
          }
          if (outstanding > 0) await tx.purchaseOrderLine.update({ where: { id: l.id }, data: { quantityReceived: l.quantity } });
        }
        return tx.purchaseOrder.update({ where: { id: input.id }, data: { status: 'received' }, include: { lines: true } });
      });
    }),

    /**
     * Réception partielle : entre en stock les quantités reçues par ligne (livraisons échelonnées).
     * Statut « received » si toutes les lignes sont soldées, sinon « partial ». Refuse de dépasser le reste dû.
     */
    receivePartial: authed('update', 'PurchaseOrder').input(purchaseReceipt).mutation(({ ctx, input }) => {
      const societeId = req(ctx.societeId);
      return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
        const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: input.id }, include: { lines: true } });
        if (po.status === 'draft') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Validez la commande avant réception.' });
        if (po.status === 'cancelled') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Commande annulée.' });
        if (po.status === 'received') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Commande déjà soldée.' });
        if (!po.warehouseId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Renseignez un entrepôt de destination.' });
        const lineById = new Map(po.lines.map((l) => [l.id, l]));
        for (const r of input.lines) {
          const l = lineById.get(r.lineId);
          if (!l) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ligne inconnue pour cette commande.' });
          const outstanding = n(l.quantity) - n(l.quantityReceived);
          if (r.quantity > outstanding + 1e-6) throw new TRPCError({ code: 'BAD_REQUEST', message: `Quantité reçue (${r.quantity}) supérieure au reste à recevoir (${outstanding}).` });
          if (r.quantity <= 0) continue;
          if (l.productId) {
            await tx.stockMovement.create({
              data: {
                organizationId: po.organizationId, societeId, warehouseId: po.warehouseId, productId: l.productId,
                kind: 'entree', quantity: r.quantity, unitCost: l.unitPriceHt, note: `Réception partielle ${po.number ?? ''}`.trim(), createdById: ctx.user.id,
              },
            });
          }
          await tx.purchaseOrderLine.update({ where: { id: l.id }, data: { quantityReceived: n(l.quantityReceived) + r.quantity } });
        }
        const fresh = await tx.purchaseOrderLine.findMany({ where: { orderId: po.id } });
        const fullyReceived = fresh.every((l) => n(l.quantityReceived) >= n(l.quantity) - 1e-6);
        return tx.purchaseOrder.update({ where: { id: input.id }, data: { status: fullyReceived ? 'received' : 'partial' }, include: { lines: true } });
      });
    }),
  }),
});
