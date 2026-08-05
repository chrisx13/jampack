import { TRPCError } from '@trpc/server';
import { withTenant } from '@jampack/db';
import { expenseCreate, expenseUpdate, byId, expenseCategoryAccount, expenseCategoryLabel, expensesCsv } from '@jampack/domain';
import { router, authed } from '../trpc/trpc';

const scope = (s: string | null) => (s ? { societeId: s } : {});
const n = (v: unknown) => Number(v as never);
const r2 = (v: number) => Math.round(v * 100) / 100;
function req(s: string | null): string {
  if (!s) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Sélectionnez une société.' });
  return s;
}

/** Trouve (ou crée) un compte PCG par code — évite d'exiger l'initialisation complète du plan. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureAccount(tx: any, orgId: string, societeId: string, code: string, name: string) {
  const found = await tx.account.findFirst({ where: { societeId, code } });
  if (found) return found;
  return tx.account.create({ data: { organizationId: orgId, societeId, code, name, class: Number(code[0]) } });
}

const ttcOf = (e: { amountHt: unknown; taxRatePct: unknown }) => {
  const ht = n(e.amountHt); const tva = r2(ht * (n(e.taxRatePct) / 100));
  return { ht: r2(ht), tva, ttc: r2(ht + tva) };
};

/** Notes de frais (dépenses salariés). Comptabilisation : charge (6xx) + TVA déductible (44566) ↔ 421. */
export const expensesRouter = router({
  list: authed('read', 'Accounting').query(({ ctx }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const rows = await tx.expense.findMany({
        where: scope(ctx.societeId),
        include: { incurredBy: { select: { name: true, email: true } } },
        orderBy: [{ date: 'desc' }],
      });
      return rows.map((e) => ({ ...e, ...ttcOf(e), categoryLabel: expenseCategoryLabel(e.category), posted: !!e.journalEntryId }));
    })
  ),

  /** Export CSV des notes de frais (Date ; Catégorie ; Description ; Salarié ; HT ; TVA ; TTC ; Statut). */
  exportCsv: authed('read', 'Accounting').query(({ ctx }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const rows = await tx.expense.findMany({
        where: scope(ctx.societeId),
        include: { incurredBy: { select: { name: true, email: true } } },
        orderBy: [{ date: 'desc' }],
      });
      const content = expensesCsv(rows.map((e) => {
        const t = ttcOf(e);
        return { date: e.date, category: expenseCategoryLabel(e.category), description: e.description, who: e.incurredBy?.name ?? e.incurredBy?.email ?? '', ht: t.ht, tva: t.tva, ttc: t.ttc, status: e.status };
      }));
      return { filename: 'notes-de-frais.csv', content };
    })
  ),

  create: authed('create', 'Accounting').input(expenseCreate).mutation(({ ctx, input }) => {
    const societeId = req(ctx.societeId);
    return withTenant(ctx.user.organizationId, ctx.societeId, (tx) =>
      tx.expense.create({
        data: {
          organizationId: ctx.user.organizationId, societeId, createdById: ctx.user.id,
          date: new Date(input.date), category: input.category, description: input.description,
          amountHt: input.amountHt, taxRatePct: input.taxRatePct,
          incurredById: input.incurredById ?? ctx.user.id,
        },
      })
    );
  }),

  update: authed('update', 'Accounting').input(expenseUpdate).mutation(({ ctx, input }) => {
    const { id, date, ...rest } = input;
    return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const e = await tx.expense.findUniqueOrThrow({ where: { id }, select: { status: true } });
      if (e.status !== 'draft') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Note de frais validée : non modifiable.' });
      return tx.expense.update({ where: { id }, data: { ...rest, ...(date !== undefined ? { date: new Date(date) } : {}) } });
    });
  }),

  remove: authed('update', 'Accounting').input(byId).mutation(({ ctx, input }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const e = await tx.expense.findUniqueOrThrow({ where: { id: input.id }, select: { status: true } });
      if (e.status !== 'draft') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Impossible de supprimer une note de frais validée.' });
      return tx.expense.delete({ where: { id: input.id } });
    })
  ),

  validate: authed('update', 'Accounting').input(byId).mutation(({ ctx, input }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.expense.update({ where: { id: input.id }, data: { status: 'validated' } }))
  ),

  markReimbursed: authed('update', 'Accounting').input(byId).mutation(({ ctx, input }) =>
    withTenant(ctx.user.organizationId, ctx.societeId, (tx) => tx.expense.update({ where: { id: input.id }, data: { status: 'reimbursed' } }))
  ),

  /** Comptabilise la note de frais : 6xx (charge HT) + 44566 (TVA déd.) au débit, 421 (dû au salarié) au crédit. */
  post: authed('create', 'Accounting').input(byId).mutation(({ ctx, input }) => {
    const societeId = req(ctx.societeId);
    return withTenant(ctx.user.organizationId, ctx.societeId, async (tx) => {
      const e = await tx.expense.findUniqueOrThrow({ where: { id: input.id }, include: { incurredBy: { select: { name: true, email: true } } } });
      if (e.status === 'draft') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Validez la note de frais avant de la comptabiliser.' });
      if (e.journalEntryId) return { id: e.journalEntryId, alreadyPosted: true };
      const t = ttcOf(e);
      const journal = await tx.journal.findFirst({ where: { ...scope(ctx.societeId), type: 'achat' } }) ?? await tx.journal.findFirst({ where: scope(ctx.societeId) });
      if (!journal) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Initialisez les journaux (Comptabilité ▸ Plan comptable).' });
      const charge = await ensureAccount(tx, ctx.user.organizationId, societeId, expenseCategoryAccount(e.category), expenseCategoryLabel(e.category));
      const tvaDed = await ensureAccount(tx, ctx.user.organizationId, societeId, '445660', 'TVA déductible');
      const perso = await ensureAccount(tx, ctx.user.organizationId, societeId, '421000', 'Personnel — rémunérations dues');
      const entry = await tx.journalEntry.create({
        data: {
          organizationId: ctx.user.organizationId, societeId, journalId: journal.id,
          date: e.date, reference: 'NDF', label: `Note de frais — ${e.description}`.slice(0, 120), createdById: ctx.user.id,
          lines: {
            create: [
              { accountId: charge.id, label: expenseCategoryLabel(e.category), debit: t.ht, credit: 0, position: 0 },
              ...(t.tva > 0 ? [{ accountId: tvaDed.id, label: 'TVA déductible', debit: t.tva, credit: 0, position: 1 }] : []),
              { accountId: perso.id, label: `Dû à ${e.incurredBy?.name ?? e.incurredBy?.email ?? 'salarié'}`, debit: 0, credit: t.ttc, position: 2 },
            ],
          },
        },
      });
      await tx.expense.update({ where: { id: e.id }, data: { journalEntryId: entry.id } });
      return { id: entry.id, alreadyPosted: false };
    });
  }),
});
