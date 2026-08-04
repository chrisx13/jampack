import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { withTenant } from '@jampack/db';
import { supplierPaymentCreate, computeInvoiceTotals, byId } from '@jampack/domain';
import { router, authed } from '../trpc/trpc';

const scope = (s: string | null) => (s ? { societeId: s } : {});
function req(s: string | null): string {
  if (!s) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Sélectionnez une société.' });
  return s;
}
const n = (v: unknown) => Number(v as never);

/** Recalcule le statut d'une facture fournisseur selon le cumul de ses règlements (payée / validée). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function recompute(tx: any, supplierInvoiceId: string) {
  const inv = await tx.supplierInvoice.findUnique({ where: { id: supplierInvoiceId }, include: { lines: true, payments: true } });
  if (!inv || inv.status === 'draft' || inv.status === 'cancelled') return;
  const { totalTtc } = computeInvoiceTotals(inv.lines.map((l: { quantity: unknown; unitPriceHt: unknown; taxRatePct: unknown }) => ({ quantity: n(l.quantity), unitPriceHt: n(l.unitPriceHt), taxRatePct: n(l.taxRatePct) })));
  const paid = inv.payments.reduce((s: number, p: { amount: unknown }) => s + n(p.amount), 0);
  const settled = paid + 0.005 >= totalTtc && totalTtc > 0;
  const status = settled ? 'paid' : 'validated';
  if (status !== inv.status) {
    await tx.supplierInvoice.update({ where: { id: supplierInvoiceId }, data: { status, paidDate: settled ? (inv.paidDate ?? new Date()) : null } });
  }
}

export const supplierPaymentRouter = router({
  listForInvoice: authed('read', 'SupplierInvoice').input(z.object({ supplierInvoiceId: z.string().min(1) })).query(({ ctx, input }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
      tx.supplierPayment.findMany({ where: { ...scope(ctx.societeId), supplierInvoiceId: input.supplierInvoiceId }, orderBy: { date: 'desc' } })
    )
  ),

  create: authed('update', 'SupplierInvoice').input(supplierPaymentCreate).mutation(({ ctx, input }) => {
    const societeId = req(ctx.societeId);
    const { date, ...rest } = input;
    return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const inv = await tx.supplierInvoice.findUniqueOrThrow({ where: { id: input.supplierInvoiceId }, select: { status: true } });
      if (inv.status === 'draft' || inv.status === 'cancelled') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Validez la facture avant de saisir un règlement.' });
      const p = await tx.supplierPayment.create({
        data: { ...rest, organizationId: ctx.user.organizationId, societeId, createdById: ctx.user.id, date: date ? new Date(date) : undefined },
      });
      await recompute(tx, input.supplierInvoiceId);
      return p;
    });
  }),

  remove: authed('update', 'SupplierInvoice').input(byId).mutation(({ ctx, input }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const p = await tx.supplierPayment.findUniqueOrThrow({ where: { id: input.id }, select: { supplierInvoiceId: true } });
      await tx.supplierPayment.delete({ where: { id: input.id } });
      await recompute(tx, p.supplierInvoiceId);
      return { id: input.id };
    })
  ),
});
