import { TRPCError } from '@trpc/server';
import { withTenant } from '@jampack/db';
import { SALES_DOCS, byId } from '@jampack/domain';
import { authed } from '../trpc/trpc';
import { makeSalesRouter, requireSociete, copyLines } from './salesRouter';

/** Génère un avoir (brouillon) à partir d'une facture, en recopiant ses lignes. */
const createCreditNote = authed('create', 'CreditNote').input(byId).mutation(({ ctx, input }) => {
  requireSociete(ctx.societeId);
  return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
    const src = await tx.invoice.findUniqueOrThrow({ where: { id: input.id }, include: { lines: true } });
    if (src.docType !== 'facture') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Un avoir se crée depuis une facture.' });
    const av = await tx.invoice.create({
      data: {
        docType: 'avoir',
        status: 'draft',
        organizationId: src.organizationId,
        societeId: src.societeId,
        companyId: src.companyId,
        establishmentId: src.establishmentId,
        factorId: src.factorId,
        bankAccountId: src.bankAccountId,
        paymentTermId: src.paymentTermId,
        notes: `Avoir sur facture ${src.number ?? '(brouillon)'}`,
        sourceId: src.id,
        createdById: ctx.user.id,
        lines: copyLines(src.lines),
      },
    });
    return { id: av.id };
  });
});

export const invoiceRouter = makeSalesRouter(SALES_DOCS.facture, { createCreditNote });
