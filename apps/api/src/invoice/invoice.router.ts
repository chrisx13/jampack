import { TRPCError } from '@trpc/server';
import { chromium } from 'playwright';
import { withTenant, nextDocumentNumber } from '@jampack/db';
import { invoiceCreate, invoiceUpdate, computeInvoiceTotals, byId } from '@jampack/domain';
import { router, authed } from '../trpc/trpc';
import { renderInvoiceHtml } from './invoiceHtml';

const scope = (societeId: string | null) => (societeId ? { societeId } : {});
function requireSociete(societeId: string | null): string {
  if (!societeId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Sélectionnez une société.' });
  return societeId;
}
const n = (v: unknown) => Number(v as never);
const lineData = (l: { productId?: string; label: string; quantity: number; unitPriceHt: number; taxRatePct: number; position?: number }, i: number) => ({
  productId: l.productId || undefined,
  label: l.label,
  quantity: l.quantity,
  unitPriceHt: l.unitPriceHt,
  taxRatePct: l.taxRatePct,
  position: l.position ?? i,
});

/**
 * Résout l'affactureur / le compte bancaire / la condition de paiement d'une facture :
 * - factor : imposé si le client l'exige (factorMandatory), sinon valeur fournie ou défaut du client ;
 * - condition de paiement : valeur fournie, sinon spécifique au client, sinon défaut société ;
 * - compte bancaire : valeur fournie, sinon compte par défaut de la société.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveBilling(tx: any, societeId: string, companyId: string, input: { factorId?: string | null; bankAccountId?: string | null; paymentTermId?: string | null }) {
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

const fullInclude = {
  lines: { orderBy: { position: 'asc' as const } },
  company: { select: { name: true } },
  establishment: true,
  factor: true,
  bankAccount: true,
  paymentTerm: true,
};

export const invoiceRouter = router({
  list: authed('read', 'Invoice').query(({ ctx }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const rows = await tx.invoice.findMany({
        where: scope(ctx.societeId),
        include: { company: { select: { name: true } }, lines: { select: { quantity: true, unitPriceHt: true, taxRatePct: true } } },
        orderBy: [{ createdAt: 'desc' }],
      });
      return rows.map((r) => ({
        id: r.id, number: r.number, status: r.status, issueDate: r.issueDate, dueDate: r.dueDate,
        company: r.company,
        ...computeInvoiceTotals(r.lines.map((l) => ({ quantity: n(l.quantity), unitPriceHt: n(l.unitPriceHt), taxRatePct: n(l.taxRatePct) }))),
      }));
    })
  ),

  get: authed('read', 'Invoice').input(byId).query(({ ctx, input }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.invoice.findUniqueOrThrow({ where: { id: input.id }, include: fullInclude }))
  ),

  create: authed('create', 'Invoice').input(invoiceCreate).mutation(async ({ ctx, input }) => {
    const societeId = requireSociete(ctx.societeId);
    const { lines, issueDate, dueDate, factorId, bankAccountId, paymentTermId, ...rest } = input;
    return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const b = await resolveBilling(tx, societeId, rest.companyId, { factorId, bankAccountId, paymentTermId });
      return tx.invoice.create({
        data: {
          ...rest,
          organizationId: ctx.user.organizationId,
          societeId,
          createdById: ctx.user.id,
          issueDate: issueDate ? new Date(issueDate) : undefined,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          factorId: b.factorId,
          bankAccountId: b.bankAccountId,
          paymentTermId: b.paymentTermId,
          lines: { create: lines.map(lineData) },
        },
        include: { lines: true },
      });
    });
  }),

  update: authed('update', 'Invoice').input(invoiceUpdate).mutation(async ({ ctx, input }) => {
    const { id, lines, issueDate, dueDate, establishmentId, factorId, bankAccountId, paymentTermId, ...rest } = input;
    const societeId = requireSociete(ctx.societeId);
    return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const inv = await tx.invoice.findUniqueOrThrow({ where: { id }, select: { status: true, companyId: true } });
      if (inv.status !== 'draft') throw new TRPCError({ code: 'BAD_REQUEST', message: "Une facture validée n'est plus modifiable." });
      if (lines) await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
      const b = await resolveBilling(tx, societeId, rest.companyId ?? inv.companyId, { factorId, bankAccountId, paymentTermId });
      return tx.invoice.update({
        where: { id },
        data: {
          ...rest,
          ...(establishmentId !== undefined ? { establishmentId } : {}),
          ...(issueDate !== undefined ? { issueDate: issueDate ? new Date(issueDate) : null } : {}),
          ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
          factorId: b.factorId,
          bankAccountId: b.bankAccountId,
          paymentTermId: b.paymentTermId,
          ...(lines ? { lines: { create: lines.map(lineData) } } : {}),
        },
        include: { lines: true },
      });
    });
  }),

  /** Validation : numéro atomique, échéance calculée depuis la condition de paiement. */
  validate: authed('update', 'Invoice').input(byId).mutation(({ ctx, input }) => {
    const societeId = requireSociete(ctx.societeId);
    return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const inv = await tx.invoice.findUniqueOrThrow({ where: { id: input.id }, include: { lines: true, paymentTerm: true } });
      if (inv.status !== 'draft') return inv;
      if (inv.lines.length === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ajoutez au moins une ligne avant de valider.' });
      const number = inv.number ?? (await nextDocumentNumber(tx, societeId, 'facture'));
      const issue = inv.issueDate ?? new Date();
      const due = inv.dueDate ?? (inv.paymentTerm ? new Date(issue.getTime() + inv.paymentTerm.days * 86400000) : null);
      return tx.invoice.update({
        where: { id: input.id },
        data: { status: 'validated', number, issueDate: issue, dueDate: due ?? undefined },
        include: { lines: true },
      });
    });
  }),

  cancel: authed('update', 'Invoice').input(byId).mutation(({ ctx, input }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.invoice.update({ where: { id: input.id }, data: { status: 'cancelled' } }))
  ),

  /** PDF de la facture (template HTML à champs de fusion → PDF via Chromium). */
  pdf: authed('read', 'Invoice').input(byId).mutation(async ({ ctx, input }) => {
    const societeId = requireSociete(ctx.societeId);
    const { html, filename } = await withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const inv = await tx.invoice.findUniqueOrThrow({ where: { id: input.id }, include: fullInclude });
      const soc = await tx.societe.findUniqueOrThrow({ where: { id: societeId } });
      const totals = computeInvoiceTotals(inv.lines.map((l) => ({ quantity: n(l.quantity), unitPriceHt: n(l.unitPriceHt), taxRatePct: n(l.taxRatePct) })));
      return { html: renderInvoiceHtml(inv, soc, totals), filename: `${inv.number ?? 'brouillon'}.pdf` };
    });
    const browser = await chromium.launch({ ignoreDefaultArgs: ['--headless=old'], args: ['--headless=new', '--no-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle' });
      const buf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '14mm', bottom: '16mm', left: '14mm', right: '14mm' } });
      return { filename, base64: Buffer.from(buf).toString('base64') };
    } finally {
      await browser.close();
    }
  }),
});
