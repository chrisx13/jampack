import { TRPCError } from '@trpc/server';
import { withTenant } from '@jampack/db';
import { SALES_DOCS, byId } from '@jampack/domain';
import { authed } from '../trpc/trpc';
import { makeSalesRouter, requireSociete, copyLines, fullInclude, salesTotals } from './salesRouter';
import { renderFacturXml } from './facturx';
import { getPdp } from './pdp';

/** Génère un avoir (brouillon) à partir d'une facture, en recopiant ses lignes. */
const createCreditNote = authed('create', 'CreditNote').input(byId).mutation(({ ctx, input }) => {
  requireSociete(ctx.societeId);
  return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
    const src = await tx.invoice.findUniqueOrThrow({ where: { id: input.id }, include: { lines: true } });
    if (src.docType !== 'facture') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Un avoir se crée depuis une facture.' });
    const av = await tx.invoice.create({
      data: {
        docType: 'avoir', status: 'draft', organizationId: src.organizationId, societeId: src.societeId,
        companyId: src.companyId, establishmentId: src.establishmentId, factorId: src.factorId, bankAccountId: src.bankAccountId, paymentTermId: src.paymentTermId,
        discountType: src.discountType, discountValue: src.discountValue,
        notes: `Avoir sur facture ${src.number ?? '(brouillon)'}`, sourceId: src.id, createdById: ctx.user.id, lines: copyLines(src.lines),
      },
    });
    return { id: av.id };
  });
});

/** Facture au format Factur-X (XML CII) — pour téléchargement / dépôt PDP. */
const facturx = authed('read', 'Invoice').input(byId).query(({ ctx, input }) => {
  const societeId = requireSociete(ctx.societeId);
  return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
    const inv = await tx.invoice.findUniqueOrThrow({ where: { id: input.id }, include: fullInclude });
    if (inv.docType !== 'facture') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Factur-X uniquement pour les factures.' });
    const soc = await tx.societe.findUniqueOrThrow({ where: { id: societeId } });
    const totals = salesTotals(inv);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { filename: `${inv.number ?? 'brouillon'}-facturx.xml`, xml: renderFacturXml(inv as any, soc as any, totals) };
  });
});

/** Transmet la facture via la PDP (interne par défaut) et journalise la transmission. */
const sendToPdp = authed('update', 'Invoice').input(byId).mutation(({ ctx, input }) => {
  const societeId = requireSociete(ctx.societeId);
  return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
    const inv = await tx.invoice.findUniqueOrThrow({ where: { id: input.id }, include: fullInclude });
    if (inv.docType !== 'facture') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Seule une facture s’envoie via PDP.' });
    if (inv.status === 'draft' || inv.status === 'cancelled') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Validez la facture avant transmission.' });
    const soc = await tx.societe.findUniqueOrThrow({ where: { id: societeId } });
    const totals = salesTotals(inv);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const xml = renderFacturXml(inv as any, soc as any, totals);
    const res = await getPdp().transmit({ invoiceNumber: inv.number ?? '', xml });
    const rec = await tx.pdpTransmission.create({ data: { organizationId: ctx.user.organizationId, societeId, invoiceId: inv.id, provider: res.provider, status: res.status, providerRef: res.providerRef } });
    return { id: rec.id, status: res.status, provider: res.provider, providerRef: res.providerRef };
  });
});

/** Historique des transmissions PDP d'une facture. */
const transmissions = authed('read', 'Invoice').input(byId).query(({ ctx, input }) =>
  withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.pdpTransmission.findMany({ where: { invoiceId: input.id }, orderBy: { createdAt: 'desc' } }))
);

export const invoiceRouter = makeSalesRouter(SALES_DOCS.facture, { createCreditNote, facturx, sendToPdp, transmissions });
