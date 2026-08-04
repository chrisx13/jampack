import { TRPCError } from '@trpc/server';
import { withTenant } from '@jampack/db';
import { SALES_DOCS, byId, quoteDaysToExpiry } from '@jampack/domain';
import { authed } from '../trpc/trpc';
import { makeSalesRouter, requireSociete, copyLines, salesTotals } from './salesRouter';

/** Devis émis (non convertis) avec leur date de validité et le nb de jours avant expiration. */
const expiring = authed('read', 'Quote').query(({ ctx }) =>
  withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
    const rows = await tx.invoice.findMany({
      where: { ...(ctx.societeId ? { societeId: ctx.societeId } : {}), docType: 'devis', status: 'sent' },
      include: { company: { select: { name: true } }, lines: { select: { quantity: true, unitPriceHt: true, taxRatePct: true } } },
      orderBy: [{ validUntil: 'asc' }],
    });
    return rows.map((r) => {
      const t = salesTotals(r);
      return { id: r.id, number: r.number, company: r.company, validUntil: r.validUntil, totalTtc: t.totalTtc, daysToExpiry: quoteDaysToExpiry(r, new Date()), expired: quoteDaysToExpiry(r, new Date()) != null && (quoteDaysToExpiry(r, new Date()) as number) < 0 };
    });
  })
);

/** Transition de statut d'un devis émis (envoyé → accepté / refusé). */
const setStatus = (from: string, to: string) =>
  authed('update', 'Quote').input(byId).mutation(({ ctx, input }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const q = await tx.invoice.findUniqueOrThrow({ where: { id: input.id }, select: { status: true, docType: true } });
      if (q.docType !== 'devis') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Pièce non-devis.' });
      if (q.status !== from) throw new TRPCError({ code: 'BAD_REQUEST', message: `Le devis doit être « ${from} » pour cette action.` });
      return tx.invoice.update({ where: { id: input.id }, data: { status: to } });
    })
  );

/** Convertit un devis en facture (brouillon) et marque le devis « converti ». */
const convertToInvoice = authed('create', 'Invoice').input(byId).mutation(({ ctx, input }) => {
  requireSociete(ctx.societeId);
  return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
    const q = await tx.invoice.findUniqueOrThrow({ where: { id: input.id }, include: { lines: true } });
    if (q.docType !== 'devis') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Seul un devis se convertit en facture.' });
    if (q.status === 'converted') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ce devis est déjà converti.' });
    if (q.status === 'draft') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Validez (envoyez) le devis avant de le convertir.' });
    const inv = await tx.invoice.create({
      data: {
        docType: 'facture',
        status: 'draft',
        organizationId: q.organizationId,
        societeId: q.societeId,
        companyId: q.companyId,
        establishmentId: q.establishmentId,
        factorId: q.factorId,
        bankAccountId: q.bankAccountId,
        paymentTermId: q.paymentTermId,
        notes: q.notes,
        sourceId: q.id,
        createdById: ctx.user.id,
        lines: copyLines(q.lines),
      },
    });
    await tx.invoice.update({ where: { id: q.id }, data: { status: 'converted' } });
    return { id: inv.id };
  });
});

export const quoteRouter = makeSalesRouter(SALES_DOCS.devis, {
  accept: setStatus('sent', 'accepted'),
  refuse: setStatus('sent', 'refused'),
  convertToInvoice,
  expiring,
});
