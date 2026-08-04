import { TRPCError } from '@trpc/server';
import { chromium } from 'playwright';
import { withTenant, nextDocumentNumber } from '@jampack/db';
import { invoiceCreate, invoiceUpdate, computeInvoiceTotals, byId, type SalesDocMeta } from '@jampack/domain';
import { router, authed } from '../trpc/trpc';
import { renderDocHtml } from './invoiceHtml';

export const scope = (societeId: string | null) => (societeId ? { societeId } : {});
export function requireSociete(societeId: string | null): string {
  if (!societeId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Sélectionnez une société.' });
  return societeId;
}
export const n = (v: unknown) => Number(v as never);

export const lineData = (
  l: { productId?: string; label: string; quantity: number; unitPriceHt: number; taxRatePct: number; position?: number },
  i: number
) => ({
  productId: l.productId || undefined,
  label: l.label,
  quantity: l.quantity,
  unitPriceHt: l.unitPriceHt,
  taxRatePct: l.taxRatePct,
  position: l.position ?? i,
});

/** Résout affactureur / compte bancaire / condition de paiement (défauts client puis société). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveBilling(tx: any, societeId: string, companyId: string, input: { factorId?: string | null; bankAccountId?: string | null; paymentTermId?: string | null }) {
  const company = await tx.company.findUniqueOrThrow({ where: { id: companyId }, select: { factorId: true, factorMandatory: true, paymentTermId: true } });
  const [defTerm, defBank] = await Promise.all([
    tx.paymentTerm.findFirst({ where: { societeId, isDefault: true, isActive: true }, select: { id: true } }),
    tx.bankAccount.findFirst({ where: { societeId, isDefault: true, isActive: true }, select: { id: true } }),
  ]);
  const pick = (given: string | null | undefined, fallback: string | null) => (given !== undefined ? given : fallback);
  const factorId = company.factorMandatory ? (company.factorId ?? null) : pick(input.factorId, company.factorId ?? null);
  const paymentTermId = pick(input.paymentTermId, company.paymentTermId ?? defTerm?.id ?? null);
  const bankAccountId = pick(input.bankAccountId, defBank?.id ?? null);
  return { factorId, paymentTermId, bankAccountId };
}

export const fullInclude = {
  lines: { orderBy: { position: 'asc' as const } },
  company: { select: { name: true, siren: true, siret: true, tvaNumber: true } },
  establishment: true,
  factor: true,
  bankAccount: true,
  paymentTerm: true,
};

async function htmlToPdf(html: string) {
  const browser = await chromium.launch({ ignoreDefaultArgs: ['--headless=old'], args: ['--headless=new', '--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    const buf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '14mm', bottom: '16mm', left: '14mm', right: '14mm' } });
    return Buffer.from(buf).toString('base64');
  } finally {
    await browser.close();
  }
}

/**
 * Construit le routeur CRUD d'une pièce de vente (devis / facture / avoir).
 * Toutes les pièces partagent le même modèle `Invoice` discriminé par `docType`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function makeSalesRouter(meta: SalesDocMeta, extra: Record<string, any> = {}) {
  const where = (societeId: string | null) => ({ ...scope(societeId), docType: meta.docType });

  return router({
    list: authed('read', meta.subject).query(({ ctx }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
        const rows = await tx.invoice.findMany({
          where: where(ctx.societeId),
          include: { company: { select: { name: true } }, lines: { select: { quantity: true, unitPriceHt: true, taxRatePct: true } } },
          orderBy: [{ createdAt: 'desc' }],
        });
        return rows.map((r) => ({
          id: r.id, number: r.number, status: r.status, issueDate: r.issueDate, dueDate: r.dueDate, validUntil: r.validUntil,
          company: r.company,
          ...computeInvoiceTotals(r.lines.map((l) => ({ quantity: n(l.quantity), unitPriceHt: n(l.unitPriceHt), taxRatePct: n(l.taxRatePct) }))),
        }));
      })
    ),

    get: authed('read', meta.subject).input(byId).query(({ ctx, input }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.invoice.findUniqueOrThrow({ where: { id: input.id }, include: fullInclude }))
    ),

    create: authed('create', meta.subject).input(invoiceCreate).mutation(async ({ ctx, input }) => {
      const societeId = requireSociete(ctx.societeId);
      const { lines, issueDate, dueDate, validUntil, factorId, bankAccountId, paymentTermId, ...rest } = input;
      return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
        // Droit de limitation RGPD (art. 18) : aucun nouveau traitement (pièce) sur un tiers gelé.
        const co = await tx.company.findUniqueOrThrow({ where: { id: rest.companyId }, select: { processingRestricted: true } });
        if (co.processingRestricted) throw new TRPCError({ code: 'FORBIDDEN', message: "Traitement limité (RGPD art. 18) : ce tiers ne peut pas faire l'objet de nouvelles pièces." });
        const b = await resolveBilling(tx, societeId, rest.companyId, { factorId, bankAccountId, paymentTermId });
        return tx.invoice.create({
          data: {
            ...rest,
            docType: meta.docType,
            organizationId: ctx.user.organizationId,
            societeId,
            createdById: ctx.user.id,
            issueDate: issueDate ? new Date(issueDate) : undefined,
            dueDate: dueDate ? new Date(dueDate) : undefined,
            validUntil: validUntil ? new Date(validUntil) : undefined,
            factorId: b.factorId,
            bankAccountId: b.bankAccountId,
            paymentTermId: b.paymentTermId,
            lines: { create: lines.map(lineData) },
          },
          include: { lines: true },
        });
      });
    }),

    update: authed('update', meta.subject).input(invoiceUpdate).mutation(async ({ ctx, input }) => {
      const { id, lines, issueDate, dueDate, validUntil, establishmentId, factorId, bankAccountId, paymentTermId, ...rest } = input;
      const societeId = requireSociete(ctx.societeId);
      return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
        const doc = await tx.invoice.findUniqueOrThrow({ where: { id }, select: { status: true, companyId: true } });
        if (doc.status !== 'draft') throw new TRPCError({ code: 'BAD_REQUEST', message: `Un ${meta.singular.toLowerCase()} validé n'est plus modifiable.` });
        if (lines) await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
        const b = await resolveBilling(tx, societeId, rest.companyId ?? doc.companyId, { factorId, bankAccountId, paymentTermId });
        return tx.invoice.update({
          where: { id },
          data: {
            ...rest,
            ...(establishmentId !== undefined ? { establishmentId } : {}),
            ...(issueDate !== undefined ? { issueDate: issueDate ? new Date(issueDate) : null } : {}),
            ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
            ...(validUntil !== undefined ? { validUntil: validUntil ? new Date(validUntil) : null } : {}),
            factorId: b.factorId,
            bankAccountId: b.bankAccountId,
            paymentTermId: b.paymentTermId,
            ...(lines ? { lines: { create: lines.map(lineData) } } : {}),
          },
          include: { lines: true },
        });
      });
    }),

    /** Émission : numéro atomique + statut « émis » propre au type de pièce. */
    validate: authed('update', meta.subject).input(byId).mutation(({ ctx, input }) => {
      const societeId = requireSociete(ctx.societeId);
      return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
        const doc = await tx.invoice.findUniqueOrThrow({ where: { id: input.id }, include: { lines: true, paymentTerm: true } });
        if (doc.status !== 'draft') return doc;
        if (doc.lines.length === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ajoutez au moins une ligne avant de valider.' });
        const number = doc.number ?? (await nextDocumentNumber(tx, societeId, meta.seqType));
        const issue = doc.issueDate ?? new Date();
        const data: Record<string, unknown> = { status: meta.issuedStatus, number, issueDate: issue };
        if (meta.docType === 'facture') {
          data.dueDate = doc.dueDate ?? (doc.paymentTerm ? new Date(issue.getTime() + doc.paymentTerm.days * 86400000) : null);
        } else if (meta.docType === 'devis') {
          data.validUntil = doc.validUntil ?? new Date(issue.getTime() + 30 * 86400000);
        }
        return tx.invoice.update({ where: { id: input.id }, data, include: { lines: true } });
      });
    }),

    cancel: authed('update', meta.subject).input(byId).mutation(({ ctx, input }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.invoice.update({ where: { id: input.id }, data: { status: 'cancelled' } }))
    ),

    /** Duplique la pièce en un nouveau brouillon (même type, même client/lignes ; numéro et dates réinitialisés). */
    duplicate: authed('create', meta.subject).input(byId).mutation(({ ctx, input }) => {
      const societeId = requireSociete(ctx.societeId);
      return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
        const src = await tx.invoice.findUniqueOrThrow({ where: { id: input.id }, include: { lines: true } });
        return tx.invoice.create({
          data: {
            docType: meta.docType,
            organizationId: ctx.user.organizationId,
            societeId,
            createdById: ctx.user.id,
            companyId: src.companyId,
            notes: src.notes,
            vatReverseCharge: src.vatReverseCharge,
            paymentTermId: src.paymentTermId,
            bankAccountId: src.bankAccountId,
            factorId: src.factorId,
            lines: copyLines(src.lines),
          },
          include: { lines: true },
        });
      });
    }),

    /** PDF de la pièce (template HTML → PDF via Chromium). */
    pdf: authed('read', meta.subject).input(byId).mutation(async ({ ctx, input }) => {
      const societeId = requireSociete(ctx.societeId);
      const { html, filename } = await withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
        const doc = await tx.invoice.findUniqueOrThrow({ where: { id: input.id }, include: fullInclude });
        const soc = await tx.societe.findUniqueOrThrow({ where: { id: societeId } });
        const totals = computeInvoiceTotals(doc.lines.map((l) => ({ quantity: n(l.quantity), unitPriceHt: n(l.unitPriceHt), taxRatePct: n(l.taxRatePct) })));
        return { html: renderDocHtml(doc, soc, totals), filename: `${doc.number ?? 'brouillon'}.pdf` };
      });
      return { filename, base64: await htmlToPdf(html) };
    }),

    ...extra,
  });
}

/** Copie les lignes d'une pièce vers une nouvelle (conversion devis→facture, facture→avoir). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const copyLines = (lines: any[]) => ({
  create: lines.map((l) => ({ productId: l.productId ?? undefined, label: l.label, quantity: l.quantity, unitPriceHt: l.unitPriceHt, taxRatePct: l.taxRatePct, position: l.position })),
});
