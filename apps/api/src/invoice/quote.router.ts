import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { withTenant } from '@jampack/db';
import { SALES_DOCS, byId, quoteDaysToExpiry, depositLines, effectiveDiscountFactor } from '@jampack/domain';
import { authed } from '../trpc/trpc';
import { makeSalesRouter, requireSociete, salesTotals, n } from './salesRouter';

const r2 = (v: number) => Math.round(v * 100) / 100;

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

    // Déduction des acomptes déjà facturés (facture de solde). Les lignes d'acompte sont nettes ;
    // on les stocke divisées par le facteur de remise pour qu'après application de la remise globale
    // (héritée du devis) leur contribution nette vaille exactement le montant de l'acompte.
    const deposits = await tx.invoice.findMany({ where: { sourceId: q.id, isDeposit: true, docType: 'facture', status: { in: ['validated', 'paid'] } }, include: { lines: true } });
    const grossHt = q.lines.reduce((s, l) => s + r2(n(l.quantity) * n(l.unitPriceHt)), 0);
    const factor = effectiveDiscountFactor(r2(grossHt), { discountType: q.discountType as 'none' | 'percent' | 'amount', discountValue: n(q.discountValue) }) || 1;
    const base = q.lines.map((l, i) => ({ productId: l.productId ?? undefined, label: l.label, quantity: l.quantity, unitPriceHt: l.unitPriceHt, taxRatePct: l.taxRatePct, position: i }));
    let pos = base.length;
    for (const dep of deposits) {
      for (const dl of dep.lines) {
        const net = r2(n(dl.quantity) * n(dl.unitPriceHt));
        base.push({ productId: undefined, label: `Acompte déjà facturé (${dep.number ?? ''})`.trim(), quantity: 1 as never, unitPriceHt: r2(-net / factor) as never, taxRatePct: dl.taxRatePct, position: pos++ });
      }
    }

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
        discountType: q.discountType,
        discountValue: q.discountValue,
        notes: q.notes,
        sourceId: q.id,
        createdById: ctx.user.id,
        lines: { create: base },
      },
    });
    await tx.invoice.update({ where: { id: q.id }, data: { status: 'converted' } });
    return { id: inv.id };
  });
});

/** Génère une facture d'acompte (brouillon) de `pct` % d'un devis, ventilée par taux de TVA. */
const createDepositInvoice = authed('create', 'Invoice').input(z.object({ id: z.string().min(1), pct: z.number().min(0.01).max(100) })).mutation(({ ctx, input }) => {
  requireSociete(ctx.societeId);
  return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
    const q = await tx.invoice.findUniqueOrThrow({ where: { id: input.id }, include: { lines: true } });
    if (q.docType !== 'devis') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Un acompte se crée depuis un devis.' });
    if (q.status === 'draft') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Validez (envoyez) le devis avant de demander un acompte.' });
    const dl = depositLines(
      q.lines.map((l) => ({ quantity: n(l.quantity), unitPriceHt: n(l.unitPriceHt), taxRatePct: n(l.taxRatePct) })),
      { discountType: q.discountType as 'none' | 'percent' | 'amount', discountValue: n(q.discountValue) },
      input.pct,
    );
    if (dl.length === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Devis sans montant à facturer.' });
    const inv = await tx.invoice.create({
      data: {
        docType: 'facture', status: 'draft', isDeposit: true,
        organizationId: q.organizationId, societeId: q.societeId, companyId: q.companyId, establishmentId: q.establishmentId,
        factorId: q.factorId, bankAccountId: q.bankAccountId, paymentTermId: q.paymentTermId,
        notes: `Facture d'acompte (${input.pct} %) sur devis ${q.number ?? ''}`.trim(),
        sourceId: q.id, createdById: ctx.user.id,
        lines: { create: dl.map((l, i) => ({ label: l.label, quantity: l.quantity, unitPriceHt: l.unitPriceHt, taxRatePct: l.taxRatePct, position: i })) },
      },
    });
    return { id: inv.id };
  });
});

export const quoteRouter = makeSalesRouter(SALES_DOCS.devis, {
  accept: setStatus('sent', 'accepted'),
  refuse: setStatus('sent', 'refused'),
  convertToInvoice,
  createDepositInvoice,
  expiring,
});
