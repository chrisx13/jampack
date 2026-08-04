import { TRPCError } from '@trpc/server';
import { withTenant, nextDocumentNumber } from '@jampack/db';
import { SALES_DOCS, byId } from '@jampack/domain';
import { authed } from '../trpc/trpc';
import { makeSalesRouter, requireSociete, copyLines, fullInclude, salesTotals, htmlToPdf } from './salesRouter';
import { renderFacturXml } from './facturx';
import { renderDeliveryHtml } from './deliveryHtml';
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

/** Attribue (idempotent) un n° de BL séquentiel + une date de livraison à une facture. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureDeliveryNumber(tx: any, orgId: string, societeId: string, inv: { id: string; deliveryNumber: string | null; deliveredAt: Date | null }) {
  if (inv.deliveryNumber) return { deliveryNumber: inv.deliveryNumber, deliveredAt: inv.deliveredAt };
  await tx.numberSequence.upsert({
    where: { societeId_docType: { societeId, docType: 'bl' } },
    update: {},
    create: { organizationId: orgId, societeId, docType: 'bl', prefix: 'BL-' },
  });
  const deliveryNumber = await nextDocumentNumber(tx, societeId, 'bl');
  const deliveredAt = inv.deliveredAt ?? new Date();
  await tx.invoice.update({ where: { id: inv.id }, data: { deliveryNumber, deliveredAt } });
  return { deliveryNumber, deliveredAt };
}

/** Émet le bon de livraison d'une facture (attribue n° + date, idempotent) — sans rendu. */
const issueDelivery = authed('update', 'Invoice').input(byId).mutation(({ ctx, input }) => {
  const societeId = requireSociete(ctx.societeId);
  return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
    const inv = await tx.invoice.findUniqueOrThrow({ where: { id: input.id }, select: { id: true, docType: true, deliveryNumber: true, deliveredAt: true } });
    if (inv.docType !== 'facture') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Le bon de livraison se génère depuis une facture.' });
    return ensureDeliveryNumber(tx, ctx.user.organizationId, societeId, inv);
  });
});

/** Bon de livraison (PDF) d'une facture : garantit le n° BL puis rend le document (sans prix). */
const deliveryNote = authed('read', 'Invoice').input(byId).mutation(({ ctx, input }) => {
  const societeId = requireSociete(ctx.societeId);
  return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
    const inv = await tx.invoice.findUniqueOrThrow({ where: { id: input.id }, include: fullInclude });
    if (inv.docType !== 'facture') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Le bon de livraison se génère depuis une facture.' });
    const { deliveryNumber, deliveredAt } = await ensureDeliveryNumber(tx, ctx.user.organizationId, societeId, inv);
    const soc = await tx.societe.findUniqueOrThrow({ where: { id: societeId } });
    const html = renderDeliveryHtml({ ...inv, deliveryNumber, deliveredAt }, soc as never);
    return { filename: `${deliveryNumber}.pdf`, base64: await htmlToPdf(html) };
  });
});

export const invoiceRouter = makeSalesRouter(SALES_DOCS.facture, { createCreditNote, facturx, sendToPdp, transmissions, issueDelivery, deliveryNote });
