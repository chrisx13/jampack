import { TRPCError } from '@trpc/server';
import { withTenant, nextDocumentNumber } from '@jampack/db';
import { invoiceCreate, invoiceUpdate, computeInvoiceTotals, byId } from '@jampack/domain';
import { router, authed } from '../trpc/trpc';

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
    withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
      tx.invoice.findUniqueOrThrow({
        where: { id: input.id },
        include: { lines: { orderBy: { position: 'asc' } }, company: { select: { name: true } }, establishment: true },
      })
    )
  ),

  create: authed('create', 'Invoice').input(invoiceCreate).mutation(({ ctx, input }) => {
    const societeId = requireSociete(ctx.societeId);
    const { lines, issueDate, dueDate, ...rest } = input;
    return withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
      tx.invoice.create({
        data: {
          ...rest,
          organizationId: ctx.user.organizationId,
          societeId,
          createdById: ctx.user.id,
          issueDate: issueDate ? new Date(issueDate) : undefined,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          lines: { create: lines.map(lineData) },
        },
        include: { lines: true },
      })
    );
  }),

  update: authed('update', 'Invoice').input(invoiceUpdate).mutation(({ ctx, input }) => {
    const { id, lines, issueDate, dueDate, establishmentId, ...rest } = input;
    return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const inv = await tx.invoice.findUniqueOrThrow({ where: { id }, select: { status: true } });
      if (inv.status !== 'draft') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Une facture validée n\'est plus modifiable.' });
      if (lines) await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
      return tx.invoice.update({
        where: { id },
        data: {
          ...rest,
          ...(establishmentId !== undefined ? { establishmentId } : {}),
          ...(issueDate !== undefined ? { issueDate: issueDate ? new Date(issueDate) : null } : {}),
          ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
          ...(lines ? { lines: { create: lines.map(lineData) } } : {}),
        },
        include: { lines: true },
      });
    });
  }),

  /** Validation : attribue le numéro de façon atomique, fige le statut. */
  validate: authed('update', 'Invoice').input(byId).mutation(({ ctx, input }) => {
    const societeId = requireSociete(ctx.societeId);
    return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const inv = await tx.invoice.findUniqueOrThrow({ where: { id: input.id }, include: { lines: true } });
      if (inv.status !== 'draft') return inv;
      if (inv.lines.length === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ajoutez au moins une ligne avant de valider.' });
      const number = inv.number ?? (await nextDocumentNumber(tx, societeId, 'facture'));
      return tx.invoice.update({
        where: { id: input.id },
        data: { status: 'validated', number, issueDate: inv.issueDate ?? new Date() },
        include: { lines: true },
      });
    });
  }),

  /** Pas de suppression physique : on annule (statut cancelled). */
  cancel: authed('update', 'Invoice').input(byId).mutation(({ ctx, input }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
      tx.invoice.update({ where: { id: input.id }, data: { status: 'cancelled' } })
    )
  ),
});
