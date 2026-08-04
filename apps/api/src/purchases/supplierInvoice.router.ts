import { TRPCError } from '@trpc/server';
import { withTenant } from '@jampack/db';
import { supplierInvoiceCreate, supplierInvoiceUpdate, computeInvoiceTotals, byId } from '@jampack/domain';
import { router, authed } from '../trpc/trpc';

const scope = (s: string | null) => (s ? { societeId: s } : {});
function req(s: string | null): string {
  if (!s) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Sélectionnez une société.' });
  return s;
}
const n = (v: unknown) => Number(v as never);
const lineData = (l: { label: string; quantity: number; unitPriceHt: number; taxRatePct: number; position?: number }, i: number) => ({
  label: l.label, quantity: l.quantity, unitPriceHt: l.unitPriceHt, taxRatePct: l.taxRatePct, position: l.position ?? i,
});
const totalsOf = (lines: { quantity: unknown; unitPriceHt: unknown; taxRatePct: unknown }[]) =>
  computeInvoiceTotals(lines.map((l) => ({ quantity: n(l.quantity), unitPriceHt: n(l.unitPriceHt), taxRatePct: n(l.taxRatePct) })));

const fullInclude = { lines: { orderBy: { position: 'asc' as const } }, supplier: { select: { name: true } }, purchaseOrder: { select: { number: true } } };

export const supplierInvoiceRouter = router({
  list: authed('read', 'SupplierInvoice').query(({ ctx }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const rows = await tx.supplierInvoice.findMany({
        where: scope(ctx.societeId),
        include: { supplier: { select: { name: true } }, lines: { select: { quantity: true, unitPriceHt: true, taxRatePct: true } } },
        orderBy: [{ createdAt: 'desc' }],
      });
      return rows.map((r) => ({ id: r.id, reference: r.reference, status: r.status, issueDate: r.issueDate, dueDate: r.dueDate, supplier: r.supplier, ...totalsOf(r.lines) }));
    })
  ),

  get: authed('read', 'SupplierInvoice').input(byId).query(({ ctx, input }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.supplierInvoice.findUniqueOrThrow({ where: { id: input.id }, include: fullInclude }))
  ),

  /** Rapprochement 3 voies : commande ↔ réception ↔ facture fournisseur (contrôle de cohérence). */
  match: authed('read', 'SupplierInvoice').input(byId).query(({ ctx, input }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const inv = await tx.supplierInvoice.findUniqueOrThrow({
        where: { id: input.id },
        include: { lines: true, purchaseOrder: { include: { lines: true } } },
      });
      const r2 = (v: number) => Math.round(v * 100) / 100;
      const invoicedHt = r2(inv.lines.reduce((s, l) => s + n(l.quantity) * n(l.unitPriceHt), 0));
      const po = inv.purchaseOrder;
      if (!po) return { linked: false as const, invoicedHt };
      const orderedHt = r2(po.lines.reduce((s, l) => s + n(l.quantity) * n(l.unitPriceHt), 0));
      const orderedQty = po.lines.reduce((s, l) => s + n(l.quantity), 0);
      const receivedQty = po.lines.reduce((s, l) => s + n(l.quantityReceived), 0);
      const variance = r2(invoicedHt - orderedHt);
      const receptionComplete = po.lines.every((l) => n(l.quantityReceived) + 0.0005 >= n(l.quantity));
      const priceMatch = Math.abs(variance) <= 0.01;
      return {
        linked: true as const,
        poNumber: po.number,
        poStatus: po.status,
        orderedHt,
        invoicedHt,
        variance,
        receivedRatio: orderedQty > 0 ? Math.round((receivedQty / orderedQty) * 100) : 0,
        receptionComplete,
        priceMatch,
        overInvoiced: variance > 0.01,
        ok: priceMatch && receptionComplete,
      };
    })
  ),

  create: authed('create', 'SupplierInvoice').input(supplierInvoiceCreate).mutation(({ ctx, input }) => {
    const societeId = req(ctx.societeId);
    const { lines, issueDate, dueDate, ...rest } = input;
    return withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
      tx.supplierInvoice.create({
        data: {
          ...rest, organizationId: ctx.user.organizationId, societeId, createdById: ctx.user.id,
          issueDate: issueDate ? new Date(issueDate) : undefined,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          lines: { create: lines.map(lineData) },
        },
        include: { lines: true },
      })
    );
  }),

  update: authed('update', 'SupplierInvoice').input(supplierInvoiceUpdate).mutation(({ ctx, input }) => {
    const { id, lines, issueDate, dueDate, purchaseOrderId, ...rest } = input;
    return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const inv = await tx.supplierInvoice.findUniqueOrThrow({ where: { id }, select: { status: true } });
      if (inv.status !== 'draft') throw new TRPCError({ code: 'BAD_REQUEST', message: "Une facture validée n'est plus modifiable." });
      if (lines) await tx.supplierInvoiceLine.deleteMany({ where: { invoiceId: id } });
      return tx.supplierInvoice.update({
        where: { id },
        data: {
          ...rest,
          ...(purchaseOrderId !== undefined ? { purchaseOrderId } : {}),
          ...(issueDate !== undefined ? { issueDate: issueDate ? new Date(issueDate) : null } : {}),
          ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
          ...(lines ? { lines: { create: lines.map(lineData) } } : {}),
        },
        include: { lines: true },
      });
    });
  }),

  validate: authed('update', 'SupplierInvoice').input(byId).mutation(({ ctx, input }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const inv = await tx.supplierInvoice.findUniqueOrThrow({ where: { id: input.id }, include: { lines: true } });
      if (inv.status !== 'draft') return inv;
      if (inv.lines.length === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ajoutez au moins une ligne.' });
      return tx.supplierInvoice.update({ where: { id: input.id }, data: { status: 'validated', issueDate: inv.issueDate ?? new Date() }, include: { lines: true } });
    })
  ),

  markPaid: authed('update', 'SupplierInvoice').input(byId).mutation(({ ctx, input }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.supplierInvoice.update({ where: { id: input.id }, data: { status: 'paid', paidDate: new Date() } }))
  ),
  markUnpaid: authed('update', 'SupplierInvoice').input(byId).mutation(({ ctx, input }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.supplierInvoice.update({ where: { id: input.id }, data: { status: 'validated', paidDate: null } }))
  ),
  cancel: authed('update', 'SupplierInvoice').input(byId).mutation(({ ctx, input }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.supplierInvoice.update({ where: { id: input.id }, data: { status: 'cancelled' } }))
  ),

  /** Échéancier fournisseur : factures validées non soldées, avec reste dû et retard. */
  echeancier: authed('read', 'SupplierInvoice').query(({ ctx }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const rows = await tx.supplierInvoice.findMany({
        where: { ...scope(ctx.societeId), status: 'validated' },
        include: {
          supplier: { select: { name: true } },
          lines: { select: { quantity: true, unitPriceHt: true, taxRatePct: true } },
          payments: { select: { amount: true } },
        },
        orderBy: [{ dueDate: 'asc' }],
      });
      const now = Date.now();
      return rows
        .map((r) => {
          const { totalTtc } = totalsOf(r.lines);
          const paid = r.payments.reduce((s, p) => s + n(p.amount), 0);
          const remaining = Math.round((totalTtc - paid) * 100) / 100;
          return { id: r.id, reference: r.reference, supplier: r.supplier, dueDate: r.dueDate, totalTtc, paid, remaining, overdue: r.dueDate ? new Date(r.dueDate).getTime() < now : false };
        })
        .filter((r) => r.remaining > 0.005);
    })
  ),
});
