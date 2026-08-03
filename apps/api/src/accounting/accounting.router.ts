import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { withTenant } from '@jampack/db';
import { accountCreate, accountUpdate, journalCreate, journalEntryCreate, computeInvoiceTotals, byId, PCG_MINIMAL, JOURNAL_TYPES } from '@jampack/domain';
import { router, protectedProcedure, authed } from '../trpc/trpc';

const scope = (s: string | null) => (s ? { societeId: s } : {});
function req(s: string | null): string {
  if (!s) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Sélectionnez une société.' });
  return s;
}
const n = (v: unknown) => Number(v as never);
const classOf = (code: string) => Number(code[0]) || 0;

const DEFAULT_JOURNALS: { code: string; name: string; type: (typeof JOURNAL_TYPES)[number] }[] = [
  { code: 'VT', name: 'Ventes', type: 'vente' },
  { code: 'AC', name: 'Achats', type: 'achat' },
  { code: 'BQ', name: 'Banque', type: 'banque' },
  { code: 'OD', name: 'Opérations diverses', type: 'od' },
];

export const accountingRouter = router({
  // ── Plan comptable ──
  accounts: router({
    list: authed('read', 'Accounting').query(({ ctx }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.account.findMany({ where: scope(ctx.societeId), orderBy: { code: 'asc' } }))
    ),
    create: authed('manage', 'all').input(accountCreate).mutation(({ ctx, input }) => {
      const societeId = req(ctx.societeId);
      return withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
        tx.account.create({ data: { ...input, class: classOf(input.code), organizationId: ctx.user.organizationId, societeId } })
      );
    }),
    update: authed('manage', 'all').input(accountUpdate).mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
        tx.account.update({ where: { id }, data: { ...data, ...(data.code ? { class: classOf(data.code) } : {}) } })
      );
    }),
    /** Amorce le plan comptable minimal (PCG) si la société n'en a pas encore. */
    initPcg: authed('manage', 'all').mutation(({ ctx }) => {
      const societeId = req(ctx.societeId);
      return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
        const count = await tx.account.count({ where: scope(ctx.societeId) });
        if (count > 0) return { created: 0 };
        await tx.account.createMany({ data: PCG_MINIMAL.map((a) => ({ ...a, class: classOf(a.code), organizationId: ctx.user.organizationId, societeId })) });
        return { created: PCG_MINIMAL.length };
      });
    }),
  }),

  // ── Journaux ──
  journals: router({
    list: authed('read', 'Accounting').query(({ ctx }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.journal.findMany({ where: scope(ctx.societeId), orderBy: { code: 'asc' } }))
    ),
    create: authed('manage', 'all').input(journalCreate).mutation(({ ctx, input }) => {
      const societeId = req(ctx.societeId);
      return withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.journal.create({ data: { ...input, organizationId: ctx.user.organizationId, societeId } }));
    }),
    initDefaults: authed('manage', 'all').mutation(({ ctx }) => {
      const societeId = req(ctx.societeId);
      return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
        const count = await tx.journal.count({ where: scope(ctx.societeId) });
        if (count > 0) return { created: 0 };
        await tx.journal.createMany({ data: DEFAULT_JOURNALS.map((j) => ({ ...j, organizationId: ctx.user.organizationId, societeId })) });
        return { created: DEFAULT_JOURNALS.length };
      });
    }),
  }),

  // ── Écritures ──
  entries: router({
    list: authed('read', 'Accounting').input(z.object({ journalId: z.string().optional() }).optional()).query(({ ctx, input }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
        tx.journalEntry.findMany({
          where: { ...scope(ctx.societeId), ...(input?.journalId ? { journalId: input.journalId } : {}) },
          include: { journal: { select: { code: true } }, lines: { select: { debit: true, credit: true } } },
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          take: 200,
        })
      ).then((rows) =>
        rows.map((r) => ({ id: r.id, date: r.date, reference: r.reference, label: r.label, journal: r.journal, total: Math.round(r.lines.reduce((s, l) => s + n(l.debit), 0) * 100) / 100 }))
      )
    ),
    get: authed('read', 'Accounting').input(byId).query(({ ctx, input }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
        tx.journalEntry.findUniqueOrThrow({ where: { id: input.id }, include: { journal: true, lines: { include: { account: { select: { code: true, name: true } } }, orderBy: { position: 'asc' } } } })
      )
    ),
    create: authed('create', 'Accounting').input(journalEntryCreate).mutation(({ ctx, input }) => {
      const societeId = req(ctx.societeId);
      const { lines, date, ...rest } = input;
      return withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
        tx.journalEntry.create({
          data: {
            ...rest, organizationId: ctx.user.organizationId, societeId, createdById: ctx.user.id, date: new Date(date),
            lines: { create: lines.map((l, i) => ({ accountId: l.accountId, label: l.label, debit: l.debit ?? 0, credit: l.credit ?? 0, position: i })) },
          },
          include: { lines: true },
        })
      );
    }),
    remove: authed('manage', 'all').input(byId).mutation(({ ctx, input }) =>
      withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.journalEntry.delete({ where: { id: input.id } }))
    ),
  }),

  /** Balance générale : total débit/crédit et solde par compte. */
  balance: authed('read', 'Accounting').query(({ ctx }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const grouped = await tx.journalEntryLine.groupBy({ by: ['accountId'], where: { entry: { is: scope(ctx.societeId) } }, _sum: { debit: true, credit: true } });
      if (grouped.length === 0) return { rows: [], totalDebit: 0, totalCredit: 0 };
      const accounts = await tx.account.findMany({ where: scope(ctx.societeId), select: { id: true, code: true, name: true } });
      const aById = new Map(accounts.map((a) => [a.id, a]));
      const r2 = (v: number) => Math.round(v * 100) / 100;
      const rows = grouped
        .map((g) => {
          const debit = n(g._sum.debit), credit = n(g._sum.credit);
          return { accountId: g.accountId, code: aById.get(g.accountId)?.code ?? '—', name: aById.get(g.accountId)?.name ?? '—', debit: r2(debit), credit: r2(credit), solde: r2(debit - credit) };
        })
        .sort((a, b) => a.code.localeCompare(b.code));
      return { rows, totalDebit: r2(rows.reduce((s, r) => s + r.debit, 0)), totalCredit: r2(rows.reduce((s, r) => s + r.credit, 0)) };
    })
  ),

  /** Comptabilise une facture de vente : écriture au journal des ventes (411 débit TTC = 707 HT + 44571 TVA). */
  postSalesInvoice: authed('create', 'Accounting').input(byId).mutation(({ ctx, input }) => {
    const societeId = req(ctx.societeId);
    return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const inv = await tx.invoice.findUniqueOrThrow({ where: { id: input.id }, include: { lines: true, company: { select: { name: true } } } });
      if (inv.docType !== 'facture') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Seule une facture se comptabilise.' });
      if (inv.status === 'draft' || inv.status === 'cancelled') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Validez la facture avant de la comptabiliser.' });
      if (inv.journalEntryId) return { id: inv.journalEntryId, alreadyPosted: true };
      const totals = computeInvoiceTotals(inv.lines.map((l) => ({ quantity: n(l.quantity), unitPriceHt: n(l.unitPriceHt), taxRatePct: n(l.taxRatePct) })));
      const [journal, client, ventes, tva] = await Promise.all([
        tx.journal.findFirst({ where: { ...scope(ctx.societeId), type: 'vente' } }),
        tx.account.findFirst({ where: { ...scope(ctx.societeId), code: '411000' } }),
        tx.account.findFirst({ where: { ...scope(ctx.societeId), code: '707000' } }),
        tx.account.findFirst({ where: { ...scope(ctx.societeId), code: '445710' } }),
      ]);
      if (!journal || !client || !ventes || !tva) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Initialisez le plan comptable et les journaux (Comptabilité ▸ Plan comptable).' });
      const entry = await tx.journalEntry.create({
        data: {
          organizationId: ctx.user.organizationId, societeId, journalId: journal.id,
          date: inv.issueDate ?? new Date(), reference: inv.number, label: `Facture ${inv.number ?? ''} — ${inv.company?.name ?? ''}`.trim(), createdById: ctx.user.id,
          lines: {
            create: [
              { accountId: client.id, label: 'Client', debit: totals.totalTtc, credit: 0, position: 0 },
              { accountId: ventes.id, label: 'Ventes HT', debit: 0, credit: totals.totalHt, position: 1 },
              ...(totals.totalTva > 0 ? [{ accountId: tva.id, label: 'TVA collectée', debit: 0, credit: totals.totalTva, position: 2 }] : []),
            ],
          },
        },
      });
      await tx.invoice.update({ where: { id: inv.id }, data: { journalEntryId: entry.id } });
      return { id: entry.id, alreadyPosted: false };
    });
  }),

  /** Comptabilise un règlement client : journal de banque (512 débit = 411 crédit). */
  postPayment: authed('create', 'Accounting').input(byId).mutation(({ ctx, input }) => {
    const societeId = req(ctx.societeId);
    return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const p = await tx.payment.findUniqueOrThrow({ where: { id: input.id }, include: { invoice: { select: { number: true } } } });
      if (p.journalEntryId) return { id: p.journalEntryId, alreadyPosted: true };
      const [journal, banque, client] = await Promise.all([
        tx.journal.findFirst({ where: { ...scope(ctx.societeId), type: 'banque' } }),
        tx.account.findFirst({ where: { ...scope(ctx.societeId), code: '512000' } }),
        tx.account.findFirst({ where: { ...scope(ctx.societeId), code: '411000' } }),
      ]);
      if (!journal || !banque || !client) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Initialisez le plan comptable et les journaux.' });
      const amount = n(p.amount);
      const entry = await tx.journalEntry.create({
        data: {
          organizationId: ctx.user.organizationId, societeId, journalId: journal.id, date: p.date, reference: p.invoice?.number,
          label: `Règlement ${p.invoice?.number ?? ''}`.trim(), createdById: ctx.user.id,
          lines: { create: [
            { accountId: banque.id, label: 'Banque', debit: amount, credit: 0, position: 0 },
            { accountId: client.id, label: 'Client', debit: 0, credit: amount, position: 1 },
          ] },
        },
      });
      await tx.payment.update({ where: { id: p.id }, data: { journalEntryId: entry.id } });
      return { id: entry.id, alreadyPosted: false };
    });
  }),

  /** Comptabilise une facture fournisseur : journal d'achat (607 HT + 44566 TVA déd. = 401 TTC). */
  postSupplierInvoice: authed('create', 'Accounting').input(byId).mutation(({ ctx, input }) => {
    const societeId = req(ctx.societeId);
    return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const inv = await tx.supplierInvoice.findUniqueOrThrow({ where: { id: input.id }, include: { lines: true, supplier: { select: { name: true } } } });
      if (inv.status === 'draft' || inv.status === 'cancelled') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Validez la facture avant de la comptabiliser.' });
      if (inv.journalEntryId) return { id: inv.journalEntryId, alreadyPosted: true };
      const totals = computeInvoiceTotals(inv.lines.map((l) => ({ quantity: n(l.quantity), unitPriceHt: n(l.unitPriceHt), taxRatePct: n(l.taxRatePct) })));
      const [journal, achats, tvaDed, fourn] = await Promise.all([
        tx.journal.findFirst({ where: { ...scope(ctx.societeId), type: 'achat' } }),
        tx.account.findFirst({ where: { ...scope(ctx.societeId), code: '607000' } }),
        tx.account.findFirst({ where: { ...scope(ctx.societeId), code: '445660' } }),
        tx.account.findFirst({ where: { ...scope(ctx.societeId), code: '401000' } }),
      ]);
      if (!journal || !achats || !tvaDed || !fourn) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Initialisez le plan comptable et les journaux.' });
      const entry = await tx.journalEntry.create({
        data: {
          organizationId: ctx.user.organizationId, societeId, journalId: journal.id, date: inv.issueDate ?? new Date(), reference: inv.reference,
          label: `Facture fourn. ${inv.reference ?? ''} — ${inv.supplier?.name ?? ''}`.trim(), createdById: ctx.user.id,
          lines: {
            create: [
              { accountId: achats.id, label: 'Achats HT', debit: totals.totalHt, credit: 0, position: 0 },
              ...(totals.totalTva > 0 ? [{ accountId: tvaDed.id, label: 'TVA déductible', debit: totals.totalTva, credit: 0, position: 1 }] : []),
              { accountId: fourn.id, label: 'Fournisseur', debit: 0, credit: totals.totalTtc, position: 2 },
            ],
          },
        },
      });
      await tx.supplierInvoice.update({ where: { id: inv.id }, data: { journalEntryId: entry.id } });
      return { id: entry.id, alreadyPosted: false };
    });
  }),
});
