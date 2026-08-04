import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { withTenant } from '@jampack/db';
import { paymentCreate, computeInvoiceTotals, byId, dunningMessage } from '@jampack/domain';
import { router, authed } from '../trpc/trpc';
import { requireSociete, scope, n } from './salesRouter';

/** Recalcule le statut d'une facture selon le cumul de ses règlements (payée / validée). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function recompute(tx: any, invoiceId: string) {
  const inv = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { lines: true, payments: true } });
  if (!inv || inv.docType !== 'facture' || inv.status === 'draft' || inv.status === 'cancelled') return;
  const { totalTtc } = computeInvoiceTotals(inv.lines.map((l: { quantity: unknown; unitPriceHt: unknown; taxRatePct: unknown }) => ({ quantity: n(l.quantity), unitPriceHt: n(l.unitPriceHt), taxRatePct: n(l.taxRatePct) })));
  const paid = inv.payments.reduce((s: number, p: { amount: unknown }) => s + n(p.amount), 0);
  const status = paid + 0.005 >= totalTtc ? 'paid' : 'validated';
  if (status !== inv.status) await tx.invoice.update({ where: { id: invoiceId }, data: { status } });
}

export const paymentRouter = router({
  listForInvoice: authed('read', 'Payment').input(z.object({ invoiceId: z.string().min(1) })).query(({ ctx, input }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
      tx.payment.findMany({ where: { ...scope(ctx.societeId), invoiceId: input.invoiceId }, orderBy: { date: 'desc' } })
    )
  ),

  create: authed('create', 'Payment').input(paymentCreate).mutation(({ ctx, input }) => {
    const societeId = requireSociete(ctx.societeId);
    const { date, ...rest } = input;
    return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const inv = await tx.invoice.findUniqueOrThrow({ where: { id: input.invoiceId }, select: { docType: true, status: true } });
      if (inv.docType !== 'facture') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Un règlement se rattache à une facture.' });
      if (inv.status === 'draft' || inv.status === 'cancelled') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Validez la facture avant de saisir un règlement.' });
      const p = await tx.payment.create({
        data: { ...rest, organizationId: ctx.user.organizationId, societeId, createdById: ctx.user.id, date: date ? new Date(date) : undefined },
      });
      await recompute(tx, input.invoiceId);
      return p;
    });
  }),

  remove: authed('delete', 'Payment').input(byId).mutation(({ ctx, input }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const p = await tx.payment.findUniqueOrThrow({ where: { id: input.id }, select: { invoiceId: true } });
      await tx.payment.delete({ where: { id: input.id } });
      await recompute(tx, p.invoiceId);
      return { id: input.id };
    })
  ),

  /** Échéancier client : factures validées non soldées, avec reste dû et retard. */
  echeancier: authed('read', 'Payment').query(({ ctx }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const rows = await tx.invoice.findMany({
        where: { ...scope(ctx.societeId), docType: 'facture', status: 'validated' },
        include: {
          company: { select: { name: true } },
          lines: { select: { quantity: true, unitPriceHt: true, taxRatePct: true } },
          payments: { select: { amount: true } },
        },
        orderBy: [{ dueDate: 'asc' }],
      });
      const now = Date.now();
      return rows
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => {
          const { totalTtc } = computeInvoiceTotals(r.lines.map((l: { quantity: unknown; unitPriceHt: unknown; taxRatePct: unknown }) => ({ quantity: n(l.quantity), unitPriceHt: n(l.unitPriceHt), taxRatePct: n(l.taxRatePct) })));
          const paid = r.payments.reduce((s: number, p: { amount: unknown }) => s + n(p.amount), 0);
          const remaining = Math.round((totalTtc - paid) * 100) / 100;
          const overdue = r.dueDate ? new Date(r.dueDate).getTime() < now : false;
          return { id: r.id, number: r.number, company: r.company, dueDate: r.dueDate, totalTtc, paid, remaining, overdue };
        })
        .filter((r: { remaining: number }) => r.remaining > 0.005);
    })
  ),

  /** Relances : factures échues non soldées, avec le niveau de relance atteint et le reste dû. */
  reminders: authed('read', 'Payment').query(({ ctx }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const rows = await tx.invoice.findMany({
        where: { ...scope(ctx.societeId), docType: 'facture', status: 'validated', dueDate: { lt: new Date() } },
        include: { company: { select: { name: true } }, lines: { select: { quantity: true, unitPriceHt: true, taxRatePct: true } }, payments: { select: { amount: true } } },
        orderBy: [{ reminderLevel: 'desc' }, { dueDate: 'asc' }],
      });
      return rows
        .map((r) => {
          const { totalTtc } = computeInvoiceTotals(r.lines.map((l) => ({ quantity: n(l.quantity), unitPriceHt: n(l.unitPriceHt), taxRatePct: n(l.taxRatePct) })));
          const remaining = Math.round((totalTtc - r.payments.reduce((s, p) => s + n(p.amount), 0)) * 100) / 100;
          return { id: r.id, number: r.number, company: r.company, dueDate: r.dueDate, remaining, reminderLevel: r.reminderLevel, lastReminderAt: r.lastReminderAt };
        })
        .filter((r) => r.remaining > 0.005);
    })
  ),

  /** Enregistre une relance (incrémente le niveau, cap 3) sur une facture. */
  recordReminder: authed('update', 'Payment').input(byId).mutation(({ ctx, input }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const inv = await tx.invoice.findUniqueOrThrow({ where: { id: input.id }, select: { docType: true, reminderLevel: true } });
      if (inv.docType !== 'facture') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Seule une facture se relance.' });
      return tx.invoice.update({ where: { id: input.id }, data: { reminderLevel: Math.min(inv.reminderLevel + 1, 3), lastReminderAt: new Date() } });
    })
  ),

  /** Lettre de relance (texte) au niveau suivant, pour la facture. */
  reminderLetter: authed('read', 'Payment').input(byId).query(({ ctx, input }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const inv = await tx.invoice.findUniqueOrThrow({ where: { id: input.id }, include: { lines: true, payments: true } });
      const { totalTtc } = computeInvoiceTotals(inv.lines.map((l) => ({ quantity: n(l.quantity), unitPriceHt: n(l.unitPriceHt), taxRatePct: n(l.taxRatePct) })));
      const remaining = Math.round((totalTtc - inv.payments.reduce((s, p) => s + n(p.amount), 0)) * 100) / 100;
      const level = Math.min((inv.reminderLevel || 0) + 1, 3);
      const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
      const content = dunningMessage(level, { number: inv.number ?? '', amount: eur.format(remaining), dueDate: inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('fr-FR') : '—' });
      return { filename: `relance-${inv.number ?? 'facture'}.txt`, content, level };
    })
  ),
});
