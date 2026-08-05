import { TRPCError } from '@trpc/server';
import { withTenant } from '@jampack/db';
import { timeEntryCreate, timeEntryUpdate, byId, timeEntryAmountHt } from '@jampack/domain';
import { router, authed } from '../trpc/trpc';
import { requireSociete, scope, n } from './salesRouter';

const dstr = (d: Date) => new Date(d).toISOString().slice(0, 10);

/**
 * Suivi du temps : temps passé rattaché à un client, facturable. `invoiceForCompany` génère une
 * facture brouillon à partir des temps ouverts + facturables d'un client (une ligne par temps).
 */
export const timeRouter = router({
  list: authed('read', 'Invoice').query(({ ctx }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const rows = await tx.timeEntry.findMany({
        where: scope(ctx.societeId),
        include: { company: { select: { name: true } } },
        orderBy: [{ date: 'desc' }],
      });
      return rows.map((e) => ({ ...e, amountHt: timeEntryAmountHt(e.minutes, n(e.hourlyRateHt)) }));
    })
  ),

  create: authed('create', 'Invoice').input(timeEntryCreate).mutation(({ ctx, input }) => {
    const societeId = requireSociete(ctx.societeId);
    return withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
      tx.timeEntry.create({
        data: {
          organizationId: ctx.user.organizationId, societeId, createdById: ctx.user.id, incurredById: ctx.user.id,
          date: new Date(input.date), description: input.description, minutes: input.minutes,
          companyId: input.companyId, opportunityId: input.opportunityId ?? null,
          hourlyRateHt: input.hourlyRateHt, billable: input.billable,
        },
      })
    );
  }),

  update: authed('update', 'Invoice').input(timeEntryUpdate).mutation(({ ctx, input }) => {
    const { id, date, ...rest } = input;
    return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const e = await tx.timeEntry.findUniqueOrThrow({ where: { id }, select: { status: true } });
      if (e.status !== 'open') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Temps déjà facturé : non modifiable.' });
      return tx.timeEntry.update({ where: { id }, data: { ...rest, ...(date !== undefined ? { date: new Date(date) } : {}) } });
    });
  }),

  remove: authed('update', 'Invoice').input(byId).mutation(({ ctx, input }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const e = await tx.timeEntry.findUniqueOrThrow({ where: { id: input.id }, select: { status: true } });
      if (e.status !== 'open') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Impossible de supprimer un temps facturé.' });
      return tx.timeEntry.delete({ where: { id: input.id } });
    })
  ),

  /** Facture brouillon depuis les temps ouverts + facturables d'un client (une ligne par temps). */
  invoiceForCompany: authed('create', 'Invoice').input(byId).mutation(({ ctx, input }) => {
    const societeId = requireSociete(ctx.societeId);
    return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const entries = await tx.timeEntry.findMany({ where: { ...scope(ctx.societeId), companyId: input.id, status: 'open', billable: true } });
      if (entries.length === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Aucun temps facturable pour ce client.' });
      const inv = await tx.invoice.create({
        data: {
          docType: 'facture', status: 'draft',
          organizationId: ctx.user.organizationId, societeId, companyId: input.id, createdById: ctx.user.id,
          notes: 'Facturation au temps',
          lines: {
            create: entries.map((e, i) => ({
              label: `${e.description} (${dstr(e.date)}, ${Math.floor(e.minutes / 60)}h${String(e.minutes % 60).padStart(2, '0')})`,
              quantity: Math.round((e.minutes / 60) * 1000) / 1000,
              unitPriceHt: n(e.hourlyRateHt),
              taxRatePct: 20,
              position: i,
            })),
          },
        },
      });
      await tx.timeEntry.updateMany({ where: { id: { in: entries.map((e) => e.id) } }, data: { status: 'invoiced', invoiceId: inv.id } });
      return { id: inv.id, count: entries.length };
    });
  }),
});
